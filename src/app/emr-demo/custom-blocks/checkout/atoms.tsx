/* eslint-disable @typescript-eslint/no-explicit-any */

import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { AlertCircle, Check, ChevronDown, Loader2, Pill } from 'lucide-react';
import React from 'react';
import { fill, hasText } from './pricing';
import {
  darkButtonClass,
  darkButtonStyle,
  optionRadius,
  secondaryTone,
  softShadow,
  tileStyle,
  type Brand,
} from './styles';

// A 1px gradient border around an opaque fill, with an optional tint layered on top.
export const gradientBorder = (
  brand: Brand,
  fill: string,
  tint?: string,
): React.CSSProperties => ({
  border: '1px solid transparent',
  background: [
    tint ? `${tint} padding-box` : null,
    `linear-gradient(${fill}, ${fill}) padding-box`,
    `${brand.gradient} border-box`,
  ]
    .filter(Boolean)
    .join(', '),
});

export const GradientText: React.FC<{
  brand: Brand;
  className?: string;
  children: React.ReactNode;
}> = ({ brand, className, children }) => (
  <span
    className={cn('bg-clip-text text-transparent', className)}
    style={{ backgroundImage: brand.text }}
  >
    {children}
  </span>
);

export const AccentDot: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  brand: Brand;
}> = ({ icon: Icon, brand }) => (
  <span
    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-gray-900"
    style={{ backgroundImage: brand.gradient }}
    aria-hidden="true"
  >
    <Icon className="size-3.5" />
  </span>
);

export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  brand: Brand;
}> = ({ children, icon, onClick, disabled, busy, brand }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    className={darkButtonClass}
    style={darkButtonStyle}
  >
    {busy ? (
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
    ) : null}
    <span>{children}</span>
    {busy ? null : <AccentDot icon={icon} brand={brand} />}
  </button>
);

// Pixel sizes go inline because the public form's CSS has no size-20 or size-24.
export const TILE_SIZES = { lg: 96, md: 80, sm: 40 } as const;

export const MediaTile: React.FC<{
  imageUrl: string | null;
  label: string;
  size?: keyof typeof TILE_SIZES;
  primary: string;
}> = ({ imageUrl, label, size = 'lg', primary }) => {
  const sizeStyle = { width: TILE_SIZES[size], height: TILE_SIZES[size] };
  const radiusClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        className={cn('shrink-0 object-cover', radiusClass)}
        style={{ ...tileStyle, ...sizeStyle }}
      />
    );
  }

  // Without a product photo, a large placeholder tile only squeezes the name onto more lines,
  // so the name rows show a small pill beside their first line instead.
  if (size !== 'sm') {
    return (
      <Pill
        className="size-5 shrink-0"
        style={{ color: primary }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center', radiusClass)}
      style={{ ...tileStyle, ...sizeStyle }}
      aria-hidden="true"
    >
      <Pill className="size-4" style={{ color: primary }} />
    </div>
  );
};

export const DetailTable: React.FC<{ rows: [string, string][] }> = ({
  rows,
}) => {
  const visible = rows.filter(([, value]) => hasText(value));
  if (visible.length === 0) return null;

  return (
    <dl
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: 'var(--color-gray-300)' }}
    >
      {visible.map(([label, value]) => (
        <div
          key={label}
          className="grid border-b border-gray-300 last:border-b-0"
          style={{ gridTemplateColumns: '4rem minmax(0, 1fr)' }}
        >
          <dt className="flex items-center justify-center border-r border-gray-300 px-2 py-2 text-xs leading-[14px] text-gray-600">
            {label}
          </dt>
          <dd className="px-2.5 py-2 text-sm leading-[16px] text-gray-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export const DrawerToggle: React.FC<{
  label: string;
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
  controls: string;
}> = ({ label, open, onClick, disabled, controls }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-expanded={open}
    aria-controls={controls}
    className="flex h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-white px-2.5 text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    style={{ flex: '1 1 auto', ...softShadow('0 1px 2px', 0.05) }}
  >
    <span>{label}</span>
    <ChevronDown
      className={cn(
        'size-3.5 shrink-0 text-gray-600 transition-transform duration-200',
        open && 'rotate-180',
      )}
      aria-hidden="true"
    />
  </button>
);

// The plan cards' radio: an outlined circle, or a filled gradient circle with a check.
export const RadioMark: React.FC<{ selected: boolean; brand: Brand }> = ({
  selected,
  brand,
}) =>
  selected ? (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundImage: brand.gradient }}
      aria-hidden="true"
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  ) : (
    <span
      className="size-6 shrink-0 rounded-full border bg-white"
      style={{ borderColor: 'var(--checkout-radio-border)' }}
      aria-hidden="true"
    />
  );

export const ChoiceRow: React.FC<{
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  detail?: string;
  aside?: string;
  imageUrl?: string | null;
  showImage: boolean;
  brand: Brand;
  selectedLabel: string;
}> = ({
  selected,
  onClick,
  disabled,
  title,
  detail,
  aside,
  imageUrl,
  showImage,
  brand,
  selectedLabel,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex w-full items-center gap-3 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
      !selected && 'border bg-white',
    )}
    style={{
      ...optionRadius,
      ...(selected
        ? gradientBorder(brand, 'white', brand.tint)
        : { borderColor: 'var(--checkout-option-border)' }),
    }}
  >
    <RadioMark selected={selected} brand={brand} />
    {showImage ? (
      <MediaTile
        imageUrl={imageUrl ?? null}
        label={title}
        size="sm"
        primary={brand.primary}
      />
    ) : null}
    <span className="min-w-0 flex-1">
      <span className="block text-base text-gray-900">{title}</span>
      {detail ? (
        <span className="block text-base text-gray-600">{detail}</span>
      ) : null}
    </span>
    {aside ? (
      <span className="shrink-0 text-base" style={secondaryTone}>
        {aside}
      </span>
    ) : null}
    {selected ? <span className="sr-only">{selectedLabel}</span> : null}
  </button>
);

export const InlineMessage: React.FC<{
  tone?: 'error' | 'info' | 'success';
  children: React.ReactNode;
}> = ({ tone = 'info', children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={cn(
      'flex items-start gap-2 rounded-xl px-4 py-3 text-base',
      tone === 'error' && 'bg-red-50 text-red-800',
      tone === 'info' && 'bg-gray-100',
      tone === 'success' && 'bg-emerald-50 text-emerald-800',
    )}
    style={tone === 'info' ? secondaryTone : undefined}
  >
    {tone === 'success' ? (
      <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
    ) : (
      <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden="true" />
    )}
    <span>{children}</span>
  </div>
);
