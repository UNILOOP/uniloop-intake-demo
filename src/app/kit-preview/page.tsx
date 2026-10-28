'use client';

// Local check page for the whole-brand Option Cards upgrade. Not committed.
// /kit-preview?form=<name>[&step=<fieldName or block id>][&edit=1] loads public/emr-demo/kit-preview/form-<name>.json; #<fieldName> jumps to a question
// without a page load, which agent-browser's recorder stops at.
// Renders a copy of VitalMeds' preview form (public/emr-demo/kit-preview/) with the brand
// layout, the form's own theme and the demo's custom blocks, without a merchant key.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  StandardBlocks,
  StandardNodes,
} from '@/packages/survey-form-package/src/builder';
import { getSystemBlocks } from '../emr-demo/custom-blocks';
import { LocalLayouts } from '../emr-demo/custom-layouts';
import { createMerchantLogo } from '../emr-demo/merchant-logo';

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

export default function KitPreviewPage() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const systemBlocks = useMemo(
    () => (typeof window !== 'undefined' ? getSystemBlocks() : []),
    [],
  );

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    setParams(next);
    setStep(next.get('step'));
    const jump = () => setStep(window.location.hash.slice(1) || next.get('step'));
    window.addEventListener('hashchange', jump);
    const requested = next.get('form') || '';
    const name = /^[a-z0-9-]+$/.test(requested) ? requested : 'before';
    fetch(`/emr-demo/kit-preview/form-${name}.json`, { cache: 'no-store' })
      .then((response) => response.json())
      .then(setForm)
      .catch((err) => setError(String(err)));
    return () => window.removeEventListener('hashchange', jump);
  }, []);

  const logo = useMemo(
    () => createMerchantLogo({ name: 'VitalMeds', logo: params?.get('logo') }),
    [params],
  );

  if (error) return <p role="alert">{error}</p>;
  if (!form || !params) return null;

  const layout = LocalLayouts.brandStepLayout;
  const startPage = Math.max(
    0,
    form.rootNode.items.findIndex((item: any) => item.fieldName === step || item.uuid === step),
  );

  return params.get('edit') ? (
    <SurveyBuilder
      initialData={form}
      blockDefinitions={[...StandardBlocks, ...systemBlocks]}
      logo={logo}
      previewLayout={layout}
      nodeDefinitions={StandardNodes}
    />
  ) : (
    <SurveyForm
      key={step ?? ''}
      logo={logo}
      survey={form}
      layout={layout}
      startPage={startPage}
      // The answers so far, for checks run from the browser
      onChange={(values: Record<string, unknown>) => {
        (window as any).kitValues = values;
      }}
      onSubmit={() => {}}
    />
  );
}
