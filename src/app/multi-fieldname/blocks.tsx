'use client';

// Test blocks for the multi field name check page. Not committed.
// Both answer an object with two keys, frequency and severity, that the form can save under
// their own field names (BlockData.outputFields).

import React from 'react';
import { Activity, ListChecks } from 'lucide-react';
import type { BlockDefinition, BlockRendererProps } from '@/packages/survey-form-package/src/types';

const FREQUENCY = [
  { label: 'Every day', value: 'daily' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Rarely', value: 'rarely' },
];
const SEVERITY = [
  { label: 'Mild', value: 'mild' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Severe', value: 'severe' },
];

const outputSchema = {
  type: 'object' as const,
  properties: {
    frequency: { type: 'string' as const, description: 'How often do you get headaches?', options: FREQUENCY },
    severity: { type: 'string' as const, description: 'How bad are your headaches?', options: SEVERITY },
  },
};

const Choice = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    style={{
      padding: '12px 16px',
      borderRadius: 10,
      border: `2px solid ${selected ? '#1d4ed8' : '#d4d4d8'}`,
      background: selected ? '#eff6ff' : '#fff',
      fontWeight: 500,
      textAlign: 'left',
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const FieldError = ({ children }: { children?: string }) =>
  children ? (
    <p role="alert" style={{ color: '#b91c1c', fontSize: 14, margin: '6px 0 0' }}>
      {children}
    </p>
  ) : null;

// Two questions in one block: each pick updates its key of the block's answer
const HeadacheRenderer = ({ block, value, onChange, error, fieldErrors }: BlockRendererProps) => {
  const answer = (value as Record<string, string> | undefined) ?? {};
  const pick = (key: string, picked: string) => onChange?.({ ...answer, [key]: picked });
  const group = (key: 'frequency' | 'severity', title: string, options: typeof FREQUENCY) => (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 8 }}>{title}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => (
          <Choice key={option.value} selected={answer[key] === option.value} onClick={() => pick(key, option.value)}>
            {option.label}
          </Choice>
        ))}
      </div>
      <FieldError>{fieldErrors?.[key]}</FieldError>
    </fieldset>
  );

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{block.label}</h2>
      {group('frequency', 'How often?', FREQUENCY)}
      {group('severity', 'How bad?', SEVERITY)}
      <FieldError>{error}</FieldError>
    </div>
  );
};

const PRESETS = [
  { label: 'Every day, mild', value: { frequency: 'daily', severity: 'mild' } },
  { label: 'Every week, severe', value: { frequency: 'weekly', severity: 'severe' } },
  { label: 'Rarely, moderate', value: { frequency: 'rarely', severity: 'moderate' } },
];

// One pick sets both keys, so an auto-continue step routes on a mapped key in the same tick
const PresetRenderer = ({ block, value, onChange, error, fieldErrors }: BlockRendererProps) => {
  const answer = value as Record<string, string> | undefined;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{block.label}</h2>
      {PRESETS.map((preset) => (
        <Choice
          key={preset.label}
          selected={answer?.frequency === preset.value.frequency && answer?.severity === preset.value.severity}
          onClick={() => onChange?.(preset.value)}
        >
          {preset.label}
        </Choice>
      ))}
      <FieldError>{fieldErrors?.frequency ?? fieldErrors?.severity ?? error}</FieldError>
    </div>
  );
};

const Settings = () => <p style={{ fontSize: 12, color: '#71717a' }}>No settings: a test block.</p>;
const Item = ({ data }: { data: { label?: string } }) => <div>{data.label}</div>;

export const HeadacheCheckBlock: BlockDefinition = {
  type: 'headacheCheck',
  name: 'Headache Check (test)',
  description: 'Two questions in one block, for the multi field name check',
  icon: <Activity className="w-4 h-4" />,
  defaultData: { type: 'headacheCheck', label: 'Tell us about your headaches', fieldName: 'headaches' },
  renderItem: (props: any) => <Item {...props} />,
  renderFormFields: () => <Settings />,
  renderPreview: () => <div>Headache Check</div>,
  renderBlock: (props) => <HeadacheRenderer {...props} />,
  outputSchema,
  fieldConfig: { enabled: true, label: 'Field Name', required: true },
} as BlockDefinition;

export const HeadachePresetBlock: BlockDefinition = {
  type: 'headachePreset',
  name: 'Headache Preset (test)',
  description: 'One pick sets both keys, for the multi field name check',
  icon: <ListChecks className="w-4 h-4" />,
  defaultData: { type: 'headachePreset', label: 'Which best describes last week?', fieldName: 'lastWeek' },
  renderItem: (props: any) => <Item {...props} />,
  renderFormFields: () => <Settings />,
  renderPreview: () => <div>Headache Preset</div>,
  renderBlock: (props) => <PresetRenderer {...props} />,
  outputSchema,
  fieldConfig: { enabled: true, label: 'Field Name', required: true },
} as BlockDefinition;
