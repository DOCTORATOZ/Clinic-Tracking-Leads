import { NextResponse } from 'next/server';

/** Safe until OAuth credentials and the production adapter are provisioned. */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.CALENDAR_SYNC_ENABLED !== 'true') return NextResponse.json({ processed: 0, status: 'disabled', reason: 'Google OAuth credentials or sync flag are not configured' });
  return NextResponse.json({ processed: 0, status: 'blocked', reason: 'Install the production Google adapter before enabling sync.' }, { status: 503 });
}
