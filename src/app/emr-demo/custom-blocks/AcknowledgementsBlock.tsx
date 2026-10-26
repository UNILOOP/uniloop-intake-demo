import React, { forwardRef, useState, useEffect, useMemo } from 'react';
import type {
  BlockDefinition,
  BlockRendererProps,
  ChatRendererProps,
  ContentBlockItemProps,
  ThemeDefinition,
} from '@/packages/survey-form-package/src/types';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { Switch } from '@/packages/survey-form-package/src/components/ui/switch';
import { ShieldAlert, ChevronDown, Trash2, Plus } from 'lucide-react';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';

// ============================================================================
// Types
// ============================================================================

export type VisibilityOperator = 'equals' | 'notEquals' | 'contains';

export interface VisibilityRule {
  field: string;
  operator: VisibilityOperator;
  value: string;
}

export interface AcknowledgementItem {
  id: string;
  accordionTitle: string;
  content: string;
  // Every rule must match for the item to show.
  showIf?: VisibilityRule[];
  // Older JavaScript condition. Core rewrites words inside quotes too, so a
  // comparison like gender == 'Female' never matches; showIf replaces it.
  visibleIf?: string;
  autoSelect?: boolean;
}

export interface AcknowledgementValue {
  masterAcknowledged: boolean;
  items: Record<string, boolean>;
}

// ============================================================================
// Default content
// ============================================================================

const DEFAULT_TITLE = 'Your safety is our top priority.';
const DEFAULT_DESCRIPTION =
  'Please read and acknowledge the following information. By checking the boxes below, you acknowledge the information.';
const DEFAULT_MASTER_LABEL = 'I acknowledge all of the below information.';

const DEFAULT_ITEMS: AcknowledgementItem[] = [
  {
    id: 'consent_to_telehealth',
    accordionTitle: 'Consent to Telehealth',
    content:
      '## Introduction\nThis Consent to Telehealth Services outlines the terms and conditions of using our telehealth services ("Services"), which are provided through our websites and applications. By using these Services, you can obtain an online consultation with an independent, licensed healthcare professional ("Provider") and receive mail order pharmacy services for any prescribed medications. Telehealth involves the delivery of healthcare services using electronic communications between a healthcare provider and a patient who are not in the same physical location.\n\n## Section 1: Telehealth Services\nTelehealth services may include, but are not limited to:\nElectronic transmission of medical records, photo images, personal health information, or other data between a patient and a Provider. Interactions between a patient and a Provider via audio, video, and/or asynchronous data communications, such as secure messaging and email. Use of data from remote monitoring devices, medical devices, and sound or video files.\n\n## Section 2: Benefits of Telehealth\nEasier, more efficient, and less expensive access to medical care. Obtaining medical care and treatment at convenient times. Interaction with Providers without in-office appointments.\n\n## Section 3: Limitations of Telehealth\nInsufficient information for appropriate medical decision making, requiring alternative care. Inability to conduct certain tests or assess vital signs in person, affecting diagnosis or treatment. Potential delays in medical care due to technological failures. Data security breaches compromising patient information. Limited treatment options, particularly regarding prescriptions, due to regulatory requirements.\n\n## Section 4: Patient Responsibilities\nBy agreeing to this Consent to Telehealth Services, you acknowledge and understand the following:\nYou have read and understood the risks and benefits of telehealth services. You give informed consent to receive medical care and treatment by telehealth from affiliated Providers. The use of telehealth in your medical care may include technology not specifically described in this consent. No specific benefits or results can be guaranteed; your condition may not be cured or improved and may worsen in some cases. You have a duty to answer questions about your health and medical history honestly, accurately, and to keep all healthcare providers up-to-date on any changes. Withholding or providing inaccurate information may result in harm or even death. Providers may determine that your condition is not suitable for telehealth treatment, and you may need to seek alternative care. Telehealth services enable coordination and communication with a Provider and do not replace your relationship with existing healthcare providers. In case of a medical emergency, you should call 9-1-1 and seek immediate medical treatment.\n\n## Section 5: Privacy and Data Security\nYour information, including personal health information, will be collected, used, shared, and protected as described in our Privacy Policy. You have the right to access your health and wellness information pertaining to telehealth consultations in accordance with applicable laws and regulations. Your telehealth records will be shared with other healthcare providers only with your consent and at your request.\n\n## Section 6: Consent Withdrawal\nYou may withhold or withdraw this consent at any time by emailing us with such instructions. Otherwise, this consent will be considered renewed upon each new telehealth consultation with a Provider.\n\nBy checking the "Agree" box, you accept this Consent to Telehealth Services and confirm that you understand and agree to the terms and conditions outlined above. All capitalized terms not defined herein have the meanings assigned to them in our Terms of Use. For clarity, "we," "us," and "our" refer to our company, and "you" and "yours" refer to the person using the Services.',
    autoSelect: false,
  },
  {
    id: 'general_guidelines_glp1',
    accordionTitle: 'General Guidelines for GLP-1 Medication',
    content:
      'The traditional use of weight loss medications is for individuals with a BMI of 30 and above or to those who are overweight who have associated health conditions. Using it for someone in your BMI range (27-29) without an accompanying health condition is termed "off-label." Using a medication "off-label" refers to the practice of prescribing a drug for a purpose, age group, dosage, or form of administration that is not included in the approved labeling by regulatory agencies like the U.S. Food and Drug Administration (FDA). While a medication undergoes rigorous testing for specific uses before receiving approval, healthcare providers may discover through clinical experience or research that it can be effective for treating other conditions. There may be benefits such as weight reduction for individuals within your range. If you agree to this off-label use, it\'s crucial to follow the prescribed regimen and report any concerns. Please discuss any questions with us.',
    autoSelect: false,
  },
  {
    id: 'truthfulness_consent',
    accordionTitle: 'Truthfulness Consent',
    content:
      'Consent: I have reviewed, understand, and attest that the information I have provided above is true to the best of my knowledge. I understand that it is critical to my health to share complete health information with my doctor. I will not hold the doctor or affiliated medical practice responsible for any oversights or omissions, whether intentional or not in the information that I provided above.',
    autoSelect: false,
  },
  {
    id: 'breastfeeding_pregnancy_precaution',
    accordionTitle: 'Breastfeeding/Pregnancy Precaution',
    content:
      'The FDA says that these medications may pose a risk to the developing fetus (baby) if you get pregnant while taking it. "The pill" (oral contraception) is not enough because this medication can interfere with the effectiveness. For birth control you must use condoms, an IUD, or the implant. Official FDA recommendations: For the first month after first starting a weight loss medication, and for the first month after each dose escalation, continue using your oral contraception and add a barrier method of contraception (such as condoms) to prevent pregnancy. Alternatively, you can switch to a non-oral contraceptive method (such as an IUD or implant) before starting your medication. When you stop the medication, you must continue using a backup method (like condoms) for two months after stopping to allow the medication to fully leave your system before getting pregnant. Similarly, it is not known to be safe in breastfeeding. If you are breastfeeding, consult your doctor for safe weight loss options.',
    showIf: [
      { field: 'selectablebox27uzg7', operator: 'equals', value: 'Female' },
      { field: 'currentlyPregnantBlock', operator: 'notEquals', value: 'Yes' },
    ],
    autoSelect: false,
  },
  {
    id: 'oral_tirzepatide_consent',
    accordionTitle: 'Oral Tirzepatide Consent',
    content:
      'I understand that tirzepatide is FDA-approved only in injectable form and that the oral formulation being prescribed to me is not FDA-approved. I acknowledge that there is limited clinical data regarding the safety, efficacy, and pharmacokinetics of oral tirzepatide, and that current research does not establish consistent bioavailability when administered orally. I understand that compounded or non-injectable formulations may not achieve therapeutic blood levels comparable to FDA-approved injectable versions. I acknowledge that the benefits, risks, and long-term outcomes of oral tirzepatide are not fully known. I understand that this prescription constitutes off-label and/or compounded use, and I voluntarily consent to treatment after discussion of alternatives, including FDA-approved injectable options.',
    showIf: [
      { field: 'selectablebox2tbsa3', operator: 'contains', value: 'oral' },
    ],
    autoSelect: false,
  },
];

// ============================================================================
// Visibility and content helpers
// ============================================================================

const OPERATOR_LABELS: Record<VisibilityOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
};

const normalizeAnswer = (answer: unknown) =>
  (typeof answer === 'object' && answer !== null
    ? JSON.stringify(answer)
    : String(answer ?? '')
  )
    .trim()
    .toLowerCase();

// Single-choice questions store a string, multi-choice an array of strings.
const getAnswers = (raw: unknown): string[] => {
  if (raw === undefined || raw === null || raw === '') return [];
  return (Array.isArray(raw) ? raw : [raw]).map(normalizeAnswer);
};

const matchesRule = (rule: VisibilityRule, values: Record<string, any>) => {
  const field = rule.field?.trim();
  if (!field) return true;
  const answers = getAnswers(values[field]);
  const expected = normalizeAnswer(rule.value);
  if (rule.operator === 'notEquals') return !answers.includes(expected);
  if (rule.operator === 'contains')
    return answers.some((answer) => answer.includes(expected));
  return answers.includes(expected);
};

const isItemVisible = (
  item: AcknowledgementItem,
  values: Record<string, any>,
  evaluateCondition?: (condition: string) => boolean,
) => {
  if (item.showIf?.length)
    return item.showIf.every((rule) => matchesRule(rule, values));
  if (!item.visibleIf || !evaluateCondition) return true;
  try {
    return evaluateCondition(item.visibleIf);
  } catch {
    return true;
  }
};

// A line starting with "##" is a section heading; other lines are paragraphs.
const parseContent = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('##')
        ? { heading: true, text: line.replace(/^##\s*/, '') }
        : { heading: false, text: line },
    );

const accentGradient = (theme: ThemeDefinition) =>
  `linear-gradient(to bottom right, ${theme.colors.secondary}, ${theme.colors.primary})`;

// Card: 16px radius, 1.5px accent-gradient border drawn inside a 16px padding.
const cardStyle = (theme: ThemeDefinition): React.CSSProperties => ({
  borderRadius: 16,
  border: '1.5px solid transparent',
  padding: 14.5,
  background: `linear-gradient(white, white) padding-box, ${accentGradient(theme)} border-box`,
});

const cardTextStyle = (theme: ThemeDefinition): React.CSSProperties => ({
  fontFamily: theme.fonts?.heading,
  fontSize: 16,
  lineHeight: '20px',
  letterSpacing: '-0.01em',
  color: theme.colors.text,
});

// ============================================================================
// Themed Checkbox
// ============================================================================
interface ThemedCheckboxProps {
  isChecked: boolean;
  onToggleCheck: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  theme: ThemeDefinition;
}

const ThemedCheckbox: React.FC<ThemedCheckboxProps> = ({
  isChecked,
  onToggleCheck,
  disabled,
  label,
  theme,
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isChecked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onToggleCheck(!isChecked)}
      className={cn(
        'relative w-6 h-6 shrink-0 flex items-center justify-center text-white transition-all duration-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
      style={
        isChecked
          ? { borderRadius: 8, background: accentGradient(theme) }
          : {
              borderRadius: 8,
              border: `1.5px solid color-mix(in srgb, ${theme.colors.text} 25%, transparent)`,
            }
      }
    >
      {isChecked && (
        <svg
          className="w-4 h-4 transition-transform duration-200 ease-out scale-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
};

// ============================================================================
// Builder Form Component
// ============================================================================

const AcknowledgementsBlockForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handle = (field: string, value: any) =>
    onUpdate?.({ ...data, [field]: value });

  const items: AcknowledgementItem[] = data.acknowledgements || [];

  const updateItem = (
    index: number,
    field: keyof AcknowledgementItem,
    value: any,
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    handle('acknowledgements', newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    handle('acknowledgements', newItems);
  };

  const addItem = () => {
    const newItems = [...items];
    newItems.push({
      id: `item-${Date.now()}`,
      accordionTitle: 'New Item',
      content: 'Content goes here...',
      autoSelect: false,
    });
    handle('acknowledgements', newItems);
  };

  const updateRules = (index: number, rules: VisibilityRule[]) =>
    updateItem(index, 'showIf', rules.length ? rules : undefined);

  const updateRule = (
    index: number,
    ruleIndex: number,
    field: keyof VisibilityRule,
    value: string,
  ) => {
    const rules = [...(items[index].showIf || [])];
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
    updateRules(index, rules);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm" htmlFor="fieldName">
            Field Name
          </Label>
          <Input
            id="fieldName"
            value={data.fieldName || ''}
            onChange={(e) => handle('fieldName', e.target.value)}
            placeholder="acknowledgements"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm" htmlFor="label">
            Title
          </Label>
          <Input
            id="label"
            value={data.label || ''}
            onChange={(e) => handle('label', e.target.value)}
            placeholder={DEFAULT_TITLE}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="description">
          Description (optional)
        </Label>
        <Textarea
          id="description"
          value={data.description || ''}
          onChange={(e) => handle('description', e.target.value)}
          placeholder={DEFAULT_DESCRIPTION}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="masterLabel">
          Master Checkbox Label
        </Label>
        <Input
          id="masterLabel"
          value={data.masterLabel || ''}
          onChange={(e) => handle('masterLabel', e.target.value)}
          placeholder={DEFAULT_MASTER_LABEL}
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-semibold">Acknowledgement Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>

        {items.map((item, index) => (
          <Card key={item.id} className="p-4 space-y-4 relative">
            <div className="absolute top-2 right-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 pr-6">
              <div className="space-y-2">
                <Label className="text-xs">ID (Internal)</Label>
                <Input
                  value={item.id}
                  onChange={(e) => updateItem(index, 'id', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Accordion Title</Label>
                <Input
                  value={item.accordionTitle}
                  onChange={(e) =>
                    updateItem(index, 'accordionTitle', e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Content</Label>
              <Textarea
                value={item.content}
                onChange={(e) => updateItem(index, 'content', e.target.value)}
                rows={3}
                className="text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Start a line with ## to show it as a section heading.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Show only when</Label>
              {(item.showIf || []).map((rule, ruleIndex) => (
                <div key={ruleIndex} className="flex items-center gap-2">
                  <Input
                    value={rule.field}
                    onChange={(e) =>
                      updateRule(index, ruleIndex, 'field', e.target.value)
                    }
                    placeholder="Question field name"
                    className="h-8 text-xs"
                  />
                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      updateRule(index, ruleIndex, 'operator', e.target.value)
                    }
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {(Object.keys(OPERATOR_LABELS) as VisibilityOperator[]).map(
                      (operator) => (
                        <option key={operator} value={operator}>
                          {OPERATOR_LABELS[operator]}
                        </option>
                      ),
                    )}
                  </select>
                  <Input
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(index, ruleIndex, 'value', e.target.value)
                    }
                    placeholder="Answer"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() =>
                      updateRules(
                        index,
                        (item.showIf || []).filter((_, i) => i !== ruleIndex),
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateRules(index, [
                    ...(item.showIf || []),
                    { field: '', operator: 'equals', value: '' },
                  ])
                }
              >
                <Plus className="w-4 h-4 mr-1" /> Add condition
              </Button>
              <p className="text-xs text-muted-foreground">
                Use the question&apos;s Field Name, for example
                selectablebox27uzg7. All conditions must match, and answers
                ignore upper and lower case. With no conditions the item always
                shows.
              </p>
              {item.visibleIf && (
                <div className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
                  <span className="flex-1 break-all">
                    {item.showIf?.length
                      ? 'Ignored: the conditions above take its place.'
                      : 'Old text condition. It can’t compare text answers, so add conditions above instead.'}{' '}
                    <code>{item.visibleIf}</code>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => updateItem(index, 'visibleIf', undefined)}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id={`autoSelect-${index}`}
                checked={item.autoSelect || false}
                onCheckedChange={(checked) =>
                  updateItem(index, 'autoSelect', checked)
                }
              />
              <Label
                htmlFor={`autoSelect-${index}`}
                className="text-xs cursor-pointer border-none bg-transparent"
              >
                Auto-select this item by default
              </Label>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Builder Item Preview
// ============================================================================

const AcknowledgementsBlockItem: React.FC<ContentBlockItemProps> = ({
  data,
}) => {
  const items: AcknowledgementItem[] = data.acknowledgements || DEFAULT_ITEMS;

  return (
    <Card className="space-y-3 p-4">
      {data.label && (
        <Label className="text-center block text-lg font-semibold h-[20px] mb-2 leading-none">
          {data.label || DEFAULT_TITLE}
        </Label>
      )}
      {(data.description || DEFAULT_DESCRIPTION) && (
        <p className="text-sm text-muted-foreground text-center">
          {data.description || DEFAULT_DESCRIPTION}
        </p>
      )}

      <div className="border rounded-md p-3 flex items-center gap-3 bg-muted/20">
        <div className="h-4 w-4 rounded border" />
        <span className="text-sm font-medium">
          {data.masterLabel || DEFAULT_MASTER_LABEL}
        </span>
      </div>

      <div className="space-y-2 pl-2 border-l-2 ml-2 mt-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-center text-sm text-muted-foreground"
          >
            <div className="h-3 w-3 rounded border" /> {item.accordionTitle}
            {(item.showIf?.length || item.visibleIf) && (
              <span className="text-[10px] bg-muted px-1 rounded">
                Conditional
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

const AcknowledgementsBlockPreview: React.FC = () => (
  <div className="w-full flex items-center justify-center py-1">
    <div className="w-4/5 border rounded-md p-2 text-xs text-muted-foreground bg-muted/30 flex items-center gap-2">
      <ShieldAlert className="w-3 h-3" /> Acknowledgements
    </div>
  </div>
);

// ============================================================================
// Renderer Component
// ============================================================================

const AcknowledgementsRenderer = forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, value, onChange, error, disabled, theme: themeProp }, ref) => {
    const theme = themeProp ?? themes.default;
    const items: AcknowledgementItem[] = block.acknowledgements || [];
    const title = block.label || DEFAULT_TITLE;
    const description = block.description || DEFAULT_DESCRIPTION;
    const masterLabel = block.masterLabel || DEFAULT_MASTER_LABEL;

    // Get context to evaluate visibility
    const context = useSurveyForm();
    const visibleItems = useMemo(() => {
      const formValues = {
        ...(context?.values || {}),
        ...(context?.computedValues || {}),
      };
      return items.filter((item) =>
        isItemVisible(item, formValues, context?.evaluateCondition),
      );
    }, [
      items,
      context?.values,
      context?.computedValues,
      context?.evaluateCondition,
    ]);
    const visibleKey = visibleItems.map((item) => item.id).join(',');

    // Use current value or default empty mapping
    const blockValue: AcknowledgementValue = value || {
      masterAcknowledged: false,
      items: {},
    };

    // Core validates with validateValue(value, block) and no form values, so
    // masterAcknowledged is what lets the page continue. Keep it equal to
    // "every visible item is checked", and apply autoSelect to newly visible
    // items, in one update.
    useEffect(() => {
      const newItemsMap = { ...blockValue.items };
      let changed = false;

      visibleItems.forEach((item) => {
        if (item.autoSelect && newItemsMap[item.id] === undefined) {
          newItemsMap[item.id] = true;
          changed = true;
        }
      });

      const allChecked = visibleItems.every(
        (item) => newItemsMap[item.id] === true,
      );
      if (blockValue.masterAcknowledged !== allChecked) changed = true;

      if (changed && onChange) {
        onChange({ masterAcknowledged: allChecked, items: newItemsMap });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleKey, value]); // Intentionally not deeply depending on onChange

    const isItemChecked = (id: string) => blockValue.items[id] === true;
    const allVisibleChecked = visibleItems.every((item) =>
      isItemChecked(item.id),
    );

    const handleMasterToggle = (checked: boolean) => {
      const newItemsMap = { ...blockValue.items };

      visibleItems.forEach((item) => {
        newItemsMap[item.id] = checked;
      });

      onChange?.({
        masterAcknowledged: checked || visibleItems.length === 0,
        items: newItemsMap,
      });
    };

    const handleItemToggle = (itemId: string, checked: boolean) => {
      const newItemsMap = { ...blockValue.items, [itemId]: checked };

      onChange?.({
        masterAcknowledged: visibleItems.every(
          (item) => newItemsMap[item.id] === true,
        ),
        items: newItemsMap,
      });
    };

    // Accordion state
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
    const toggleAccordion = (id: string) => {
      setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const textStyle = cardTextStyle(theme);

    return (
      <div ref={ref} className="w-full max-w-lg mx-auto space-y-4">
        {/* Title */}
        <div className="space-y-3">
          {title && (
            <h2
              className={cn(theme.title, 'text-left text-2xl')}
              style={{ lineHeight: 1.17 }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className={cn(theme.description, 'text-left font-normal')}
              style={{ opacity: 0.76 }}
            >
              {description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {/* Master Checkbox row */}
          <div className="flex gap-3 items-center w-full">
            <div className="flex items-center py-3 shrink-0">
              <ThemedCheckbox
                isChecked={allVisibleChecked}
                onToggleCheck={handleMasterToggle}
                disabled={disabled}
                label={masterLabel}
                theme={theme}
              />
            </div>

            <button
              type="button"
              disabled={disabled}
              aria-pressed={allVisibleChecked}
              className={cn(
                'flex flex-1 min-w-0 items-center text-left select-none',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              )}
              style={{ ...cardStyle(theme), ...textStyle }}
              onClick={() => {
                if (!disabled) handleMasterToggle(!allVisibleChecked);
              }}
            >
              {masterLabel}
            </button>
          </div>

          {/* Individual Items */}
          {visibleItems.map((item) => {
            const isChecked = isItemChecked(item.id);
            const isOpen = openItems[item.id] || false;
            const itemContentId = `${block.fieldName}-${item.id}-content`;
            const cardOpacity = disabled ? 0.5 : 1;
            // A transition runs at the new state's duration, so cards open
            // slowly enough to follow the long text and close quickly.
            const motion = cn(
              'ease-out motion-reduce:transition-none',
              isOpen ? 'duration-500' : 'duration-300',
            );

            // Grid: the checkbox sits in row 1 beside the header, so it stays
            // centred on the header while the content row below opens. The
            // card's border and background are a layer spanning both rows.
            return (
              <div
                key={item.id}
                className="grid w-full gap-x-3"
                style={{
                  ...textStyle,
                  gridTemplateColumns: '24px minmax(0, 1fr)',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    ...cardStyle(theme),
                    gridColumn: 2,
                    gridRow: '1 / span 2',
                    opacity: cardOpacity,
                  }}
                />

                <div
                  className="flex items-center self-center"
                  style={{ gridColumn: 1, gridRow: 1 }}
                >
                  <ThemedCheckbox
                    isChecked={isChecked}
                    onToggleCheck={(c) => handleItemToggle(item.id, c)}
                    disabled={disabled}
                    label={item.accordionTitle}
                    theme={theme}
                  />
                </div>

                <button
                  type="button"
                  disabled={disabled}
                  aria-expanded={isOpen}
                  aria-controls={itemContentId}
                  onClick={() => toggleAccordion(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 text-left',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                  style={{
                    gridColumn: 2,
                    gridRow: 1,
                    padding: 16,
                    opacity: cardOpacity,
                  }}
                >
                  <span className="flex-1">{item.accordionTitle}</span>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 shrink-0 opacity-50 transition-transform',
                      motion,
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>

                {/* Stays mounted so it can animate. The public form CSS has no
                    grid-rows classes, so the 0fr/1fr rows are inline. */}
                <div
                  id={itemContentId}
                  aria-hidden={!isOpen}
                  className={cn('grid transition-all', motion)}
                  style={{
                    gridColumn: 2,
                    gridRow: 2,
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    opacity: isOpen ? cardOpacity : 0,
                  }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div style={{ padding: '0 16px 16px' }}>
                      <div
                        aria-hidden="true"
                        style={{
                          borderTop: `1px solid color-mix(in srgb, ${theme.colors.text} 15%, transparent)`,
                        }}
                      />
                      <div
                        className="flex flex-col gap-2"
                        style={{ paddingTop: 16 }}
                      >
                        {parseContent(item.content).map((part, index) =>
                          part.heading ? (
                            <p key={index} style={{ fontWeight: 500 }}>
                              {part.text}
                            </p>
                          ) : (
                            <p key={index} style={{ opacity: 0.7 }}>
                              {part.text}
                            </p>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className={theme.field.error}>{error}</div>}
      </div>
    );
  },
);
AcknowledgementsRenderer.displayName = 'AcknowledgementsRenderer';

// Chat Component placeholder
const AcknowledgementsChatRenderer: React.FC<ChatRendererProps> = (props) => {
  return (
    <div className="p-4 border rounded-lg bg-muted/20">
      Chat UI for AcknowledgementsBlock not fully implemented yet. Please use
      standard view.
    </div>
  );
};

// ============================================================================
// Block Definition Export
// ============================================================================

export const AcknowledgementsBlock: BlockDefinition = {
  type: 'acknowledgements',
  name: 'Acknowledgements',
  description:
    'List of configurable collapsible precaution/consent cards with acknowledgement checkboxes.',
  icon: <ShieldAlert className="w-4 h-4" />,
  defaultData: {
    type: 'acknowledgements',
    fieldName: 'acknowledgements',
    label: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    masterLabel: DEFAULT_MASTER_LABEL,

    acknowledgements: DEFAULT_ITEMS,
    required: true,
  },
  generateDefaultData: () => ({
    type: 'acknowledgements',
    fieldName: 'acknowledgements',
    label: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    masterLabel: DEFAULT_MASTER_LABEL,

    acknowledgements: DEFAULT_ITEMS,
    required: true,
  }),
  renderItem: (props) => <AcknowledgementsBlockItem {...props} />,
  renderFormFields: (props) => <AcknowledgementsBlockForm {...props} />,
  renderPreview: () => <AcknowledgementsBlockPreview />,
  renderBlock: (props) => <AcknowledgementsRenderer {...props} />,
  chatRenderer: (props) => <AcknowledgementsChatRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (!data.acknowledgements || data.acknowledgements.length === 0)
      return 'At least one acknowledgement item is required';
    return null;
  },
  validateValue: (value: any, data: any, context?: any) => {
    if (!data.required) return null;

    // We expect the form to provide an AcknowledgementValue
    const blockVal = value || { masterAcknowledged: false, items: {} };
    if (blockVal.masterAcknowledged) return null;

    const items: AcknowledgementItem[] = data.acknowledgements || [];

    // Determine visible items. Without context, assume visible to be safe.
    const formValues = {
      ...(context?.formValues || {}),
      ...(context?.computedValues || {}),
    };
    const visibleItems = context
      ? items.filter((item) =>
          isItemVisible(item, formValues, (condition) =>
            context.evaluateCondition(condition, formValues),
          ),
        )
      : items;

    if (visibleItems.length === 0) return null; // Nothing to acknowledge

    // Check if ALL visible items are manually checked
    const allChecked = visibleItems.every(
      (item) => blockVal.items && blockVal.items[item.id] === true,
    );

    if (allChecked) {
      return null;
    }

    return 'You must acknowledge all required information to continue.';
  },
  outputSchema: {
    type: 'object',
    properties: {},
  },
};
