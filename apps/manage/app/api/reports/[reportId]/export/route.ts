import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getAdminDb,
  requireAuth,
  isVerifiedSession,
} from '@rally/firebase/admin';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GM-or-better roles permitted to export. Super admins also pass.
// ---------------------------------------------------------------------------

const EXPORT_ALLOWED_ROLES = new Set<string>([
  'owner',
  'general_manager',
  'sales_manager',
  'service_manager',
  'finance_manager',
]);

// ---------------------------------------------------------------------------
// Query schema — `?format=csv|pdf&start=YYYY-MM-DD&end=YYYY-MM-DD`
// ---------------------------------------------------------------------------

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']).default('csv'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ---------------------------------------------------------------------------
// Report registry
// ---------------------------------------------------------------------------

interface ReportRow {
  [key: string]: string | number | null;
}

interface ReportColumn {
  key: string;
  header: string;
  width?: number;
}

interface ReportDefinition {
  id: string;
  title: string;
  columns: ReportColumn[];
  fetch: (ctx: ReportContext) => Promise<ReportRow[]>;
}

interface ReportContext {
  groupId: string;
  dealershipId: string | null;
  start: Date | null;
  end: Date | null;
}

// ---------------------------------------------------------------------------
// Firestore helpers — small, defensive readers. We don't assume the data
// model is bug-free, so missing fields fall back to '' rather than crashing.
// ---------------------------------------------------------------------------

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp object
  if (typeof v === 'object' && v !== null && '_seconds' in v) {
    const seconds = (v as { _seconds: number })._seconds;
    return new Date(seconds * 1000);
  }
  return null;
}

function daysBetween(a: Date | null, b: Date): number {
  if (!a) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const REPORTS: Record<string, ReportDefinition> = {
  'inventory-summary': {
    id: 'inventory-summary',
    title: 'Inventory Summary',
    columns: [
      { key: 'stockNumber', header: 'Stock #', width: 80 },
      { key: 'vin', header: 'VIN', width: 130 },
      { key: 'year', header: 'Year', width: 50 },
      { key: 'make', header: 'Make', width: 70 },
      { key: 'model', header: 'Model', width: 90 },
      { key: 'status', header: 'Status', width: 70 },
      { key: 'daysOnLot', header: 'Days', width: 50 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      let query = db.collection('vehicles').where('groupId', '==', ctx.groupId);
      if (ctx.dealershipId) {
        query = query.where('dealershipId', '==', ctx.dealershipId);
      }
      const snap = await query.limit(5000).get();
      const today = new Date();
      return snap.docs.map((doc) => {
        const d = doc.data();
        return {
          stockNumber: asString(d.stockNumber ?? doc.id),
          vin: asString(d.vin ?? doc.id),
          year: asNumber(d.year),
          make: asString(d.make),
          model: asString(d.model),
          status: asString(d.status),
          daysOnLot: daysBetween(asDate(d.intakeAt ?? d.createdAt), today),
        };
      });
    },
  },
  'aging-alert': {
    id: 'aging-alert',
    title: 'Aging Alert',
    columns: [
      { key: 'stockNumber', header: 'Stock #', width: 80 },
      { key: 'vin', header: 'VIN', width: 130 },
      { key: 'year', header: 'Year', width: 50 },
      { key: 'make', header: 'Make', width: 70 },
      { key: 'model', header: 'Model', width: 90 },
      { key: 'daysOnLot', header: 'Days', width: 50 },
      { key: 'status', header: 'Status', width: 70 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      let query = db.collection('vehicles').where('groupId', '==', ctx.groupId);
      if (ctx.dealershipId) {
        query = query.where('dealershipId', '==', ctx.dealershipId);
      }
      const snap = await query.limit(5000).get();
      const today = new Date();
      return snap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            stockNumber: asString(d.stockNumber ?? doc.id),
            vin: asString(d.vin ?? doc.id),
            year: asNumber(d.year),
            make: asString(d.make),
            model: asString(d.model),
            status: asString(d.status),
            daysOnLot: daysBetween(asDate(d.intakeAt ?? d.createdAt), today),
          };
        })
        .filter((row) => Number(row.daysOnLot) >= 60)
        .sort((a, b) => Number(b.daysOnLot) - Number(a.daysOnLot));
    },
  },
  'activity-report': {
    id: 'activity-report',
    title: 'Activity Report',
    columns: [
      { key: 'timestamp', header: 'Timestamp', width: 130 },
      { key: 'type', header: 'Type', width: 90 },
      { key: 'vehicleStock', header: 'Stock #', width: 80 },
      { key: 'userName', header: 'User', width: 110 },
      { key: 'notes', header: 'Notes', width: 200 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      let query = db
        .collection('activities')
        .where('groupId', '==', ctx.groupId);
      if (ctx.dealershipId) {
        query = query.where('dealershipId', '==', ctx.dealershipId);
      }
      if (ctx.start) {
        query = query.where('timestamp', '>=', ctx.start);
      }
      if (ctx.end) {
        query = query.where('timestamp', '<=', ctx.end);
      }
      const snap = await query.limit(5000).get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        const ts = asDate(d.timestamp ?? d.createdAt);
        return {
          timestamp: ts ? ts.toISOString() : '',
          type: asString(d.type ?? d.activityType),
          vehicleStock: asString(d.vehicleStock ?? d.stockNumber),
          userName: asString(d.userName ?? d.userDisplayName ?? d.userId),
          notes: asString(d.notes ?? d.description),
        };
      });
    },
  },
  'sales-performance': {
    id: 'sales-performance',
    title: 'Sales Performance',
    columns: [
      { key: 'salesperson', header: 'Salesperson', width: 130 },
      { key: 'unitsSold', header: 'Units', width: 60 },
      { key: 'testDrives', header: 'Test Drives', width: 90 },
      { key: 'avgDaysToClose', header: 'Avg Days', width: 80 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      let query = db
        .collection('activities')
        .where('groupId', '==', ctx.groupId);
      if (ctx.dealershipId) {
        query = query.where('dealershipId', '==', ctx.dealershipId);
      }
      if (ctx.start) {
        query = query.where('timestamp', '>=', ctx.start);
      }
      if (ctx.end) {
        query = query.where('timestamp', '<=', ctx.end);
      }
      const snap = await query.limit(10000).get();

      // Aggregate by user
      const buckets = new Map<string, { name: string; units: number; testDrives: number }>();
      for (const doc of snap.docs) {
        const d = doc.data();
        const userId = asString(d.userId ?? d.userUid ?? 'unknown');
        const name = asString(d.userName ?? d.userDisplayName ?? userId);
        const bucket = buckets.get(userId) ?? { name, units: 0, testDrives: 0 };
        const type = asString(d.type ?? d.activityType);
        if (type === 'sale' || type === 'sold') bucket.units += 1;
        if (type === 'test_drive' || type === 'testDrive') bucket.testDrives += 1;
        buckets.set(userId, bucket);
      }

      return Array.from(buckets.values())
        .map((b) => ({
          salesperson: b.name,
          unitsSold: b.units,
          testDrives: b.testDrives,
          avgDaysToClose: 0, // Placeholder — real calc requires deal docs
        }))
        .sort((a, b) => Number(b.unitsSold) - Number(a.unitsSold));
    },
  },
  'staff-report': {
    id: 'staff-report',
    title: 'Staff Report',
    columns: [
      { key: 'displayName', header: 'Name', width: 130 },
      { key: 'role', header: 'Role', width: 110 },
      { key: 'status', header: 'Status', width: 70 },
      { key: 'lastActiveAt', header: 'Last Active', width: 130 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      const snap = await db
        .collectionGroup('memberships')
        .where('groupId', '==', ctx.groupId)
        .limit(2000)
        .get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        return {
          displayName: asString(d.displayName ?? d.employeeUid ?? doc.id),
          role: asString(d.role),
          status: asString(d.status ?? 'active'),
          lastActiveAt: (() => {
            const ts = asDate(d.lastActiveAt);
            return ts ? ts.toISOString() : '';
          })(),
        };
      });
    },
  },
  'hold-report': {
    id: 'hold-report',
    title: 'Hold Report',
    columns: [
      { key: 'stockNumber', header: 'Stock #', width: 80 },
      { key: 'vin', header: 'VIN', width: 130 },
      { key: 'holdReason', header: 'Reason', width: 120 },
      { key: 'heldBy', header: 'Held By', width: 110 },
      { key: 'expiresAt', header: 'Expires', width: 130 },
    ],
    fetch: async (ctx) => {
      const db = getAdminDb();
      let query = db
        .collection('vehicles')
        .where('groupId', '==', ctx.groupId)
        .where('subStatus', '==', 'on_hold');
      if (ctx.dealershipId) {
        query = query.where('dealershipId', '==', ctx.dealershipId);
      }
      const snap = await query.limit(5000).get();
      return snap.docs.map((doc) => {
        const d = doc.data();
        const expires = asDate(d.holdExpiresAt);
        return {
          stockNumber: asString(d.stockNumber ?? doc.id),
          vin: asString(d.vin ?? doc.id),
          holdReason: asString(d.holdReason ?? d.holdNote),
          heldBy: asString(d.holdBy ?? d.heldBy),
          expiresAt: expires ? expires.toISOString() : '',
        };
      });
    },
  },
} as const;

// ---------------------------------------------------------------------------
// CSV writer — RFC-4180 compliant escaping. Quotes a field if it contains
// `,`, `"`, `\n`, or `\r`; doubles embedded `"`.
// ---------------------------------------------------------------------------

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(report: ReportDefinition, rows: ReportRow[]): string {
  const headerLine = report.columns.map((c) => csvEscape(c.header)).join(',');
  const dataLines = rows.map((row) =>
    report.columns.map((c) => csvEscape(row[c.key] ?? '')).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// PDF writer — minimal table layout (header, rows, footer with page count).
// ---------------------------------------------------------------------------

async function buildPdf(
  report: ReportDefinition,
  rows: ReportRow[],
  meta: { groupId: string; dealershipId: string | null; generatedAt: Date },
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 48, bottom: 48, left: 36, right: 36 },
        // bufferPages required for switchToPage() in the footer pass
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ──
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#000');
      doc.text(`Rally — ${report.title}`, { align: 'left' });
      doc.moveDown(0.2);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555')
        .text(
          `Group: ${meta.groupId}${meta.dealershipId ? ` · Store: ${meta.dealershipId}` : ''} · Generated ${meta.generatedAt.toISOString()}`,
        );
      doc.moveDown(0.6);

      // ── Table header ──
      const startX = doc.page.margins.left;
      let y = doc.y;
      const colWidths = report.columns.map((c) => c.width ?? 80);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
      let x = startX;
      report.columns.forEach((col, i) => {
        doc.text(col.header, x, y, { width: colWidths[i], ellipsis: true });
        x += colWidths[i] ?? 80;
      });
      y += 16;
      doc
        .moveTo(startX, y - 4)
        .lineTo(
          startX + colWidths.reduce((a, b) => a + b, 0),
          y - 4,
        )
        .strokeColor('#888')
        .lineWidth(0.5)
        .stroke();

      // ── Rows ──
      doc.font('Helvetica').fontSize(8).fillColor('#222');
      const pageBottom = doc.page.height - doc.page.margins.bottom - 24;
      for (const row of rows) {
        if (y > pageBottom) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        x = startX;
        report.columns.forEach((col, i) => {
          const v = row[col.key];
          doc.text(v == null ? '' : String(v), x, y, {
            width: colWidths[i],
            ellipsis: true,
            lineBreak: false,
          });
          x += colWidths[i] ?? 80;
        });
        y += 14;
      }

      // ── Footer ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#888')
          .text(
            `Page ${i + 1} of ${range.count} · ${rows.length} rows`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom + 8,
            {
              width:
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
              align: 'center',
            },
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// GET — export a report as CSV or PDF
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (!isVerifiedSession(auth)) return auth;

    // Role check — super admins always pass via isSuperAdmin
    if (
      !auth.isSuperAdmin &&
      (!auth.role || !EXPORT_ALLOWED_ROLES.has(auth.role))
    ) {
      return NextResponse.json(
        { error: 'Forbidden: report export requires manager role' },
        { status: 403 },
      );
    }

    if (!auth.groupId && !auth.isSuperAdmin) {
      return NextResponse.json(
        { error: 'No group context on session' },
        { status: 400 },
      );
    }

    const { reportId } = await params;
    const report = REPORTS[reportId];
    if (!report) {
      return NextResponse.json(
        { error: `Unknown report: ${reportId}` },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const parsed = exportQuerySchema.safeParse({
      format: url.searchParams.get('format') ?? 'csv',
      start: url.searchParams.get('start') ?? undefined,
      end: url.searchParams.get('end') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { format, start, end } = parsed.data;

    const ctx: ReportContext = {
      groupId: auth.groupId ?? '',
      dealershipId: auth.dealershipId ?? null,
      start: start ? new Date(`${start}T00:00:00.000Z`) : null,
      end: end ? new Date(`${end}T23:59:59.999Z`) : null,
    };

    const rows = await report.fetch(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `${report.id}-${today}.${format}`;

    if (format === 'csv') {
      const csv = buildCsv(report, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // PDF
    const pdfBuffer = await buildPdf(report, rows, {
      groupId: ctx.groupId,
      dealershipId: ctx.dealershipId,
      generatedAt: new Date(),
    });
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[API] Report export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
