import React from 'react';
import { expandHex, mix, withAlpha } from './pricing';

// ============================================================================
// Shared presentation pieces
// ============================================================================

// Every colour comes from the theme. The design's neutrals are tones of the theme's text colour on white,
// which reproduce the approved Figma greys on Ivy's theme. The block root sets Tailwind's --color-gray-*
// variables to those tones, so gray-* classes inside the block are the design's neutrals, and it sets
// the --survey-* variables that core's isolation CSS uses to paint inputs, selects and every `.border`.
// That CSS also repaints text-gray-700 to 900 with --survey-text, so the two darker text greys use
// their own variables.
// The portal's compile of the block's CSS drops some arbitrary colours, gradients and grid templates,
// and the public form serves only the portal's and the merchant's CSS, so anything those lack goes inline.
export const neutralVars = (text: string): React.CSSProperties => {
  const tone = (amount: number) => mix(text, amount, 'white');

  return {
    '--survey-border': tone(0.09),
    '--survey-surface': 'white',
    '--survey-text': text,
    '--survey-text-muted': tone(0.32),
    '--color-gray-50': tone(0.02),
    '--color-gray-100': tone(0.08),
    '--color-gray-200': tone(0.09),
    '--color-gray-300': tone(0.13),
    '--color-gray-400': tone(0.32),
    '--color-gray-500': tone(0.52),
    '--color-gray-600': tone(0.7),
    '--color-gray-900': text,
    '--checkout-text-label': tone(0.9),
    '--checkout-text-secondary': tone(0.8),
    // Two outline greys that fall between the gray steps.
    '--checkout-option-border': tone(0.16),
    '--checkout-radio-border': tone(0.26),
  } as React.CSSProperties;
};

export const ink = 'var(--color-gray-900)';
export const softShadow = (
  shape: string,
  alpha: number,
): React.CSSProperties => ({
  boxShadow: `${shape} ${withAlpha(ink, alpha)}`,
});

export const cardClass = 'rounded-[20px] bg-white p-4';
export const cardStyle = softShadow('0 1px 3px', 0.04);
export const headingClass = 'font-normal tracking-[-0.02em] text-gray-900';
// Figma's type scale for the numbered step titles and the medication name (card and order summary).
export const stepTitleClass = 'text-2xl leading-[28px] tracking-[-0.04em]';
// Long drug names wrap onto even lines rather than leaving the dose alone on the second.
export const medicationNameClass =
  'text-balance text-base leading-5 font-medium tracking-[-0.01em] text-gray-900';
export const labelClass = 'block text-sm';
export const labelTone: React.CSSProperties = {
  color: 'var(--checkout-text-label)',
};
export const secondaryTone: React.CSSProperties = {
  color: 'var(--checkout-text-secondary)',
};
export const stepTitle = (step: number, title: string) => `${step}. ${title}`;
export const inputClass =
  'h-12 w-full min-w-0 rounded-xl border bg-white px-4 text-base text-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
export const darkButtonClass =
  'flex h-14 w-full items-center justify-center gap-3 rounded-full px-6 text-lg font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60';
export const darkButtonStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(180deg, ${mix(ink, 0.91, 'white')}, ${mix(ink, 0.79, 'black')})`,
  ...softShadow('0 4px 12px', 0.12),
};
export const tileStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-gray-100)',
};
export const optionRadius: React.CSSProperties = { borderRadius: 14 };

// HSL saturation under 0.15 reads as grey, like the secondaries of most built-in themes.
// Colour values stay out of this comment because the portal validator flags any hex literal.
export const isNeutral = (color: string): boolean => {
  const hex = expandHex(color);
  if (!hex) return false;
  const [red, green, blue] = [0, 2, 4].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max === min) return true;
  const lightness = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * lightness - 1)) < 0.15;
};

// The design's brand treatment: a gradient from the theme's secondary to its primary colour (pink to purple on
// Ivy's theme). A grey secondary would wash it out, so then the gradient runs from the primary to a deeper primary.
export interface Brand {
  primary: string;
  gradient: string;
  tint: string;
  text: string;
}

export const makeBrand = (primary: string, secondary: string): Brand => {
  const neutral = isNeutral(secondary);
  const start = neutral ? primary : secondary;
  const end = neutral ? mix(primary, 0.8, 'black') : primary;

  return {
    primary,
    gradient: `linear-gradient(90deg, ${start}, ${end})`,
    tint: `linear-gradient(90deg, ${withAlpha(start, 0.1)}, ${withAlpha(end, 0.1)})`,
    text: `linear-gradient(90deg, ${mix(start, 0.8, 'black')}, ${mix(end, 0.8, 'black')})`,
  };
};
