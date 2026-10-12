import { NextResponse } from 'next/server';
import { defaultUniloopBaseUrl } from '@/lib/uniloop-connection';

export function GET() {
  return NextResponse.json(
    { base_url: defaultUniloopBaseUrl() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
