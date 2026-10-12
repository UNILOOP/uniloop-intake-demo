import { NextRequest, NextResponse } from 'next/server';
import paths from '@/lib/merchant-api-paths.json';
import {
  defaultUniloopBaseUrl,
  normalizeUniloopBaseUrl,
  merchantPermissionHint,
} from '@/lib/uniloop-connection';

const allowed = Object.entries(paths).map(([path, methods]) => ({
  pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`),
  methods,
}));

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join('/');
  if (
    path.some((part) => part === '.' || part === '..' || /[\\/]/.test(part)) ||
    !allowed.some(
      (route) =>
        route.pattern.test(endpoint) &&
        route.methods.includes(request.method.toLowerCase()),
    )
  ) {
    return NextResponse.json(
      { message: 'Unsupported merchant API operation.' },
      { status: 404 },
    );
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json(
      { message: 'Enter a Uniloop merchant token.' },
      { status: 401 },
    );
  }
  let base: string;
  try {
    base = request.headers.get('x-uniloop-base-url')
      ? normalizeUniloopBaseUrl(request.headers.get('x-uniloop-base-url')!)
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
  const url = new URL(
    `${base.replace(/\/$/, '')}/api/v1/merchant/${path.map(encodeURIComponent).join('/')}`,
  );
  url.search = request.nextUrl.search;
  const headers = new Headers({
    Authorization: authorization,
    Accept: 'application/json',
  });
  for (const name of ['content-type', 'x-patient-token', 'idempotency-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      signal: AbortSignal.timeout(60000),
    });
    // Never follow redirects with merchant credentials or return cached patient data.
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        {
          message:
            'Unexpected redirect from Uniloop API. Check UNILOOP_API_URL.',
        },
        { status: 502 },
      );
    }
    if (response.status === 403) {
      const data = await response
        .json()
        .catch(() => ({ message: 'Uniloop denied this operation.' }));
      return NextResponse.json(
        {
          ...data,
          permission_hint: merchantPermissionHint(endpoint, request.method),
          upstream_origin: base,
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
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
        message: `Unable to reach Uniloop at ${base}. Check the saved base URL.`,
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
