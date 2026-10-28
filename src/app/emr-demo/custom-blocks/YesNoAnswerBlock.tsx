import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
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
import { Switch } from '@/packages/survey-form-package/src/components/ui/switch';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { CheckSquare, MessageSquareText } from 'lucide-react';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';

type Choice = 'no' | 'yes' | null;

interface YesNoAnswer {
  choice: Choice;
  details: string;
}

const DEFAULTS = {
  fieldName: 'yesNoAnswer',
  label: 'Have you ever had weight loss surgery (bariatric or gastric)?',
  noLabel: 'No',
  yesLabel: 'Yes',
  detailsPrompt:
    "Please list your weight loss surgery(s) and the date(s). Don't worry about typos.",
  detailsPlaceholder: 'Type your answer here',
  buttonText: 'Next',
};

// Long enough for the patient to see the selection before the step changes.
const ADVANCE_DELAY_MS = 150;
// The layout keeps the old step on screen for its exit animation. If the step hasn't
// changed after this long, moving on failed and the block takes clicks again.
const LEAVE_TIMEOUT_MS = 1000;
const OPEN_TRANSITION =
  'grid-template-rows 0.5s ease, opacity 0.5s ease, margin-top 0.5s ease';
const CLOSE_TRANSITION =
  'grid-template-rows 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease';

const getNoLabel = (data: BlockData) => data.noLabel || DEFAULTS.noLabel;
const getYesLabel = (data: BlockData) => data.yesLabel || DEFAULTS.yesLabel;
const detailsRequired = (data: BlockData) => data.detailsRequired !== false;

// The answer is saved as plain text ("No", "Yes" or "Yes: <details>") because the
// patient intake shows text answers as they are and object answers as raw JSON.
const formatAnswer = (answer: YesNoAnswer, data: BlockData): string => {
  if (answer.choice === 'no') return getNoLabel(data);
  if (answer.choice !== 'yes') return '';

  const details = answer.details.trim();
  return details ? `${getYesLabel(data)}: ${details}` : getYesLabel(data);
};

const parseAnswer = (value: unknown, data: BlockData): YesNoAnswer => {
  if (typeof value !== 'string') return { choice: null, details: '' };

  const yesLabel = getYesLabel(data);
  if (value === getNoLabel(data)) return { choice: 'no', details: '' };
  if (value === yesLabel) return { choice: 'yes', details: '' };
  if (value.startsWith(`${yesLabel}: `)) {
    return { choice: 'yes', details: value.slice(yesLabel.length + 2) };
  }

  return { choice: null, details: '' };
};

const isAnswerComplete = (answer: YesNoAnswer, data: BlockData) =>
  answer.choice === 'no' ||
  (answer.choice === 'yes' &&
    (!detailsRequired(data) || answer.details.trim().length > 0));

interface AnswerBoxProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  theme: ThemeDefinition;
  onSelect?: () => void;
}

// Same markup and theme classes as the platform's Selectable Box Question, so the
// block matches the live intake's questions.
const AnswerBox: React.FC<AnswerBoxProps> = ({
  label,
  selected,
  disabled,
  theme,
  onSelect,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      'block w-full cursor-pointer text-left',
      theme.field.selectableBox ||
        'p-5 transition-all duration-200 cursor-pointer rounded-lg',
      selected
        ? theme.field.selectableBoxSelected || 'border border-gray-400 bg-gray-50'
        : theme.field.selectableBoxDefault ||
            'border border-gray-300 bg-white hover:bg-gray-50',
      !disabled && (theme.field.selectableBoxHover || 'hover:border-gray-400'),
      theme.field.selectableBoxFocus ||
        'focus-within:ring-2 focus-within:ring-gray-500 focus-within:ring-offset-2',
      disabled &&
        (theme.field.selectableBoxDisabled || 'opacity-50 cursor-not-allowed'),
    )}
  >
    <div className="flex items-center justify-between">
      <span
        className={cn(
          theme.field.selectableBoxText || 'text-gray-900 text-base font-normal',
          selected &&
            (theme.field.selectableBoxTextSelected || 'text-gray-900 font-normal'),
        )}
      >
        {label}
      </span>
      {selected && (
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full',
            theme.field.selectableBoxIndicator || 'bg-gray-600 text-white',
          )}
        >
          <CheckSquare
            className={cn(
              'h-3 w-3',
              theme.field.selectableBoxIndicatorIcon || 'text-white',
            )}
          />
        </div>
      )}
    </div>
  </button>
);

interface YesNoAnswerUiProps {
  data: BlockData;
  answer: YesNoAnswer;
  theme: ThemeDefinition;
  disabled?: boolean;
  showButton: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onChoose?: (choice: 'no' | 'yes') => void;
  onDetailsChange?: (details: string) => void;
  onContinue?: () => void;
}

const YesNoAnswerUi: React.FC<YesNoAnswerUiProps> = ({
  data,
  answer,
  theme,
  disabled,
  showButton,
  textareaRef,
  onChoose,
  onDetailsChange,
  onContinue,
}) => {
  const idPrefix = useId();
  const questionId = `${idPrefix}-question`;
  const detailsId = `${idPrefix}-details`;
  const open = answer.choice === 'yes';
  const canContinue = isAnswerComplete(answer, data);

  return (
    <div className="survey-box-question w-full min-w-0 space-y-4 text-left">
      {data.label && (
        <Label
          id={questionId}
          className={cn('block text-lg font-bold', theme.field.label, 'text-left')}
        >
          {data.label}
        </Label>
      )}

      {data.description && (
        <div
          className={cn(
            'text-sm text-muted-foreground',
            theme.field.description,
            'text-left',
          )}
        >
          {data.description}
        </div>
      )}

      <div
        role="radiogroup"
        aria-labelledby={data.label ? questionId : undefined}
        className={cn(
          'my-8 space-y-4',
          theme.field.selectableBoxContainer || 'space-y-3',
        )}
      >
        <AnswerBox
          label={getNoLabel(data)}
          selected={answer.choice === 'no'}
          disabled={disabled}
          theme={theme}
          onSelect={onChoose ? () => onChoose('no') : undefined}
        />
        <AnswerBox
          label={getYesLabel(data)}
          selected={open}
          disabled={disabled}
          theme={theme}
          onSelect={onChoose ? () => onChoose('yes') : undefined}
        />
      </div>

      {/* The details area grows from zero height when Yes is picked. */}
      <div
        aria-hidden={!open}
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          marginTop: open ? undefined : 0,
          transition: open ? OPEN_TRANSITION : CLOSE_TRANSITION,
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="space-y-4 pb-1">
            {data.detailsPrompt && (
              <Label
                htmlFor={detailsId}
                className={cn('block', theme.field.label, 'text-left')}
              >
                {data.detailsPrompt}
              </Label>
            )}
            <Textarea
              ref={textareaRef}
              id={detailsId}
              rows={4}
              value={answer.details}
              placeholder={data.detailsPlaceholder}
              disabled={disabled || !open}
              tabIndex={open ? undefined : -1}
              onChange={(event) => onDetailsChange?.(event.target.value)}
              className={theme.field.textarea}
            />
            {showButton && (
              <button
                type="button"
                disabled={disabled || !open || !canContinue}
                tabIndex={open ? undefined : -1}
                onClick={onContinue}
                className={cn(
                  'w-full',
                  theme.button.primary,
                  (disabled || !canContinue) && 'cursor-not-allowed opacity-60',
                )}
              >
                {data.buttonText || DEFAULTS.buttonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const YesNoAnswerBlockForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const handleChange = (field: string, value: unknown) => {
    onUpdate?.({ ...data, [field]: value });
  };

  const textField = (
    field: string,
    label: string,
    placeholder: string,
    help?: string,
  ) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={field}>
        {label}
      </Label>
      <Input
        id={field}
        value={data[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {textField(
          'fieldName',
          'Field Name',
          DEFAULTS.fieldName,
          'Unique identifier for storing responses',
        )}
        {textField('label', 'Question Label', DEFAULTS.label)}
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

      <div className="grid grid-cols-2 gap-4">
        {textField(
          'noLabel',
          'First answer (moves on)',
          DEFAULTS.noLabel,
          'Saved as the answer, then the next step shows',
        )}
        {textField(
          'yesLabel',
          'Second answer (opens details)',
          DEFAULTS.yesLabel,
          'Saved as "Yes" or "Yes: <details>"',
        )}
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Label className="text-sm">Details (shown after the second answer)</Label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground" htmlFor="detailsPrompt">
            Prompt
          </Label>
          <Textarea
            id="detailsPrompt"
            value={data.detailsPrompt || ''}
            onChange={(e) => handleChange('detailsPrompt', e.target.value)}
            placeholder={DEFAULTS.detailsPrompt}
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {textField(
            'detailsPlaceholder',
            'Placeholder',
            DEFAULTS.detailsPlaceholder,
          )}
          {textField(
            'buttonText',
            'Button text',
            DEFAULTS.buttonText,
            "Hidden when the layout's continue button is on",
          )}
        </div>
        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="detailsRequired"
            checked={detailsRequired(data)}
            onCheckedChange={(checked) => handleChange('detailsRequired', checked)}
          />
          <Label htmlFor="detailsRequired" className="text-sm">
            Details required
          </Label>
        </div>
      </div>
    </div>
  );
};

const YesNoAnswerBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="space-y-3 p-4">
    <YesNoAnswerUi
      data={data}
      answer={{ choice: 'yes', details: '' }}
      theme={themes.default}
      showButton={data.showContinueButton === false}
      disabled
    />
  </Card>
);

const YesNoAnswerBlockPreview: React.FC = () => (
  <div className="w-full space-y-2 py-1">
    <AnswerBox label={DEFAULTS.noLabel} selected={false} theme={themes.default} />
    <AnswerBox label={DEFAULTS.yesLabel} selected theme={themes.default} />
  </div>
);

const YesNoAnswerRenderer = forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, value, onChange, disabled, theme: themeProp }, ref) => {
    const theme = themeProp ?? themes.default;
    const { goToNextBlock } = useSurveyForm();
    const [answer, setAnswer] = useState<YesNoAnswer>(() =>
      parseAnswer(value ?? block.defaultValue, block),
    );
    const lastSaved = useRef(formatAnswer(answer, block));
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Set once the block moves on, so a second click during the exit animation
    // can't move the patient past the next step too.
    const leaving = useRef(false);

    // Follow outside changes to the value (for example a reset), but not our own.
    useEffect(() => {
      if (typeof value === 'string' && value !== lastSaved.current) {
        lastSaved.current = value;
        setAnswer(parseAnswer(value, block));
      }
    }, [value, block]);

    useEffect(() => {
      const pending = timers.current;
      return () => pending.forEach(clearTimeout);
    }, []);

    const save = (next: YesNoAnswer) => {
      setAnswer(next);
      const saved = formatAnswer(next, block);
      lastSaved.current = saved;
      onChange?.(saved);
      return saved;
    };

    const leave = (saved: string, delay: number) => {
      const fieldName = block.fieldName;
      if (!fieldName) return;

      leaving.current = true;
      timers.current.push(
        setTimeout(() => goToNextBlock({ [fieldName]: saved }), delay),
        setTimeout(() => {
          leaving.current = false;
        }, delay + LEAVE_TIMEOUT_MS),
      );
    };

    const handleChoose = (choice: 'no' | 'yes') => {
      if (disabled || leaving.current) return;

      if (choice === 'no') {
        leave(save({ choice: 'no', details: answer.details }), ADVANCE_DELAY_MS);
        return;
      }

      if (answer.choice !== 'yes') save({ choice: 'yes', details: answer.details });
      // Focus once the area has started to open, so the page scrolls to it.
      timers.current.push(
        setTimeout(() => textareaRef.current?.focus(), ADVANCE_DELAY_MS),
      );
    };

    const handleDetailsChange = (details: string) => {
      if (disabled || leaving.current) return;
      save({ choice: 'yes', details });
    };

    const handleContinue = () => {
      if (disabled || leaving.current || !isAnswerComplete(answer, block)) return;
      leave(formatAnswer(answer, block), 0);
    };

    return (
      <div ref={ref}>
        <YesNoAnswerUi
          data={block}
          answer={answer}
          theme={theme}
          disabled={disabled}
          showButton={block.showContinueButton === false}
          textareaRef={textareaRef}
          onChoose={handleChoose}
          onDetailsChange={handleDetailsChange}
          onContinue={handleContinue}
        />
      </div>
    );
  },
);

YesNoAnswerRenderer.displayName = 'YesNoAnswerRenderer';

const createDefaultData = (): BlockData => ({
  type: 'yes-no-answer',
  fieldName: DEFAULTS.fieldName,
  label: DEFAULTS.label,
  description: '',
  noLabel: DEFAULTS.noLabel,
  yesLabel: DEFAULTS.yesLabel,
  detailsPrompt: DEFAULTS.detailsPrompt,
  detailsPlaceholder: DEFAULTS.detailsPlaceholder,
  detailsRequired: true,
  buttonText: DEFAULTS.buttonText,
  // The block moves on by itself after No, and draws its own button after Yes.
  showContinueButton: false,
  defaultValue: '',
});

export const YesNoAnswerBlock: BlockDefinition = {
  type: 'yes-no-answer',
  name: 'Yes/No Answer',
  description: 'No moves on; Yes opens a text area for details',
  icon: <MessageSquareText className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <YesNoAnswerBlockItem {...props} />,
  renderFormFields: (props) => <YesNoAnswerBlockForm {...props} />,
  renderPreview: () => <YesNoAnswerBlockPreview />,
  renderBlock: (props) => <YesNoAnswerRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (!data.label) return 'Label is required';
    if (getNoLabel(data) === getYesLabel(data)) {
      return 'The two answers must be different';
    }

    return null;
  },
  // The block doesn't show this message: core reports it as soon as Yes is picked, and the
  // disabled button already tells the patient that details are needed.
  validateValue: (value, data) => {
    if (!isAnswerComplete(parseAnswer(value, data), data)) return 'Error.';

    return null;
  },
  // "No", "Yes" or "Yes: <details>", using the builder's answer labels.
  outputSchema: {
    type: 'string',
  },
};
