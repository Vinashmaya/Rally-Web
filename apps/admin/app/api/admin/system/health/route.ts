import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — Return system health metrics
// In production this would query the VPS via SSH/API for real metrics
// For now, returns static data with the intent to wire real monitoring later
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;
    const health = {
      cpu: { used: 23, label: 'CPU Usage' },
      ram: { usedGB: 8.2, totalGB: 24, label: 'RAM Usage' },
      disk: { usedGB: 142, totalGB: 720, label: 'Disk Usage' },
      network: { avgMbps: 12, label: 'Network' },
      pm2: [
        { id: 'pm2-001', name: 'rally-staff', status: 'online', mode: 'cluster', instances: 4, cpuPercent: 12, memoryMB: 880, uptime: '3d 14h', restarts: 0 },
        { id: 'pm2-002', name: 'rally-manage', status: 'online', mode: 'cluster', instances: 2, cpuPercent: 5, memoryMB: 440, uptime: '3d 14h', restarts: 0 },
        { id: 'pm2-003', name: 'rally-admin', status: 'online', mode: 'fork', instances: 1, cpuPercent: 2, memoryMB: 210, uptime: '3d 14h', restarts: 0 },
        { id: 'pm2-004', name: 'rally-portal', status: 'online', mode: 'cluster', instances: 2, cpuPercent: 8, memoryMB: 360, uptime: '3d 14h', restarts: 0 },
      ],
      cronJobs: [
        { id: 'cron-001', name: 'Cleanup deprovisioned tenants', schedule: 'Daily at 3:00 AM', lastRun: '2026-02-24T03:00:00Z', nextRun: '2026-02-25T03:00:00Z', status: 'active' },
        { id: 'cron-002', name: 'Analytics rollup', schedule: 'Hourly', lastRun: '2026-02-24T09:00:00Z', nextRun: '2026-02-24T10:00:00Z', status: 'active' },
        { id: 'cron-003', name: 'SSL cert renewal check', schedule: 'Daily at 2:00 AM', lastRun: '2026-02-24T02:00:00Z', nextRun: '2026-02-25T02:00:00Z', status: 'active' },
        { id: 'cron-004', name: 'PM2 log rotation', schedule: 'Daily at midnight', lastRun: '2026-02-24T00:00:00Z', nextRun: '2026-02-25T00:00:00Z', status: 'active' },
      ],
      lastBroadcast: {
        message: 'Scheduled maintenance window: Feb 22 2:00-4:00 AM CST. Expect brief downtime.',
        timestamp: '2026-02-21T18:00:00Z',
      },
    } as const;

    return NextResponse.json({ success: true, data: health });
  } catch (error) {
    console.error('[API] System health error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// POST — Execute system actions (restart, stop, maintenance toggle)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { action, process: processName, enabled, message } = body as {
      action: 'restart' | 'stop' | 'maintenance' | 'broadcast';
      process?: string;
      enabled?: boolean;
      message?: string;
    };

    switch (action) {
      case 'restart':
        if (!processName) {
          return NextResponse.json({ error: 'Missing process name' }, { status: 400 });
        }
        // TODO: Wire to PM2 API on VPS
        console.log(`[System] Restart requested for: ${processName}`);
        return NextResponse.json({ success: true, data: { action: 'restart', process: processName } });

      case 'stop':
        if (!processName) {
          return NextResponse.json({ error: 'Missing process name' }, { status: 400 });
        }
        // TODO: Wire to PM2 API on VPS
        console.log(`[System] Stop requested for: ${processName}`);
        return NextResponse.json({ success: true, data: { action: 'stop', process: processName } });

      case 'maintenance':
        if (typeof enabled !== 'boolean') {
          return NextResponse.json({ error: 'Missing enabled boolean' }, { status: 400 });
        }
        // TODO: Wire to maintenance mode toggle
        console.log(`[System] Maintenance mode: ${enabled ? 'enabled' : 'disabled'}`);
        return NextResponse.json({ success: true, data: { action: 'maintenance', enabled } });

      case 'broadcast':
        if (!message) {
          return NextResponse.json({ error: 'Missing message' }, { status: 400 });
        }
        // TODO: Wire to real broadcast (Firestore or WebSocket)
        console.log(`[System] Broadcast: ${message}`);
        return NextResponse.json({ success: true, data: { action: 'broadcast', message } });

      default:
        return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] System action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
