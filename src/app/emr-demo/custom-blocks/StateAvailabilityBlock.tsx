import React, { useEffect, useMemo, useState } from 'react';
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
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { themes } from '@/packages/survey-form-package/src/themes';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import {
  ArrowUpRight,
  Check,
  Clock,
  Heart,
  MapPin,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * State availability: tells the patient whether the treatment plan serves their state.
 * It asks for the state itself, or reads it from an earlier question named in its settings
 * (in this form or, on enrollment pages, an earlier form), and checks it against the plan
 * through the enrollment module. It saves the state's two-letter code once the plan serves
 * it, so Next moves on only for a served state.
 *
 * Every text is a setting; `{state}` in a text is replaced by the state's name.
 */

interface Line {
  icon: string;
  text: string;
}

const ICONS: Record<string, { Icon: LucideIcon; name: string }> = {
  check: { Icon: Check, name: 'Tick' },
  truck: { Icon: Truck, name: 'Truck' },
  shield: { Icon: ShieldCheck, name: 'Shield' },
  stethoscope: { Icon: Stethoscope, name: 'Stethoscope' },
  clock: { Icon: Clock, name: 'Clock' },
  heart: { Icon: Heart, name: 'Heart' },
  pin: { Icon: MapPin, name: 'Pin' },
};

const US_STATES: [string, string][] = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
];

const STATE_NAMES = new Map(US_STATES);
const WIDE_QUERY = '(min-width: 640px)';

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const getLines = (data: BlockData): Line[] => (Array.isArray(data.lines) ? data.lines : []);

/** A two-letter code from an answer that holds a code or a state's name */
const toStateCode = (answer: unknown): string => {
  const text = typeof answer === 'string' ? answer.trim() : '';
  if (STATE_NAMES.has(text.toUpperCase())) return text.toUpperCase();
  const match = US_STATES.find(([, name]) => name.toLowerCase() === text.toLowerCase());
  return match ? match[0] : '';
};

/** An answer by field name (`field` or `field.key`): this form's first, then earlier forms' */
const readAnswer = (path: string, values: Record<string, unknown>, customData: any): unknown => {
  const earlier = Object.values(customData?.completedFormResponses ?? {}).filter(
    (answers): answers is Record<string, unknown> => !!answers && typeof answers === 'object',
  );
  return [values, ...earlier.reverse()]
    .map((answers) =>
      path
        .split('.')
        .reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as any)[key] : undefined), answers),
    )
    .find((value) => value !== undefined && value !== null && value !== '');
};

/**
 * Whether the plan serves the state; true when no plan is loaded, as in the builder. A form's
 * public page (`/start/{slug}`) passes the module without a plan, and the module then turns
 * every state down; enrollment pages build it with their plan, so their check still applies
 */
const planServes = (state: string, customData: any): boolean => {
  const module = customData?.emrEnrollmentUtils ?? customData?.enrollmentModule;
  if (!module?.validateAddressStateForEmrPlan || !module.plan) return true;
  return module.validateAddressStateForEmrPlan({ state, country: 'US' }).valid === true;
};

const useWide = () => {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
};

interface StateAvailabilityUiProps {
  data: BlockData;
  theme: ThemeDefinition;
  /** The state's code, or empty before one is known */
  state: string;
  available: boolean;
  /** Shows the picker; null when the state comes from an earlier answer */
  onPick: ((state: string) => void) | null;
  error?: string;
}

const StateAvailabilityUi: React.FC<StateAvailabilityUiProps> = ({ data, theme, state, available, onPick, error }) => {
  const ink = theme.colors.text;
  const primary = theme.colors.primary;
  const wide = useWide();
  const name = STATE_NAMES.get(state) || state;
  const fill = (text: string) => text.split('{state}').join(name);
  const lines = getLines(data).filter((line) => line.text?.trim());

  return (
    <div>
      {onPick && (
        <div className="space-y-2" style={{ marginBottom: state ? 28 : 0 }}>
          {data.pickerLabel && (
            <label htmlFor={`${data.fieldName}-state`} className={theme.field.label}>
              {data.pickerLabel}
            </label>
          )}
          <select
            id={`${data.fieldName}-state`}
            className={cn(theme.field.select, 'cursor-pointer')}
            value={state}
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">{data.pickerPlaceholder || 'Select your state'}</option>
            {US_STATES.map(([code, stateName]) => (
              <option key={code} value={code}>
                {stateName}
              </option>
            ))}
          </select>
        </div>
      )}

      {state && available && (
        <div>
          {data.accentHeading && (
            <p
              style={{
                fontFamily: theme.fonts?.secondary,
                fontStyle: 'italic',
                fontSize: 'clamp(44px, 3vw, 48px)',
                lineHeight: 1.05,
                color: primary,
              }}
            >
              {fill(data.accentHeading)}
            </p>
          )}
          {data.heading && (
            <h2 className="font-medium" style={{ marginTop: 4, fontSize: 'clamp(22px, 1.6vw, 24px)', lineHeight: 1.3, color: ink }}>
              {fill(data.heading)}
            </h2>
          )}
          {lines.length > 0 && (
            <ul className="space-y-3" style={{ marginTop: 20 }}>
              {lines.map((line, index) => {
                const Icon = (ICONS[line.icon] ?? ICONS.check).Icon;
                return (
                  <li key={index} className="flex items-start gap-3 text-sm" style={{ color: ink, lineHeight: 1.5 }}>
                    <span
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{ width: 20, height: 20, marginTop: 1, backgroundColor: theme.colors.accent, color: primary }}
                    >
                      <Icon style={{ width: 11, height: 11 }} aria-hidden />
                    </span>
                    <span>{fill(line.text)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {data.imageUrl && (
            <img
              src={data.imageUrl}
              alt={data.imageAlt || ''}
              className="block w-full object-cover"
              style={{ marginTop: 24, borderRadius: 16, aspectRatio: wide ? '297 / 157' : '311 / 240' }}
            />
          )}
        </div>
      )}

      {state && !available && (
        <div>
          {data.unavailableHeading && (
            <h2 className="font-medium" style={{ fontSize: 'clamp(22px, 1.6vw, 24px)', lineHeight: 1.3, color: ink }}>
              {fill(data.unavailableHeading)}
            </h2>
          )}
          {data.unavailableText && (
            <p className="text-base" style={{ marginTop: 12, lineHeight: 1.6, color: tint(ink, 65) }}>
              {fill(data.unavailableText)}
            </p>
          )}
          {data.unavailableLinkText && (
            <a
              href={data.unavailableLinkUrl || undefined}
              className="inline-flex items-center gap-1.5 font-medium underline"
              style={{ marginTop: 16, color: primary }}
            >
              {data.unavailableLinkText}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      )}

      {error && <p className={theme.field.error}>{error}</p>}
    </div>
  );
};

const StateAvailabilityRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, value, onChange, onBlur, error, theme }, ref) => {
    const { values, customData } = useSurveyForm();
    const sourceField: string = (block.stateFieldName || '').trim();
    const fromAnswer = sourceField ? toStateCode(readAnswer(sourceField, values, customData)) : '';
    const [picked, setPicked] = useState(() => toStateCode(value));
    // Ask only when there's no earlier answer to read
    const state = fromAnswer || picked;
    const available = useMemo(() => (state ? planServes(state, customData) : false), [state, customData]);
    const answer = state && available ? state : '';

    useEffect(() => {
      if ((value ?? '') !== answer) onChange?.(answer);
    }, [answer]);

    return (
      <div ref={ref}>
        <StateAvailabilityUi
          data={block}
          theme={theme ?? themes.default}
          state={state}
          available={available}
          onPick={
            fromAnswer
              ? null
              : (next) => {
                  setPicked(next);
                  onBlur?.();
                }
          }
          error={error}
        />
      </div>
    );
  },
);

StateAvailabilityRenderer.displayName = 'StateAvailabilityRenderer';

const StateAvailabilityForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const lines = getLines(data);
  const update = (patch: Record<string, unknown>) => onUpdate?.({ ...data, ...patch });
  const setLines = (next: Line[]) => update({ lines: next });

  const text = (field: string, label: string, help?: string, rows = 0) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`state-availability-${field}`}>
        {label}
      </Label>
      {rows ? (
        <Textarea
          id={`state-availability-${field}`}
          value={data[field] || ''}
          onChange={(e) => update({ [field]: e.target.value })}
          rows={rows}
        />
      ) : (
        <Input
          id={`state-availability-${field}`}
          value={data[field] || ''}
          onChange={(e) => update({ [field]: e.target.value })}
        />
      )}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* The builder draws the field name itself, from `fieldConfig` */}
      {text(
        'stateFieldName',
        'Read the state from (optional)',
        'The field name of an earlier question that asks for the state, in this form or an earlier one. Leave empty to ask here.',
      )}
      {text('pickerLabel', 'Question, when asking here')}
      {text('pickerPlaceholder', 'Placeholder')}
      <p className="text-xs text-muted-foreground">
        In the texts below, {'{state}'} is replaced by the state’s name.
      </p>
      {text('accentHeading', 'Available: first line', 'In the theme’s second font, in italics.')}
      {text('heading', 'Available: heading')}

      <div className="space-y-2">
        <Label className="text-sm">Available: lines</Label>
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              aria-label={`Line ${index + 1} icon`}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={line.icon}
              onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, icon: e.target.value } : l)))}
            >
              {Object.entries(ICONS).map(([key, { name }]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Line ${index + 1}`}
              value={line.text}
              onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, text: e.target.value } : l)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setLines(lines.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { icon: 'check', text: '' }])}>
          <Plus className="h-4 w-4 mr-1" />
          Add line
        </Button>
      </div>

      {text('imageUrl', 'Available: photo URL (optional)')}
      {text('imageAlt', 'Photo description')}
      {text('unavailableHeading', 'Not available: heading')}
      {text('unavailableText', 'Not available: text', undefined, 3)}
      {text('unavailableLinkText', 'Not available: link text (optional)')}
      {text('unavailableLinkUrl', 'Not available: link URL')}
      {text('message', 'Message if Next is pressed without a served state')}
    </div>
  );
};

const StateAvailabilityItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <StateAvailabilityUi data={data} theme={themes.default} state="FL" available onPick={null} />
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'stateAvailability',
  fieldName: 'state',
  required: true,
  stateFieldName: '',
  pickerLabel: 'Which state do you live in?',
  pickerPlaceholder: 'Select your state',
  accentHeading: 'Good news.',
  heading: 'We’re available in {state}',
  lines: [
    { icon: 'check', text: 'Licensed providers in {state} can review your answers' },
    { icon: 'truck', text: 'Ships to {state}' },
  ],
  imageUrl: '',
  imageAlt: '',
  unavailableHeading: 'We’re not in {state} yet',
  unavailableText: 'Treatment isn’t available in {state} at the moment.',
  unavailableLinkText: '',
  unavailableLinkUrl: '',
  message: 'Choose a state where treatment is available to continue.',
  hidePrivacy: true,
});

export const StateAvailabilityBlock: BlockDefinition = {
  type: 'stateAvailability',
  name: 'State Availability',
  description: 'Checks the patient’s state against the treatment plan',
  icon: <MapPin className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <StateAvailabilityItem {...props} />,
  renderFormFields: (props) => <StateAvailabilityForm {...props} />,
  renderPreview: () => (
    <div className="w-full py-1">
      <StateAvailabilityUi data={createDefaultData()} theme={themes.default} state="FL" available onPick={null} />
    </div>
  ),
  renderBlock: (props) => <StateAvailabilityRenderer {...props} />,
  validate: (data) => (data.fieldName ? null : 'Field name is required'),
  validateValue: (value, data) =>
    typeof value === 'string' && STATE_NAMES.has(value)
      ? null
      : data.message || 'Choose a state where treatment is available to continue.',
  inputSchema: { type: 'string' },
  outputSchema: { type: 'string' },
  fieldConfig: {
    enabled: true,
    label: 'Field Name',
    required: true,
  },
};

export default StateAvailabilityBlock;
