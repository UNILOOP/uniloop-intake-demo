'use client';

import { useSyncExternalStore, type ComponentProps } from 'react';
import type {
  ExternalField,
  ExternalStore,
  ExternalSyncAdapter,
  ExternalValues,
} from '@/packages/survey-form-package/src';
import { hasExternalValue } from '@/packages/survey-form-package/src';
import type { GlobalCustomField } from '@/packages/survey-form-package/src/builder';

/**
 * Patient keys the EMR demo hands to the survey package as external fields.
 * The package only sees these as plain keys; everything patient-specific stays here.
 */
export const PATIENT_FIELDS: ExternalField[] = [
  { key: 'patient.email', label: 'Email', type: 'string', group: 'Patient' },
  { key: 'patient.phone', label: 'Phone', type: 'string', group: 'Patient' },
  { key: 'patient.firstName', label: 'First name', type: 'string', group: 'Patient' },
  { key: 'patient.middleName', label: 'Middle name', type: 'string', group: 'Patient' },
  { key: 'patient.lastName', label: 'Last name', type: 'string', group: 'Patient' },
  { key: 'patient.dateOfBirth', label: 'Date of birth', type: 'date', group: 'Patient' },
  {
    key: 'patient.gender',
    label: 'Gender',
    type: 'string',
    group: 'Patient',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
    ],
  },
  {
    key: 'patient.genderBiological',
    label: 'Biological sex',
    type: 'string',
    group: 'Patient',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
    ],
  },
  { key: 'patient.height', label: 'Height (in)', type: 'number', group: 'Patient' },
  { key: 'patient.weight', label: 'Weight (lbs)', type: 'number', group: 'Patient' },
  { key: 'patient.address.line1', label: 'Address line 1', type: 'string', group: 'Patient address' },
  { key: 'patient.address.city', label: 'City', type: 'string', group: 'Patient address' },
  { key: 'patient.address.state', label: 'State', type: 'string', group: 'Patient address' },
  { key: 'patient.address.zip', label: 'ZIP', type: 'string', group: 'Patient address' },
];

const NUMBER_KEYS = new Set(
  PATIENT_FIELDS.filter((field) => field.type === 'number').map((field) => field.key),
);

/** What the mapping field saves on a block */
export interface PatientMapping {
  bindings: Array<{ internalKey: string; externalKey: string }>;
  /** Skip the block when every mapped key already has a value from the patient */
  autoContinue?: boolean;
}

export const PATIENT_MAPPING_KEY = 'patientMapping';

const readMapping = (block: any): PatientMapping | undefined => {
  const mapping = block?.[PATIENT_MAPPING_KEY];
  return mapping && Array.isArray(mapping.bindings) ? mapping : undefined;
};

/** Patient values from the stored patient profile, keyed like `PATIENT_FIELDS` */
export function patientToExternal(patient: Record<string, any> | null | undefined): ExternalValues {
  if (!patient) return {};
  const values: ExternalValues = {
    'patient.email': patient.email,
    'patient.phone': patient.phone,
    'patient.firstName': patient.firstName ?? patient.first_name,
    'patient.middleName': patient.middleName ?? patient.middle_name,
    'patient.lastName': patient.lastName ?? patient.last_name,
    'patient.dateOfBirth': patient.dateOfBirth ?? patient.date_of_birth,
    'patient.gender': patient.gender,
    'patient.genderBiological': patient.genderBiological ?? patient.gender_biological,
    'patient.height': patient.height,
    'patient.weight': patient.weight,
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => hasExternalValue(value)),
  );
}

const FIELD_OPTIONS = new Map(
  PATIENT_FIELDS.filter((field) => field.options).map((field) => [field.key, field.options!]),
);

/** The option whose value matches `value` ignoring case, e.g. "Female" -> "female" */
const matchOption = (options: Array<{ value: string }> | undefined, value: unknown) =>
  typeof value === 'string'
    ? options?.find((option) => String(option.value).toLowerCase() === value.toLowerCase())?.value
    : undefined;

/** Two-way sync between blocks and patient keys, driven by each block's `patientMapping` */
export const patientSync: ExternalSyncAdapter = {
  getBindings: (block) =>
    (readMapping(block)?.bindings ?? []).filter(
      (binding) => binding.internalKey && binding.externalKey,
    ),
  // Blocks spell the same choice differently ("Female" vs "female"), so patient keys
  // with options keep the canonical value and each block gets its own spelling back
  toInternal: (value, _binding, block) => matchOption(block.options, value) ?? value,
  toExternal: (value, binding) => {
    const option = matchOption(FIELD_OPTIONS.get(binding.externalKey), value);
    if (option !== undefined) return option;
    if (!NUMBER_KEYS.has(binding.externalKey) || value === '' || value == null) return value;
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  },
  shouldSkipBlock: (block, { values, externalValues, bindings }) =>
    !!readMapping(block)?.autoContinue &&
    bindings.length > 0 &&
    bindings.every(
      (binding) =>
        hasExternalValue(externalValues[binding.externalKey]) &&
        hasExternalValue(readValue(values, binding.internalKey)),
    ),
};

function readValue(values: Record<string, any>, key: string) {
  if (key in values) return values[key];
  const dot = key.indexOf('.');
  return dot === -1 ? undefined : values[key.slice(0, dot)]?.[key.slice(dot + 1)];
}

const control = 'rounded-md border px-2 py-1 bg-background text-xs min-w-0 flex-1';

type MappingFieldProps = ComponentProps<GlobalCustomField['component']>;

/** Builder field: map this block's keys to patient keys */
function PatientMappingEditor({ data, onUpdate, fieldNames = [], externalFields = [] }: MappingFieldProps) {
  const mapping = readMapping(data);
  const ownKeys = fieldNames.length ? fieldNames : data.fieldName ? [data.fieldName] : [];
  // Until edited, the block's own field is listed (unmapped) so the editor starts from it
  const rows = mapping?.bindings ?? (ownKeys[0] ? [{ internalKey: ownKeys[0], externalKey: '' }] : []);

  const save = (next: Partial<PatientMapping>) =>
    onUpdate({
      ...data,
      [PATIENT_MAPPING_KEY]: { bindings: rows, autoContinue: !!mapping?.autoContinue, ...next },
    });
  const setRow = (index: number, patch: Partial<PatientMapping['bindings'][number]>) =>
    save({ bindings: rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  if (!ownKeys.length) {
    return <p className="text-xs text-muted-foreground">Give this block a field name to map it.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            aria-label="Block key"
            className={control}
            value={row.internalKey}
            onChange={(event) => setRow(index, { internalKey: event.target.value })}
          >
            {[...new Set([row.internalKey, ...ownKeys])].filter(Boolean).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">↔</span>
          <select
            aria-label="Patient key"
            className={control}
            value={row.externalKey}
            onChange={(event) => setRow(index, { externalKey: event.target.value })}
          >
            <option value="">Not mapped</option>
            {externalFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label ? `${field.label} (${field.key})` : field.key}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs text-red-600"
            aria-label="Remove mapping"
            onClick={() => save({ bindings: rows.filter((_, i) => i !== index) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs underline"
        onClick={() =>
          save({ bindings: [...rows, { internalKey: ownKeys[0], externalKey: '' }] })
        }
      >
        Add mapping
      </button>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!mapping?.autoContinue}
          onChange={(event) => save({ autoContinue: event.target.checked })}
        />
        Auto continue when the patient already has these values
      </label>
    </div>
  );
}

export const patientMappingField: GlobalCustomField = {
  key: PATIENT_MAPPING_KEY,
  label: 'Patient mapping',
  description: 'Keep block keys and patient keys in step, both ways.',
  component: PatientMappingEditor,
};

/** Edits patient values in place; a mounted form picks each change up without remounting */
export function PatientContextPanel({ store }: { store: ExternalStore }) {
  const values = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <details className="rounded border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Patient context</summary>
      <p className="mt-2 text-xs text-muted-foreground">
        External keys passed to the form. Edits here update mapped blocks live; answers to
        mapped blocks update these.
      </p>
      <div className="mt-2 space-y-2">
        {PATIENT_FIELDS.map((field) => (
          <label key={field.key} className="block text-xs">
            {field.label}
            {field.options ? (
              <select
                className={`${control} block w-full mt-1`}
                value={values[field.key] ?? ''}
                onChange={(event) =>
                  store.setValues({ [field.key]: event.target.value || undefined })
                }
              >
                <option value="">—</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={`${control} block w-full mt-1`}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={values[field.key] ?? ''}
                onChange={(event) => {
                  const raw = event.target.value;
                  store.setValues({
                    [field.key]:
                      raw === '' ? undefined : field.type === 'number' ? Number(raw) : raw,
                  });
                }}
              />
            )}
          </label>
        ))}
      </div>
    </details>
  );
}
