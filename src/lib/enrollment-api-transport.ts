/** Local demo transport; hosted utilities keep their original endpoints elsewhere. */
type Transport = (url: string, init?: RequestInit) => Promise<Response>;
let transport: Transport | null = null;
export function installEnrollmentTransport(next: Transport) {
  transport = next;
  return () => {
    if (transport === next) transport = null;
  };
}
export function enrollmentFetch(url: string, init?: RequestInit) {
  return transport ? transport(url, init) : fetch(url, init);
}

/** Mirror the patient-facing endpoints used by Uniloop's shared EMR utilities. */
export function patientEndpointAllowed(path: string, method: string): boolean {
  const routes: [RegExp, string[]][] = [
    [
      /^\/api\/v2\/patient\/(send-otp|validate|update|get-coupon|validate-coupon)$/,
      ['POST'],
    ],
    [/^\/api\/patient\/validate-token$/, ['POST']],
    [/^\/api\/patient\/(profile|addresses|intercom)$/, ['GET']],
    [/^\/api\/v2\/patient\/vitals(?:\/(latest|trends))?$/, ['GET', 'POST']],
    [/^\/api\/v2\/patient\/vitals\/\d+$/, ['PATCH']],
    [/^\/api\/patient\/payments\/(methods|store-credits)$/, ['GET']],
    [/^\/api\/patient\/payments\/store-credits$/, ['PUT']],
    [
      /^\/api\/patient\/payments\/(setup-intent|save-method|payment-intent|authorization-intent|authorization-return)$/,
      ['POST'],
    ],
    [/^\/api\/patient\/payments\/methods\/[^/]+$/, ['DELETE']],
    [/^\/api\/patient\/payments\/methods\/[^/]+\/default$/, ['POST']],
    [/^\/api\/patient\/payments\/store-credits\/intents\/[^/]+$/, ['DELETE']],
    [/^\/api\/patient\/billing\/(quote|cancel-checkout)$/, ['POST']],
    [/^\/emr\/enroll\/[a-zA-Z0-9_-]+(?:\/preferred-drugs)?$/, ['POST']],
  ];
  return routes.some(
    ([pattern, methods]) =>
      pattern.test(path) && methods.includes(method.toUpperCase()),
  );
}
export function patientEndpointPublic(path: string): boolean {
  return ['/api/v2/patient/send-otp', '/api/v2/patient/validate'].includes(
    path,
  );
}

export function createPatientTransport(
  getPatientToken: () => string | null,
  baseUrl = '',
  onError?: (message: string) => void,
): Transport {
  return async (url, init = {}) => {
    const parsed = new URL(url, 'http://demo.local');
    const method = (init.method || 'GET').toUpperCase();
    if (
      parsed.origin !== 'http://demo.local' ||
      !patientEndpointAllowed(parsed.pathname, method)
    ) {
      throw new Error(
        `Unsupported patient enrollment API request: ${method} ${url}`,
      );
    }
    const headers = new Headers(init.headers);
    const patient =
      headers.get('authorization')?.replace(/^Bearer /i, '') ||
      getPatientToken();
    headers.delete('x-csrf-token');
    headers.delete('x-patient-token');
    headers.delete('x-uniloop-merchant-token');
    if (patient) headers.set('Authorization', `Bearer ${patient}`);
    else headers.delete('authorization');
    if (baseUrl) headers.set('X-Uniloop-Base-URL', baseUrl);
    headers.set('Accept', 'application/json');
    const response = await fetch(
      `/api/uniloop-patient${parsed.pathname}${parsed.search}`,
      {
        ...init,
        method,
        headers,
        cache: 'no-store',
      },
    );
    const data = await response
      .json()
      .catch(() => ({ message: 'Uniloop returned an invalid response.' }));
    if (!response.ok) {
      data.error ??= data.message || 'Patient API request failed.';
      data.errors ??= { error: data.error };
      onError?.(`${method} ${parsed.pathname}: ${data.error}`);
    }
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
