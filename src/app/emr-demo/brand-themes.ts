import type { ThemeDefinition } from '@/packages/survey-form-package/src/types';

/**
 * Brand themes for checking layouts and blocks under more than one brand, picked
 * with `?theme=` on /emr-demo.
 *
 * Every theme is built from the same tokens, so a layout or block that reads only
 * `ThemeDefinition` fields re-skins for any brand. Colour classes use six-digit
 * hex (`bg-[#RRGGBB]`, optionally `/alpha`), plain or with a hover, focus, active,
 * disabled, focus-visible or checked variant: core's `applyDynamicColors` writes
 * the CSS for those at runtime, so they work on public pages. Every other class
 * must be a stock Tailwind class, which the portal's app CSS already has.
 */
interface BrandTokens {
  colors: ThemeDefinition['colors'];
  /** Secondary text: descriptions, captions, placeholders */
  mutedText: string;
  /** Cards, inputs and option boxes */
  surface: string;
  /** Unselected checkbox and radio outlines */
  controlBorder: string;
  /** Primary button background and its hover */
  button: string;
  buttonHover: string;
  /** Rounding for cards, and for inputs and option boxes */
  radius: { card: string; control: string };
  fonts: NonNullable<ThemeDefinition['fonts']>;
}

function brandTheme(tokens: BrandTokens): ThemeDefinition {
  const { colors, mutedText, surface, controlBorder, button, buttonHover, radius } = tokens;
  const control = `w-full h-14 ${radius.control} border border-[${colors.border}] bg-[${surface}] px-4 text-base text-[${colors.text}] hover:border-[${colors.primary}] focus:border-[${colors.primary}] focus:outline-none focus:ring-0 shadow-none transition-colors placeholder:text-gray-400`;

  return {
    name: 'custom',
    // Full width: the kit's layout draws edge-to-edge bars and sets its own content widths
    containerLayout: 'w-full flex-1 h-full min-h-screen',
    header: 'mb-6 text-start',
    title: `text-2xl font-medium tracking-tight text-start text-[${colors.text}]`,
    description: `text-sm text-start text-[${mutedText}]`,
    background: `bg-[${colors.background}]`,
    card: `bg-[${surface}] ${radius.card} border border-[${colors.border}]`,
    field: {
      label: `block text-2xl font-medium leading-tight tracking-tight text-[${colors.text}]`,
      input: control,
      description: `mt-1 text-sm leading-5 text-start text-[${mutedText}]`,
      error: `mt-2 text-sm text-start text-[${colors.error}]`,
      radio: `h-5 w-5 border-[${controlBorder}] text-[${colors.primary}] shadow-none focus:ring-0`,
      checkbox: `h-5 w-5 rounded-md border border-[${controlBorder}] bg-[${surface}] shadow-none focus:ring-0`,
      select: control,
      textarea: `w-full h-32 ${radius.control} border border-[${colors.border}] bg-[${surface}] px-4 py-3 text-base text-[${colors.text}] hover:border-[${colors.primary}] focus:border-[${colors.primary}] focus:outline-none focus:ring-0 shadow-none transition-colors placeholder:text-gray-400`,
      file: `w-full ${radius.control} border border-[${colors.border}] bg-[${surface}] px-4 py-3 text-base text-[${colors.text}] cursor-pointer hover:border-[${colors.primary}] transition-colors`,
      matrix: `w-full border-collapse text-base ${radius.control} overflow-hidden`,
      range: `accent-[${colors.primary}]`,
      text: `text-[${colors.text}]`,
      activeText: `text-[${colors.primary}]`,
      placeholder: 'text-gray-500',
      boxBorder: `border-[${colors.border}]`,
      selectableBox: `px-4 py-3.5 ${radius.control} cursor-pointer text-left transition-colors duration-200`,
      selectableBoxDefault: `border border-[${colors.border}] bg-[${surface}] hover:border-[${colors.primary}]`,
      selectableBoxSelected: `border-2 border-[${colors.primary}] bg-[${colors.accent}]`,
      selectableBoxHover: `hover:border-[${colors.primary}]`,
      selectableBoxFocus: `focus:border-[${colors.primary}]`,
      selectableBoxDisabled: 'opacity-50 cursor-not-allowed',
      selectableBoxContainer: 'space-y-2 w-full',
      selectableBoxText: `text-base font-normal text-[${colors.text}]`,
      selectableBoxTextSelected: `text-base font-semibold text-[${colors.text}]`,
      selectableBoxIndicator: `bg-[${colors.primary}] text-white`,
      selectableBoxIndicatorIcon: 'text-white',
      agreementContainer: 'space-y-4',
      agreementPanel: `${radius.control} border border-[${colors.border}] bg-[${surface}] px-4 py-3 text-base whitespace-pre-wrap`,
      signatureCanvas: `w-full h-40 ${radius.control} border border-[${colors.border}] bg-[${surface}] overflow-hidden`,
      signatureColor: colors.text,
    },
    container: {
      card: `bg-[${surface}]`,
      border: `border-[${colors.border}]`,
      activeBorder: `border-[${colors.primary}]`,
      activeBg: `bg-[${colors.accent}]`,
      header: `bg-[${surface}]`,
    },
    progress: {
      bar: `bg-[${colors.primary}]`,
      dots: 'flex space-x-2 justify-center',
      numbers: 'flex space-x-2 justify-center',
      percentage: `text-right text-sm text-[${mutedText}] mb-2`,
      label: `text-sm text-[${mutedText}] mb-2`,
    },
    button: {
      primary: `inline-flex w-full h-14 items-center justify-center rounded-full bg-[${button}] hover:bg-[${buttonHover}] px-8 text-base font-semibold text-white transition-colors focus:outline-none`,
      secondary: `inline-flex justify-center rounded-full border border-[${colors.border}] bg-[${surface}] px-8 py-3 text-base font-medium text-[${colors.text}] hover:bg-[${colors.background}] focus:outline-none transition-colors`,
      text: `text-base font-medium text-[${colors.text}] hover:text-[${colors.primary}]`,
      navigation: `inline-flex items-center justify-center rounded-full bg-[${button}] hover:bg-[${buttonHover}] px-8 py-3 text-base font-semibold text-white`,
    },
    colors,
    fonts: tokens.fonts,
  };
}

/**
 * VitalMeds' redesign (Figma "VitalMeds Working File", Intake Flow - V2, read
 * 2026-10-17). Starts from the live theme on form 1124, whose error and success
 * colours it keeps, and takes the VM2 styles: text/primary, text/secondary,
 * bg/subtle, border/default, neutral/400, cat/weight/solid and /soft,
 * brand/primary and the lime icon chip.
 */
export const vitalmeds = brandTheme({
  colors: {
    primary: '#3C8F3D',
    secondary: '#CEEC8F',
    accent: '#E7F5D5',
    background: '#F1F2EC',
    text: '#1E2418',
    border: '#E3E5DD',
    error: '#FF0000',
    success: '#10B981',
  },
  mutedText: '#5F6458',
  surface: '#FFFFFF',
  controlBorder: '#A3A79A',
  button: '#1E2418',
  buttonHover: '#2C3127',
  radius: { card: 'rounded-3xl', control: 'rounded-2xl' },
  fonts: {
    urls: [
      'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@200..800&display=swap',
    ],
    primary: 'Manrope, sans-serif',
    secondary: '"Instrument Serif", serif',
    heading: 'Manrope, sans-serif',
    body: 'Manrope, sans-serif',
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
});

/** A made-up second brand, to check that nothing in the kit is VitalMeds-only */
export const sampleBrand = brandTheme({
  colors: {
    primary: '#C2410C',
    secondary: '#FDE68A',
    accent: '#FFEDD5',
    background: '#F8FAFC',
    text: '#0F172A',
    border: '#CBD5E1',
    error: '#B91C1C',
    success: '#15803D',
  },
  mutedText: '#475569',
  surface: '#FFFFFF',
  controlBorder: '#94A3B8',
  button: '#1E3A8A',
  buttonHover: '#1E40AF',
  radius: { card: 'rounded-lg', control: 'rounded-md' },
  fonts: {
    urls: [
      'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Lora:ital,wght@1,400..700&display=swap',
    ],
    primary: 'Inter, sans-serif',
    secondary: 'Lora, serif',
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
});

export const BrandThemes: Record<string, ThemeDefinition> = {
  vitalmeds,
  sampleBrand,
};
