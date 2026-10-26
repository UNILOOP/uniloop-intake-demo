import React, { useEffect, useId, useState } from 'react';
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
import { themes } from '@/packages/survey-form-package/src/themes';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Heart,
  HelpCircle,
  LayoutList,
  Pill,
  Plus,
  Stethoscope,
  Syringe,
  Trash2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Option cards: a choice question drawn as cards, for single or multiple answers. It saves
 * the same answer as the Selectable Box Question (the option's value, or a list of values),
 * so Replace offers it for selectable box, radio, checkbox and dropdown questions, and the
 * rules that test those values keep working.
 *
 * Each option can add a second line, an icon or image, and a badge. The cards sit in a
 * list or in a row, with a checkbox or radio on either side or none, and a note can follow
 * them. Colours come from the theme; the warning colours can be set per block.
 */

interface CardOption {
  id?: string;
  label: string;
  value: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  badge?: string;
  /** Picking it clears the others (multiple answers only), as in the Selectable Box */
  exclusiveAutoSubmit?: boolean;
}

type CardStyle = 'list' | 'row';
type IndicatorSide = 'left' | 'right' | 'none';
type Tone = 'brand' | 'warning' | 'neutral';

/** Core's generateFieldName, which the portal's core build doesn't export */
const generateFieldName = (prefix: string) =>
  `${prefix}${Date.now().toString(36).substring(4, 7)}${Math.random().toString(36).substring(2, 5)}`;

// Icons an option can show, and the colour each is drawn in. `rowSize` is the icon's size in a row
// card's 36px circle: lucide's cross and tick fill their boxes differently, and the designs draw the
// cross 12px across and the tick 10px.
const ICONS: Record<string, { Icon: LucideIcon; tone: Tone; name: string; rowSize?: number }> = {
  x: { Icon: X, tone: 'warning', name: 'Cross', rowSize: 24 },
  check: { Icon: Check, tone: 'brand', name: 'Tick', rowSize: 15 },
  question: { Icon: HelpCircle, tone: 'neutral', name: 'Question mark' },
  stethoscope: { Icon: Stethoscope, tone: 'neutral', name: 'Stethoscope' },
  syringe: { Icon: Syringe, tone: 'neutral', name: 'Syringe' },
  pill: { Icon: Pill, tone: 'neutral', name: 'Pill' },
  heart: { Icon: Heart, tone: 'neutral', name: 'Heart' },
};

/** A colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const getOptions = (data: BlockData): CardOption[] =>
  Array.isArray(data.options) ? data.options : [];
const isMulti = (data: BlockData) => data.multiSelect === true;
const isRequired = (data: BlockData) => data.required !== false;
const getCardStyle = (data: BlockData): CardStyle => (data.cardStyle === 'row' ? 'row' : 'list');
const getIndicator = (data: BlockData): IndicatorSide =>
  data.indicator === 'right' || data.indicator === 'none' ? data.indicator : 'left';

const parseValue = (value: unknown, multi: boolean): string | string[] => {
  if (multi) {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  }
  return typeof value === 'string' ? value : '';
};

const hasAnswer = (value: unknown) =>
  Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value !== '';

/**
 * An exclusive option stands alone and any other option clears it, as in the Selectable Box, but
 * picking it doesn't move on: the patient presses Continue, so a mis-tap can be undone.
 */
const toggleMulti = (value: string, current: string[], options: CardOption[]): string[] => {
  const isExclusive = (v: string) => options.find((o) => o.value === v)?.exclusiveAutoSubmit === true;

  if (isExclusive(value)) return current.length === 1 && current[0] === value ? [] : [value];

  const kept = current.filter((v) => !isExclusive(v));
  return kept.includes(value) ? kept.filter((v) => v !== value) : [...kept, value];
};

/** The option's two lines: its own description, or with `splitLabelAtDash` the text after " – " */
const getLines = (option: CardOption, data: BlockData): [string, string] => {
  if (option.description) return [option.label, option.description];
  if (data.splitLabelAtDash) {
    const match = option.label.match(/\s[–—-]\s/);
    if (match?.index !== undefined) {
      return [
        option.label.slice(0, match.index).trim(),
        option.label.slice(match.index + match[0].length).trim(),
      ];
    }
  }
  return [option.label, ''];
};

interface Palette {
  ink: string;
  primary: string;
  fg: Record<Tone, string>;
  bg: Record<Tone, string>;
}

const getPalette = (theme: ThemeDefinition, data: BlockData): Palette => {
  const { colors } = theme;
  const warning = data.warningColor || colors.error;
  return {
    ink: colors.text,
    primary: colors.primary,
    fg: { brand: colors.primary, warning, neutral: tint(colors.text, 80) },
    bg: {
      brand: colors.accent,
      warning: data.warningSurface || tint(warning, 8),
      neutral: colors.background,
    },
  };
};

interface IndicatorProps {
  multi: boolean;
  selected: boolean;
  theme: ThemeDefinition;
  palette: Palette;
}

// The colour in a theme class's `border-[…]`. Public pages give every `.border` the field border
// colour in a rule that outranks the theme's class, so the indicator sets its outline inline.
const outlineColor = (classes?: string) => classes?.match(/(?:^|\s)border-\[(#[^\]\s]+)\]/)?.[1];

const Indicator: React.FC<IndicatorProps> = ({ multi, selected, theme, palette }) => {
  // Unpicked outlines are 1.5px, as in the designs
  const size = { width: 20, height: 20, flexShrink: 0, borderWidth: 1.5 };
  const outline = outlineColor(multi ? theme.field.checkbox : theme.field.radio);

  if (multi) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center border',
          theme.field.checkbox || 'rounded border-gray-400 bg-white',
        )}
        style={{
          ...size,
          borderRadius: 6,
          ...(outline && { borderColor: outline }),
          ...(selected && { backgroundColor: palette.primary, borderColor: palette.primary }),
        }}
      >
        {selected && <Check size={14} strokeWidth={3} style={{ color: 'white' }} />}
      </span>
    );
  }

  // A picked radio is a solid disc with a white centre
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-full border',
        theme.field.radio || 'border-gray-400',
      )}
      style={{
        ...size,
        ...(outline && { borderColor: outline }),
        ...(selected && { backgroundColor: palette.primary, borderColor: palette.primary }),
      }}
    >
      {selected && <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: 'white' }} />}
    </span>
  );
};

interface MediaProps {
  option: CardOption;
  selected: boolean;
  round: boolean;
  theme: ThemeDefinition;
  palette: Palette;
}

/** The option's image or icon: a 64px rounded square in a list, a 36px circle in a row, as in the designs */
const Media: React.FC<MediaProps> = ({ option, selected, round, theme, palette }) => {
  const icon = option.icon ? ICONS[option.icon] : undefined;
  if (!option.imageUrl && !icon) return null;

  const size = round ? 36 : 64;
  const frame: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: round ? '50%' : 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (option.imageUrl) {
    return (
      <span className={theme.container.card || 'bg-white'} style={frame}>
        <img src={option.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </span>
    );
  }

  const { Icon, tone, rowSize } = icon!;
  return (
    <span
      aria-hidden
      style={{
        ...frame,
        // On a picked card the icon sits on white, as in the designs
        backgroundColor: selected ? 'white' : palette.bg[tone],
        color: palette.fg[tone],
      }}
    >
      <Icon size={round ? rowSize || 18 : 24} />
    </span>
  );
};

interface OptionCardProps {
  option: CardOption;
  data: BlockData;
  selected: boolean;
  disabled?: boolean;
  theme: ThemeDefinition;
  palette: Palette;
  onSelect?: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  option,
  data,
  selected,
  disabled,
  theme,
  palette,
  onSelect,
}) => {
  const multi = isMulti(data);
  const row = getCardStyle(data) === 'row';
  const side = getIndicator(data);
  const [title, detail] = getLines(option, data);
  const hasMedia = Boolean(option.imageUrl || (option.icon && ICONS[option.icon]));
  // A row card with an icon stands it above a centred label; every other card reads left to right
  const stacked = row && hasMedia;
  const indicator =
    side === 'none' ? null : (
      <Indicator multi={multi} selected={selected} theme={theme} palette={palette} />
    );

  const text = (
    <span className={cn('flex min-w-0 flex-col', stacked ? 'items-center' : 'flex-1')}>
      <span className={cn('flex flex-wrap items-center', stacked && 'justify-center')} style={{ gap: 6 }}>
        <span
          className={cn(
            theme.field.selectableBoxText || 'text-base text-gray-900',
            selected && (theme.field.selectableBoxTextSelected || 'font-medium'),
          )}
        >
          {title}
        </span>
        {option.badge && (
          <span
            className="inline-flex items-center rounded-full text-xs font-semibold"
            style={{
              padding: '2px 8px',
              backgroundColor: theme.colors.secondary,
              color: palette.ink,
            }}
          >
            {option.badge}
          </span>
        )}
      </span>
      {detail && (
        <span
          className={cn(theme.field.description || 'text-gray-500')}
          // 14px beside an image or icon, 12px in a plain list, as in the designs
          style={{ marginTop: 2, fontSize: hasMedia ? 14 : 12, lineHeight: 1.5 }}
        >
          {detail}
        </span>
      )}
    </span>
  );

  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'block w-full text-left',
        theme.field.selectableBox || 'p-4 rounded-lg transition-all duration-200',
        selected
          ? theme.field.selectableBoxSelected || 'border-2 border-gray-700 bg-gray-50'
          : theme.field.selectableBoxDefault || 'border border-gray-300 bg-white',
        !disabled && (theme.field.selectableBoxHover || 'hover:border-gray-400'),
        theme.field.selectableBoxFocus,
        disabled ? theme.field.selectableBoxDisabled || 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
      style={stacked ? { padding: '18px 12px', height: '100%' } : { height: '100%' }}
    >
      {stacked ? (
        <span className="flex flex-col items-center text-center" style={{ gap: 10 }}>
          {indicator}
          <Media option={option} selected={selected} round theme={theme} palette={palette} />
          {text}
        </span>
      ) : (
        <span className="flex" style={{ gap: 12, alignItems: hasMedia ? 'center' : 'flex-start' }}>
          {/* Flex, so the wrapper is the indicator's height and not a line's, which made one-line cards taller */}
          {side === 'left' && <span style={{ display: 'flex', marginTop: hasMedia ? 0 : 2 }}>{indicator}</span>}
          <Media option={option} selected={selected} round={false} theme={theme} palette={palette} />
          {text}
          {side === 'right' && <span style={{ display: 'flex', marginTop: hasMedia ? 0 : 2 }}>{indicator}</span>}
        </span>
      )}
    </button>
  );
};

interface OptionCardsUiProps {
  data: BlockData;
  value: string | string[];
  theme: ThemeDefinition;
  error?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

const OptionCardsUi: React.FC<OptionCardsUiProps> = ({
  data,
  value,
  theme,
  error,
  disabled,
  onSelect,
}) => {
  const idPrefix = useId();
  const questionId = `${idPrefix}-question`;
  const options = getOptions(data);
  const multi = isMulti(data);
  const row = getCardStyle(data) === 'row';
  const palette = getPalette(theme, data);
  const columns = Math.max(1, Math.min(Number(data.columns) || options.length, 4));
  const noteTone: Tone = ['brand', 'neutral'].includes(data.noteTone) ? data.noteTone : 'warning';

  const isSelected = (optionValue: string) =>
    Array.isArray(value) ? value.includes(optionValue) : value === optionValue;

  const cards = options.map((option, index) => {
    const card = (
      <OptionCard
        key={option.id || option.value}
        option={option}
        data={data}
        selected={isSelected(option.value)}
        disabled={disabled}
        theme={theme}
        palette={palette}
        onSelect={onSelect ? () => onSelect(option.value) : undefined}
      />
    );
    // In a list, a line sets exclusive options such as "None of the below" apart from the rest
    const previous = options[index - 1];
    const split =
      !row && previous && Boolean(previous.exclusiveAutoSubmit) !== Boolean(option.exclusiveAutoSubmit);
    return split ? (
      <React.Fragment key={option.id || option.value}>
        <div role="separator" style={{ height: 1, backgroundColor: theme.colors.border, margin: '24px 0' }} />
        {card}
      </React.Fragment>
    ) : (
      card
    );
  });

  return (
    <div className="survey-option-cards flex w-full min-w-0 flex-col text-left" style={{ gap: 20 }}>
      {(data.label || data.description) && (
        <div>
          {data.label && (
            <Label id={questionId} className={cn('block text-lg font-bold', theme.field.label, 'text-left')}>
              {data.label}
            </Label>
          )}
          {data.description && (
            <div className={cn('text-sm text-muted-foreground', theme.field.description, 'text-left')}>
              {data.description}
            </div>
          )}
        </div>
      )}

      <div
        role={multi ? 'group' : 'radiogroup'}
        aria-labelledby={data.label ? questionId : undefined}
        aria-invalid={!!error}
        className={row ? undefined : theme.field.selectableBoxContainer || 'space-y-2'}
        style={
          row
            ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 12 }
            : undefined
        }
      >
        {cards}
      </div>

      {data.note && (
        <p
          className={cn('text-sm', theme.field.description)}
          style={{
            margin: 0,
            padding: 16,
            borderRadius: 12,
            backgroundColor: palette.bg[noteTone],
          }}
        >
          {data.note}
        </p>
      )}

      {error && <p className={cn('text-sm text-red-600', theme.field.error)}>{error}</p>}
    </div>
  );
};

const OptionCardsRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, value, onChange, onBlur, error, disabled, theme: themeProp }, ref) => {
    const theme = themeProp ?? themes.default;
    const multi = isMulti(block);
    const [selected, setSelected] = useState<string | string[]>(() =>
      parseValue(hasAnswer(value) ? value : block.defaultValue, multi),
    );

    // Follow outside changes to the value, such as Back restoring an answer
    useEffect(() => {
      if (value !== undefined) setSelected(parseValue(value, multi));
    }, [value, multi]);

    const handleSelect = (optionValue: string) => {
      if (disabled) return;

      const next = multi
        ? toggleMulti(optionValue, Array.isArray(selected) ? selected : [], getOptions(block))
        : // Picking the chosen card again clears it, as in the Selectable Box
          selected === optionValue
          ? ''
          : optionValue;

      setSelected(next);
      onChange?.(next);
      onBlur?.();
    };

    return (
      <div ref={ref}>
        <OptionCardsUi
          data={block}
          value={selected}
          theme={theme}
          error={error}
          disabled={disabled}
          onSelect={handleSelect}
        />
      </div>
    );
  },
);

OptionCardsRenderer.displayName = 'OptionCardsRenderer';

const newOptionId = () => `option-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

const OptionCardsForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const options = getOptions(data);
  const multi = isMulti(data);
  const row = getCardStyle(data) === 'row';

  const handleChange = (field: string, value: unknown) => onUpdate?.({ ...data, [field]: value });
  const setOptions = (next: CardOption[]) => handleChange('options', next);
  const updateOption = (index: number, field: keyof CardOption, value: unknown) =>
    setOptions(options.map((option, i) => (i === index ? { ...option, [field]: value } : option)));
  const moveOption = (index: number, offset: number) => {
    const next = [...options];
    const [option] = next.splice(index, 1);
    next.splice(index + offset, 0, option);
    setOptions(next);
  };
  const addOption = () => {
    const n = options.length + 1;
    setOptions([...options, { id: newOptionId(), label: `Option ${n}`, value: `option-${n}` }]);
  };

  const textField = (field: string, label: string, placeholder: string, help?: string) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`option-cards-${field}`}>
        {label}
      </Label>
      <Input
        id={`option-cards-${field}`}
        value={data[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  const choice = (
    field: string,
    label: string,
    value: string,
    choices: [string, string][],
    help?: string,
  ) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`option-cards-${field}`}>
        {label}
      </Label>
      <select
        id={`option-cards-${field}`}
        className={selectClass}
        value={value}
        onChange={(e) => handleChange(field, e.target.value)}
      >
        {choices.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* The builder draws the field name itself, from `fieldConfig` */}
      {textField('label', 'Question Label', 'Select an option')}

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="option-cards-description">
          Description (optional)
        </Label>
        <Textarea
          id="option-cards-description"
          value={data.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Shown below the question"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Answers</Label>
          <div className="flex items-center gap-4 pt-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!multi} onChange={() => handleChange('multiSelect', false)} />
              One
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={multi} onChange={() => handleChange('multiSelect', true)} />
              Several
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            One saves the option's value; several save a list of values
          </p>
        </div>
        <div className="space-y-3 pt-1">
          <div className="flex items-center space-x-2">
            <Switch
              id="option-cards-required"
              checked={isRequired(data)}
              onCheckedChange={(checked) => handleChange('required', checked)}
            />
            <Label htmlFor="option-cards-required" className="text-sm">
              Answer required
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="option-cards-split"
              checked={data.splitLabelAtDash === true}
              onCheckedChange={(checked) => handleChange('splitLabelAtDash', checked)}
            />
            <Label htmlFor="option-cards-split" className="text-sm">
              Split "Label – detail" into two lines
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {choice('cardStyle', 'Cards', getCardStyle(data), [
          ['list', 'List'],
          ['row', 'Row'],
        ])}
        {choice(
          'indicator',
          'Checkbox or radio',
          getIndicator(data),
          [
            ['left', 'Left'],
            ['right', 'Right'],
            ['none', 'None'],
          ],
        )}
        {row &&
          choice(
            'columns',
            'Columns',
            String(data.columns || 0),
            [
              ['0', 'One per option'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
            ],
          )}
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Label className="text-sm" htmlFor="option-cards-note">
          Note below the cards (optional)
        </Label>
        <Textarea
          id="option-cards-note"
          value={data.note || ''}
          onChange={(e) => handleChange('note', e.target.value)}
          placeholder="For example, what happens after a given answer"
          rows={2}
        />
        <div className="grid grid-cols-3 gap-4">
          {choice('noteTone', 'Note colour', data.noteTone || 'warning', [
            ['warning', 'Warning'],
            ['brand', 'Brand'],
            ['neutral', 'Neutral'],
          ])}
          {textField('warningColor', 'Warning colour', 'Theme error colour', 'The cross icon')}
          {textField('warningSurface', 'Warning background', 'A tint of it', 'The note and the cross circle')}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm">Options</Label>
        {options.map((option, index) => (
          <div key={option.id || index} className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                aria-label={`Option ${index + 1} label`}
                value={option.label}
                onChange={(e) => updateOption(index, 'label', e.target.value)}
                placeholder="Label"
              />
              <Input
                aria-label={`Option ${index + 1} value`}
                value={option.value}
                onChange={(e) => updateOption(index, 'value', e.target.value)}
                placeholder="Saved value"
              />
              <Input
                aria-label={`Option ${index + 1} second line`}
                value={option.description || ''}
                onChange={(e) => updateOption(index, 'description', e.target.value)}
                placeholder="Second line (optional)"
              />
              <Input
                aria-label={`Option ${index + 1} badge`}
                value={option.badge || ''}
                onChange={(e) => updateOption(index, 'badge', e.target.value)}
                placeholder="Badge (optional)"
              />
              <select
                aria-label={`Option ${index + 1} icon`}
                className={selectClass}
                value={option.icon || ''}
                onChange={(e) => updateOption(index, 'icon', e.target.value || undefined)}
              >
                <option value="">No icon</option>
                {Object.entries(ICONS).map(([key, { name }]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Option ${index + 1} image URL`}
                value={option.imageUrl || ''}
                onChange={(e) => updateOption(index, 'imageUrl', e.target.value)}
                placeholder="Image URL (optional, replaces the icon)"
              />
            </div>
            <div className="flex items-center justify-between">
              {multi ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`option-cards-exclusive-${index}`}
                    checked={option.exclusiveAutoSubmit === true}
                    onCheckedChange={(checked) => updateOption(index, 'exclusiveAutoSubmit', checked)}
                  />
                  <Label htmlFor={`option-cards-exclusive-${index}`} className="text-xs">
                    Clears the others
                  </Label>
                </div>
              ) : (
                <span />
              )}
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveOption(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Move down"
                  disabled={index === options.length - 1}
                  onClick={() => moveOption(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove option"
                  disabled={options.length <= 1}
                  onClick={() => setOptions(options.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          <Plus className="mr-1 h-4 w-4" />
          Add option
        </Button>
      </div>
    </div>
  );
};

const OptionCardsItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <OptionCardsUi data={data} value={isMulti(data) ? [] : ''} theme={themes.default} disabled />
  </Card>
);

const OptionCardsPreview: React.FC = () => (
  <div className="w-full py-1">
    <OptionCardsUi
      data={{
        type: 'optionCards',
        cardStyle: 'row',
        indicator: 'none',
        options: [
          { id: 'no', label: 'No', value: 'No', icon: 'x' },
          { id: 'yes', label: 'Yes', value: 'Yes', icon: 'check' },
        ],
      }}
      value="No"
      theme={themes.default}
    />
  </div>
);

const createDefaultData = (): BlockData => ({
  type: 'optionCards',
  fieldName: generateFieldName('optionCards'),
  label: 'Select an option',
  description: '',
  multiSelect: false,
  required: true,
  cardStyle: 'list',
  indicator: 'left',
  columns: 0,
  splitLabelAtDash: false,
  note: '',
  noteTone: 'warning',
  warningColor: '',
  warningSurface: '',
  defaultValue: '',
  options: [
    { id: newOptionId(), label: 'Option 1', value: 'option-1' },
    { id: newOptionId(), label: 'Option 2', value: 'option-2' },
  ],
});

export const OptionCardsBlock: BlockDefinition = {
  type: 'optionCards',
  name: 'Option Cards',
  description: 'Choice cards with icons, images, badges and second lines',
  icon: <LayoutList className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <OptionCardsItem {...props} />,
  renderFormFields: (props) => <OptionCardsForm {...props} />,
  renderPreview: () => <OptionCardsPreview />,
  renderBlock: (props) => <OptionCardsRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (!data.label) return 'Label is required';
    const options = getOptions(data);
    if (options.length === 0) return 'At least one option is required';
    const values = options.map((option) => option.value);
    if (values.some((value) => !value)) return 'Every option needs a value';
    if (new Set(values).size !== values.length) return 'Option values must be different';
    return null;
  },
  validateValue: (value, data) => {
    if (isRequired(data) && !hasAnswer(value)) return 'Please choose an answer.';
    return null;
  },
  // The same shapes as the Selectable Box Question, so either can replace the other
  inputSchema: {
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    discriminator: { propertyName: 'multiSelect', mapping: { false: 0, true: 1 } },
  },
  outputSchema: {
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    discriminator: { propertyName: 'multiSelect', mapping: { false: 0, true: 1 } },
  },
  fieldConfig: {
    enabled: true,
    label: 'Field Name',
    required: true,
  },
};

export default OptionCardsBlock;
