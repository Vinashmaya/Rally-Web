import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  adminDb,
  FieldValue,
  requireSuperAdmin,
  isVerifiedSession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// BRIDGE / SYNC — System health route
//
// GET — Returns real metrics from the host:
//   - CPU/RAM via Node `os` module
//   - Disk via `fs.statfs` (Node 18+) → fallback to `df -BG /`
//   - Network: not measured cleanly without /proc parsing → null
//   - PM2: parses `~/.pm2/dump.pm2` first, falls back to `pm2 jlist`
//   - Cron jobs: dashboard mirror — read from Firestore `system/cron`. The
//     real schedules live in the host crontab (configured externally on the
//     VPS). This page is a status mirror, not a control plane.
//   - Last broadcast: read from Firestore `system/broadcast`
//
// Any failed read is reported in `errors[]`, the rest of the payload is still
// returned. Super admins want a partial view, not a 500.
//
// POST — Real PM2 actions + Firestore-backed maintenance/broadcast.
//   maintenance contract: writes to `system/config` doc field `maintenance`
//     and standalone doc `system/maintenance`. Apps subscribe to
//     `system/maintenance` and render a banner / 503 page when
//     `enabled === true`. (Banner UI lives in next sprint.)
//   broadcast contract: writes to `system/broadcast` — same subscription
//     pattern. `expiresAt` optional, ISO string.
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

const KNOWN_PM2_PROCESSES = ['rally-staff', 'rally-manage', 'rally-admin', 'rally-portal'] as const;
type KnownProcess = (typeof KNOWN_PM2_PROCESSES)[number];

function isKnownProcess(name: string): name is KnownProcess {
  return (KNOWN_PM2_PROCESSES as readonly string[]).includes(name);
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------

interface CpuMetric {
  used: number; // 0-100 percentage (best-effort load avg / cores)
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  cores: number;
  label: string;
}

function readCpu(): CpuMetric {
  const cores = os.cpus().length;
  // os.loadavg() always returns a 3-tuple at runtime, but with
  // noUncheckedIndexedAccess each element is typed `number | undefined`.
  // Default to 0 if any value is missing (shouldn't happen in practice).
  const loadavg = os.loadavg();
  const load1 = loadavg[0] ?? 0;
  const load5 = loadavg[1] ?? 0;
  const load15 = loadavg[2] ?? 0;
  // Convert load average → approximate utilization percent.
  // load1 == cores  → ~100% utilization.
  const used = Math.min(100, Math.round((load1 / Math.max(cores, 1)) * 100));
  return {
    used,
    loadAvg1: Number(load1.toFixed(2)),
    loadAvg5: Number(load5.toFixed(2)),
    loadAvg15: Number(load15.toFixed(2)),
    cores,
    label: 'CPU Usage',
  };
}

// ---------------------------------------------------------------------------
// RAM
// ---------------------------------------------------------------------------

interface RamMetric {
  usedGB: number;
  totalGB: number;
  freeGB: number;
  label: string;
}

function readRam(): RamMetric {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const toGB = (bytes: number): number => Number((bytes / 1024 ** 3).toFixed(2));
  return {
    usedGB: toGB(used),
    freeGB: toGB(free),
    totalGB: toGB(total),
    label: 'RAM Usage',
  };
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

interface DiskMetric {
  usedGB: number;
  totalGB: number;
  freeGB: number;
  label: string;
}

async function readDisk(): Promise<DiskMetric> {
  // Try fs.statfs first (Node 18+)
  try {
    const fsPromises = await import('node:fs/promises');
    // statfs is available on Node 19+; cast for type-safety where missing
    const fp = fsPromises as typeof fsPromises & {
      statfs?: (p: string) => Promise<{ blocks: bigint | number; bfree: bigint | number; bsize: bigint | number }>;
    };
    if (typeof fp.statfs === 'function') {
      const stat = await fp.statfs('/');
      const blocks = Number(stat.blocks);
      const bfree = Number(stat.bfree);
      const bsize = Number(stat.bsize);
      const total = blocks * bsize;
      const free = bfree * bsize;
      const used = total - free;
      const toGB = (bytes: number): number => Number((bytes / 1024 ** 3).toFixed(1));
      return {
        usedGB: toGB(used),
        freeGB: toGB(free),
        totalGB: toGB(total),
        label: 'Disk Usage',
      };
    }
  } catch {
    // fall through to df
  }

  // Fallback: df -BG /
  const { stdout } = await execFileAsync('df', ['-BG', '/'], { timeout: 2000 });
  // Filesystem 1G-blocks Used Available Use% Mounted on
  // /dev/sda1     720G       142G  578G    20%  /
  const lines = stdout.trim().split('\n');
  const parts = lines[lines.length - 1]!.split(/\s+/);
  const totalGB = parseInt(parts[1]!.replace(/G$/, ''), 10);
  const usedGB = parseInt(parts[2]!.replace(/G$/, ''), 10);
  const freeGB = parseInt(parts[3]!.replace(/G$/, ''), 10);
  return { usedGB, freeGB, totalGB, label: 'Disk Usage' };
}

// ---------------------------------------------------------------------------
// PM2
// ---------------------------------------------------------------------------

interface PM2ProcessSummary {
  id: string;
  name: string;
  status: 'online' | 'stopped' | 'errored' | 'launching' | 'stopping';
  mode: 'cluster' | 'fork';
  instances: number;
  cpuPercent: number;
  memoryMB: number;
  uptime: string;
  restarts: number;
}

interface PM2DumpEntry {
  name?: string;
  pm_id?: number;
  pid?: number;
  pm2_env?: {
    status?: string;
    exec_mode?: string;
    instances?: number | string;
    pm_uptime?: number;
    restart_time?: number;
  };
  monit?: { cpu?: number; memory?: number };
}

function formatUptime(pmUptime?: number): string {
  if (!pmUptime || pmUptime <= 0) return '—';
  const ms = Date.now() - pmUptime;
  if (ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${sec}s`;
}

function normalizePm2Entry(e: PM2DumpEntry, idx: number): PM2ProcessSummary {
  const env = e.pm2_env ?? {};
  const monit = e.monit ?? {};
  const status = (env.status ?? 'stopped') as PM2ProcessSummary['status'];
  const mode: PM2ProcessSummary['mode'] = env.exec_mode === 'cluster_mode' ? 'cluster' : 'fork';
  const instances = typeof env.instances === 'number' ? env.instances : 1;
  return {
    id: `pm2-${e.pm_id ?? idx}`,
    name: e.name ?? `process-${idx}`,
    status,
    mode,
    instances,
    cpuPercent: typeof monit.cpu === 'number' ? Math.round(monit.cpu) : 0,
    memoryMB: typeof monit.memory === 'number' ? Math.round(monit.memory / (1024 * 1024)) : 0,
    uptime: formatUptime(env.pm_uptime),
    restarts: typeof env.restart_time === 'number' ? env.restart_time : 0,
  };
}

async function readPm2(): Promise<PM2ProcessSummary[] | null> {
  // 1) Try the dump file. Most reliable, no spawn cost.
  const dumpPath = path.join(os.homedir(), '.pm2', 'dump.pm2');
  try {
    const raw = await readFile(dumpPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry, i) => normalizePm2Entry(entry as PM2DumpEntry, i));
    }
  } catch {
    // fall through
  }

  // 2) Fall back to `pm2 jlist`
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: 4000 });
    const parsed = JSON.parse(stdout) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry, i) => normalizePm2Entry(entry as PM2DumpEntry, i));
    }
  } catch {
    // PM2 not installed (local dev) or call failed
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cron + broadcast (Firestore)
// ---------------------------------------------------------------------------

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  status: 'active' | 'paused' | 'error';
}

const DEFAULT_CRON_JOBS: readonly CronJob[] = [
  {
    id: 'cron-001',
    name: 'Cleanup deprovisioned tenants',
    schedule: 'Daily at 3:00 AM',
    lastRun: null,
    nextRun: null,
    status: 'active',
  },
  {
    id: 'cron-002',
    name: 'Analytics rollup',
    schedule: 'Hourly',
    lastRun: null,
    nextRun: null,
    status: 'active',
  },
  {
    id: 'cron-003',
    name: 'SSL cert renewal check',
    schedule: 'Daily at 2:00 AM',
    lastRun: null,
    nextRun: null,
    status: 'active',
  },
  {
    id: 'cron-004',
    name: 'PM2 log rotation',
    schedule: 'Daily at midnight',
    lastRun: null,
    nextRun: null,
    status: 'active',
  },
] as const;

async function readCronJobs(): Promise<CronJob[]> {
  // Doc lives at `system/cron`. Field `jobs` is an array of CronJob.
  // If missing, seed with the four expected jobs and return them.
  const ref = adminDb.collection('system').doc('cron');
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      jobs: DEFAULT_CRON_JOBS,
      seededAt: FieldValue.serverTimestamp(),
      note: 'Dashboard mirror only — actual schedules configured in host crontab.',
    });
    return [...DEFAULT_CRON_JOBS];
  }
  const data = snap.data();
  const jobs = Array.isArray(data?.jobs) ? (data!.jobs as CronJob[]) : [];
  return jobs.length > 0 ? jobs : [...DEFAULT_CRON_JOBS];
}

interface BroadcastInfo {
  message: string;
  timestamp: string;
  expiresAt?: string;
}

async function readLastBroadcast(): Promise<BroadcastInfo | null> {
  const ref = adminDb.collection('system').doc('broadcast');
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data || typeof data.message !== 'string') return null;
  // Firestore Timestamp → ISO
  let timestamp = new Date().toISOString();
  if (data.since && typeof (data.since as { toDate?: () => Date }).toDate === 'function') {
    timestamp = (data.since as { toDate: () => Date }).toDate().toISOString();
  } else if (typeof data.since === 'string') {
    timestamp = data.since;
  }
  let expiresAt: string | undefined;
  if (data.expiresAt && typeof (data.expiresAt as { toDate?: () => Date }).toDate === 'function') {
    expiresAt = (data.expiresAt as { toDate: () => Date }).toDate().toISOString();
  } else if (typeof data.expiresAt === 'string') {
    expiresAt = data.expiresAt;
  }
  return { message: data.message, timestamp, expiresAt };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const errors: string[] = [];

    // CPU + RAM never throw — pure os calls
    const cpu = readCpu();
    const ram = readRam();

    let disk: DiskMetric | null = null;
    try {
      disk = await readDisk();
    } catch (err) {
      errors.push(`disk: ${err instanceof Error ? err.message : String(err)}`);
    }

    let pm2: PM2ProcessSummary[] | null = null;
    try {
      pm2 = await readPm2();
      if (pm2 === null) {
        errors.push('pm2: not available on this host (local dev or PM2 not installed)');
      }
    } catch (err) {
      errors.push(`pm2: ${err instanceof Error ? err.message : String(err)}`);
    }

    let cronJobs: CronJob[] = [];
    try {
      cronJobs = await readCronJobs();
    } catch (err) {
      errors.push(`cron: ${err instanceof Error ? err.message : String(err)}`);
    }

    let lastBroadcast: BroadcastInfo | null = null;
    try {
      lastBroadcast = await readLastBroadcast();
    } catch (err) {
      errors.push(`broadcast: ${err instanceof Error ? err.message : String(err)}`);
    }

    let maintenance: { enabled: boolean } = { enabled: false };
    try {
      const snap = await adminDb.collection('system').doc('maintenance').get();
      if (snap.exists) {
        const d = snap.data();
        maintenance = { enabled: Boolean(d?.enabled) };
      }
    } catch (err) {
      errors.push(`maintenance: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Network: no clean cross-platform metric without /proc parsing.
    // Returning null is honest — UI can show "—" rather than fake data.
    const network: { avgMbps: number | null; label: string } = {
      avgMbps: null,
      label: 'Network',
    };

    return NextResponse.json({
      success: true,
      data: {
        cpu,
        ram,
        disk,
        network,
        pm2,
        cronJobs,
        lastBroadcast,
        maintenance,
        host: { hostname: os.hostname(), platform: os.platform(), uptimeSeconds: Math.floor(os.uptime()) },
        errors,
      },
    });
  } catch (error) {
    console.error('[API] System health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Zod-validated action dispatch
// ---------------------------------------------------------------------------

const restartStopSchema = z.object({
  action: z.enum(['restart', 'stop']),
  process: z.enum(KNOWN_PM2_PROCESSES),
});

const maintenanceSchema = z.object({
  action: z.literal('maintenance'),
  enabled: z.boolean(),
});

const broadcastSchema = z.object({
  action: z.literal('broadcast'),
  message: z.string().min(1).max(500),
  expiresAt: z.string().datetime().optional(),
});

const postBodySchema = z.union([restartStopSchema, maintenanceSchema, broadcastSchema]);

async function writeAuditLog(
  actorUid: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await adminDb.collection('auditLogs').add({
      action,
      actorId: actorUid,
      actorType: 'super-admin',
      targetType: 'system',
      timestamp: FieldValue.serverTimestamp(),
      metadata,
    });
  } catch (err) {
    console.error('[API] audit log write failed:', err);
  }
}

async function runPm2Command(cmd: 'reload' | 'stop', name: KnownProcess): Promise<string> {
  // execFile (not exec) — args are passed as an array, never a string. This
  // means even if `name` somehow bypassed validation it cannot inject a shell.
  const { stdout, stderr } = await execFileAsync('pm2', [cmd, name], { timeout: 15000 });
  return [stdout, stderr].filter(Boolean).join('\n').trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const rawBody = (await request.json()) as unknown;
    const parsed = postBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;

    switch (body.action) {
      case 'restart': {
        // Defense-in-depth: the schema already restricts to known processes.
        if (!isKnownProcess(body.process)) {
          return NextResponse.json({ error: 'Unknown process' }, { status: 400 });
        }
        try {
          const output = await runPm2Command('reload', body.process);
          await writeAuditLog(auth.uid, 'system.process.restart', { process: body.process });
          return NextResponse.json({
            success: true,
            data: { action: 'restart', process: body.process, output },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'pm2 reload failed';
          return NextResponse.json(
            { error: `pm2 reload failed: ${message}`, hint: 'PM2 may not be available on this host.' },
            { status: 500 },
          );
        }
      }

      case 'stop': {
        if (!isKnownProcess(body.process)) {
          return NextResponse.json({ error: 'Unknown process' }, { status: 400 });
        }
        try {
          const output = await runPm2Command('stop', body.process);
          await writeAuditLog(auth.uid, 'system.process.stop', { process: body.process });
          return NextResponse.json({
            success: true,
            data: { action: 'stop', process: body.process, output },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'pm2 stop failed';
          return NextResponse.json(
            { error: `pm2 stop failed: ${message}`, hint: 'PM2 may not be available on this host.' },
            { status: 500 },
          );
        }
      }

      case 'maintenance': {
        // CONTRACT (next sprint UI work):
        //   Apps subscribe to `system/maintenance` doc. When `enabled === true`,
        //   the staff/manage/portal apps render a maintenance banner. The portal
        //   middleware can additionally return a 503 page on tenant routes.
        //   Super admin app remains accessible regardless.
        await adminDb
          .collection('system')
          .doc('maintenance')
          .set(
            {
              enabled: body.enabled,
              since: FieldValue.serverTimestamp(),
              setBy: auth.uid,
            },
            { merge: true },
          );
        await writeAuditLog(auth.uid, 'system.maintenance.toggle', { enabled: body.enabled });
        return NextResponse.json({
          success: true,
          data: { action: 'maintenance', enabled: body.enabled },
        });
      }

      case 'broadcast': {
        // CONTRACT: same subscription pattern as maintenance — apps listen to
        //   `system/broadcast` and render a banner with `message`. Set
        //   expiresAt to auto-clear; otherwise the banner shows until the
        //   message is overwritten or `enabled: false` is written.
        await adminDb
          .collection('system')
          .doc('broadcast')
          .set(
            {
              message: body.message,
              since: FieldValue.serverTimestamp(),
              setBy: auth.uid,
              ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}),
            },
            { merge: false },
          );
        await writeAuditLog(auth.uid, 'system.broadcast', { messagePreview: body.message.slice(0, 80) });
        return NextResponse.json({
          success: true,
          data: { action: 'broadcast', message: body.message },
        });
      }
    }
  } catch (error) {
    console.error('[API] System action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
