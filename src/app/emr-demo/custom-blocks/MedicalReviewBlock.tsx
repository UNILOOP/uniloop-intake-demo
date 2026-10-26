import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
  ThemeDefinition,
} from '@/packages/survey-form-package/src/types';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Switch } from '@/packages/survey-form-package/src/components/ui/switch';
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { themes } from '@/packages/survey-form-package/src/themes';
import { Check, ClipboardCheck, Plus, Star, Trash2 } from 'lucide-react';

/**
 * Medical review: a short "reviewing your answers" step between the questions and the plan.
 * It greets the patient by name, ticks off a checklist one line at a time, shows a result
 * line, then moves on by itself. It saves nothing.
 *
 * Texts can quote answers: `{field}` or `{field.key}` is replaced by that answer, from this
 * form or, on enrollment pages, an earlier form, and `{field|text}` falls back to the text.
 * A line whose answer is missing is left out. The eligibility figure is a setting that is
 * off by default.
 */

interface ChecklistItem {
  title: string;
  detail: string;
}

/** A two-letter state code in an answer shows as the state's name */
const STATE_NAMES = new Map(
  'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'
    .split('|')
    .map((entry) => [entry.slice(0, 2), entry.slice(3)] as [string, string]),
);

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const getItems = (data: BlockData): ChecklistItem[] => (Array.isArray(data.checklist) ? data.checklist : []);

type AnswerLookup = (path: string) => unknown;

/** Looks answers up by field name (`field` or `field.key`): this form's first, then earlier forms' */
const useAnswers = (): AnswerLookup => {
  const { values, customData } = useSurveyForm();
  return useMemo(() => {
    const earlier = Object.values(customData?.completedFormResponses ?? {}).filter(
      (answers): answers is Record<string, unknown> => !!answers && typeof answers === 'object',
    );
    const sources = [values as Record<string, unknown>, ...earlier.reverse()];
    return (path: string) =>
      sources
        .map((answers) =>
          path
            .split('.')
            .reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as any)[key] : undefined), answers),
        )
        .find((value) => value !== undefined && value !== null && value !== '');
  }, [values, customData]);
};

/** Fills `{field}` and `{field|fallback}` with answers; null when an answer is missing and has no fallback */
const fillTokens = (text: string, answer: AnswerLookup): string | null => {
  let missing = false;
  const filled = text.replace(/\{([^{}|]+)(?:\|([^{}]*))?\}/g, (_match, path: string, fallback?: string) => {
    const found = answer(path.trim());
    const shown = Array.isArray(found) ? found.join(', ') : found == null ? '' : String(found).trim();
    if (shown) return STATE_NAMES.get(shown) ?? shown;
    if (fallback !== undefined) return fallback;
    missing = true;
    return '';
  });
  return missing ? null : filled;
};

const noAnswers: AnswerLookup = () => undefined;

interface MedicalReviewUiProps {
  data: BlockData;
  theme: ThemeDefinition;
  answer: AnswerLookup;
  /** How many checklist lines are ticked; all of them when not animating */
  ticked: number;
  /** The eligibility bar's fill, 0 to 1 */
  progress: number;
  showResult: boolean;
}

const MedicalReviewUi: React.FC<MedicalReviewUiProps> = ({ data, theme, answer, ticked, progress, showResult }) => {
  const ink = theme.colors.text;
  const primary = theme.colors.primary;
  const muted = tint(ink, 62);
  const name = fillTokens(data.nameLine || '', answer);
  // Without a name, the heading loses the comma that led into it
  const heading = name ? data.heading : (data.heading || '').replace(/[,\s]+$/, '');
  const items = getItems(data)
    .map((item) => ({ title: fillTokens(item.title || '', answer), detail: fillTokens(item.detail || '', answer) }))
    .filter((item) => item.title !== null && item.detail !== null);
  const waiting = fillTokens(data.waitingText || '', answer);
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));

  return (
    <div>
      {heading && (
        <h2 className="font-medium" style={{ fontSize: 'clamp(24px, 1.75vw, 26px)', lineHeight: 1.25, color: ink }}>
          {heading}
        </h2>
      )}
      {name && (
        <p
          style={{
            fontFamily: theme.fonts?.secondary,
            fontStyle: 'italic',
            fontSize: 'clamp(44px, 3vw, 48px)',
            lineHeight: 1.1,
            color: primary,
          }}
        >
          {name}
        </p>
      )}

      {data.showScore && (
        <div style={{ marginTop: 24 }}>
          <div className="flex items-center justify-between text-sm font-medium" style={{ color: ink }}>
            <span>{data.scoreLabel}</span>
            <span style={{ color: primary }}>{Math.round(score * progress)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(score * progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ marginTop: 10, height: 6, borderRadius: 6, backgroundColor: theme.colors.border }}
          >
            <div
              style={{
                height: '100%',
                width: `${score * progress}%`,
                borderRadius: 6,
                backgroundColor: primary,
                transition: 'width 0.6s ease-out',
              }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-4" style={{ marginTop: 24 }}>
        {items.map((item, index) => {
          const done = index < ticked;
          return (
            <li key={index} className="flex items-start gap-3">
              <span
                className={`flex shrink-0 items-center justify-center rounded-full ${done ? '' : 'animate-spin'}`}
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: done ? primary : 'transparent',
                  border: done ? 'none' : `2px solid ${theme.colors.border}`,
                  borderTopColor: done ? undefined : muted,
                  color: 'white',
                  transition: 'background-color 0.3s',
                }}
              >
                {done && <Check style={{ width: 13, height: 13 }} strokeWidth={3} aria-hidden />}
              </span>
              <div style={{ opacity: done ? 1 : 0.55, transition: 'opacity 0.3s' }}>
                <p className="font-medium" style={{ fontSize: 16, color: ink }}>
                  {item.title}
                </p>
                {item.detail && (
                  <p className="text-sm" style={{ marginTop: 2, color: muted }}>
                    {item.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {waiting && (
          <li className="flex items-center gap-3">
            <span
              className="shrink-0 rounded-full animate-spin"
              style={{
                width: 24,
                height: 24,
                border: `2px solid ${theme.colors.border}`,
                borderTopColor: muted,
              }}
              aria-hidden
            />
            <span style={{ fontSize: 16, color: muted }}>{waiting}</span>
          </li>
        )}
      </ul>

      {data.resultText && (
        <div
          className="flex items-center gap-3"
          aria-live="polite"
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            backgroundColor: theme.colors.accent,
            opacity: showResult ? 1 : 0,
            transform: showResult ? 'none' : 'translateY(6px)',
            transition: 'opacity 0.4s, transform 0.4s',
          }}
        >
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{ width: 32, height: 32, backgroundColor: 'white', color: primary }}
          >
            <Star style={{ width: 12, height: 12 }} fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <span className="font-medium" style={{ fontSize: 16, color: ink }}>
            {showResult ? data.resultText : ''}
          </span>
        </div>
      )}

      {data.footer && (
        <p className="text-xs text-center" style={{ marginTop: 24, color: muted }}>
          {data.footer}
        </p>
      )}
    </div>
  );
};

const MedicalReviewRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(({ block, theme }, ref) => {
  const { goToNextBlock } = useSurveyForm();
  const answer = useAnswers();
  const count = getItems(block).length;
  const stepMs = Math.max(0.2, Number(block.stepSeconds) || 1.2) * 1000;
  const advanceMs = Math.max(0, Number(block.advanceSeconds) || 0) * 1000;
  const [elapsed, setElapsed] = useState(0);
  const moved = useRef(false);

  // One clock drives the ticks, the bar and the move on; with reduced motion all show at once
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = Date.now() - (reduced ? stepMs * (count + 1) : 0);
    const timer = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(timer);
  }, [stepMs, count]);

  const ticked = Math.min(count, Math.floor(elapsed / stepMs));
  const allTicked = elapsed >= stepMs * count;

  useEffect(() => {
    if (advanceMs > 0 && elapsed >= advanceMs && !moved.current) {
      moved.current = true;
      goToNextBlock();
    }
  }, [elapsed, advanceMs, goToNextBlock]);

  return (
    <div ref={ref}>
      <MedicalReviewUi
        data={block}
        theme={theme ?? themes.default}
        answer={answer}
        ticked={ticked}
        progress={Math.min(1, elapsed / (stepMs * Math.max(count, 1)))}
        showResult={allTicked}
      />
    </div>
  );
});

MedicalReviewRenderer.displayName = 'MedicalReviewRenderer';

const MedicalReviewForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const items = getItems(data);
  const update = (patch: Record<string, unknown>) => onUpdate?.({ ...data, ...patch });
  const setItems = (next: ChecklistItem[]) => update({ checklist: next });

  const text = (field: string, label: string, help?: string, type = 'text') => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`medical-review-${field}`}>
        {label}
      </Label>
      <Input
        id={`medical-review-${field}`}
        type={type}
        value={data[field] ?? ''}
        onChange={(e) => {
          const value = type === 'number' ? Number(e.target.value) : e.target.value;
          // Next shows only when the step doesn't move on by itself
          update(field === 'advanceSeconds' ? { advanceSeconds: value, showContinueButton: !value } : { [field]: value });
        }}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Texts can quote answers: {'{field}'} or {'{field.key}'} shows that answer, and {'{field|text}'} falls back to
        the text. A line whose answer is missing is left out.
      </p>
      {text('heading', 'Heading')}
      {text('nameLine', 'Name line', 'In the theme’s second font, in italics, under the heading.')}

      <div className="flex items-center justify-between">
        <Label className="text-sm" htmlFor="medical-review-showScore">
          Show the eligibility bar
        </Label>
        <Switch
          id="medical-review-showScore"
          checked={!!data.showScore}
          onCheckedChange={(checked) => update({ showScore: checked })}
        />
      </div>
      {data.showScore && (
        <>
          {text('scoreLabel', 'Bar label')}
          {text('score', 'Bar figure (percent)', undefined, 'number')}
        </>
      )}

      <div className="space-y-2">
        <Label className="text-sm">Checklist</Label>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Line ${index + 1} title`}
              className="w-36"
              value={item.title}
              onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, title: e.target.value } : it)))}
            />
            <Input
              aria-label={`Line ${index + 1} detail`}
              value={item.detail}
              onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, detail: e.target.value } : it)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { title: '', detail: '' }])}>
          <Plus className="h-4 w-4 mr-1" />
          Add line
        </Button>
      </div>

      {text('waitingText', 'Last line, still in progress')}
      {text('resultText', 'Result')}
      {text('footer', 'Footer')}
      {text('stepSeconds', 'Seconds per checklist line', undefined, 'number')}
      {text('advanceSeconds', 'Move on after (seconds)', '0 keeps the step and shows Next.', 'number')}
    </div>
  );
};

const MedicalReviewItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <MedicalReviewUi data={data} theme={themes.default} answer={noAnswers} ticked={99} progress={1} showResult />
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'medicalReview',
  heading: 'Finding your match,',
  nameLine: '{NameInformation.firstName}',
  showScore: false,
  scoreLabel: 'Eligibility check',
  score: 0,
  checklist: [
    { title: 'Your goal', detail: 'Lose {selectableboxzziytz}' },
    { title: 'Body metrics', detail: 'BMI {bmi.bmi}' },
    { title: 'Health history', detail: 'Answers received' },
  ],
  waitingText: 'Matching you with a licensed provider in {state|your state}…',
  resultText: 'Looks like a good match for treatment.',
  footer: 'Hang tight — your personalized plan is almost ready.',
  stepSeconds: 1.2,
  advanceSeconds: 7,
  hideBack: true,
  hidePrivacy: true,
  showContinueButton: false,
});

export const MedicalReviewBlock: BlockDefinition = {
  type: 'medicalReview',
  name: 'Medical Review',
  description: 'A "reviewing your answers" step that greets the patient and moves on by itself',
  icon: <ClipboardCheck className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <MedicalReviewItem {...props} />,
  renderFormFields: (props) => <MedicalReviewForm {...props} />,
  renderPreview: () => (
    <div className="w-full py-1">
      <MedicalReviewUi
        data={createDefaultData()}
        theme={themes.default}
        answer={noAnswers}
        ticked={99}
        progress={1}
        showResult
      />
    </div>
  ),
  renderBlock: (props) => <MedicalReviewRenderer {...props} />,
  validate: (data) => (data.heading || data.nameLine ? null : 'Add a heading'),
};

export default MedicalReviewBlock;
