'use client';

// Local check page for hard stops on a multi select question. Not committed.

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { themes } from '@/packages/survey-form-package/src/themes';

const SurveyForm = dynamic(
  () => import('@/packages/survey-form-package/src/renderer/SurveyForm').then((mod) => mod.SurveyForm),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);

const STOP =
  'Based on your responses you do not currently meet the clinical criteria for the requested treatment at this time.';
const option = (id: string, label: string) => ({ id: `ms-${id}`, label, value: label });

// The diagnosis question as the GLP-1 intake sets it up: one "Equals" rule per disqualifying option,
// and a navigation rule that sends Cancer to a follow-up question.
const rootNode = {
  type: 'section',
  uuid: 'ms-root',
  name: 'Multi select hard stop check',
  items: [
    {
      type: 'selectablebox',
      uuid: 'ms-dx',
      fieldName: 'diagnoses',
      label: 'Have you ever been diagnosed with any of the following?',
      description: 'Select all that apply',
      multiSelect: true,
      options: [
        option('none', 'None of the below'),
        option('t2d', 'Type 2 diabetes'),
        option('thyroid', 'Thyroid disease (hypo/hyper)'),
        option('pancreas', 'Pancreatitis or history of pancreatic problems'),
        option('cancer', 'Cancer'),
        option('gi', 'Severe gastrointestinal disease'),
        option('gallbladder', 'Gallbladder disease'),
      ],
      validationRules: [
        { operator: 'isNotEmpty', message: 'This field is required', severity: 'error' },
        { field: 'diagnoses', operator: '==', value: 'Pancreatitis or history of pancreatic problems', message: STOP, severity: 'error' },
        { field: 'diagnoses', operator: '==', value: 'Severe gastrointestinal disease', message: STOP, severity: 'error' },
      ],
      navigationRules: [{ condition: 'diagnoses == "Cancer"', target: 'ms-cancer-detail' }],
      nextBlockId: 'ms-symptoms',
    },
    {
      type: 'textfield',
      uuid: 'ms-cancer-detail',
      fieldName: 'cancerDetail',
      label: 'You have/had a cancer diagnosis. Please tell us the type and when it was diagnosed.',
      placeholder: 'Type your answer here',
    },
    {
      type: 'yesNoAnswer',
      uuid: 'ms-symptoms',
      fieldName: 'symptoms',
      label: 'Do you currently experience any symptoms that limit your daily activity?',
      yesLabel: 'Yes',
      noLabel: 'No',
    },
  ],
};

export default function MultiSelectHardStopPage() {
  const [values, setValues] = useState<Record<string, unknown>>({});

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
          <SurveyForm
            survey={{ rootNode, theme: themes.uniloop }}
            onChange={(v: Record<string, unknown>) => setValues(v)}
            onSubmit={() => {}}
          />
        </div>
        <aside className="rounded-lg border border-gray-300 bg-white p-3 text-xs">
          <h2 className="mb-2 font-semibold text-gray-900">Form data</h2>
          <pre id="form-data" className="whitespace-pre-wrap break-words text-gray-700">
            {JSON.stringify(values, null, 2)}
          </pre>
        </aside>
      </div>
    </main>
  );
}
