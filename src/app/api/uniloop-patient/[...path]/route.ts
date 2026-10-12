import { NextRequest, NextResponse } from 'next/server';
import {
  patientEndpointAllowed,
  patientEndpointPublic,
} from '@/lib/enrollment-api-transport';
import {
  defaultUniloopBaseUrl,
  normalizeUniloopBaseUrl,
} from '@/lib/uniloop-connection';

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = `/${path.join('/')}`;
  if (
    path.some((part) => part === '.' || part === '..' || /[\\/]/.test(part)) ||
    !patientEndpointAllowed(endpoint, request.method)
  ) {
    return NextResponse.json(
      { message: 'Unsupported patient enrollment API operation.' },
      { status: 404 },
    );
  }
  const authorization = request.headers.get('authorization');
  if (
    !patientEndpointPublic(endpoint) &&
    !authorization?.startsWith('Bearer ')
  ) {
    return NextResponse.json(
      {
        message:
          'Verify the patient with OTP before using this enrollment action.',
      },
      { status: 401 },
    );
  }
  let base: string;
  try {
    const selected = request.headers.get('x-uniloop-base-url');
    base = selected
      ? normalizeUniloopBaseUrl(selected)
      : defaultUniloopBaseUrl();
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Invalid Uniloop base URL.',
      },
      { status: 400 },
    );
  }
  const url = new URL(`${base}/${path.map(encodeURIComponent).join('/')}`);
  url.search = request.nextUrl.search;
  const headers = new Headers({ Accept: 'application/json' });
  if (authorization) headers.set('Authorization', authorization);
  for (const name of ['content-type', 'idempotency-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(60000),
    });
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        {
          message:
            'The patient API redirected. Check that the base URL is the merchant’s enrollment domain.',
        },
        { status: 502 },
      );
    }
    if (response.status === 419) {
      return NextResponse.json(
        {
          message:
            'This Uniloop endpoint requires a hosted session/CSRF token. The backend must support patient bearer authentication for this action to run locally.',
        },
        { status: 419 },
      );
    }
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        message: `Unable to reach the patient API at ${base}. Check the saved Uniloop base URL.`,
      },
      { status: 502 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};
