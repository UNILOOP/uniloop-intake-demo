import React from 'react';
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
import { themes } from '@/packages/survey-form-package/src/themes';
import {
  ArrowUpRight,
  Ban,
  Clock,
  Heart,
  Leaf,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Not a fit: the step a patient reaches when their answers rule the treatment out. It shows
 * why, what they can do instead, and links to a provider and to other treatments. Rules in
 * the form decide when it shows; a form can hold one per reason, each with its own text.
 *
 * It never moves the form on. Under the brand step layout the bottom bar becomes the "other
 * treatments" link (or hides); under any other layout Next stays, and the step's answer is
 * required but never given, so Next shows the "use Back" message instead of submitting.
 * Back stays, so the patient can change an answer.
 */

interface NextStep {
  icon: string;
  text: string;
}

const ICONS: Record<string, { Icon: LucideIcon; name: string }> = {
  message: { Icon: MessageSquare, name: 'Message' },
  leaf: { Icon: Leaf, name: 'Leaf' },
  clock: { Icon: Clock, name: 'Clock' },
  heart: { Icon: Heart, name: 'Heart' },
  phone: { Icon: Phone, name: 'Phone' },
  mail: { Icon: Mail, name: 'Mail' },
  ban: { Icon: Ban, name: 'Stop' },
};

/** A theme colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/** Core's generateFieldName, which the portal's core build doesn't export */
const generateFieldName = (prefix: string) =>
  `${prefix}${Date.now().toString(36).substring(4, 7)}${Math.random().toString(36).substring(2, 5)}`;

const getSteps = (data: BlockData): NextStep[] => (Array.isArray(data.steps) ? data.steps : []);

const iconFor = (key: string) => (ICONS[key] ?? ICONS.heart).Icon;

interface NotAFitUiProps {
  data: BlockData;
  theme: ThemeDefinition;
  error?: string;
}

const NotAFitUi: React.FC<NotAFitUiProps> = ({ data, theme, error }) => {
  const ink = theme.colors.text;
  const accent = data.accentColor || theme.colors.error;
  const accentSurface = data.accentSurface || tint(accent, 10);
  const TopGlyph = iconFor(data.icon);
  const steps = getSteps(data).filter((step) => step.text?.trim());

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: 52, height: 52, backgroundColor: accentSurface, color: accent }}
      >
        <TopGlyph style={{ width: 20, height: 20 }} aria-hidden />
      </span>
      {data.heading && (
        <h2
          className="font-medium"
          style={{ marginTop: 20, fontSize: 'clamp(22px, 1.6vw, 24px)', lineHeight: 1.25, color: ink }}
        >
          {data.heading}
        </h2>
      )}
      {data.text && (
        <p style={{ marginTop: 16, fontSize: 'clamp(15px, 1.15vw, 16px)', lineHeight: 1.6, color: tint(ink, 65) }}>
          {data.text}
        </p>
      )}

      {steps.length > 0 && (
        <div
          className="w-full text-left"
          style={{ marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: theme.colors.background }}
        >
          {data.stepsTitle && (
            <p className="text-sm font-medium" style={{ color: ink }}>
              {data.stepsTitle}
            </p>
          )}
          <ul className="space-y-2" style={{ marginTop: data.stepsTitle ? 12 : 0 }}>
            {steps.map((step, index) => {
              const Icon = iconFor(step.icon);
              return (
                <li key={index} className="flex items-center gap-3 text-sm" style={{ color: ink }}>
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full"
                    style={{ width: 28, height: 28, backgroundColor: 'white', color: tint(ink, 70) }}
                  >
                    <Icon style={{ width: 13, height: 13 }} aria-hidden />
                  </span>
                  <span style={{ lineHeight: 1.45 }}>{step.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.linkText && (
        <a
          href={data.linkUrl || undefined}
          className="relative flex w-full items-center rounded-full font-medium"
          style={{
            marginTop: 16,
            height: 56,
            padding: '0 64px 0 24px',
            border: `1px solid ${ink}`,
            color: ink,
            fontSize: 16,
          }}
        >
          {data.linkText}
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              bottom: 6,
              aspectRatio: '1',
              backgroundColor: ink,
              color: 'white',
            }}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </a>
      )}

      {error && <p className={theme.field.error}>{error}</p>}
    </div>
  );
};

const NotAFitRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, error, theme }, ref) => (
    <div ref={ref}>
      <NotAFitUi data={block} theme={theme ?? themes.default} error={error} />
    </div>
  ),
);

NotAFitRenderer.displayName = 'NotAFitRenderer';

const NotAFitForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const steps = getSteps(data);
  const update = (patch: Record<string, unknown>) => onUpdate?.({ ...data, ...patch });
  const setSteps = (next: NextStep[]) => update({ steps: next });

  const text = (field: string, label: string, help?: string, rows = 0) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`not-a-fit-${field}`}>
        {label}
      </Label>
      {rows ? (
        <Textarea
          id={`not-a-fit-${field}`}
          value={data[field] || ''}
          onChange={(e) => update({ [field]: e.target.value })}
          rows={rows}
        />
      ) : (
        <Input
          id={`not-a-fit-${field}`}
          value={data[field] || ''}
          onChange={(e) =>
            // The bar shows only with a link to open, so Next never shows under the brand layout
            update(
              field === 'nextHref'
                ? { nextHref: e.target.value, showContinueButton: Boolean(e.target.value.trim()) }
                : { [field]: e.target.value },
            )
          }
        />
      )}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  const iconSelect = (id: string, label: string, value: string, onChange: (icon: string) => void) => (
    <select
      id={id}
      aria-label={label}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(ICONS).map(([key, { name }]) => (
        <option key={key} value={key}>
          {name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* The builder draws the field name itself, from `fieldConfig` */}
      <div className="space-y-2">
        <Label className="text-sm" htmlFor="not-a-fit-icon">
          Icon
        </Label>
        <div>{iconSelect('not-a-fit-icon', 'Icon', data.icon || 'heart', (icon) => update({ icon }))}</div>
      </div>
      {text('heading', 'Heading')}
      {text('text', 'Text', 'Why the treatment is not a fit. A form can hold one of these blocks per reason.', 3)}
      {text('stepsTitle', 'List title')}

      <div className="space-y-2">
        <Label className="text-sm">What the patient can do</Label>
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            {iconSelect(`not-a-fit-step-${index}-icon`, `Line ${index + 1} icon`, step.icon, (icon) =>
              setSteps(steps.map((s, i) => (i === index ? { ...s, icon } : s))),
            )}
            <Input
              aria-label={`Line ${index + 1}`}
              value={step.text}
              onChange={(e) => setSteps(steps.map((s, i) => (i === index ? { ...s, text: e.target.value } : s)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setSteps(steps.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setSteps([...steps, { icon: 'heart', text: '' }])}>
          <Plus className="h-4 w-4 mr-1" />
          Add line
        </Button>
      </div>

      {text('linkText', 'Card link text', 'An outlined button in the card. Leave empty to hide it.')}
      {text('linkUrl', 'Card link URL')}
      {text('nextText', 'Bottom bar text')}
      {text('nextHref', 'Bottom bar link', 'Under the brand step layout the bottom bar opens this link. Leave empty to hide the bar.')}
      {text('accentColor', 'Icon colour (optional)', 'Defaults to the theme’s error colour.')}
      {text('accentSurface', 'Icon background (optional)')}
      {text('message', 'Message if Next is pressed', 'Shown under layouts that keep Next on this step.')}
    </div>
  );
};

const NotAFitItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <NotAFitUi data={data} theme={themes.default} />
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'notAFit',
  fieldName: generateFieldName('notAFit'),
  icon: 'heart',
  heading: 'This treatment isn’t the right fit for you right now',
  text: '',
  stepsTitle: 'What you can do',
  steps: [
    { icon: 'message', text: 'Message a provider about safe options for you' },
    { icon: 'leaf', text: 'Explore other treatments' },
    { icon: 'clock', text: 'Come back anytime — we’ve saved your answers' },
  ],
  linkText: 'Message a provider',
  linkUrl: '',
  nextText: 'Explore other treatments',
  nextHref: '',
  showContinueButton: false,
  accentColor: '',
  accentSurface: '',
  message: 'Your answers rule this treatment out. Use Back to change an answer.',
  hideProgress: true,
  hidePrivacy: true,
});

export const NotAFitBlock: BlockDefinition = {
  type: 'notAFit',
  name: 'Not a Fit',
  description: 'Ends the form for answers that rule the treatment out, with next steps',
  icon: <Heart className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <NotAFitItem {...props} />,
  renderFormFields: (props) => <NotAFitForm {...props} />,
  renderPreview: () => (
    <div className="w-full py-1">
      <NotAFitUi data={createDefaultData()} theme={themes.default} />
    </div>
  ),
  renderBlock: (props) => <NotAFitRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (!data.heading) return 'Heading is required';
    return null;
  },
  // Never answered, so a layout that keeps Next can't move past this step
  validateValue: (_value, data) => data.message || 'Use Back to change an answer.',
  fieldConfig: {
    enabled: true,
    label: 'Field Name',
    required: true,
  },
};

export default NotAFitBlock;
