'use client';

// Local check page for blocks that save output keys under their own field names. Not committed.
// /multi-fieldname shows the form with the saved values beside it; /multi-fieldname?edit=1 opens it in the builder;
// /multi-fieldname?prefill=1 starts with a saved answer for the first step, as a resumed session would.

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { themes } from '@/packages/survey-form-package/src/themes';
import { StandardBlocks, StandardNodes } from '@/packages/survey-form-package/src/builder';
import { registerBlock } from '@/packages/survey-form-package/src/blocks';
import { HeadacheCheckBlock, HeadachePresetBlock } from './blocks';
import type { NodeData } from '@/packages/survey-form-package/src/types';

const SurveyForm = dynamic(
  () => import('@/packages/survey-form-package/src/renderer/SurveyForm').then((mod) => mod.SurveyForm),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);
const SurveyBuilder = dynamic(
  () => import('@/packages/survey-form-package/src/builder').then((mod) => mod.SurveyBuilder),
  { ssr: false },
);

const end = (uuid: string, title: string) => ({
  type: 'html',
  uuid,
  label: title,
  html: `<h2 style="font-size:22px;font-weight:700">${title}</h2>`,
  isEndBlock: true,
});

// Step 1 asks both questions; its keys route to different steps and have their own rules.
// Step 2 sets both keys with one pick and moves on by itself.
const rootNode: NodeData = {
  type: 'section',
  uuid: 'mf-root',
  name: 'Multi field name check',
  items: [
    {
      type: 'headacheCheck',
      uuid: 'mf-check',
      fieldName: 'headaches',
      label: 'Tell us about your headaches',
      outputFields: {
        frequency: { fieldName: 'headacheFrequency' },
        severity: { fieldName: 'headacheSeverity', question: 'How bad are your headaches usually?' },
      },
      validationRules: [
        { field: 'headacheFrequency', operator: 'isNotEmpty', message: 'Pick how often you get headaches.', severity: 'error' },
        { field: 'headacheSeverity', operator: 'isNotEmpty', message: 'Pick how bad they are.', severity: 'error' },
      ],
      navigationRules: [
        { condition: 'headacheSeverity == "severe"', target: 'mf-severe' },
        { condition: 'headacheFrequency == "daily"', target: 'mf-daily' },
      ],
      nextBlockId: 'mf-preset',
    },
    {
      type: 'headachePreset',
      uuid: 'mf-preset',
      fieldName: 'lastWeek',
      label: 'Which best describes last week?',
      autoContinueOnSelect: true,
      showContinueButton: false,
      outputFields: {
        frequency: { fieldName: 'lastWeekFrequency' },
        severity: { fieldName: 'lastWeekSeverity' },
      },
      navigationRules: [{ condition: 'lastWeekSeverity == "severe"', target: 'mf-severe' }],
      nextBlockId: 'mf-done',
    },
    end('mf-daily', 'Step for daily headaches'),
    end('mf-severe', 'Step for severe headaches'),
    end('mf-done', 'All done'),
  ],
};

export default function MultiFieldNamePage() {
  const [ready, setReady] = useState(false);
  const [edit, setEdit] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, unknown> | undefined>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    registerBlock(HeadacheCheckBlock);
    registerBlock(HeadachePresetBlock);
    const params = new URLSearchParams(window.location.search);
    setEdit(params.has('edit'));
    if (params.has('prefill')) setPrefill({ headaches: { frequency: 'daily', severity: 'mild' } });
    setReady(true);
  }, []);

  if (!ready) return null;

  if (edit) {
    return (
      <SurveyBuilder
        initialData={{ rootNode, theme: themes.uniloop }}
        blockDefinitions={[...StandardBlocks, HeadacheCheckBlock, HeadachePresetBlock]}
        nodeDefinitions={StandardNodes}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
          <SurveyForm
            survey={{ rootNode, theme: themes.uniloop }}
            initialValues={prefill}
            onChange={(v: Record<string, unknown>) => setValues(v)}
            onSubmit={(v: Record<string, unknown>) => setSubmitted(v)}
          />
        </div>
        <aside className="rounded-lg border border-gray-300 bg-white p-3 text-xs">
          <h2 className="mb-2 font-semibold text-gray-900">Saved values</h2>
          <pre id="form-data" className="whitespace-pre-wrap break-words text-gray-700">
            {JSON.stringify(values, null, 2)}
          </pre>
          {submitted && (
            <>
              <h2 className="mb-2 mt-3 font-semibold text-gray-900">Submitted</h2>
              <pre id="submitted-data" className="whitespace-pre-wrap break-words text-gray-700">
                {JSON.stringify(submitted, null, 2)}
              </pre>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
