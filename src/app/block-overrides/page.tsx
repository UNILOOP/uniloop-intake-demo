'use client';

// Local check page for the blockOverrides prop. Not committed.

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, ToggleRight, Bug } from 'lucide-react';
import { registerBlock } from '@/packages/survey-form-package/src';
import type { BlockOverrides } from '@/packages/survey-form-package/src';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ChatRendererProps,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { StandardBlocks } from '@/packages/survey-form-package/src/blocks';
import { StandardNodes } from '@/packages/survey-form-package/src/builder/nodes';

const SurveyForm = dynamic(
  () => import('@/packages/survey-form-package/src/renderer/SurveyForm').then((mod) => mod.SurveyForm),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);

const SurveyBuilder = dynamic(
  () =>
    import('@/packages/survey-form-package/src/builder/survey/SurveyBuilder').then(
      (mod) => mod.SurveyBuilder,
    ),
  { ssr: false, loading: () => <Loader2 className="w-6 h-6 animate-spin" /> },
);

// ---------- Demo override: same { answer, details } shape, different look ----------

type YesNo = { answer: 'Yes' | 'No'; details: string };

function Pills({
  block,
  value,
  onPick,
  disabled,
}: {
  block: BlockData;
  value?: Partial<YesNo>;
  onPick: (answer: 'Yes' | 'No') => void;
  disabled?: boolean;
}) {
  const options: Array<['Yes' | 'No', string]> = [
    ['Yes', block.yesLabel || 'Yes'],
    ['No', block.noLabel || 'No'],
  ];
  return (
    <div className="flex gap-3" data-testid="override-pills">
      {options.map(([answer, label]) => (
        <button
          key={answer}
          type="button"
          disabled={disabled}
          onClick={() => onPick(answer)}
          className={`rounded-full border-2 px-6 py-2 text-sm font-semibold transition ${
            value?.answer === answer
              ? 'border-fuchsia-600 bg-fuchsia-600 text-white'
              : 'border-fuchsia-300 bg-white text-fuchsia-700 hover:border-fuchsia-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OverrideBadge() {
  return (
    <span className="inline-block rounded bg-fuchsia-100 px-2 py-0.5 text-xs font-medium text-fuchsia-800">
      Custom Yes/No (override)
    </span>
  );
}

function OverrideYesNoRenderer({ block, value, onChange, error, disabled }: BlockRendererProps) {
  const current = (value || {}) as Partial<YesNo>;
  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-fuchsia-300 p-4 text-left">
      <OverrideBadge />
      <p className="text-lg font-semibold">{block.label}</p>
      <Pills
        block={block}
        value={current}
        disabled={disabled}
        onPick={(answer) => onChange?.({ answer, details: answer === 'Yes' ? current.details || '' : '' })}
      />
      {current.answer === 'Yes' && (
        <textarea
          className="w-full rounded-md border p-2 text-sm"
          placeholder={block.detailsPlaceholder || 'Type your answer here'}
          value={current.details || ''}
          onChange={(e) => onChange?.({ answer: 'Yes', details: e.target.value })}
        />
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

function OverrideYesNoChat({ block, value, onChange, onSubmit, disabled }: ChatRendererProps) {
  const current = (value || {}) as Partial<YesNo>;
  return (
    <div className="space-y-2" data-testid="override-chat">
      <OverrideBadge />
      <Pills
        block={block}
        value={current}
        disabled={disabled}
        onPick={(answer) =>
          answer === 'No' ? onSubmit({ answer, details: '' }) : onChange({ answer, details: current.details || '' })
        }
      />
      {current.answer === 'Yes' && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border p-2 text-sm"
            placeholder="Which surgery, and when?"
            value={current.details || ''}
            onChange={(e) => onChange({ answer: 'Yes', details: e.target.value })}
          />
          <button
            type="button"
            className="rounded-md bg-fuchsia-600 px-3 text-sm text-white"
            onClick={() => onSubmit({ answer: 'Yes', details: current.details || '' })}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function OverrideYesNoItem({ data }: ContentBlockItemProps) {
  return (
    <div className="space-y-2 p-2">
      <OverrideBadge />
      <p className="font-medium">{data.label}</p>
      <Pills block={data} onPick={() => {}} disabled />
    </div>
  );
}

function OverrideYesNoForm({ data, onUpdate }: ContentBlockItemProps) {
  return (
    <div className="space-y-2" data-testid="override-settings">
      <OverrideBadge />
      <label className="block text-sm font-medium" htmlFor="override-question">
        Question (override settings)
      </label>
      <input
        id="override-question"
        className="w-full rounded-md border p-2 text-sm"
        value={data.label || ''}
        onChange={(e) => onUpdate?.({ ...data, label: e.target.value })}
      />
    </div>
  );
}

const overrideDefaults: BlockData = {
  type: 'demoYesNoOverride',
  fieldName: '',
  label: 'Custom yes/no question',
  yesLabel: 'Yes',
  noLabel: 'No',
  isCustom: true,
};

const DemoYesNoOverride: BlockDefinition = {
  type: 'demoYesNoOverride',
  name: 'Custom Yes/No',
  description: 'Pill buttons; saves { answer, details }',
  icon: <ToggleRight className="w-4 h-4" />,
  defaultData: overrideDefaults,
  generateDefaultData: () => ({ ...overrideDefaults, fieldName: `customYesNo_${Date.now().toString(36)}` }),
  renderItem: (props) => <OverrideYesNoItem {...props} />,
  renderFormFields: (props) => <OverrideYesNoForm {...props} />,
  renderPreview: () => <OverrideBadge />,
  renderBlock: (props) => <OverrideYesNoRenderer {...props} />,
  chatRenderer: (props) => <OverrideYesNoChat {...props} />,
  validateValue: (value) => {
    const v = (value || {}) as Partial<YesNo>;
    if (v.answer !== 'Yes' && v.answer !== 'No') return 'Pick Yes or No to continue (override check)';
    if (v.answer === 'Yes' && !v.details?.trim()) return 'Tell us a bit more (override check)';
    return null;
  },
  outputSchema: {
    type: 'object',
    properties: {
      answer: { type: 'string', enum: ['Yes', 'No'] },
      details: { type: 'string' },
    },
  } as BlockDefinition['outputSchema'],
};

function Broken(): React.JSX.Element {
  throw new Error('demoBrokenOverride always throws while rendering');
}

const DemoBrokenOverride: BlockDefinition = {
  type: 'demoBrokenOverride',
  name: 'Broken override',
  description: 'Throws while rendering',
  icon: <Bug className="w-4 h-4" />,
  defaultData: { type: 'demoBrokenOverride', fieldName: '', label: 'Broken', isCustom: true },
  renderItem: () => <Broken />,
  renderFormFields: () => <Broken />,
  renderPreview: () => <span>Broken</span>,
  renderBlock: () => <Broken />,
  chatRenderer: () => <Broken />,
};

registerBlock(DemoYesNoOverride);
registerBlock(DemoBrokenOverride);

// ---------- Survey ----------

const survey = {
  rootNode: {
    type: 'section',
    uuid: 'bo-root',
    name: 'Block overrides check',
    items: [
      {
        type: 'markdown',
        uuid: 'bo-md',
        text: '**Block overrides check.** This intro is a markdown block.',
      },
      {
        type: 'yesNoAnswer',
        uuid: 'bo-yn',
        fieldName: 'hadSurgery',
        label: 'Have you had surgery before?',
        yesLabel: 'Yes',
        noLabel: 'No',
        detailsPrompt: 'Which surgery, and when?',
        detailsPlaceholder: 'Type your answer here',
        detailsRequired: true,
      },
      {
        type: 'radio',
        uuid: 'bo-sb',
        fieldName: 'goal',
        label: 'What is your main goal?',
        options: [
          { id: 'bo-o1', label: 'Feel better', value: 'feel-better' },
          { id: 'bo-o2', label: 'Sleep better', value: 'sleep-better' },
        ],
      },
      {
        type: 'textfield',
        uuid: 'bo-tf',
        fieldName: 'firstName',
        label: 'First name',
      },
    ],
  },
} as any;

const MAPPINGS: Record<string, BlockOverrides | undefined> = {
  none: undefined,
  override: { yesNoAnswer: 'demoYesNoOverride' },
  broken: { yesNoAnswer: 'demoBrokenOverride' },
  unregistered: { yesNoAnswer: 'notRegisteredBlock' },
};

export default function BlockOverridesPage() {
  const [mapping, setMapping] = useState('none');
  const [layout, setLayout] = useState('default');
  const [tab, setTab] = useState<'form' | 'builder'>('form');
  const [formRun, setFormRun] = useState(0);
  const [submitted, setSubmitted] = useState<Record<string, any> | null>(null);
  const [exported, setExported] = useState<any>(null);

  const blockOverrides = useMemo(() => MAPPINGS[mapping], [mapping]);

  return (
    <div className="min-h-screen bg-white p-4 text-gray-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-xl font-bold">Block overrides check</h1>
        <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-gray-50 p-3 text-sm">
          <label className="flex flex-col gap-1">
            Mapping for yesNoAnswer
            <select
              id="mapping"
              className="rounded border bg-white p-1"
              value={mapping}
              onChange={(e) => setMapping(e.target.value)}
            >
              <option value="none">none</option>
              <option value="override">demoYesNoOverride</option>
              <option value="broken">demoBrokenOverride</option>
              <option value="unregistered">notRegisteredBlock</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Layout
            <select
              id="layout"
              className="rounded border bg-white p-1"
              value={layout}
              onChange={(e) => {
                setLayout(e.target.value);
                setFormRun((n) => n + 1);
              }}
            >
              <option value="default">default</option>
              <option value="chat">chat</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              id="tab-form"
              type="button"
              className={`rounded px-3 py-1 ${tab === 'form' ? 'bg-gray-900 text-white' : 'border bg-white'}`}
              onClick={() => setTab('form')}
            >
              Form
            </button>
            <button
              id="tab-builder"
              type="button"
              className={`rounded px-3 py-1 ${tab === 'builder' ? 'bg-gray-900 text-white' : 'border bg-white'}`}
              onClick={() => setTab('builder')}
            >
              Builder
            </button>
            <button
              id="restart"
              type="button"
              className="rounded border bg-white px-3 py-1"
              onClick={() => {
                setSubmitted(null);
                setFormRun((n) => n + 1);
              }}
            >
              Restart form
            </button>
          </div>
        </div>

        {tab === 'form' ? (
          <div className="rounded-lg border p-2" style={{ minHeight: 420 }}>
            <SurveyForm
              key={`${layout}-${formRun}`}
              survey={survey}
              layout={layout}
              mode="pageless"
              blockOverrides={blockOverrides}
              onSubmit={(data: Record<string, any>) => setSubmitted(data)}
            />
          </div>
        ) : (
          <div className="rounded-lg border" style={{ height: 760 }}>
            <SurveyBuilder
              blockDefinitions={StandardBlocks}
              nodeDefinitions={StandardNodes}
              initialData={{ rootNode: survey.rootNode }}
              blockOverrides={blockOverrides}
              onDataChange={setExported}
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Submitted values</h2>
            <pre id="submitted" className="max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
              {submitted ? JSON.stringify(submitted, null, 2) : 'not submitted'}
            </pre>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Builder export (block types)</h2>
            <pre id="exported" className="max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
              {exported?.rootNode
                ? JSON.stringify(
                    (exported.rootNode.items || []).map((b: any) => ({
                      type: b.type,
                      fieldName: b.fieldName,
                      label: b.label,
                      isCustom: b.isCustom,
                    })),
                    null,
                    2,
                  )
                : 'builder not opened'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
