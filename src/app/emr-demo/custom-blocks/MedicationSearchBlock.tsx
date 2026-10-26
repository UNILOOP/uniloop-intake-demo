import React, { forwardRef, useEffect, useRef, useState } from 'react';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
  ThemeDefinition,
} from '@/packages/survey-form-package/src/types';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { CirclePlus, CircleX, Search, X } from 'lucide-react';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';

interface MedicationOption {
  id: string;
  label: string;
  value: string;
}

interface MedicationSearchUiProps {
  label?: string;
  description?: string;
  options: MedicationOption[];
  selectedOptions: MedicationOption[];
  error?: string;
  disabled?: boolean;
  theme: ThemeDefinition;
  searchLabel?: string;
  optionLimit?: number;
  defaultAddMedicationOpen?: boolean;
  defaultCustomMedication?: string;
  defaultSearchOpen?: boolean;
  onSelectOption?: (option: MedicationOption) => void;
  onRemoveOption?: (option: MedicationOption) => void;
  onAddCustomMedication?: (option: MedicationOption) => void;
}

const DEFAULT_SEARCH_LABEL = 'Search Medication';
const DEFAULT_EMPTY_ACTION_LABEL = "Don't see your medication?";
const DEFAULT_FIELD_NAME = 'medicationSearch';
const DEFAULT_MEDICATION_OPTION_ENTRIES = [
  ['Acetaminophen (Tylenol)', 'acetaminophen'],
  ['Albuterol (ProAir, Ventolin)', 'albuterol'],
  ['Alprazolam (Xanax)', 'alprazolam'],
  ['Amlodipine (Norvasc)', 'amlodipine'],
  ['Amoxicillin', 'amoxicillin'],
  ['Apixaban (Eliquis)', 'apixaban'],
  ['Aspirin (Bayer, Excedrin)', 'aspirin'],
  ['Atorvastatin (Lipitor)', 'atorvastatin'],
  ['Azithromycin (Zithromax)', 'azithromycin'],
  ['Bupropion (Wellbutrin)', 'bupropion'],
  ['Calcium (Caltrate, Viactiv)', 'calcium'],
  ['Cetirizine (Zyrtec)', 'cetirizine'],
  ['Citalopram (Celexa)', 'citalopram'],
  ['Clindamycin', 'clindamycin'],
  ['Clonazepam (Klonopin)', 'clonazepam'],
  ['Clopidogrel (Plavix)', 'clopidogrel'],
  ['Cyclobenzaprine (Flexeril)', 'cyclobenzaprine'],
  ['Dextromethorphan (found in many OTC cough medicines)', 'dextromethorphan'],
  ['Diphenhydramine (Benadryl)', 'diphenhydramine'],
  ['Duloxetine (Cymbalta)', 'duloxetine'],
  ['Erythromycin', 'erythromycin'],
  ['Escitalopram (Lexapro)', 'escitalopram'],
  ['Esomeprazole (Nexium)', 'esomeprazole'],
  ['Fexofenadine (Allegra)', 'fexofenadine'],
  ['Finasteride (Proscar, Propecia)', 'finasteride'],
  ['Fish Oil (Lovaza, Omacor)', 'fish-oil'],
  ['Fluconazole (Diflucan)', 'fluconazole'],
  ['Fluticasone (Flonase, Flovent)', 'fluticasone'],
  ['Gabapentin (Neurontin)', 'gabapentin'],
  ['Hydrochlorothiazide', 'hydrochlorothiazide'],
  ['Hydroxyzine (Atarax, Vistaril)', 'hydroxyzine'],
  ['Ibuprofen (Advil, Motrin)', 'ibuprofen'],
  ['Insulin Glargine (Lantus, Basaglar)', 'insulin-glargine'],
  ['Levothyroxine (Synthroid, Levoxyl)', 'levothyroxine'],
  ['Lisinopril (Prinivil, Zestril)', 'lisinopril'],
  ['Lorazepam (Ativan)', 'lorazepam'],
  ['Loratadine (Claritin)', 'loratadine'],
  ['Losartan (Cozaar)', 'losartan'],
  ['Magnesium (Mag-Ox, Mag-Tab SR)', 'magnesium'],
  ['Meloxicam (Mobic)', 'meloxicam'],
  ['Metformin (Glucophage)', 'metformin'],
  ['Metoprolol (Lopressor, Toprol XL)', 'metoprolol'],
  ['Mometasone (Nasonex)', 'mometasone'],
  ['Montelukast (Singulair)', 'montelukast'],
  ['Naproxen (Aleve)', 'naproxen'],
  ['Omeprazole (Prilosec)', 'omeprazole'],
  ['Ondansetron (Zofran)', 'ondansetron'],
  ['Pantoprazole (Protonix)', 'pantoprazole'],
  ['Pravastatin (Pravachol)', 'pravastatin'],
  ['Probiotics (Culturelle, Align)', 'probiotics'],
  ['Pseudoephedrine (Sudafed)', 'pseudoephedrine'],
  ['Quetiapine (Seroquel)', 'quetiapine'],
  ['Ranitidine (Zantac)', 'ranitidine'],
  ['Rosuvastatin (Crestor)', 'rosuvastatin'],
  ['Sertraline (Zoloft)', 'sertraline'],
  ['Sildenafil (Viagra)', 'sildenafil'],
  ['Simvastatin (Zocor)', 'simvastatin'],
  ['Tadalafil (Cialis)', 'tadalafil'],
  ['Tiotropium (Spiriva)', 'tiotropium'],
  ['Tramadol', 'tramadol'],
  ['Trazodone', 'trazodone'],
  ['Valacyclovir (Valtrex)', 'valacyclovir'],
  ['Venlafaxine (Effexor)', 'venlafaxine'],
  ['Vitamin D (D3, Calcitriol)', 'vitamin-d'],
  ['Warfarin (Coumadin)', 'warfarin'],
  ['Zinc (Cold-Eeze, Zicam)', 'zinc'],
] as const;

const DEFAULT_MEDICATION_OPTIONS: MedicationOption[] =
  DEFAULT_MEDICATION_OPTION_ENTRIES.map(([label, value], index) => ({
    id: `medication-option-${index + 1}`,
    label,
    value,
  }));

const createDefaultMedicationOptions = (): MedicationOption[] =>
  DEFAULT_MEDICATION_OPTIONS.map((option) => ({ ...option }));

const getNextMedicationOptionId = (options: MedicationOption[]): string => {
  const maxNumericId = options.reduce((maxValue, option) => {
    const match = option.id.match(/(\d+)$/);
    if (!match) return maxValue;

    const parsedValue = Number(match[1]);
    return Number.isNaN(parsedValue)
      ? maxValue
      : Math.max(maxValue, parsedValue);
  }, 0);

  return `medication-option-${maxNumericId + 1}`;
};

const getMedicationOptions = (data: BlockData): MedicationOption[] => {
  if (Array.isArray(data.options) && data.options.length > 0) {
    return data.options.map((option: any, index: number) => ({
      id: option.id || `medication-option-${index}`,
      label: option.label || option.value || `Medication ${index + 1}`,
      value: option.value || option.label || `medication-${index + 1}`,
    }));
  }

  return (data.labels || []).map((label: string, index: number) => ({
    id: `medication-option-${index}`,
    label,
    value: String((data.values || [])[index] || label),
  }));
};

const getSelectedMedications = (
  value: unknown,
  options: MedicationOption[],
): MedicationOption[] => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const rawSelections = Array.isArray(value) ? value : [value];

  return rawSelections
    .map((selection, index) => {
      if (
        selection &&
        typeof selection === 'object' &&
        !Array.isArray(selection)
      ) {
        const selectionRecord = selection as Record<string, unknown>;
        const rawValue = selectionRecord.value;
        const rawLabel = selectionRecord.label;
        const matchedOption =
          rawValue !== undefined
            ? options.find((option) => option.value === String(rawValue))
            : undefined;

        return {
          id: String(
            selectionRecord.id || matchedOption?.id || `selected-${index}`,
          ),
          label: String(
            rawLabel ||
              matchedOption?.label ||
              rawValue ||
              `Medication ${index + 1}`,
          ),
          value: String(
            rawValue ||
              matchedOption?.value ||
              rawLabel ||
              `medication-${index + 1}`,
          ),
        };
      }

      // Older answers saved the option value; newer ones save its label.
      const stringValue = String(selection);
      const matchedOption = options.find(
        (option) =>
          option.value === stringValue || option.label === stringValue,
      );

      return (
        matchedOption || {
          id: `selected-${index}`,
          label: stringValue,
          value: stringValue,
        }
      );
    })
    .filter(Boolean);
};

const MedicationBottleI: React.FC = () => (
  <svg
    className="shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="23"
    viewBox="0 0 18 23"
    fill="none"
  >
    <path
      d="M6 14.3171H12M9 11.2439V17.3902M15.6627 8.62127C16.5257 9.65261 17 10.9662 17 12.3245V19.9512C17 21.0827 16.1046 22 15 22H3C1.89543 22 1 21.0827 1 19.9512V12.3245C1 10.9662 1.47434 9.65261 2.3373 8.62127C3.39263 7.36003 4.93328 6.63415 6.55489 6.63415H11.4451C13.0667 6.63415 14.6074 7.36003 15.6627 8.62127ZM5.5 4.07317H12.5C13.3284 4.07317 14 3.38522 14 2.53659C14 1.68795 13.3284 1 12.5 1H5.5C4.67157 1 4 1.68795 4 2.53659C4 3.38522 4.67157 4.07317 5.5 4.07317Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FooterChevronI: React.FC = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    className="w-3"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 320 512"
  >
    <path
      fill="currentColor"
      d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"
    />
  </svg>
);

const renderHighlightedText = (text: string, query: string) => {
  if (!query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'ig'));

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <strong key={`${part}-${index}`}>{part}</strong>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
};

interface SelectedMedicationListProps {
  selectedOptions: MedicationOption[];
  disabled?: boolean;
  theme: ThemeDefinition;
  onRemoveOption?: (option: MedicationOption) => void;
}

const SelectedMedicationList: React.FC<SelectedMedicationListProps> = ({
  selectedOptions,
  disabled = false,
  theme,
  onRemoveOption,
}) => {
  if (selectedOptions.length === 0) {
    return null;
  }

  const primaryColor = theme.colors.primary;

  return (
    <section aria-label="Your current medications" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4
            className={cn(theme.field.label, 'mb-0 text-left')}
            style={{ color: theme.colors.text }}
          >
            Your current medications
          </h4>
        </div>
      </div>

      <ul className="flex flex-col gap-4" aria-live="polite">
        {selectedOptions.map((option, index) => (
          <li
            key={option.id || `${option.value}-${index}`}
            className={cn(
              'mb-0 flex items-center gap-3 rounded-sm border border-l-[3px] px-3 py-3 shadow-none transition-colors sm:px-4 bg-white',
            )}
            style={{
              borderColor: theme.colors.border,
              borderLeftColor: primaryColor,
            }}
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: primaryColor,
              }}
            />

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  theme.field.text,
                  'block text-sm font-semibold leading-5 sm:text-[15px]',
                )}
              >
                {option.label}
              </span>
            </span>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemoveOption?.(option)}
              aria-label={`Remove ${option.label}`}
              className={cn(
                'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm px-0 py-0 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                disabled
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer opacity-65 hover:opacity-100',
              )}
              style={{
                color: theme.colors.text,
                outlineColor: primaryColor,
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

const MedicationSearchUi: React.FC<MedicationSearchUiProps> = ({
  label,
  description,
  options,
  selectedOptions,
  disabled = false,
  theme,
  searchLabel = DEFAULT_SEARCH_LABEL,
  optionLimit,
  defaultAddMedicationOpen = false,
  defaultCustomMedication = '',
  defaultSearchOpen = false,
  onSelectOption,
  onRemoveOption,
  onAddCustomMedication,
}) => {
  const customMedicationInputRef = useRef<HTMLInputElement>(null);
  const visibleOptions =
    typeof optionLimit === 'number' ? options.slice(0, optionLimit) : options;
  const [isSearchOpen, setIsSearchOpen] = useState(defaultSearchOpen);
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(
    defaultAddMedicationOpen,
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [customMedicationName, setCustomMedicationName] = useState(
    defaultCustomMedication,
  );
  const [isCustomMedicationFocused, setIsCustomMedicationFocused] =
    useState(false);
  const [isAddMedicationButtonVisible, setIsAddMedicationButtonVisible] =
    useState(false);
  const [searchValue, setSearchValue] = useState('');
  const query = searchValue.trim().toLowerCase();
  // Names that start with the query come first; the sort keeps the list order within each group.
  const filteredOptions = visibleOptions
    .filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(query),
    )
    .sort(
      (a, b) =>
        Number(!a.label.toLowerCase().startsWith(query)) -
        Number(!b.label.toLowerCase().startsWith(query)),
    );
  const displayedOptions = searchValue.trim()
    ? filteredOptions
    : visibleOptions;
  const handleSelect = (option: MedicationOption) => {
    if (disabled) return;
    onSelectOption?.(option);
    setSearchValue('');
    setIsSearchOpen(false);
  };
  const handleAddCustomMedication = () => {
    const trimmedValue = customMedicationName.trim();
    if (!trimmedValue || disabled) return;

    onAddCustomMedication?.({
      id: `custom-${trimmedValue.toLowerCase().replace(/\s+/g, '-')}`,
      label: trimmedValue,
      value: trimmedValue,
    });
    setCustomMedicationName('');
    setIsAddMedicationOpen(false);
    setSearchValue('');
    setIsSearchOpen(false);
  };

  useEffect(() => {
    if (!isAddMedicationOpen) {
      setIsAddMedicationButtonVisible(false);
      setIsCustomMedicationFocused(false);
      return;
    }

    customMedicationInputRef.current?.focus();

    const timeoutId = window.setTimeout(() => {
      setIsAddMedicationButtonVisible(true);
    }, 30);

    return () => window.clearTimeout(timeoutId);
  }, [isAddMedicationOpen]);

  return (
    <div className="survey-medication-search w-full max-w-lg mx-auto min-w-0 space-y-4">
      {label && <h3 className={cn(theme.title, 'text-left')}>{label}</h3>}

      {description && (
        <p
          className={cn(
            'text-sm text-muted-foreground',
            theme.description,
            'text-left',
          )}
        >
          {description}
        </p>
      )}

      <div className="autocomplete">
        <div className="floating-label-input-container relative w-full">
          <label
            htmlFor={`${label || 'medication-search'}-autocomplete-input`}
            className={cn(
              'floating-label absolute left-14 transition-all duration-200',
              searchValue || isSearchFocused
                ? 'top-6 -translate-y-2 text-sm'
                : 'top-7 text-lg',
            )}
            style={{ color: theme.colors.text }}
          >
            {searchLabel}
          </label>
          <input
            id={`${label || 'medication-search'}-autocomplete-input`}
            placeholder=""
            inputMode="text"
            className={cn(
              theme.field.input,
              'mb-4 h-20 rounded-[14px] border bg-white pb-2 pl-14 pr-4 pt-9',
            )}
            data-ignore-input="true"
            type="text"
            value={searchValue}
            disabled={disabled}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChange={(e) => {
              const nextValue = e.target.value;
              setSearchValue(nextValue);
              setIsSearchOpen(nextValue.trim().length > 0);
            }}
            style={{
              borderColor: isSearchOpen
                ? theme.colors.primary
                : theme.colors.border,
              boxShadow: 'none',
            }}
          />
          <div className="absolute left-4 top-11 -translate-y-1/2">
            <Search
              className="h-[22px] w-[22px]"
              style={{ color: theme.colors.text }}
            />
          </div>
          <span className="text-[14px]" style={{ color: theme.colors.error }} />
        </div>

        {isSearchOpen && (
          <>
            {displayedOptions.length > 0 && (
              <div
                className={cn(
                  theme.container.card,
                  theme.container.border,
                  'flex flex-col gap-4 rounded-[14px] px-3 py-4 shadow-none',
                )}
              >
                {displayedOptions.map((option, index) => (
                  <div
                    key={option.id || `${option.value}-${index}`}
                    className="search-result-item"
                  >
                    <div
                      className={cn(
                        theme.field.selectableBox,
                        theme.field.selectableBoxDefault,
                        theme.field.selectableBoxHover,
                        theme.field.selectableBoxFocus,
                        'flex items-center gap-4 rounded-[14px] p-4',
                        disabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer',
                      )}
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onClick={() => handleSelect(option)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(option);
                        }
                      }}
                      style={{ color: theme.colors.text }}
                    >
                      <span
                        className={cn(
                          theme.container.activeBg,
                          theme.container.activeBorder,
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                        )}
                        style={{ color: theme.colors.text }}
                      >
                        <MedicationBottleI />
                      </span>
                      <span
                        className={cn(
                          theme.field.selectableBoxText,
                          'min-w-0 flex-1 truncate',
                        )}
                      >
                        {renderHighlightedText(option.label, searchValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="custom-footer">
              <div
                className={cn(
                  theme.button.text,
                  'mr-3 flex items-center justify-between gap-5 rounded-[14px] p-4',
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => setIsAddMedicationOpen((open) => !open)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsAddMedicationOpen((open) => !open);
                  }
                }}
                style={{ color: theme.colors.primary }}
              >
                <span className="text-base">{DEFAULT_EMPTY_ACTION_LABEL}</span>
                <FooterChevronI />
              </div>
            </div>
          </>
        )}
      </div>

      {isAddMedicationOpen && (
        <div
          className="fixed inset-0 h-screen overflow-hidden z-50 flex items-end justify-center bg-black/40 px-4"
          onClick={() => setIsAddMedicationOpen(false)}
        >
          <div
            className={cn(
              theme.container.card,
              'relative max-h-[80vh] w-full max-w-[600px] overflow-y-auto rounded-t-[32px] p-6 shadow-xl md:mx-4 md:rounded-lg',
            )}
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: theme.colors.background }}
          >
            <div>
              <div className={cn(theme.field.label, 'mb-4 text-base')}>
                Add Medication
              </div>

              <div className="floating-label-input-container relative w-full">
                <label
                  htmlFor={`${label || 'medication-search'}-custom-medication-input`}
                  className={cn(
                    'floating-label absolute left-4 transition-all duration-200',
                    customMedicationName || isCustomMedicationFocused
                      ? 'top-6 -translate-y-2 text-sm'
                      : 'top-7 text-lg',
                  )}
                  style={{ color: theme.colors.text }}
                >
                  Medication
                </label>
                <input
                  ref={customMedicationInputRef}
                  id={`${label || 'medication-search'}-custom-medication-input`}
                  placeholder=""
                  inputMode="text"
                  className={cn(
                    theme.field.input,
                    'mb-4 h-20 w-full rounded-[14px] border bg-white pb-2 pl-4 pr-4 pt-9',
                  )}
                  type="text"
                  value={customMedicationName}
                  disabled={disabled}
                  onChange={(e) => setCustomMedicationName(e.target.value)}
                  onFocus={() => setIsCustomMedicationFocused(true)}
                  onBlur={() => setIsCustomMedicationFocused(false)}
                  style={{
                    borderColor: isCustomMedicationFocused
                      ? theme.colors.primary
                      : theme.colors.border,
                    boxShadow: 'none',
                  }}
                />
                <span
                  className="text-[14px]"
                  style={{ color: theme.colors.error }}
                />
              </div>

              <div
                className={cn(
                  'mt-2 transition-opacity ease-in-out',
                  isAddMedicationButtonVisible ? 'opacity-100' : 'opacity-0',
                )}
                style={{ transitionDuration: '500ms' }}
              >
                <button
                  type="button"
                  onClick={handleAddCustomMedication}
                  className={cn(
                    theme.button.primary,
                    'pointer-events-auto flex items-center justify-center min-h-16 px-4',
                    disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer',
                  )}
                >
                  Add medication
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SelectedMedicationList
        selectedOptions={selectedOptions}
        disabled={disabled}
        theme={theme}
        onRemoveOption={onRemoveOption}
      />
    </div>
  );
};

const MedicationSearchBlockForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const [newMedicationLabel, setNewMedicationLabel] = useState('');
  const [newMedicationValue, setNewMedicationValue] = useState('');
  const options = getMedicationOptions(data);

  const handleChange = (field: string, value: unknown) => {
    onUpdate?.({
      ...data,
      [field]: value,
    });
  };

  const handleAddOption = () => {
    if (!newMedicationLabel.trim()) return;

    handleChange('options', [
      ...options,
      {
        id: getNextMedicationOptionId(options),
        label: newMedicationLabel.trim(),
        value: newMedicationValue.trim() || newMedicationLabel.trim(),
      },
    ]);

    setNewMedicationLabel('');
    setNewMedicationValue('');
  };

  const handleUpdateOption = (
    index: number,
    field: 'label' | 'value',
    value: string,
  ) => {
    const nextOptions = [...options];
    nextOptions[index] = {
      ...nextOptions[index],
      [field]: value,
    };

    handleChange('options', nextOptions);
  };

  const handleRemoveOption = (index: number) => {
    const nextOptions = [...options];
    nextOptions.splice(index, 1);
    handleChange('options', nextOptions);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm" htmlFor="fieldName">
            Field Name
          </Label>
          <Input
            id="fieldName"
            value={data.fieldName || ''}
            onChange={(e) => handleChange('fieldName', e.target.value)}
            placeholder="medications"
          />
          <p className="text-xs text-muted-foreground">
            Unique identifier for storing responses
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm" htmlFor="label">
            Question Label
          </Label>
          <Input
            id="label"
            value={data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Please list medications you are currently taking."
          />
          <p className="text-xs text-muted-foreground">
            Prompt shown above the medication search UI
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="description">
          Description (optional)
        </Label>
        <Textarea
          id="description"
          value={data.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Shown below the question"
          rows={2}
        />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Medication Options</Label>
          <span className="text-xs text-muted-foreground">
            Configure the label and submitted value for each medication
          </span>
        </div>

        <div className="space-y-3">
          {options.map((option, index) => (
            <div
              key={option.id || `medication-option-${index}`}
              className="flex items-center gap-2"
            >
              <div className="w-6 text-xs text-muted-foreground">
                {index + 1}
              </div>
              <div className="grow grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <Input
                    value={option.label}
                    onChange={(e) =>
                      handleUpdateOption(index, 'label', e.target.value)
                    }
                    placeholder="Medication label"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    value={option.value}
                    onChange={(e) =>
                      handleUpdateOption(index, 'value', e.target.value)
                    }
                    placeholder="Medication value"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveOption(index)}
                className="text-destructive"
              >
                <CircleX className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <CirclePlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grow grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={newMedicationLabel}
                  onChange={(e) => setNewMedicationLabel(e.target.value)}
                  placeholder="New medication label"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input
                  value={newMedicationValue}
                  onChange={(e) => setNewMedicationValue(e.target.value)}
                  placeholder="New medication value"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleAddOption}
            >
              <CirclePlus className="h-4 w-4 text-primary" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MedicationSearchBlockItem: React.FC<ContentBlockItemProps> = ({
  data,
}) => {
  const options = getMedicationOptions(data);

  return (
    <Card className="space-y-3 p-4">
      <MedicationSearchUi
        label={data.label}
        description={data.description}
        options={options}
        selectedOptions={options.slice(0, 1)}
        theme={themes.default}
        optionLimit={Math.min(options.length, 2) || 1}
      />
    </Card>
  );
};

const MedicationSearchBlockPreview: React.FC = () => {
  const options: MedicationOption[] = [
    {
      id: 'preview-losartan',
      label: 'Losartan',
      value: 'Cozaar',
    },
  ];

  return (
    <div className="w-full py-1">
      <MedicationSearchUi
        options={options}
        selectedOptions={options}
        theme={themes.default}
        optionLimit={1}
      />
    </div>
  );
};

const MedicationSearchRenderer = forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, value, onChange, error, disabled, theme: themeProp }, ref) => {
    const theme = themeProp ?? themes.default;
    const options = getMedicationOptions(block);
    const selectedOptions = getSelectedMedications(value, options);
    // Answers store the medication name the patient saw, not the option value.
    const handleSelectOption = (option: MedicationOption) => {
      if (disabled) return;

      const alreadySelected = selectedOptions.some(
        (selectedOption) =>
          selectedOption.value === option.value ||
          selectedOption.label === option.label,
      );

      if (alreadySelected) return;

      onChange?.([
        ...selectedOptions.map((selectedOption) => selectedOption.label),
        option.label,
      ]);
    };

    const handleRemoveOption = (option: MedicationOption) => {
      if (disabled) return;

      onChange?.(
        selectedOptions
          .filter((selectedOption) => selectedOption.value !== option.value)
          .map((selectedOption) => selectedOption.label),
      );
    };

    return (
      <div ref={ref}>
        <MedicationSearchUi
          label={block.label}
          description={block.description}
          options={options}
          selectedOptions={selectedOptions}
          error={error}
          disabled={disabled}
          theme={theme}
          onSelectOption={handleSelectOption}
          onRemoveOption={handleRemoveOption}
          onAddCustomMedication={handleSelectOption}
        />
      </div>
    );
  },
);

MedicationSearchRenderer.displayName = 'MedicationSearchRenderer';

export const MedicationSearchBlock: BlockDefinition = {
  type: 'medication-search',
  name: 'Medication Search',
  description:
    'Search-style medication picker UI with selected medication chips',
  icon: <Search className="w-4 h-4" />,
  defaultData: {
    type: 'medication-search',
    fieldName: DEFAULT_FIELD_NAME,
    label: 'Please list medications you are currently taking.',
    options: createDefaultMedicationOptions(),
    defaultValue: [],
  },
  generateDefaultData: () => ({
    type: 'medication-search',
    fieldName: DEFAULT_FIELD_NAME,
    label: 'Please list medications you are currently taking.',
    options: createDefaultMedicationOptions(),
    defaultValue: [],
  }),
  renderItem: (props) => <MedicationSearchBlockItem {...props} />,
  renderFormFields: (props) => <MedicationSearchBlockForm {...props} />,
  renderPreview: () => <MedicationSearchBlockPreview />,
  renderBlock: (props) => <MedicationSearchRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (!data.label) return 'Label is required';

    const options = getMedicationOptions(data);
    if (options.length === 0)
      return 'At least one medication option is required';
    if (options.some((option) => !option.label || !option.value)) {
      return 'Each medication must have both a label and value';
    }

    return null;
  },
  validateValue: (value, data) => {
    if (data.required && (!Array.isArray(value) || value.length === 0)) {
      /* This won't be visible but won't let user pass (Continue button will be disabled). */
      return 'Error.';
    }

    return null;
  },
  outputSchema: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
};
