'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { EmrEnrollmentUtils } from '@/lib/emr-enrollment-utils';
import { createLegacyEmrEnrollmentAdapter } from '@/lib/emr-enrollment-compat';
import {
  createPatientTransport,
  installEnrollmentTransport,
} from '@/lib/enrollment-api-transport';
import {
  StandardBlocks,
  StandardNodes,
} from '@/packages/survey-form-package/src/builder';
import { getSystemBlocks } from './custom-blocks';
import { LocalLayouts } from './custom-layouts';
import { BrandThemes } from './brand-themes';
import {
  DemoForm,
  normalizeForms,
  withMultiPageCheckout,
  withUpsellOffer,
} from './forms';
import { loadMerchantComponents } from './merchant-components';
import { createMerchantLogo } from './merchant-logo';
import { FormErrorBoundary } from './form-error-boundary';
import {
  PATIENT_FIELDS,
  PatientContextPanel,
  patientMappingField,
  patientSync,
  patientToExternal,
} from './patient-external';
import {
  useExternalStore,
  type ExternalConfig,
} from '@/packages/survey-form-package/src';
import {
  advertisedTokenScopes,
  DEFAULT_UNILOOP_URL,
  normalizeUniloopBaseUrl,
} from '@/lib/uniloop-connection';
import {
  getEmrStorageKey,
  loadEnrollmentState,
  saveEnrollmentState,
} from '@/lib/enrollment-utils';

const SurveyForm = dynamic(
  () =>
    import('@/packages/survey-form-package/src/renderer/SurveyForm').then(
      (m) => m.SurveyForm,
    ),
  { ssr: false },
);
const SurveyBuilder = dynamic(
  () =>
    import('@/packages/survey-form-package/src/builder').then(
      (m) => m.SurveyBuilder,
    ),
  { ssr: false },
);
const TOKEN_KEY = 'uniloop_emr_demo_token';
const BASE_URL_KEY = 'uniloop_emr_demo_base_url';
const control = 'rounded-md border px-3 py-2 bg-background text-sm';

export default function EmrDemoPage() {
  const [token, setToken] = useState('');
  const [activeToken, setActiveToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [activeBaseUrl, setActiveBaseUrl] = useState('');
  const [defaultBaseUrl, setDefaultBaseUrl] = useState(DEFAULT_UNILOOP_URL);
  const scopes = useMemo(
    () => advertisedTokenScopes(activeToken),
    [activeToken],
  );
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [merchantComponents, setMerchantComponents] = useState<{
    definitions: any[];
    layouts: Record<string, any>;
  }>({ definitions: [], layouts: {} });
  const [plans, setPlans] = useState<any[]>([]);
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [forms, setForms] = useState<DemoForm[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  // `?layout=` and `?theme=` swap in a local layout and theme for every form
  const [overrides, setOverrides] = useState<{
    layout?: string;
    theme?: string;
    checkout?: string;
    upsell?: string;
    upsellLayout?: string;
    upsellTimer?: string;
  }>({});
  const [runtime, setRuntime] = useState<{
    utils: EmrEnrollmentUtils;
    legacy: ReturnType<typeof createLegacyEmrEnrollmentAdapter>;
  } | null>(null);
  const runtimeRef = useRef<EmrEnrollmentUtils | null>(null);
  const generation = useRef(0);
  // Patient keys shared with every rendered form. Updating the store changes a
  // mounted form in place; the form writes answers to mapped blocks back here.
  const patientStore = useExternalStore();
  const external = useMemo<ExternalConfig>(
    () => ({
      store: patientStore,
      sync: patientSync,
      onChange: (values, changes, source) =>
        console.log('[emr-demo] patient keys updated', { source, changes, values }),
    }),
    [patientStore],
  );
  const globalCustomFields = useMemo(() => [patientMappingField], []);
  const systemBlocks = useMemo(
    () => (typeof window !== 'undefined' ? getSystemBlocks() : []),
    [],
  );
  const logo = useMemo(
    () => createMerchantLogo(plan?.merchant),
    [plan?.merchant],
  );
  const visibleForms = useMemo(() => {
    const checkoutForms =
      overrides.checkout === 'two-page'
        ? withMultiPageCheckout(forms, 2)
        : overrides.checkout === 'three-page'
          ? withMultiPageCheckout(forms, 3)
          : forms;
    return overrides.upsell
      ? withUpsellOffer(checkoutForms, overrides.upsell, {
          layout: overrides.upsellLayout,
          timer: overrides.upsellTimer,
        })
      : checkoutForms;
  }, [
    forms,
    overrides.checkout,
    overrides.upsell,
    overrides.upsellLayout,
    overrides.upsellTimer,
  ]);
  const current =
    visibleForms.find((form) => form.key === selectedKey) ?? visibleForms[0];
  const layout = overrides.layout
    ? LocalLayouts[overrides.layout]
    : merchantComponents.layouts[current?.custom_layout?.transpiled_code_url];
  const formJson = useMemo(() => {
    const theme = overrides.theme && BrandThemes[overrides.theme];
    return theme && current?.form_json
      ? { ...current.form_json, theme }
      : current?.form_json;
  }, [current?.form_json, overrides.theme]);
  const context = useRef<any>(null);
  context.current = {
    forms: visibleForms,
    currentFormId: current?.id ?? null,
    answers,
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOverrides({
      layout: params.get('layout') || undefined,
      theme: params.get('theme') || undefined,
      checkout: params.get('checkout') || undefined,
      upsell: params.get('upsell') || undefined,
      upsellLayout: params.get('upsellLayout') || undefined,
      upsellTimer: params.get('upsellTimer') || undefined,
    });
  }, []);

  useEffect(() => {
    const read = () => {
      const saved = localStorage.getItem(TOKEN_KEY) || '';
      const savedBase = localStorage.getItem(BASE_URL_KEY) || '';
      setBaseUrl(savedBase);
      setActiveBaseUrl(savedBase);
      setToken(saved);
      setActiveToken(saved);
      setReady(true);
    };
    try {
      read();
    } catch {
      setReady(true);
      setError('Browser local storage is unavailable.');
    }
    fetch('/api/uniloop-config')
      .then((response) => response.json())
      .then((data) => {
        if (data.base_url) setDefaultBaseUrl(data.base_url);
      })
      .catch(() => {});
    const sync = (event: StorageEvent) => {
      if (
        event.key === TOKEN_KEY ||
        event.key === BASE_URL_KEY ||
        event.key === null
      )
        read();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const api = useCallback(
    async (path: string, init: RequestInit = {}, patientToken?: string) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${activeToken}`);
      if (activeBaseUrl) headers.set('X-Uniloop-Base-URL', activeBaseUrl);
      if (patientToken) headers.set('X-Patient-Token', patientToken);
      if (init.body && !(init.body instanceof FormData))
        headers.set('Content-Type', 'application/json');
      const response = await fetch(`/api/uniloop/${path}`, {
        ...init,
        headers,
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          [
            data.message,
            data.permission_hint,
            ...Object.values(data.errors || {}).flat(),
          ]
            .filter(Boolean)
            .join(' ') || `Uniloop request failed (${response.status}).`,
        );
      return data;
    },
    [activeToken, activeBaseUrl],
  );

  useEffect(() => {
    generation.current++;
    setPlan(null);
    setForms([]);
    setPlans([]);
    setSlug('');
    setError('');
    setResult(null);
    setAnswers({});
    setBusy(false);
    if (!activeToken) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      const available: any[] = [];
      let page = 1;
      while (true) {
        const data = await api(`plans?per_page=100&page=${page}`);
        if (cancelled) return;
        available.push(...data.data);
        if (page >= (data.meta?.last_page ?? 1)) break;
        page++;
      }
      setPlans(available);
      const requested = new URLSearchParams(window.location.search).get('slug');
      setSlug(
        available.find((p) => p.enrollment_slug === requested)
          ?.enrollment_slug ||
          available[0]?.enrollment_slug ||
          '',
      );
    })()
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeToken, api, reload]);

  useEffect(() => {
    const version = ++generation.current;
    setPlan(null);
    setForms([]);
    setAnswers({});
    setResult(null);
    setEditing(false);
    if (!slug || !activeToken) return;
    setBusy(true);
    setError('');
    api(`plans/${encodeURIComponent(slug)}`)
      .then(async (data) => {
        if (generation.current !== version) return;
        const next = data.data;
        const components = await loadMerchantComponents(
          next,
          new Set(systemBlocks.map((block) => block.type)),
        );
        if (generation.current !== version) return;
        setMerchantComponents(components);
        const nextForms = normalizeForms(next.enrollment_forms || []);
        setPlan(next);
        setForms(nextForms);
        const saved = loadEnrollmentState(
          getEmrStorageKey(next.slug || slug, next.id),
        );
        const returning =
          new URLSearchParams(window.location.search).has('setup_intent') ||
          new URLSearchParams(window.location.search).has('payment_intent');
        setAnswers(returning ? saved.formResponses || {} : {});
        setSelectedKey(
          nextForms[returning ? saved.currentStep || 0 : 0]?.key ||
            nextForms[0]?.key ||
            '',
        );
      })
      .catch((err) => {
        if (generation.current === version) setError(err.message);
      })
      .finally(() => {
        if (generation.current === version) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [slug, activeToken, api, systemBlocks]);

  useEffect(() => {
    if (!plan || !activeToken) {
      setRuntime(null);
      runtimeRef.current = null;
      return;
    }
    const utils = new EmrEnrollmentUtils({
      plan,
      merchant: plan.merchant,
      slug: plan.slug || slug,
      chargeMode: plan.charge_mode,
      patientAuthStorageKey: `uniloop_demo_patient_${encodeURIComponent(activeBaseUrl || defaultBaseUrl)}_${plan.merchant.id}_${activeToken.slice(-12)}`,
      getFormContext: () => context.current,
    });
    runtimeRef.current = utils;
    const uninstall = installEnrollmentTransport(
      createPatientTransport(
        () => utils.getPatientAuthToken(),
        activeBaseUrl,
        setError,
      ),
    );
    setRuntime({ utils, legacy: createLegacyEmrEnrollmentAdapter(utils) });
    patientStore.setValues(patientToExternal(utils.getStoredPatient()));
    return () => {
      uninstall();
      utils.dispose();
      runtimeRef.current = null;
    };
  }, [plan, activeToken, activeBaseUrl, defaultBaseUrl, slug, patientStore]);

  useEffect(() => {
    if (!plan) return;
    saveEnrollmentState(getEmrStorageKey(plan.slug || slug, plan.id), {
      formResponses: answers,
      currentStep: Math.max(
        0,
        forms.findIndex((form) => form.key === current?.key),
      ),
    });
  }, [plan, slug, answers, current?.key, forms]);

  function connect() {
    try {
      const next = token.trim().replace(/^Bearer\s+/i, '');
      const nextBase = baseUrl.trim() ? normalizeUniloopBaseUrl(baseUrl) : '';
      if (nextBase) localStorage.setItem(BASE_URL_KEY, nextBase);
      else localStorage.removeItem(BASE_URL_KEY);
      setBaseUrl(nextBase);
      setActiveBaseUrl(nextBase);
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
      setToken(next);
      if (next === activeToken) setReload((value) => value + 1);
      setActiveToken(next);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Browser storage is unavailable.',
      );
    }
  }

  const editForm = useCallback(
    (survey: any) => {
      if (!current) return;
      setForms((previous) =>
        previous.map((form) =>
          form.key === current.key ? { ...form, form_json: survey } : form,
        ),
      );
    },
    [current?.key],
  );

  async function submit(allAnswers: Record<number, any>) {
    if (!runtime) return;
    setBusy(true);
    setError('');
    try {
      const missing = forms.filter(
        (form) => form.is_required && allAnswers[form.id] === undefined,
      );
      if (missing.length)
        throw new Error(
          `Complete the required forms first: ${missing.map((form) => form.name).join(', ')}.`,
        );
      const submission = await runtime.utils.submitEmrEnrollment(
        allAnswers,
        runtime.utils.getCheckoutData(),
      );
      if (!submission.success)
        throw new Error(
          Object.values(submission.errors || {})
            .flat()
            .join(' ') || 'Enrollment submission failed.',
        );
      if (runtimeRef.current === runtime.utils) setResult(submission);
    } catch (err) {
      if (runtimeRef.current === runtime.utils)
        setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      if (runtimeRef.current === runtime.utils) setBusy(false);
    }
  }

  function completeForm(data: any) {
    if (!current) return;
    const updated = { ...answers, [current.id]: data };
    context.current.answers = updated;
    setAnswers(updated);
    const index = visibleForms.findIndex((form) => form.key === current.key);
    if (index < visibleForms.length - 1)
      setSelectedKey(visibleForms[index + 1].key);
    else void submit(updated);
  }

  const customData = runtime
    ? {
        emrEnrollmentUtils: runtime.utils,
        enrollmentModule: runtime.legacy,
        enrollmentForms: visibleForms,
        currentEnrollmentForm: current,
        completedFormResponses: answers,
      }
    : undefined;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header
        id="emr-demo-controls"
        hidden={focusMode && !!current}
        className="border-b p-5 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold">
            Uniloop EMR development demo
          </h1>
          <p className="text-sm text-muted-foreground">
            Load real treatment plans, edit forms locally, and run the shared
            EMR enrollment utilities.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-64 text-sm">
            Uniloop base URL
            <input
              aria-label="Uniloop base URL"
              type="url"
              className={`${control} block w-full mt-1`}
              value={baseUrl}
              placeholder={defaultBaseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="flex-1 min-w-64 text-sm">
            Uniloop merchant token
            <input
              aria-label="Uniloop merchant token"
              className={`${control} block w-full mt-1 font-mono`}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button onClick={connect} disabled={!ready || busy}>
            Save connection & load plans
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken('');
              setActiveToken('');
            }}
          >
            Clear token
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Token is saved in this browser’s local storage. Form edits stay local.
          Checkout and final submission use the connected Uniloop account.
        </p>
        <p className="text-xs text-muted-foreground">
          Uniloop: {activeBaseUrl || defaultBaseUrl}. Plans use the merchant
          API; intake actions use patient APIs through the local proxy.
        </p>
        {scopes && (
          <p className="text-xs text-muted-foreground">
            Merchant token scopes (claims): {scopes.join(', ') || 'none'}. Used
            for treatment plan loading; intake actions use the patient token.
          </p>
        )}
        {!!plans.length && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Treatment plan
              <select
                className={`${control} block mt-1`}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.enrollment_slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setRevision((v) => v + 1);
                setAnswers({});
                setResult(null);
                setSelectedKey(visibleForms[0]?.key || '');
              }}
            >
              Restart rendering
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 whitespace-pre-wrap">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="text-sm">
            Loading Uniloop…
          </p>
        )}
      </header>
      {!activeToken && (
        <p className="p-8 text-muted-foreground">
          Enter your merchant API token to begin.
        </p>
      )}
      {activeToken && !busy && !plans.length && !error && (
        <p className="p-8">
          No active treatment plans are available for this token.
        </p>
      )}
      {plan?.merchant_css_url && (
        <link rel="stylesheet" href={plan.merchant_css_url} />
      )}
      {plan && (
        <div className="flex flex-col lg:flex-row">
          <aside
            id="emr-demo-forms"
            hidden={focusMode && !!current}
            className="lg:w-72 shrink-0 border-r p-4 space-y-3"
          >
            <h2 className="font-semibold">{plan.name}</h2>
            <p className="text-xs text-muted-foreground">
              {plan.charge_mode} · Stripe{' '}
              {plan.stripe ? 'configured' : 'unavailable'}
            </p>
            {visibleForms.map((form, index) => (
              <button
                key={form.key}
                className={`block text-left w-full rounded border p-3 text-sm ${current?.key === form.key ? 'bg-muted border-primary' : ''}`}
                onClick={() => {
                  setSelectedKey(form.key);
                  setResult(null);
                }}
              >
                <span>
                  {index + 1}. {form.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {form.required_at} ·{' '}
                  {form.is_required ? 'Required' : 'Optional'} · Intake{' '}
                  {form.id}
                </span>
              </button>
            ))}
            {!visibleForms.length && (
              <p className="text-sm">
                No enrollment form schemas were returned for this plan.
              </p>
            )}
            <PatientContextPanel store={patientStore} />
          </aside>
          <section
            className={`min-w-0 flex-1 p-4 ${focusMode ? 'min-h-screen' : ''}`}
          >
            {current && (
              <div
                className={`flex flex-wrap items-center gap-2 mb-4 ${focusMode ? 'sticky top-0 z-40 bg-background py-3 border-b' : ''}`}
              >
                {focusMode && (
                  <span className="mr-auto text-sm font-medium">
                    {current.name}
                  </span>
                )}
                <Button
                  variant={editing ? 'outline' : 'default'}
                  onClick={() => {
                    setEditing(false);
                    setRevision((v) => v + 1);
                  }}
                >
                  Render form
                </Button>
                <Button
                  variant={editing ? 'default' : 'outline'}
                  onClick={() => setEditing(true)}
                >
                  Edit in SurveyFormBuilder
                </Button>
                <Button
                  variant="outline"
                  className={focusMode ? '' : 'ml-auto'}
                  aria-expanded={!focusMode}
                  aria-controls="emr-demo-controls emr-demo-forms"
                  onClick={() => {
                    setFocusMode((value) => !value);
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                >
                  {focusMode ? 'Exit full page' : 'Full page'}
                </Button>
              </div>
            )}
            {focusMode && error && (
              <p
                role="alert"
                className="mb-4 text-sm text-red-600 whitespace-pre-wrap"
              >
                {error}
              </p>
            )}
            {focusMode && busy && (
              <p role="status" className="mb-4 text-sm">
                Loading Uniloop…
              </p>
            )}
            <FormErrorBoundary key={`${current?.key}-${revision}-${editing}`}>
              {result ? (
                <div role="status" className="rounded border p-5">
                  <h2 className="font-semibold">Submission completed</h2>
                  <pre className="text-xs whitespace-pre-wrap mt-3">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ) : current?.form_json && runtime && !busy ? (
                editing ? (
                  <SurveyBuilder
                    key={`edit-${current.key}`}
                    initialData={formJson}
                    blockDefinitions={[
                      ...StandardBlocks,
                      ...systemBlocks,
                      ...merchantComponents.definitions,
                    ]}
                    logo={logo}
                    previewLayout={layout}
                    nodeDefinitions={StandardNodes}
                    onDataChange={editForm}
                    customData={customData}
                    externalFields={PATIENT_FIELDS}
                    globalCustomFields={globalCustomFields}
                  />
                ) : (
                  <SurveyForm
                    key={`${current.key}-${revision}`}
                    logo={logo}
                    survey={formJson}
                    layout={layout}
                    initialValues={answers[current.id]}
                    onSubmit={completeForm}
                    onChange={(data) => {
                      context.current.answers = {
                        ...context.current.answers,
                        [current.id]: data,
                      };
                      queueMicrotask(() =>
                        setAnswers((previous) =>
                          JSON.stringify(previous[current.id]) ===
                          JSON.stringify(data)
                            ? previous
                            : { ...previous, [current.id]: data },
                        ),
                      );
                    }}
                    customData={customData}
                    external={external}
                    progressBar={{
                      type: 'percentage',
                      showPercentage: true,
                      showStepInfo: true,
                      position: 'top',
                    }}
                  />
                )
              ) : current && !busy ? (
                <p role="alert">This intake has no renderable form schema.</p>
              ) : null}
            </FormErrorBoundary>
          </section>
        </div>
      )}
    </main>
  );
}
