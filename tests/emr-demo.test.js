import {
  GET as PATIENT_GET,
  POST as PATIENT_POST,
} from '../src/app/api/uniloop-patient/[...path]/route';
import {
  advertisedTokenScopes,
  normalizeUniloopBaseUrl,
} from '../src/lib/uniloop-connection';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMerchantLogo } from '../src/app/emr-demo/merchant-logo';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  createPatientTransport,
  enrollmentFetch,
  installEnrollmentTransport,
  patientEndpointAllowed,
} from '../src/lib/enrollment-api-transport';
import { normalizeForms } from '../src/app/emr-demo/forms';
import { GET, POST } from '../src/app/api/uniloop/[...path]/route';
import { NextRequest } from 'next/server';
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('uses served intake IDs, parses all schemas, and preserves form order and metadata', () => {
  const forms = normalizeForms([
    {
      id: 40,
      intake_form_id: 5,
      sort_order: 2,
      name: 'Checkout',
      form_json: '{"rootNode":{"type":"section","items":[]}}',
    },
    {
      id: 41,
      intake_form_id: 6,
      sort_order: 1,
      name: 'Patient',
      form_json: { rootNode: { items: [] } },
      custom_layout: { type: 'test' },
    },
  ]);
  expect(forms.map((f) => f.id)).toEqual([6, 5]);
  expect(forms[1].form_json.rootNode.type).toBe('section');
  expect(forms[0].custom_layout.type).toBe('test');
});

describe('server proxy', () => {
  test('rejects unsupported paths and missing credentials before contacting Uniloop', async () => {
    const fetchMock = mock();
    globalThis.fetch = fetchMock;
    const unknown = await GET(
      new NextRequest('http://localhost/api/uniloop/unknown'),
      { params: Promise.resolve({ path: ['unknown'] }) },
    );
    expect(unknown.status).toBe(404);
    const missing = await GET(
      new NextRequest('http://localhost/api/uniloop/plans'),
      { params: Promise.resolve({ path: ['plans'] }) },
    );
    expect(missing.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test('forwards only explicit credentials, preserves status and disables caching', async () => {
    globalThis.fetch = mock(async (url, init) => {
      expect(String(url)).toContain('/api/v1/merchant/plans?page=2');
      expect(new Headers(init.headers).has('cookie')).toBe(false);
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer merchant',
      );
      expect(init.redirect).toBe('manual');
      return Response.json({ data: [] }, { status: 200 });
    });
    const response = await GET(
      new NextRequest('http://localhost/api/uniloop/plans?page=2', {
        headers: { Authorization: 'Bearer merchant', Cookie: 'private=secret' },
      }),
      { params: Promise.resolve({ path: ['plans'] }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  test('does not follow redirects with credentials', async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://example.com' },
        }),
    );
    const response = await POST(
      new NextRequest('http://localhost/api/uniloop/payments/setup-intent', {
        method: 'POST',
        headers: { Authorization: 'Bearer merchant' },
        body: '{}',
      }),
      { params: Promise.resolve({ path: ['payments', 'setup-intent'] }) },
    );
    expect(response.status).toBe(502);
  });
});

describe('hosted layout logo contract', () => {
  test('provides the callable logo expected by published merchant layouts', () => {
    const logo = createMerchantLogo({
      name: 'Merchant',
      business: { logo_url: 'https://example.com/logo.png' },
    });
    expect(typeof logo).toBe('function');
    const html = renderToStaticMarkup(logo('h-8'));
    expect(html).toContain('alt="Merchant"');
    expect(html).toContain('class="h-8"');
    expect(html).toContain('src="https://example.com/logo.png"');
  });
  test('remains callable without merchant business or a logo', () => {
    expect(
      renderToStaticMarkup(
        createMerchantLogo({ name: 'Merchant', business: null })('logo'),
      ),
    ).toBe('<span class="logo">Merchant</span>');
    expect(renderToStaticMarkup(createMerchantLogo(undefined)())).toContain(
      'Uniloop',
    );
  });
});

describe('patient enrollment transport', () => {
  test.each([
    ['/api/v2/patient/send-otp', 'POST'],
    ['/api/v2/patient/validate', 'POST'],
    ['/api/v2/patient/update', 'POST'],
    ['/api/v2/patient/vitals', 'POST'],
    ['/api/v2/patient/vitals/42', 'PATCH'],
    ['/api/patient/profile', 'GET'],
    ['/api/patient/payments/setup-intent', 'POST'],
    ['/api/patient/payments/authorization-return', 'POST'],
    ['/api/patient/billing/quote', 'POST'],
    ['/emr/enroll/weight-loss', 'POST'],
    ['/emr/enroll/weight-loss/preferred-drugs', 'POST'],
  ])('preserves hosted endpoint %s and method %s', (url, method) =>
    expect(patientEndpointAllowed(url, method)).toBe(true),
  );
  test('uses the patient bearer token and selected origin, preserving the native profile POST', async () => {
    globalThis.fetch = mock(async (url, init) => {
      expect(url).toBe('/api/uniloop-patient/api/v2/patient/update');
      expect(init.method).toBe('POST');
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe('Bearer verified-patient');
      expect(headers.get('X-Uniloop-Base-URL')).toBe(
        'https://care.example.com',
      );
      expect(headers.has('X-Patient-Token')).toBe(false);
      return Response.json({ success: true, patient: { id: 1 } });
    });
    await createPatientTransport(
      () => 'verified-patient',
      'https://care.example.com',
    )('/api/v2/patient/update', { method: 'POST', body: '{}' });
  });
  test('OTP bootstrap runs without a patient token or merchant credential', async () => {
    globalThis.fetch = mock(async (url, init) => {
      expect(url).toBe('/api/uniloop-patient/api/v2/patient/send-otp');
      expect(new Headers(init.headers).has('Authorization')).toBe(false);
      return Response.json({ success: true });
    });
    await createPatientTransport(() => null)('/api/v2/patient/send-otp', {
      method: 'POST',
      body: '{}',
    });
  });
  test('preserves multipart enrollment uploads with patient authorization', async () => {
    const body = new FormData();
    body.append('form_responses', '[]');
    body.append('files[1][photo][0]', new File(['photo'], 'photo.txt'));
    globalThis.fetch = mock(async (url, init) => {
      expect(url).toBe('/api/uniloop-patient/emr/enroll/plan');
      expect(init.body).toBe(body);
      expect(new Headers(init.headers).get('Authorization')).toBe(
        'Bearer patient',
      );
      expect(new Headers(init.headers).has('content-type')).toBe(false);
      return Response.json(
        { success: true, enrollment: { uuid: 'created' } },
        { status: 201 },
      );
    });
    const response = await createPatientTransport(() => 'patient')(
      '/emr/enroll/plan',
      { method: 'POST', body },
    );
    expect((await response.json()).enrollment.uuid).toBe('created');
  });
  test('restores native fetch after the demo unmounts', async () => {
    globalThis.fetch = mock(async () => Response.json({ native: true }));
    const dispose = installEnrollmentTransport(async () =>
      Response.json({ demo: true }),
    );
    expect(await (await enrollmentFetch('/anything')).json()).toEqual({
      demo: true,
    });
    dispose();
    expect(await (await enrollmentFetch('/anything')).json()).toEqual({
      native: true,
    });
  });
});

describe('patient proxy and connection', () => {
  test('routes profile and vital calls to the supplied domain with only the patient bearer token', async () => {
    globalThis.fetch = mock(async (url, init) => {
      expect(String(url)).toBe(
        'https://care.example.com/api/v2/patient/update',
      );
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe('Bearer patient');
      expect(headers.has('X-Patient-Token')).toBe(false);
      expect(headers.has('X-Uniloop-Base-URL')).toBe(false);
      expect(headers.has('Cookie')).toBe(false);
      return Response.json({ success: true });
    });
    const response = await PATIENT_POST(
      new NextRequest(
        'http://localhost/api/uniloop-patient/api/v2/patient/update',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer patient',
            'X-Uniloop-Base-URL': 'https://care.example.com',
            Cookie: 'private=secret',
          },
          body: '{}',
        },
      ),
      { params: Promise.resolve({ path: ['api', 'v2', 'patient', 'update'] }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  test('rejects missing patient authentication before calling a protected endpoint', async () => {
    const fetchMock = mock();
    globalThis.fetch = fetchMock;
    const response = await PATIENT_GET(
      new NextRequest(
        'http://localhost/api/uniloop-patient/api/patient/profile',
      ),
      { params: Promise.resolve({ path: ['api', 'patient', 'profile'] }) },
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test('returns a clear limitation when a hosted web action requires CSRF', async () => {
    globalThis.fetch = mock(
      async () => new Response('Page expired', { status: 419 }),
    );
    const response = await PATIENT_POST(
      new NextRequest('http://localhost/api/uniloop-patient/emr/enroll/plan', {
        method: 'POST',
        headers: { Authorization: 'Bearer patient' },
        body: '{}',
      }),
      { params: Promise.resolve({ path: ['emr', 'enroll', 'plan'] }) },
    );
    expect(response.status).toBe(419);
    expect((await response.json()).message).toContain('hosted session/CSRF');
  });
  test('normalizes custom domains and loopback development URLs', () => {
    expect(
      normalizeUniloopBaseUrl('https://care.example.com/api/v1/merchant/'),
    ).toBe('https://care.example.com');
    expect(normalizeUniloopBaseUrl('http://127.0.0.1:8000/')).toBe(
      'http://127.0.0.1:8000',
    );
  });
  test.each([
    'https://user:password@example.com',
    'https://example.com/enroll/plan',
    'https://example.com?token=secret',
    'file:///tmp/example',
    'http://example.com',
  ])('rejects invalid base %s', (url) =>
    expect(() => normalizeUniloopBaseUrl(url)).toThrow(),
  );
  test('reads only advertised scope claims', () => {
    const payload = btoa(JSON.stringify({ scopes: ['enrollment:read'] }));
    expect(advertisedTokenScopes(`header.${payload}.signature`)).toEqual([
      'enrollment:read',
    ]);
    expect(advertisedTokenScopes('invalid')).toBeNull();
  });
});

describe('OTP and queued profile updates', () => {
  test('uses the newly issued patient JWT to save pending details', async () => {
    const {
      validatePatientAuth,
      savePendingUpdate,
      getPatientAuthToken,
      getPendingUpdates,
    } = await import('../src/lib/enrollment-utils');
    const { DEFAULT_PATIENT_AUTH_CONFIG } =
      await import('../src/lib/enrollment-types');
    const previousWindow = globalThis.window;
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.window = {};
    globalThis.localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const dispose = installEnrollmentTransport(
      createPatientTransport(() => null),
    );
    try {
      savePendingUpdate('firstName', 'Example', 'patient-otp');
      globalThis.fetch = mock(async (url, init) => {
        if (url.endsWith('/api/v2/patient/validate'))
          return Response.json({
            success: true,
            token: 'verified-patient',
            patient: { id: 1, email: 'test@example.com' },
          });
        expect(url).toBe('/api/uniloop-patient/api/v2/patient/update');
        expect(init.method).toBe('POST');
        expect(new Headers(init.headers).get('Authorization')).toBe(
          'Bearer verified-patient',
        );
        return Response.json({
          success: true,
          patient: {
            id: 1,
            first_name: 'Example',
            last_name: 'Patient',
            email: 'test@example.com',
          },
        });
      });
      const result = await validatePatientAuth(
        { email: 'test@example.com', otp: '123456' },
        DEFAULT_PATIENT_AUTH_CONFIG,
        'patient-otp',
      );
      expect(result.success).toBe(true);
      expect(result.patient.first_name).toBe('Example');
      expect(getPatientAuthToken('patient-otp')).toBe('verified-patient');
      expect(getPendingUpdates('patient-otp')).toBeNull();
    } finally {
      dispose();
      globalThis.window = previousWindow;
      globalThis.localStorage = previousStorage;
    }
  });
});
