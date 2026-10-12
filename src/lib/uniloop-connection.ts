export const DEFAULT_UNILOOP_URL = 'https://my.ivyrx.com';

/** Merchant APIs are mounted at the selected Uniloop origin, including custom domains. */
export function normalizeUniloopBaseUrl(value: string): string {
  const url = new URL(value.trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(
      'Use HTTPS for Uniloop, or HTTP for a local loopback server.',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Enter a Uniloop base URL without credentials, query parameters, or fragments.',
    );
  }
  if (
    !['', '/', '/api/v1/merchant', '/api/v1/merchant/'].includes(url.pathname)
  ) {
    throw new Error(
      'Enter the Uniloop origin, for example https://my.example.com, rather than an enrollment link.',
    );
  }
  return url.origin;
}

export function defaultUniloopBaseUrl(): string {
  return normalizeUniloopBaseUrl(
    process.env.UNILOOP_API_URL ||
      process.env.LARAVEL_API_URL ||
      DEFAULT_UNILOOP_URL,
  );
}

/** Diagnostic only: the API remains authoritative about signed scopes and current owner permissions. */
export function advertisedTokenScopes(token: string): string[] | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    return Array.isArray(claims.scopes) &&
      claims.scopes.every((scope: unknown) => typeof scope === 'string')
      ? claims.scopes
      : null;
  } catch {
    return null;
  }
}

export function merchantPermissionHint(
  endpoint: string,
  method: string,
): string {
  const path = endpoint.split('?')[0];
  if (path === 'patient/profile' && method === 'PATCH') {
    return 'Saving patient details requires enrollment:write or portal:write on the merchant credential and permission for its owner. OTP verification and profile writes are separate API operations.';
  }
  if (path.startsWith('patient/auth/'))
    return 'OTP login requires enrollment:write, portal:write, or patient:login. New patients also require enrollment:write.';
  if (path.startsWith('payments/'))
    return `This payment operation requires payments:${method === 'GET' ? 'read' : 'write'} and permission for the credential owner.`;
  return 'Check the merchant credential’s scopes and its owner’s permissions in Uniloop API Access.';
}
