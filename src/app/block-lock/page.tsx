'use client';

// Local check page for locked blocks in the builder. Not committed.

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { StandardBlocks } from '@/packages/survey-form-package/src/blocks';
import { StandardNodes } from '@/packages/survey-form-package/src/builder/nodes';

const SurveyBuilder = dynamic(
  () =>
    import('@/packages/survey-form-package/src/builder/survey/SurveyBuilder').then(
      (mod) => mod.SurveyBuilder,
    ),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);

const goalOptions = [
  { id: 'bl-o1', label: 'Feel better', value: 'feel-better' },
  { id: 'bl-o2', label: 'Sleep better', value: 'sleep-better' },
];
const goalBase = {
  type: 'selectablebox',
  uuid: 'bl-goal',
  fieldName: 'goal',
  label: 'What is your main goal?',
  options: goalOptions,
};
// A stopped A/B test whose variant B saves a different value for the first option.
const goal = {
  ...goalBase,
  locked: true,
  abTest: {
    enabled: false,
    variants: [
      { id: 'bl-va', name: 'Variant A', weight: 1, blockData: goalBase },
      {
        id: 'bl-vb',
        name: 'Variant B',
        weight: 1,
        blockData: { ...goalBase, options: [{ ...goalOptions[0], value: 'lw' }, goalOptions[1]] },
      },
    ],
  },
};
const firstName = {
  type: 'textfield',
  uuid: 'bl-first',
  fieldName: 'firstName',
  label: 'First name',
  locked: true,
};
const smoker = {
  type: 'yesNoAnswer',
  uuid: 'bl-smoker',
  fieldName: 'smoker',
  label: 'Do you smoke?',
};
const email = {
  type: 'textfield',
  uuid: 'bl-email',
  fieldName: 'email',
  label: 'Email',
};

const pageless = {
  type: 'section',
  uuid: 'bl-root',
  name: 'Block lock check',
  items: [goal, firstName, smoker, email],
};

// A locked block with a rule and an explicit next step to an unlocked end block mid-list.
const routing = {
  type: 'section',
  uuid: 'bl-root-routing',
  name: 'Block lock check (routing)',
  items: [
    {
      type: 'textfield',
      uuid: 'bl-age',
      fieldName: 'age',
      label: 'How old are you?',
      locked: true,
      nextBlockId: 'bl-under',
      navigationRules: [{ condition: 'age > 80', target: 'bl-email' }],
    },
    smoker,
    { type: 'textfield', uuid: 'bl-under', fieldName: 'under', label: 'Last question', isEndBlock: true },
    email,
  ],
};

// Each built-in question block with options, locked: wording stays editable, values don't.
const opt = (n: string, v: string) => ({ id: `bl-${n}-${v}`, label: v === 'y' ? 'Yes please' : 'No thanks', value: v });
const optionBlocks = {
  type: 'section',
  uuid: 'bl-root-options',
  name: 'Block lock check (option blocks)',
  items: [
    { type: 'radio', uuid: 'bl-radio', fieldName: 'contact', label: 'Can we contact you?', options: [opt('r', 'y'), opt('r', 'n')], locked: true },
    { type: 'select', uuid: 'bl-select', fieldName: 'reminder', label: 'Send reminders?', options: [opt('s', 'y'), opt('s', 'n')], locked: true },
    { type: 'checkbox', uuid: 'bl-check', fieldName: 'topics', label: 'Topics you want', options: [opt('c', 'y'), opt('c', 'n')], locked: true },
    { ...smoker, uuid: 'bl-yesno', locked: true },
    { ...goalBase, uuid: 'bl-goal-opts', locked: true },
  ],
};

const paged = {
  type: 'section',
  uuid: 'bl-root-paged',
  name: 'Block lock check (paged)',
  items: [
    { type: 'set', uuid: 'bl-page-1', name: 'Page with a locked block', items: [goal, smoker] },
    { type: 'set', uuid: 'bl-page-2', name: 'Page without one', items: [email] },
  ],
};

const summarize = (items: any[] = []): any[] =>
  items.map((b) =>
    b.type === 'set'
      ? { page: b.name, blocks: summarize(b.items) }
      : {
          uuid: b.uuid,
          type: b.type,
          fieldName: b.fieldName,
          label: b.label,
          locked: b.locked,
          options: b.options?.map((o: any) => `${o.label} = ${o.value}`),
          rules: b.navigationRules?.length || 0,
          ruleTargets: b.navigationRules?.map((r: any) => r.target),
          next: b.nextBlockId,
          end: b.isEndBlock,
          abEnabled: b.abTest?.enabled,
          multiSelect: b.multiSelect,
          yesLabel: b.yesLabel,
          abValues: b.abTest?.variants?.map((v: any) => v.blockData.options?.map((o: any) => o.value).join('|')),
        },
  );

export default function BlockLockPage() {
  const [mode, setMode] = useState<'pageless' | 'paged' | 'routing' | 'options'>('pageless');
  const [hideLock, setHideLock] = useState(false);
  const [exported, setExported] = useState<any>(null);

  return (
    <div className="min-h-screen bg-white p-4 text-gray-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-xl font-bold">Block lock check</h1>
        <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-gray-50 p-3 text-sm">
          <label className="flex flex-col gap-1">
            Mode
            <select
              id="mode"
              className="rounded border bg-white p-1"
              value={mode}
              onChange={(e) => {
                setExported(null);
                setMode(e.target.value as 'pageless' | 'paged' | 'routing' | 'options');
              }}
            >
              <option value="pageless">pageless</option>
              <option value="paged">paged</option>
              <option value="routing">routing</option>
              <option value="options">options</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              id="hide-lock"
              type="checkbox"
              checked={hideLock}
              onChange={(e) => setHideLock(e.target.checked)}
            />
            hideBlockLockControls
          </label>
        </div>

        <div className="rounded-lg border" style={{ height: 760 }}>
          <SurveyBuilder
            key={mode}
            blockDefinitions={StandardBlocks}
            nodeDefinitions={StandardNodes}
            initialData={{ rootNode: ({ pageless, paged, routing, options: optionBlocks }[mode]) as any }}
            mode={mode === 'paged' ? 'paged' : 'pageless'}
            hideBlockLockControls={hideLock}
            onDataChange={setExported}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold">Builder export</h2>
          <pre id="exported" className="max-h-96 overflow-auto rounded bg-gray-100 p-2 text-xs">
            {exported?.rootNode
              ? JSON.stringify(summarize(exported.rootNode.items), null, 2)
              : 'no change yet'}
          </pre>
        </div>
      </div>
    </div>
  );
}
