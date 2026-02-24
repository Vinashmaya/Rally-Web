import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'rally-staff',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
