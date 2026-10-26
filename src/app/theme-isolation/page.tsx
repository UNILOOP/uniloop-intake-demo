'use client';

// Local check page for scoping the theme's runtime colour rules. Not committed.

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { themes } from '@/packages/survey-form-package/src/themes';

const SurveyForm = dynamic(
  () => import('@/packages/survey-form-package/src/renderer/SurveyForm').then((mod) => mod.SurveyForm),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);

const THEME_NAMES = ['uniloop', 'default', 'modern', 'hims'] as const;
type ThemeName = (typeof THEME_NAMES)[number];

const rootNode = {
  type: 'section',
  uuid: 'ti-root',
  name: 'Theme isolation check',
  items: [
    {
      type: 'set',
      uuid: 'ti-page-1',
      name: 'Page 1',
      items: [
        {
          type: 'selectablebox',
          uuid: 'ti-sb',
          fieldName: 'goal',
          label: 'What is your main goal?',
          multiSelect: false,
          showSelectionIndicator: false,
          options: [
            { id: 'ti-sb-1', label: 'Lose weight', value: 'lose-weight' },
            { id: 'ti-sb-2', label: 'Feel better', value: 'feel-better' },
          ],
        },
        {
          type: 'yesNoAnswer',
          uuid: 'ti-yn',
          fieldName: 'hadSurgery',
          label: 'Have you had surgery before?',
          yesLabel: 'Yes',
          noLabel: 'No',
        },
        {
          type: 'select',
          uuid: 'ti-select',
          fieldName: 'state',
          label: 'Which state do you live in?',
          placeholder: 'Choose from the list...',
          labels: ['California', 'Texas'],
          values: ['CA', 'TX'],
        },
        {
          type: 'datepicker',
          uuid: 'ti-date',
          fieldName: 'startDate',
          label: 'When would you like to start?',
          placeholder: 'Pick a date',
          dateFormat: 'PPP',
          minAge: '',
        },
        {
          type: 'textfield',
          uuid: 'ti-tf',
          fieldName: 'firstName',
          label: 'First name',
          placeholder: 'Type your answer here',
        },
      ],
    },
  ],
};

export default function ThemeIsolationPage() {
  const [themeName, setThemeName] = useState<ThemeName>('uniloop');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [ruleCount, setRuleCount] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const tag = document.getElementById('dynamic-color-styles') as HTMLStyleElement | null;
      setRuleCount(tag?.sheet?.cssRules.length ?? 0);
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section id="host-panel" className="rounded-lg border border-gray-300 bg-white p-4">
          <h1 className="text-lg font-semibold text-gray-900">Host app (outside the form)</h1>
          <p className="text-sm text-gray-600">
            The search box uses the same class as the theme&apos;s selectable box focus,
            <code className="mx-1">focus-within:border-[#948EC4]</code>. It should only turn purple while you type in it.
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <div
              id="host-search"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-[#948EC4]"
            >
              <input className="w-full text-sm outline-none" placeholder="Search forms (host field)" />
            </div>
            <label className="text-sm text-gray-700">
              Theme{' '}
              <select
                id="theme-select"
                className="rounded border border-gray-300 px-2 py-1"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value as ThemeName)}
              >
                {THEME_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Mode{' '}
              <select
                id="mode-select"
                className="rounded border border-gray-300 px-2 py-1"
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark')}
              >
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>
            <span id="rule-count" className="text-sm text-gray-700">
              Runtime colour rules: <strong>{ruleCount}</strong>
            </span>
          </div>
        </section>

        <div className="overflow-hidden rounded-lg border border-gray-300">
          <SurveyForm
            survey={{ rootNode, theme: themes[themeName] }}
            mode="paged"
            themeMode={themeMode}
            onSubmit={() => {}}
          />
        </div>
      </div>
    </main>
  );
}
