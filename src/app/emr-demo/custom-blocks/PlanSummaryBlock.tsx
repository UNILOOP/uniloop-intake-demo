import React, { useMemo, useState } from 'react';
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
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { themes } from '@/packages/survey-form-package/src/themes';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Heart,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Plan summary: the patient's plan before checkout, on a dark page. A "matched" chip, the
 * patient's name and the plan's title, chips that echo their answers, a projected weight
 * chart, then a card with the treatment that matches their medication answer, its
 * benefits, a note about the provider review, questions and answers, and the button that
 * moves on. Trust lines and a footnote sit under the card. It saves nothing.
 *
 * Texts can quote answers: `{field}` or `{field.key}` is replaced by that answer, from this
 * form or, on enrollment pages, an earlier form, and `{field|text}` falls back to the text.
 * A chip or line whose answer is missing is left out. The chart, the chip and every claim
 * are settings that can be turned off or reworded.
 */

interface Treatment {
  /** The medication answer that picks this treatment; empty matches any answer */
  match: string;
  name: string;
  detail: string;
  /** Tags under the name, separated by commas */
  tags: string;
  imageUrl: string;
  /** A chip added to the answer chips when this treatment is picked */
  chip: string;
}

interface IconLine {
  icon: string;
  text: string;
}

interface Faq {
  question: string;
  answer: string;
}

const ICONS: Record<string, { Icon: LucideIcon; name: string }> = {
  stethoscope: { Icon: Stethoscope, name: 'Stethoscope' },
  heart: { Icon: Heart, name: 'Heart' },
  truck: { Icon: Truck, name: 'Truck' },
  shield: { Icon: ShieldCheck, name: 'Shield' },
  lock: { Icon: Lock, name: 'Lock' },
  check: { Icon: Check, name: 'Tick' },
};

/** A two-letter state code in an answer shows as the state's name */
const STATE_NAMES = new Map(
  'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'
    .split('|')
    .map((entry) => [entry.slice(0, 2), entry.slice(3)] as [string, string]),
);

const CHART_TICKS = 5;

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// Text spans inside a line take its line height. Public pages load the portal's stylesheet,
// which gives every span without a `font-` class a line height of 1.6
const inheritLine = { lineHeight: 'inherit' } as const;

/** Hyphenated words such as GLP-1 stay whole when a heading wraps */
const keepHyphenatedWords = (text: string) =>
  text.split(/(\S+-\S+)/).map((part, index) =>
    index % 2 ? (
      <span key={index} style={{ ...inheritLine, whiteSpace: 'nowrap' }}>
        {part}
      </span>
    ) : (
      part
    ),
  );

const list = <T,>(data: BlockData, field: string): T[] => (Array.isArray(data[field]) ? data[field] : []);

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

/** The treatment for the medication answer: an exact match, else the first one that matches any answer */
const pickTreatment = (treatments: Treatment[], picked: unknown): Treatment | undefined => {
  const value = typeof picked === 'string' ? picked.trim().toLowerCase() : '';
  return (
    treatments.find((t) => value && t.match?.trim().toLowerCase() === value) ?? treatments.find((t) => !t.match?.trim())
  );
};

interface ChartProps {
  theme: ThemeDefinition;
  data: BlockData;
  weight: number;
}

/** Today's weight, the projected weight and a curve between them over the chart's months */
const WeightChart: React.FC<ChartProps> = ({ theme, data, weight }) => {
  const light = theme.colors.secondary;
  const months = Math.max(1, Number(data.chartMonths) || 12);
  const target = Math.round(weight * (1 - (Number(data.chartLossPercent) || 0) / 100));
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  const date = end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const ticks = Array.from({ length: CHART_TICKS }, (_, i) => Math.round((months * i) / (CHART_TICKS - 1)));

  return (
    <div
      style={{
        padding: 'clamp(20px, 1.7vw, 24px)',
        borderRadius: 20,
        border: `1px solid ${tint('white', 12)}`,
        backgroundColor: tint('white', 4),
      }}
    >
      {data.chartLabel && (
        <p className="uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: tint('white', 60) }}>
          {data.chartLabel}
        </p>
      )}
      <div className="flex items-end justify-between gap-3" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 'clamp(28px, 2.2vw, 32px)', lineHeight: 1.1, color: 'white' }}>
          {weight} <span style={{ ...inheritLine, color: tint('white', 60) }}>→</span>{' '}
          <span style={{ ...inheritLine, color: light }}>
            {target} {data.chartUnit}
          </span>
        </p>
        {data.chartDateText && (
          <p className="text-sm" style={{ color: tint('white', 60), whiteSpace: 'nowrap' }}>
            {data.chartDateText.split('{date}').join(date)}
          </p>
        )}
      </div>
      {/* The end dot sits outside the stretched SVG so it stays round at every width */}
      <div style={{ position: 'relative', marginTop: 20 }} aria-hidden>
        <svg viewBox="0 0 300 90" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 96 }}>
          <path
            d="M0 6 C 60 4, 110 34, 160 56 S 255 84, 296 86"
            fill="none"
            stroke={light}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          style={{
            position: 'absolute',
            left: `${(296 / 300) * 100}%`,
            top: `${(86 / 90) * 100}%`,
            width: 9,
            height: 9,
            borderRadius: 9999,
            backgroundColor: light,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ marginTop: 10, color: tint('white', 60) }}>
        {ticks.map((month, i) => (
          <span key={i}>{i === 0 ? data.chartTodayText || 'Today' : `${month} mo`}</span>
        ))}
      </div>
    </div>
  );
};

interface PlanSummaryUiProps {
  data: BlockData;
  theme: ThemeDefinition;
  answer: AnswerLookup;
  onChoose?: () => void;
}

const PlanSummaryUi: React.FC<PlanSummaryUiProps> = ({ data, theme, answer, onChoose }) => {
  const ink = theme.colors.text;
  const primary = theme.colors.primary;
  const light = theme.colors.secondary;
  const muted = tint(ink, 62);
  const [open, setOpen] = useState<number | null>(null);

  const treatment = pickTreatment(list<Treatment>(data, 'treatments'), answer(data.treatmentField || ''));
  const name = fillTokens(data.nameLine || '', answer);
  const chips = [...list<{ text: string }>(data, 'chips').map((chip) => chip.text), treatment?.chip || '']
    .filter((text) => text?.trim())
    .map((text) => fillTokens(text, answer))
    .filter((text): text is string => !!text);
  const weight = Number(answer(data.weightField || ''));
  const showChart = data.showChart && weight > 0;
  const benefits = list<IconLine>(data, 'benefits').filter((line) => line.text?.trim());
  const trust = list<IconLine>(data, 'trust').filter((line) => line.text?.trim());
  const faqs = list<Faq>(data, 'faqs').filter((faq) => faq.question?.trim());
  const note = fillTokens(data.noteText || '', answer);
  const iconFor = (key: string) => (ICONS[key] ?? ICONS.check).Icon;
  const column = { width: '100%', maxWidth: 560, margin: '0 auto' } as const;

  return (
    <div style={{ padding: 'clamp(24px, 2.2vw, 32px) clamp(10px, 2vw, 16px) 40px', color: 'white' }}>
      <div className="flex flex-col items-center text-center" style={column}>
        {data.chipText && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full font-medium"
            style={{ padding: '6px 14px', fontSize: 'clamp(14px, 1.05vw, 15px)', backgroundColor: light, color: ink }}
          >
            <Check style={{ width: 14, height: 14 }} aria-hidden />
            {data.chipText}
          </span>
        )}
        {name && (
          <p
            style={{
              marginTop: 16,
              fontFamily: theme.fonts?.secondary,
              fontStyle: 'italic',
              fontSize: 'clamp(56px, 4.2vw, 60px)',
              lineHeight: 1.05,
              color: light,
            }}
          >
            {name}
          </p>
        )}
        {data.heading && (
          <h2 style={{ marginTop: 4, fontSize: 'clamp(44px, 3.4vw, 48px)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {keepHyphenatedWords(data.heading)}
          </h2>
        )}
        {data.subheading && chips.length > 0 && (
          <p style={{ marginTop: 20, fontSize: 15, color: tint('white', 65) }}>{data.subheading}</p>
        )}
        {chips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 12 }}>
            {chips.map((chip, index) => (
              <span
                key={index}
                className="rounded-full text-sm"
                style={{ padding: '6px 12px', border: `1px solid ${tint('white', 35)}` }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {showChart && (
        <div style={{ ...column, marginTop: 32 }}>
          <WeightChart theme={theme} data={data} weight={weight} />
        </div>
      )}

      <div
        style={{
          ...column,
          marginTop: 20,
          padding: 'clamp(24px, 2.2vw, 32px)',
          borderRadius: 24,
          backgroundColor: 'white',
          color: ink,
        }}
      >
        {data.cardTitle && <h3 style={{ fontSize: 24, lineHeight: 1.25 }}>{data.cardTitle}</h3>}

        {treatment && (
          <div
            className="flex items-center gap-4"
            style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: theme.colors.accent }}
          >
            {treatment.imageUrl && (
              <img
                src={treatment.imageUrl}
                alt=""
                className="shrink-0 object-contain"
                style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: 'white' }}
              />
            )}
            <div>
              <p className="font-medium" style={{ fontSize: 17 }}>
                {treatment.name}
              </p>
              {treatment.detail && (
                <p className="text-sm" style={{ marginTop: 4, color: muted }}>
                  {treatment.detail}
                </p>
              )}
              {treatment.tags?.trim() && (
                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                  {treatment.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full text-xs"
                        style={{ padding: '3px 10px', backgroundColor: 'white' }}
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {benefits.length > 0 && (
          <ul className="space-y-3" style={{ marginTop: 20 }}>
            {benefits.map((line, index) => {
              const Icon = iconFor(line.icon);
              return (
                <li key={index} className="flex items-center gap-3 text-sm" style={{ lineHeight: 1.45 }}>
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full"
                    style={{ width: 28, height: 28, backgroundColor: theme.colors.accent, color: primary }}
                  >
                    <Icon style={{ width: 13, height: 13 }} aria-hidden />
                  </span>
                  {line.text}
                </li>
              );
            })}
          </ul>
        )}

        {note && (
          <div
            className="flex items-center gap-3 text-sm"
            style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: theme.colors.background, color: muted }}
          >
            {data.noteImageUrl && (
              <img
                src={data.noteImageUrl}
                alt=""
                className="shrink-0 rounded-full object-cover"
                style={{ width: 40, height: 40 }}
              />
            )}
            <span style={{ lineHeight: 1.5 }}>{note}</span>
          </div>
        )}

        {faqs.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {faqs.map((faq, index) => {
              const isOpen = open === index;
              const Icon = isOpen ? Minus : Plus;
              return (
                <div key={index} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left font-medium cursor-pointer"
                    style={{ padding: '14px 0', fontSize: 15, color: ink }}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    {faq.question}
                    <Icon style={{ width: 16, height: 16, color: muted }} aria-hidden />
                  </button>
                  {isOpen && faq.answer && (
                    <p className="text-sm" style={{ paddingBottom: 14, lineHeight: 1.6, color: muted }}>
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.buttonText && (
          <button
            type="button"
            className={cn(theme.button.primary, 'relative cursor-pointer')}
            style={{ display: 'flex', marginTop: 20 }}
            onClick={onChoose}
          >
            <span>{data.buttonText}</span>
            <span
              className="flex items-center justify-center rounded-full"
              style={{ position: 'absolute', top: 6, right: 6, bottom: 6, aspectRatio: '1', backgroundColor: light, color: ink }}
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </button>
        )}
      </div>

      {trust.length > 0 && (
        <div
          className="flex flex-wrap justify-center text-xs"
          style={{ ...column, marginTop: 24, gap: '8px 20px', color: tint('white', 70) }}
        >
          {trust.map((line, index) => {
            const Icon = iconFor(line.icon);
            return (
              <span key={index} className="inline-flex items-center gap-1.5">
                <Icon style={{ width: 13, height: 13 }} aria-hidden />
                {line.text}
              </span>
            );
          })}
        </div>
      )}
      {data.footnote && (
        <p className="text-xs text-center" style={{ ...column, marginTop: 20, lineHeight: 1.6, color: tint('white', 60) }}>
          {data.footnote}
        </p>
      )}
    </div>
  );
};

const PlanSummaryRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(({ block, theme }, ref) => {
  const { goToNextBlock } = useSurveyForm();
  const answer = useAnswers();
  return (
    <div ref={ref}>
      <PlanSummaryUi data={block} theme={theme ?? themes.default} answer={answer} onChoose={() => goToNextBlock()} />
    </div>
  );
});

PlanSummaryRenderer.displayName = 'PlanSummaryRenderer';

interface ListField {
  key: string;
  label: string;
  /** A row of icons to pick from instead of a text box */
  icons?: boolean;
  rows?: number;
}

/** Edits a list of small records, each as a box of fields, with add, move and remove */
const ListEditor: React.FC<{
  label: string;
  items: Record<string, string>[];
  fields: ListField[];
  onChange: (items: Record<string, string>[]) => void;
  addText: string;
}> = ({ label, items, fields, onChange, addText }) => {
  const blank = Object.fromEntries(fields.map((field) => [field.key, field.icons ? 'check' : '']));
  const set = (index: number, key: string, value: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-md border p-2">
          {fields.map((field) =>
            field.icons ? (
              <select
                key={field.key}
                aria-label={`${label} ${index + 1} ${field.label}`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={item[field.key] || 'check'}
                onChange={(e) => set(index, field.key, e.target.value)}
              >
                {Object.entries(ICONS).map(([key, { name }]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            ) : field.rows ? (
              <Textarea
                key={field.key}
                aria-label={`${label} ${index + 1} ${field.label}`}
                placeholder={field.label}
                rows={field.rows}
                value={item[field.key] || ''}
                onChange={(e) => set(index, field.key, e.target.value)}
              />
            ) : (
              <Input
                key={field.key}
                aria-label={`${label} ${index + 1} ${field.label}`}
                placeholder={field.label}
                value={item[field.key] || ''}
                onChange={(e) => set(index, field.key, e.target.value)}
              />
            ),
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, blank])}>
        <Plus className="h-4 w-4 mr-1" />
        {addText}
      </Button>
    </div>
  );
};

const PlanSummaryForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const update = (patch: Record<string, unknown>) => onUpdate?.({ ...data, ...patch });

  const text = (field: string, label: string, help?: string, type = 'text') => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`plan-summary-${field}`}>
        {label}
      </Label>
      <Input
        id={`plan-summary-${field}`}
        type={type}
        value={data[field] ?? ''}
        onChange={(e) => update({ [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  const editor = (field: string, label: string, fields: ListField[], addText: string) => (
    <ListEditor
      label={label}
      items={list<Record<string, string>>(data, field)}
      fields={fields}
      onChange={(items) => update({ [field]: items })}
      addText={addText}
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Texts can quote answers: {'{field}'} or {'{field.key}'} shows that answer, and {'{field|text}'} falls back to
        the text. A chip or line whose answer is missing is left out.
      </p>
      {text('chipText', 'Top chip', 'Leave empty to hide it.')}
      {text('nameLine', 'Name line', 'In the theme’s second font, in italics.')}
      {text('heading', 'Heading')}
      {text('subheading', 'Text above the answer chips')}
      {editor('chips', 'Answer chips', [{ key: 'text', label: 'Chip' }], 'Add chip')}

      <div className="flex items-center justify-between">
        <Label className="text-sm" htmlFor="plan-summary-showChart">
          Show the weight chart
        </Label>
        <Switch
          id="plan-summary-showChart"
          checked={!!data.showChart}
          onCheckedChange={(checked) => update({ showChart: checked })}
        />
      </div>
      {data.showChart && (
        <>
          {text('weightField', 'Current weight from', 'The field name of the weight answer, such as bmi.weight.')}
          {text('chartLossPercent', 'Projected loss (percent of weight)', undefined, 'number')}
          {text('chartMonths', 'Over (months)', undefined, 'number')}
          {text('chartUnit', 'Unit')}
          {text('chartLabel', 'Chart label')}
          {text('chartDateText', 'Date text', '{date} becomes the month and year the chart ends.')}
          {text('chartTodayText', 'First mark')}
        </>
      )}

      {text('cardTitle', 'Card title')}
      {text('treatmentField', 'Treatment from', 'The field name of the medication answer.')}
      {editor(
        'treatments',
        'Treatments',
        [
          { key: 'match', label: 'Answer that picks it (empty: any answer)' },
          { key: 'name', label: 'Name' },
          { key: 'detail', label: 'Detail' },
          { key: 'tags', label: 'Tags, separated by commas' },
          { key: 'imageUrl', label: 'Image URL' },
          { key: 'chip', label: 'Chip added to the answer chips' },
        ],
        'Add treatment',
      )}
      {editor(
        'benefits',
        'Benefits',
        [
          { key: 'icon', label: 'Icon', icons: true },
          { key: 'text', label: 'Text' },
        ],
        'Add benefit',
      )}
      {text('noteText', 'Review note')}
      {text('noteImageUrl', 'Review note photo URL')}
      {editor(
        'faqs',
        'Questions',
        [
          { key: 'question', label: 'Question' },
          { key: 'answer', label: 'Answer', rows: 2 },
        ],
        'Add question',
      )}
      {text('buttonText', 'Button')}
      {editor(
        'trust',
        'Lines under the card',
        [
          { key: 'icon', label: 'Icon', icons: true },
          { key: 'text', label: 'Text' },
        ],
        'Add line',
      )}
      {text('footnote', 'Footnote')}
    </div>
  );
};

const PlanSummaryItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-0 overflow-hidden" style={{ backgroundColor: themes.default.colors.text }}>
    <PlanSummaryUi data={data} theme={themes.default} answer={noAnswers} />
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'planSummary',
  chipText: 'Matched from your answers',
  nameLine: '{NameInformation.firstName}’s',
  heading: 'personalized plan',
  subheading: 'Selected for you based on',
  chips: [{ text: 'Goal: {selectableboxzziytz}' }, { text: 'BMI {bmi.bmi}' }],
  showChart: false,
  weightField: 'bmi.weight',
  chartLossPercent: 0,
  chartMonths: 12,
  chartUnit: 'lbs',
  chartLabel: 'Your projected journey*',
  chartDateText: 'by {date}',
  chartTodayText: 'Today',
  cardTitle: 'Your treatment',
  treatmentField: 'selectablebox2tbsa3',
  treatments: [{ match: '', name: 'Your treatment', detail: '', tags: '', imageUrl: '', chip: '' }],
  benefits: [{ icon: 'stethoscope', text: 'Licensed provider review' }],
  noteText: 'A licensed provider in {state|your state} reviews your answers. Nothing ships until it’s approved.',
  noteImageUrl: '',
  faqs: [],
  buttonText: 'Choose my plan',
  trust: [],
  footnote: '',
  pageTone: 'dark',
  hideBack: true,
  showContinueButton: false,
});

export const PlanSummaryBlock: BlockDefinition = {
  type: 'planSummary',
  name: 'Plan Summary',
  description: 'The patient’s plan before checkout: chips, a weight chart, the treatment and FAQs',
  icon: <ClipboardList className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <PlanSummaryItem {...props} />,
  renderFormFields: (props) => <PlanSummaryForm {...props} />,
  renderPreview: () => (
    <div className="w-full overflow-hidden rounded-md" style={{ backgroundColor: themes.default.colors.text }}>
      <PlanSummaryUi data={createDefaultData()} theme={themes.default} answer={noAnswers} />
    </div>
  ),
  renderBlock: (props) => <PlanSummaryRenderer {...props} />,
  validate: (data) => (data.buttonText ? null : 'The button needs a text'),
};

export default PlanSummaryBlock;
