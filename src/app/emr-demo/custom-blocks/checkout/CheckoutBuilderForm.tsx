import type { ContentBlockItemProps } from '@/packages/survey-form-package/src/types';
import { Plus, X } from 'lucide-react';
import React from 'react';
import {
  BENEFIT_ICONS,
  CHECKOUT_FIELD_NAME,
  COPY_DEFAULTS,
  COPY_GROUPS,
  readBenefits,
  readCopy,
  readDisclaimers,
  readPreferredMedicationRules,
  readStepCopy,
  STEP_COPY_DEFAULTS,
  STEP_COPY_GROUP,
  type BenefitIcon,
  type PreferredMedicationRule,
} from './copy';

// ============================================================================
// Builder
// ============================================================================

const builderInputClass =
  'h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm';

export const CheckoutBuilderForm: React.FC<
  ContentBlockItemProps & { step?: 'single' | 'selection' | 'shipping' | 'payment' }
> = ({ data, onUpdate, step = 'single' }) => {
  const copy = readCopy(data);
  const stepCopy = readStepCopy(data);
  const rules = readPreferredMedicationRules(data);
  const benefits = readBenefits(data);
  const disclaimers = readDisclaimers(data);
  const handleUpdate = (field: string, next: unknown) =>
    onUpdate?.({ ...data, [field]: next });
  const updateRule = (
    index: number,
    field: keyof PreferredMedicationRule,
    next: string,
  ) =>
    handleUpdate(
      'preferredMedicationRules',
      rules.map((rule, position) =>
        position === index ? { ...rule, [field]: next } : rule,
      ),
    );

  return (
    <div className="space-y-4 text-sm">
      {/* Your plan and Shipping store nothing of their own: the choices and the address go to the checkout draft, and
          Payment submits the order. */}
      {step === 'selection' || step === 'shipping' ? null : (
        <div className="space-y-1">
          <label htmlFor="spc-fieldName" className="block font-medium">
            Field Name *
          </label>
          <input
            id="spc-fieldName"
            value={data.fieldName || ''}
            onChange={(event) => handleUpdate('fieldName', event.target.value)}
            placeholder={CHECKOUT_FIELD_NAME}
            className={builderInputClass}
          />
          <p className="text-xs text-gray-500">
            Stores the payment confirmation for this checkout.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.showDrugImages ?? true}
            onChange={(event) =>
              handleUpdate('showDrugImages', event.target.checked)
            }
          />
          Show medication images
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.showTitrationOptions ?? true}
            onChange={(event) =>
              handleUpdate('showTitrationOptions', event.target.checked)
            }
          />
          Show the Change dose option
        </label>
      </div>

      {COPY_GROUPS.map((group) => (
        <details
          key={group.title}
          className="rounded-md border border-gray-200 p-3"
        >
          <summary className="cursor-pointer font-medium">
            {group.title}
          </summary>
          <div className="mt-3 space-y-3">
            {group.hint ? (
              <p className="text-xs text-gray-500">{group.hint}</p>
            ) : null}
            {group.fields.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`spc-${key}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  {label}
                </label>
                {COPY_DEFAULTS[key].length > 60 ? (
                  <textarea
                    id={`spc-${key}`}
                    value={copy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                  />
                ) : (
                  <input
                    id={`spc-${key}`}
                    value={copy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    className={builderInputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </details>
      ))}

      {step === 'single' ? null : (
        <details className="rounded-md border border-gray-200 p-3">
          <summary className="cursor-pointer font-medium">
            {STEP_COPY_GROUP.title}
          </summary>
          <div className="mt-3 space-y-3">
            {STEP_COPY_GROUP.hint ? (
              <p className="text-xs text-gray-500">{STEP_COPY_GROUP.hint}</p>
            ) : null}
            {STEP_COPY_GROUP.fields.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`spc-${key}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  {label}
                </label>
                {STEP_COPY_DEFAULTS[key].length > 60 ? (
                  <textarea
                    id={`spc-${key}`}
                    value={stepCopy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                  />
                ) : (
                  <input
                    id={`spc-${key}`}
                    value={stepCopy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    className={builderInputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {step === 'single' ? null : (
        <details className="rounded-md border border-gray-200 p-3">
          <summary className="cursor-pointer font-medium">
            Preferred medication rules
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500">
              Used when UniEMR&apos;s preferred-drug lookup names nothing. The
              first rule whose field holds its answer picks the medication with
              that word in its name, unless the patient has already chosen.
              Each checkout page reads its own list, so keep them all the
              same.
            </p>
            {rules.map((rule, index) => (
              <div key={index} className="space-y-2 rounded-md bg-gray-50 p-2">
                <div className="flex gap-2">
                  <input
                    aria-label={`Rule ${index + 1} field name`}
                    value={rule.fieldName}
                    onChange={(event) =>
                      updateRule(index, 'fieldName', event.target.value)
                    }
                    placeholder="Field name"
                    className={builderInputClass}
                  />
                  <button
                    type="button"
                    aria-label={`Remove rule ${index + 1}`}
                    onClick={() =>
                      handleUpdate(
                        'preferredMedicationRules',
                        rules.filter((_, position) => position !== index),
                      )
                    }
                    className="shrink-0 rounded-md border border-gray-300 px-2"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <input
                  aria-label={`Rule ${index + 1} answer`}
                  value={rule.answer}
                  onChange={(event) =>
                    updateRule(index, 'answer', event.target.value)
                  }
                  placeholder="Answer"
                  className={builderInputClass}
                />
                <input
                  aria-label={`Rule ${index + 1} medication`}
                  value={rule.medication}
                  onChange={(event) =>
                    updateRule(index, 'medication', event.target.value)
                  }
                  placeholder="Medication (a word in its name)"
                  className={builderInputClass}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                handleUpdate('preferredMedicationRules', [
                  ...rules,
                  { fieldName: '', answer: '', medication: '' },
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1"
            >
              <Plus className="size-4" /> Add rule
            </button>
          </div>
        </details>
      )}

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer font-medium">Benefits list</summary>
        <div className="mt-3 space-y-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="space-y-2 rounded-md bg-gray-50 p-2">
              <div className="flex gap-2">
                <select
                  aria-label={`Benefit ${index + 1} icon`}
                  value={benefit.icon}
                  onChange={(event) =>
                    handleUpdate(
                      'benefits',
                      benefits.map((entry, position) =>
                        position === index
                          ? {
                              ...entry,
                              icon: event.target.value as BenefitIcon,
                            }
                          : entry,
                      ),
                    )
                  }
                  className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                >
                  {Object.keys(BENEFIT_ICONS).map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Benefit ${index + 1} title`}
                  value={benefit.title}
                  onChange={(event) =>
                    handleUpdate(
                      'benefits',
                      benefits.map((entry, position) =>
                        position === index
                          ? { ...entry, title: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  placeholder="Title"
                  className={builderInputClass}
                />
                <button
                  type="button"
                  aria-label={`Remove benefit ${index + 1}`}
                  onClick={() =>
                    handleUpdate(
                      'benefits',
                      benefits.filter((_, position) => position !== index),
                    )
                  }
                  className="shrink-0 rounded-md border border-gray-300 px-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              <input
                aria-label={`Benefit ${index + 1} description`}
                value={benefit.description}
                onChange={(event) =>
                  handleUpdate(
                    'benefits',
                    benefits.map((entry, position) =>
                      position === index
                        ? { ...entry, description: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder="Description"
                className={builderInputClass}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              handleUpdate('benefits', [
                ...benefits,
                { icon: 'check', title: '', description: '' },
              ])
            }
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1"
          >
            <Plus className="size-4" /> Add benefit
          </button>
        </div>
      </details>

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer font-medium">Disclaimers</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            Extra lines under Complete My Order, after the payment disclaimer.
          </p>
          {disclaimers.map((line, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                aria-label={`Disclaimer ${index + 1}`}
                value={line}
                onChange={(event) =>
                  handleUpdate(
                    'disclaimers',
                    disclaimers.map((entry, position) =>
                      position === index ? event.target.value : entry,
                    ),
                  )
                }
                rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove disclaimer ${index + 1}`}
                onClick={() =>
                  handleUpdate(
                    'disclaimers',
                    disclaimers.filter((_, position) => position !== index),
                  )
                }
                className="shrink-0 self-start rounded-md border border-gray-300 px-2 py-2"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => handleUpdate('disclaimers', [...disclaimers, ''])}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1"
          >
            <Plus className="size-4" /> Add disclaimer
          </button>
        </div>
      </details>
    </div>
  );
};
