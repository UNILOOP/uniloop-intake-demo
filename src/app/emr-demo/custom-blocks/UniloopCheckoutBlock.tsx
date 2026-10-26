/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleDollarSign,
  FlaskConical,
  HeartHandshake,
  Laptop,
  Loader2,
  Phone,
  Pill,
  Plus,
  ShoppingBag,
  Tag,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type EnrollmentModule = any;

const BLOCK_TYPE = 'singlePageCheckout';

// Two columns need a desktop viewport and enough room inside the form container.
const WIDE_VIEWPORT_QUERY = '(min-width: 992px)';
const WIDE_BLOCK_MIN_WIDTH = 720;
// Core pads the form 24-32px on each side; anything wider is a layout this block should not reach over.
const MAX_EDGE_BLEED = 48;

// ============================================================================
// Builder copy
// ============================================================================

const BENEFIT_ICONS = {
  price: CircleDollarSign,
  physician: Laptop,
  lab: FlaskConical,
  delivery: Zap,
  shipping: Truck,
  care: HeartHandshake,
  check: Check,
} as const;

type BenefitIcon = keyof typeof BENEFIT_ICONS;

interface Benefit {
  icon: BenefitIcon;
  title: string;
  description: string;
}

const DEFAULT_BENEFITS: Benefit[] = [
  {
    icon: 'price',
    title: 'Same price, every dose',
    description: '(no surprises, no insurance needed)',
  },
  {
    icon: 'physician',
    title: 'Same-day physician review',
    description: '(approval emailed)',
  },
  {
    icon: 'lab',
    title: 'Labwork not required',
    description: '(faster access to medication)',
  },
  {
    icon: 'delivery',
    title: 'Fast delivery to you',
    description: '(discreet packaging)',
  },
  {
    icon: 'care',
    title: 'Compassionate care',
    description: '(live support, free mobile app)',
  },
];

const COPY_DEFAULTS = {
  headerTitle: "{firstName}'s {planName} Plan",
  headerTitleFallback: 'Your {planName} Plan',
  summaryToggleLabel: 'View My Order Summary',

  personalizeTitle: 'Personalize your plan',
  personalizeSubtitle: "Please review your plan's details.",

  medicationTitle: 'Confirm your medication',
  medicationTypeLabel: 'Type',
  medicationDoseLabel: 'Dose',
  medicationTakeLabel: 'Take',
  medicationOptionsLabel: 'Optional personalizations:',
  seeOtherOptionsLabel: 'See other options',
  changeDoseLabel: 'Change dose',
  drugDrawerTitle: 'Choose a different medication',
  doseDrawerTitle: 'Choose your dose',
  selectedLabel: 'Selected',
  standardDoseLabel: 'Starting dose',
  cycleSingleTemplate: 'Cycle {from}',
  cycleRangeTemplate: 'Cycles {from}-{to}',
  cycleOpenTemplate: 'Cycle {from}+',
  preferredLoadingMessage:
    'Checking your responses for a preferred medication…',
  preferredAppliedTemplate:
    "Based on your responses, the preferred option is {drug}. We've selected it for you. You can change your selection below.",
  preferredKeptMessage:
    'Your responses suggest a medication preference. Review the options below; your current selection has been kept.',
  preferredNoneMessage: '',
  preferredUnavailableMessage:
    'Medication recommendations are temporarily unavailable. You can still choose from the options below.',

  planTitle: 'Choose a delivery plan',
  planSubtitle:
    'Save even more with longer plans. Multi-month plan medication sent every three months.',
  recommendedLabel: 'Recommended',
  savingsTemplate: 'Save {amount} per month',
  perMonthSuffix: '/mo',
  perDeliverySuffix: '/delivery',
  billedMonthlyTemplate: '{amount} billed monthly',
  billedEveryTemplate: '{amount} billed every {months} months',
  billedEveryDaysTemplate: 'Every {days} days',
  prepaidOnceTemplate: '{amount} for {months} months',
  prepaidOnceDaysTemplate: '{amount} for {days} days',

  quoteLoadingMessage: 'Updating your plan price…',
  quoteRefreshLabel: 'Refresh price',
  quoteRequiredMessage: 'Your plan price needs a refresh before payment.',

  addOnsTitle: 'Optimize your results',
  addOnsSubtitle: 'Optional products',
  addOnSavingsTitle: 'Save $40 now.',
  addOnSavingsText: 'Avoid extra consultation and shipping fees later.',
  addOnQuantityLabel: 'Quantity',
  addOnButtonLabel: 'Add to your order',
  addOnAddedLabel: 'Added to your order',

  benefitsTitle: '{firstName}, your plan also includes:',
  benefitsTitleFallback: 'Your plan also includes:',
  checkoutJumpLabel: 'Checkout',

  checkoutTitle: 'Checkout',
  checkoutSubtitle: 'Please provide your billing information.',
  shippingTitle: 'My Shipping Information',
  savedAddressesLabel: 'Saved addresses',
  newAddressLabel: 'Use a new address',
  savedAddressesLoadingText: 'Loading saved addresses…',
  streetLabel: 'Street Address',
  streetPlaceholder: 'Street',
  address2Label: 'Address 2',
  address2Placeholder: 'Apt, floor',
  cityLabel: 'City',
  cityPlaceholder: 'City',
  stateLabel: 'State',
  statePlaceholder: 'Select',
  zipLabel: 'Zip code',
  zipPlaceholder: '85006',
  paymentTitle: 'Select your payment method',
  paymentNote:
    "You won't be charged unless your prescription is approved by a clinician. A temporary pre-authorization (Pending) may appear on your account for the total amount, but no payment is taken if the reviewing clinician determines treatment isn't right for you. Pre-authorizations may take 3 days or less for your bank to release.",

  summaryPlanTemplate: 'Treatment Plan: {plan}',
  summaryAddOnLabel: 'Optional add-on',
  discountPlaceholder: 'Discount code?',
  applyLabel: 'Apply',
  changeCouponLabel: 'Change',
  discountLineTemplate: 'Discount ({code})',
  shippingLineLabel: 'Free, expedited shipping',
  dueNowLabel: 'Due now:',
  authorizationHoldLabel: 'Temporary hold today:',
  totalIfPrescribedLabel: 'Total if prescribed:',
  couponUnavailableText: 'Discount codes are unavailable right now.',
  couponEmailRequiredText: 'Verify your email to use a discount code.',
  couponInvalidText: 'This discount code could not be applied.',

  cancelNote: 'You may cancel anytime, hassle free.',
  completeOrderLabel: 'Complete My Order',
  processingLabel: 'Processing…',
  paymentDisclaimer:
    'By making a purchase, you accept a Self Pay arrangement. Your subscription will automatically renew and your credit card will be charged the subscription fee. You can cancel or modify your plan at any time in your patient portal.',
  securityNote: '256-BIT TLS SECURITY',
  supportLabel: 'Order questions?',
  supportPhone: '(866) 464-8979',

  unavailableMessage: 'Checkout is not available for this form.',
  emptyPlanMessage: 'This treatment has no plan options yet.',
  verificationRequiredMessage:
    'Complete patient verification to enable secure payment.',
  incompleteDetailsMessage:
    'Complete your details and shipping address before payment.',
  invalidEmailMessage: 'Enter a valid email before payment.',
  ineligibleStateMessage: 'This plan is unavailable at the shipping address.',
  paymentLoadingMessage: 'Secure payment is loading. Please try again shortly.',
  selectionChangedMessage:
    'Your selection changed. Review the updated checkout before payment.',
  paymentConfirmedMessage: 'Payment details confirmed.',
  submitErrorMessage:
    "Your order hasn't gone through yet. Your payment details are saved.",
  retryLabel: 'Try again',
  orderSubmittedMessage: 'Your order has been submitted.',
  paymentRequiredMessage: 'Complete payment to finish your order.',

  firstNameLabel: 'First name',
  lastNameLabel: 'Last name',
  emailLabel: 'Email',
};

type CopyKey = keyof typeof COPY_DEFAULTS;
type Copy = Record<CopyKey, string>;

const COPY_GROUPS: {
  title: string;
  hint?: string;
  fields: [CopyKey, string][];
}[] = [
  {
    title: 'Header and order summary',
    hint: 'Tokens: {firstName}, {planName}. The fallback is used when the first name is unknown.',
    fields: [
      ['headerTitle', 'Header title'],
      ['headerTitleFallback', 'Header title without a name'],
      ['summaryToggleLabel', 'Summary toggle'],
      ['summaryPlanTemplate', 'Plan line ({plan})'],
      ['summaryAddOnLabel', 'Add-on line note'],
      ['discountPlaceholder', 'Discount field placeholder'],
      ['applyLabel', 'Apply button'],
      ['changeCouponLabel', 'Remove discount button'],
      ['discountLineTemplate', 'Discount line ({code})'],
      ['shippingLineLabel', 'Shipping line (empty hides it)'],
      ['dueNowLabel', 'Due now'],
      ['authorizationHoldLabel', 'Due now when a hold is placed'],
      ['totalIfPrescribedLabel', 'Total if prescribed'],
      ['couponUnavailableText', 'Discount codes unavailable'],
      ['couponEmailRequiredText', 'Discount needs a verified email'],
      ['couponInvalidText', 'Discount code rejected'],
    ],
  },
  {
    title: 'Medication',
    hint: 'Cycle tokens: {from}, {to}.',
    fields: [
      ['personalizeTitle', 'Section title'],
      ['personalizeSubtitle', 'Section subtitle'],
      ['medicationTitle', 'Card title'],
      ['medicationTypeLabel', 'Type label'],
      ['medicationDoseLabel', 'Dose label'],
      ['medicationTakeLabel', 'Take label'],
      ['medicationOptionsLabel', 'Options label'],
      ['seeOtherOptionsLabel', 'Other options link'],
      ['changeDoseLabel', 'Change dose link'],
      ['drugDrawerTitle', 'Medication drawer title'],
      ['doseDrawerTitle', 'Dose drawer title'],
      ['selectedLabel', 'Selected label'],
      ['standardDoseLabel', 'Standard dose label'],
      ['cycleSingleTemplate', 'Single cycle'],
      ['cycleRangeTemplate', 'Cycle range'],
      ['cycleOpenTemplate', 'Open-ended cycle'],
    ],
  },
  {
    title: 'Medication recommendation',
    hint: 'Shown when the intake answers point to a preferred medication. Token: {drug}. Empty text hides that message.',
    fields: [
      ['preferredLoadingMessage', 'Checking answers'],
      ['preferredAppliedTemplate', 'Preferred option selected'],
      ['preferredKeptMessage', 'Preference found, selection kept'],
      ['preferredNoneMessage', 'No preference found'],
      ['preferredUnavailableMessage', 'Recommendation unavailable'],
    ],
  },
  {
    title: 'Delivery plans',
    hint: 'Tokens: {amount}, {months}, {days}. Prepaid plans that renew use the "Billed every" lines.',
    fields: [
      ['planTitle', 'Section title'],
      ['planSubtitle', 'Section subtitle'],
      ['recommendedLabel', 'Recommended badge'],
      ['savingsTemplate', 'Savings label'],
      ['perMonthSuffix', 'Per month suffix'],
      ['perDeliverySuffix', 'Per delivery suffix'],
      ['billedMonthlyTemplate', 'Billed monthly'],
      ['billedEveryTemplate', 'Billed every N months'],
      ['billedEveryDaysTemplate', 'Billed every N days'],
      ['prepaidOnceTemplate', 'Prepaid without renewal (months)'],
      ['prepaidOnceDaysTemplate', 'Prepaid without renewal (days)'],
    ],
  },
  {
    title: 'Prepaid plans',
    hint: 'Shown at payment while a prepaid plan’s price loads, fails or expires. The disclaimer under Complete My Order is the agreement to its terms.',
    fields: [
      ['quoteLoadingMessage', 'Price updating'],
      ['quoteRefreshLabel', 'Refresh price button'],
      ['quoteRequiredMessage', 'Price expired'],
    ],
  },
  {
    title: 'Add-ons',
    fields: [
      ['addOnsTitle', 'Section title'],
      ['addOnsSubtitle', 'Section subtitle'],
      ['addOnSavingsTitle', 'Savings note title (empty hides it)'],
      ['addOnSavingsText', 'Savings note text'],
      ['addOnQuantityLabel', 'Quantity label'],
      ['addOnButtonLabel', 'Add button'],
      ['addOnAddedLabel', 'Added state'],
    ],
  },
  {
    title: 'Benefits',
    hint: 'Token: {firstName}.',
    fields: [
      ['benefitsTitle', 'Title'],
      ['benefitsTitleFallback', 'Title without a name'],
      ['checkoutJumpLabel', 'Jump to checkout button'],
    ],
  },
  {
    title: 'Shipping',
    fields: [
      ['checkoutTitle', 'Checkout title'],
      ['checkoutSubtitle', 'Checkout subtitle'],
      ['shippingTitle', 'Shipping card title'],
      ['firstNameLabel', 'First name (shown only when the profile lacks it)'],
      ['lastNameLabel', 'Last name (shown only when the profile lacks it)'],
      ['emailLabel', 'Email (shown only when the profile lacks it)'],
      ['savedAddressesLabel', 'Saved addresses label'],
      ['newAddressLabel', 'New address option'],
      ['savedAddressesLoadingText', 'Saved addresses loading'],
      ['streetLabel', 'Street label'],
      ['streetPlaceholder', 'Street placeholder'],
      ['address2Label', 'Address 2 label'],
      ['address2Placeholder', 'Address 2 placeholder'],
      ['cityLabel', 'City label'],
      ['cityPlaceholder', 'City placeholder'],
      ['stateLabel', 'State label'],
      ['statePlaceholder', 'State placeholder'],
      ['zipLabel', 'Zip label'],
      ['zipPlaceholder', 'Zip placeholder'],
    ],
  },
  {
    title: 'Payment and completion',
    fields: [
      ['paymentTitle', 'Payment card title'],
      ['paymentNote', 'Note under the payment title (empty hides it)'],
      ['cancelNote', 'Cancel note (empty hides it)'],
      ['completeOrderLabel', 'Complete order button'],
      ['processingLabel', 'Processing label'],
      [
        'paymentDisclaimer',
        'Disclaimer under Complete My Order (empty hides it)',
      ],
      ['securityNote', 'Security note (empty hides it)'],
      ['supportLabel', 'Support label'],
      ['supportPhone', 'Support phone (empty hides it)'],
    ],
  },
  {
    title: 'Status messages',
    fields: [
      ['unavailableMessage', 'No enrollment'],
      ['emptyPlanMessage', 'No plan options'],
      ['verificationRequiredMessage', 'Verification required'],
      ['incompleteDetailsMessage', 'Missing details'],
      ['invalidEmailMessage', 'Invalid email'],
      ['ineligibleStateMessage', 'State not eligible'],
      ['paymentLoadingMessage', 'Payment still loading'],
      ['selectionChangedMessage', 'Selection changed during payment'],
      ['paymentConfirmedMessage', 'Payment confirmed'],
      ['submitErrorMessage', 'Order not submitted'],
      ['retryLabel', 'Retry button'],
      ['orderSubmittedMessage', 'Order already submitted'],
      ['paymentRequiredMessage', 'Payment missing at submit'],
    ],
  },
];

const readCopy = (block: BlockData): Copy => {
  const data = block as Record<string, unknown>;
  const copy = {} as Copy;
  for (const key of Object.keys(COPY_DEFAULTS) as CopyKey[]) {
    copy[key] =
      typeof data[key] === 'string'
        ? (data[key] as string)
        : COPY_DEFAULTS[key];
  }
  return copy;
};

const readBenefits = (block: BlockData): Benefit[] =>
  Array.isArray(block.benefits) ? block.benefits : DEFAULT_BENEFITS;

const readDisclaimers = (block: BlockData): string[] =>
  Array.isArray(block.disclaimers)
    ? block.disclaimers.filter((line: unknown) => typeof line === 'string')
    : [];

// ============================================================================
// Formatting and data helpers
// ============================================================================

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

const formatMoney = (amount: number, exact = false): string => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: exact || value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
};

const fill = (
  template: string,
  tokens: Record<string, string | number | null | undefined>,
): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in tokens ? String(tokens[key] ?? '') : match,
  );

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '';

const dataObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};

const capitalize = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

const expandHex = (color: string): string | null => {
  const hex = color.trim().replace('#', '');

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
};

// Mixes `amount` (0-1) of a colour into white or black. Hex colours give hex, which Stripe's appearance
// options need; any other CSS colour falls back to color-mix.
const mix = (
  color: string,
  amount: number,
  base: 'white' | 'black',
): string => {
  const hex = expandHex(color);

  if (!hex) {
    return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, ${base})`;
  }

  const target = base === 'white' ? 255 : 0;
  const channel = (start: number) =>
    Math.round(
      Number.parseInt(hex.slice(start, start + 2), 16) * amount +
        target * (1 - amount),
    )
      .toString(16)
      .padStart(2, '0');

  return `#${channel(0)}${channel(2)}${channel(4)}`;
};

const withAlpha = (color: string, alpha: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

const getPrimaryPhoto = (
  photos:
    | Array<{ url?: string | null; is_primary?: boolean }>
    | null
    | undefined,
): string | null => {
  if (!photos?.length) {
    return null;
  }

  return (
    photos.find((photo) => photo.is_primary)?.url ?? photos[0]?.url ?? null
  );
};

const getDrugImage = (drug: any): string | null =>
  getPrimaryPhoto(drug?.merchant_drug?.photos);

const getPhaseImage = (phase: any, drug: any): string | null =>
  getPrimaryPhoto(phase?.local_merchant_drug?.photos) ?? getDrugImage(drug);

const getPhaseDrugName = (phase: any, drug: any): string =>
  phase?.local_merchant_drug?.display_name ||
  phase?.drug_name ||
  drug?.drug_name ||
  'Medication';

const getActivePhases = (drug: any): any[] =>
  drug?.has_phases
    ? (drug?.phases ?? []).filter((phase: any) => phase?.is_active)
    : [];

const getSelectedPhase = (drug: any, phaseId: string | null): any | null =>
  phaseId
    ? (getActivePhases(drug).find((phase: any) => phase.id === phaseId) ?? null)
    : null;

const phaseCycleLabel = (copy: Copy, phase: any): string => {
  if (phase.phase_to === null || phase.phase_to === undefined) {
    return fill(copy.cycleOpenTemplate, { from: phase.phase_from });
  }

  return fill(
    phase.phase_from === phase.phase_to
      ? copy.cycleSingleTemplate
      : copy.cycleRangeTemplate,
    {
      from: phase.phase_from,
      to: phase.phase_to,
    },
  );
};

const getAddOnUnitPrice = (drug: any, phaseId: string | null): number => {
  const phase = getSelectedPhase(drug, phaseId);
  if (phase?.add_on_price != null) {
    return Number(phase.add_on_price) || 0;
  }

  return Number(drug?.add_on_price ?? 0) || 0;
};

const describeAddress = (address: any): string =>
  [
    address?.line1,
    address?.line2,
    address?.city,
    [address?.state, address?.zip].filter(Boolean).join(' '),
  ]
    .filter(hasText)
    .join(', ');

// ============================================================================
// Checkout contract (ported from the VisualCheckout block)
// ============================================================================

// A prepaid plan is a server quote: a checkout UUID plus amounts in cents and the renewal terms.
interface BillingPurchase {
  checkout_uuid: string;
  quote: any;
}

interface PrepaidState {
  purchase: BillingPurchase | null;
}

// Prepaid plans need the quote and checkout calls, which only the EMR enrollment utils provide.
const supportsPrepaid = (module: EnrollmentModule | undefined): boolean =>
  typeof module?.quoteBillingOption === 'function' &&
  typeof module?.cancelBillingCheckout === 'function' &&
  typeof module?.getSelectedEmrBillingOptionId === 'function';

const selectedBillingOptionId = (module: EnrollmentModule): number | null =>
  supportsPrepaid(module)
    ? (module.getSelectedEmrBillingOptionId() ?? null)
    : null;

const findBillingOption = (
  module: EnrollmentModule,
  id: number | null,
): any | null =>
  id == null
    ? null
    : ((module.plan?.billing_options ?? []).find(
        (option: any) => option.id === id && option.is_active !== false,
      ) ?? null);

const quoteIsLive = (quote: any): boolean =>
  Boolean(quote && Number(quote.expires_at) > Date.now() / 1000);

// Prepaid amounts come from the quote. Until it arrives, the plan card's price stands in and payment waits. The base
// price leaves out the medication, so the summary would jump when the quote lands.
const prepaidAmounts = (
  module: EnrollmentModule,
  purchase: BillingPurchase | null,
) => {
  const option = findBillingOption(module, selectedBillingOptionId(module));
  if (!option) return null;
  const quote = purchase?.quote ?? null;
  if (quote) {
    const subtotal = Number(quote.subtotal_cents ?? 0) / 100;
    const discount = Number(quote.discount_cents ?? 0) / 100;
    return {
      option,
      quote,
      subtotal,
      discount,
      total: Number(quote.net_cents ?? (subtotal - discount) * 100) / 100,
      couponCode: String(quote.terms?.coupon_code || ''),
    };
  }
  const choice = (module.getEmrBillingChoices?.() ?? []).find(
    (candidate: any) => candidate.billingOptionId === option.id,
  );
  const subtotal =
    choice?.price != null
      ? Number(choice.price) || 0
      : Number(option.base_price_cents ?? 0) / 100;
  return {
    option,
    quote: null,
    subtotal,
    discount: 0,
    total: subtotal,
    couponCode: '',
  };
};

const checkoutPricing = (
  module: EnrollmentModule,
  purchase: BillingPurchase | null = null,
): {
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string;
} => {
  const prepaid = prepaidAmounts(module, purchase);
  if (prepaid) {
    const { subtotal, discount, total, couponCode } = prepaid;
    return { subtotal, discount, total, couponCode };
  }
  const selection = dataObject(module.getEmrCheckoutSelectionState?.());
  const coupon = dataObject(module.getCheckoutCouponData?.());
  const subtotal = Math.max(
    0,
    Number(
      selection.total ??
        module.calculateEmrVariantTotal?.() ??
        coupon.subtotal ??
        0,
    ),
  );
  const discount = coupon.couponCode
    ? Math.min(subtotal, Math.max(0, Number(coupon.discountAmount ?? 0)))
    : 0;

  return {
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    couponCode: String(coupon.couponCode || ''),
  };
};

// Any write that changes pricing or the patient email makes an applied coupon stale.
const invalidateCoupon = (module: EnrollmentModule): void => {
  if (dataObject(module.getCheckoutCouponData?.()).couponCode) {
    module.setCheckoutCouponData?.(null);
  }
};

const stableCheckoutValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableCheckoutValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableCheckoutValue(entry)]),
    );
  return value;
};

const checkoutState = (
  module: EnrollmentModule,
  purchase: BillingPurchase | null = null,
) => {
  const selection = module.getEmrCheckoutSelectionState?.();
  const draft = module.getCheckoutData?.();
  const prepaid = prepaidAmounts(module, purchase);
  const chargeMode: string =
    prepaid?.quote?.terms?.charge_mode ??
    module.getChargeMode?.() ??
    'save_only';
  const subtotal =
    prepaid?.subtotal ??
    selection?.total ??
    module.calculateEmrVariantTotal?.() ??
    module.calculateEmrTotal?.() ??
    0;
  const total = prepaid?.total ?? draft?.total ?? subtotal;
  // The prepaid keys stay undefined for per-refill billing, which JSON drops, so that signature is unchanged.
  const signature = JSON.stringify(
    stableCheckoutValue({
      merchant: module.merchant?.id,
      plan: module.slug,
      patient: module.getStoredPatient?.()?.id,
      variant: selection?.variantId,
      drugs: selection?.drugSelection,
      chargeMode,
      subtotal,
      total,
      coupon: prepaid ? prepaid.couponCode || null : draft?.couponCode || null,
      billingOption: prepaid?.option.id,
      billingCheckout: prepaid ? (purchase?.checkout_uuid ?? null) : undefined,
      quote: prepaid ? (prepaid.quote?.hash ?? null) : undefined,
    }),
  );

  return {
    selection,
    draft,
    chargeMode,
    subtotal,
    discount: prepaid?.discount ?? 0,
    total,
    signature,
    billingOptionId: prepaid ? (prepaid.option.id as number) : null,
    quote: prepaid?.quote ?? null,
    // A prepaid hold covers the quoted net amount; a per-refill hold covers the full subtotal.
    displayAmount:
      chargeMode === 'save_and_authorize' && !prepaid ? subtotal : total,
  };
};

const getAuthToken = (module: EnrollmentModule | undefined): string | null =>
  module?.isEmr && module.isTokenValidated?.()
    ? (module.getPatientAuthToken?.() ?? null)
    : null;

const isPaymentComplete = (
  answer: unknown,
  module?: EnrollmentModule,
  purchase: BillingPurchase | null = null,
): boolean => {
  const value = dataObject(answer);
  if (!value.complete) return false;
  if (!module) return true;
  if (!getAuthToken(module)) return false;
  const checkout = checkoutState(module, purchase);
  // A prepaid payment stays valid only while its quote is live and the draft carries it as accepted.
  if (
    checkout.billingOptionId != null &&
    (!quoteIsLive(checkout.quote) || !checkout.draft?.billingTermsAccepted)
  )
    return false;

  return (
    Boolean(checkout.draft?.stripePaymentMethodId) &&
    value.paymentMethodId === checkout.draft?.stripePaymentMethodId &&
    value.checkoutSignature === checkout.signature
  );
};

const checkoutError = (
  module: EnrollmentModule,
  copy: Copy,
  prepaid: PrepaidState = { purchase: null },
): string | null => {
  if (!getAuthToken(module)) return copy.verificationRequiredMessage;
  const patient = module.getCheckoutPatientInfo?.();
  const address = module.getCheckoutAddress?.()?.address;
  if (
    !patient?.first_name?.trim() ||
    !patient.last_name?.trim() ||
    !patient.email?.trim() ||
    !address?.line1?.trim() ||
    !address.city?.trim() ||
    !address.state ||
    !address.zip?.trim()
  )
    return copy.incompleteDetailsMessage;
  if (!module.isValidPatientEmail(patient.email))
    return copy.invalidEmailMessage;
  const eligibility = module.validateAddressStateForEmrPlan(address);
  if (!eligibility.valid)
    return eligibility.error || copy.ineligibleStateMessage;
  if (
    selectedBillingOptionId(module) != null &&
    !quoteIsLive(prepaid.purchase?.quote)
  )
    return copy.quoteRequiredMessage;

  return null;
};

// The draft carries the accepted quote for a prepaid plan and no billing fields for per-refill billing.
const billingDraft = (
  module: EnrollmentModule,
  checkout: ReturnType<typeof checkoutState>,
  purchase: BillingPurchase | null,
): Record<string, unknown> => {
  if (!supportsPrepaid(module)) return {};
  if (checkout.billingOptionId == null || !purchase)
    return {
      billingOptionId: undefined,
      billingCheckoutUuid: undefined,
      billingQuote: undefined,
      billingTermsAccepted: false,
    };

  return {
    billingOptionId: checkout.billingOptionId,
    billingCheckoutUuid: purchase.checkout_uuid,
    billingQuote: purchase.quote,
    billingTermsAccepted: true,
    // The module drops the quote when the draft coupon differs from the quoted one.
    couponCode: purchase.quote.terms?.coupon_code ?? undefined,
    appliedCoupon: null,
    subtotal: checkout.subtotal,
    discountAmount: checkout.discount,
    finalTotal: checkout.total,
  };
};

const completePayment = (
  module: EnrollmentModule,
  copy: Copy,
  signature: string,
  prepaid: PrepaidState,
  paymentMethodId: string,
  paymentIntentId?: string,
): Record<string, unknown> => {
  const checkout = checkoutState(module, prepaid.purchase);
  if (checkout.signature !== signature)
    throw new Error(copy.selectionChangedMessage);
  const error = checkoutError(module, copy, prepaid);
  if (error) throw new Error(error);
  if (!checkout.draft) throw new Error(copy.incompleteDetailsMessage);
  module.setCheckoutData({
    ...checkout.draft,
    ...billingDraft(module, checkout, prepaid.purchase),
    chargeMode: checkout.chargeMode,
    emrVariantId: checkout.selection?.variantId ?? undefined,
    emrDrugSelection: checkout.selection?.drugSelection,
    patientVitalId: module.getVitalId() ?? undefined,
    stripePaymentMethodId: paymentMethodId,
    stripePaymentIntentId: paymentIntentId,
    total: checkout.total,
  });
  module.setCheckoutPaymentData({
    stripePaymentMethodId: paymentMethodId,
    stripePaymentIntentId: paymentIntentId,
    total: checkout.total,
  });

  return {
    complete: true,
    checkoutSignature: checkout.signature,
    paymentMethodId,
  };
};

interface PlanChoice {
  key: string;
  variantId: string;
  billingOptionId: number | null;
  name: string;
  amount: number;
  displayPrice: number;
  suffix: string;
  billingLabel: string;
  savings: number;
  savingsLabel: string;
  recommended: boolean;
}

const choiceKey = (variantId: string, billingOptionId: number | null) =>
  billingOptionId == null
    ? `per_refill:${variantId}`
    : `prepaid:${billingOptionId}`;

// Per-unit add-ons for the chosen medications, as the platform adds them to a variant that has its own price.
const medicationAddOnPerUnit = (module: EnrollmentModule): number => {
  const addOn = (drug: any, phaseId: string | null): number =>
    typeof module.getDrugAddOnPrice === 'function'
      ? Number(module.getDrugAddOnPrice(drug, phaseId)) || 0
      : getAddOnUnitPrice(drug, phaseId);
  let total = 0;
  for (const group of module.getDrugGroups?.() ?? []) {
    const selectedIds: number[] = module.getDrugGroupSelection(group.id) ?? [];
    for (const drug of group.drugs ?? []) {
      if (selectedIds.includes(drug.id))
        total += addOn(drug, module.getGroupDrugPhase(group.id, drug.id));
    }
  }
  for (const drug of module.getStandaloneDrugs?.() ?? []) {
    const phaseId = module.getStandaloneDrugPhase(drug.id);
    const phase = phaseId
      ? (drug.phases ?? []).find((candidate: any) => candidate.id === phaseId)
      : null;
    if (phase?.add_on_price != null) total += Number(phase.add_on_price) || 0;
  }
  return total;
};

// Every purchase choice for the plan: per-refill variants plus, with the EMR utils, prepaid billing options.
const planChoices = (
  module: EnrollmentModule,
  copy: Copy,
  purchase: BillingPurchase | null,
): PlanChoice[] => {
  const prepaidAllowed = supportsPrepaid(module);
  const variantPrice = (variant: any): number =>
    module.getVariantPrice?.(variant) ??
    Number(variant.price ?? variant.calculated_price ?? 0);
  const raw: any[] =
    typeof module.getEmrBillingChoices === 'function'
      ? module.getEmrBillingChoices()
      : (module.getVariants?.() ?? []).map((variant: any) => ({
          key: choiceKey(variant.id, null),
          variantId: variant.id,
          billingOptionId: null,
          label: variant.name || module.getVariantLabel?.(variant) || '',
          price: variantPrice(variant),
          supplyCount: 1,
          isDefault: false,
          variant,
        }));
  const choices = raw.filter(
    (choice) => choice.billingOptionId == null || prepaidAllowed,
  );
  const addOnPerUnit = medicationAddOnPerUnit(module);
  const options: any[] = module.plan?.billing_options ?? [];
  const selectedKey = choiceKey(
    module.getSelectedEmrVariantId?.() ?? '',
    selectedBillingOptionId(module),
  );
  const quote = purchase?.quote ?? null;

  const days = (choice: any): number =>
    Number(choice.variant?.default_refill_cycle_days ?? 0) *
    Math.max(1, Number(choice.supplyCount ?? 1));
  const months = (choice: any): number =>
    days(choice) > 0 && days(choice) % 30 === 0 ? days(choice) / 30 : 0;
  const amount = (choice: any): number => {
    if (choice.billingOptionId != null)
      return choice.key === selectedKey && quote
        ? Number(quote.subtotal_cents ?? 0) / 100
        : Number(choice.price) || 0;
    const variant = choice.variant;
    const price = Number(choice.price) || 0;
    // The EMR utils price a per-refill choice with the whole selection once medications are chosen; only a bare variant price still needs the add-ons.
    if (variant?.price == null || price !== variantPrice(variant)) return price;
    const bundle = Math.max(
      1,
      Number(variant.default_dispense_bundle_size ?? 1),
    );
    return price + addOnPerUnit * bundle;
  };
  // Savings compare the choices' own prices, which count medication add-ons the same way for every plan.
  const listPrice = (choice: any): number => Number(choice.price) || 0;
  const monthlyBaseline = Math.max(
    0,
    ...choices
      .filter((choice) => choice.billingOptionId == null && months(choice) > 0)
      .map((choice) => listPrice(choice) / months(choice)),
  );
  const hasDefault = choices.some((choice) => choice.isDefault);

  return choices.map((choice) => {
    const prepaid = choice.billingOptionId != null;
    const duration = months(choice);
    const total = amount(choice);
    const monthlyPrice = duration ? total / duration : total;
    const savings = duration
      ? Math.max(0, monthlyBaseline - listPrice(choice) / duration)
      : 0;
    const option = prepaid
      ? options.find((candidate) => candidate.id === choice.billingOptionId)
      : null;
    const renews =
      !prepaid ||
      (option?.effective_renewal_policy ?? option?.renewal_policy) ===
        'auto_renew';
    const tokens = {
      amount: formatMoney(total),
      months: duration,
      days: days(choice),
    };
    const billingLabel = !days(choice)
      ? ''
      : renews
        ? duration === 1
          ? fill(copy.billedMonthlyTemplate, tokens)
          : duration
            ? fill(copy.billedEveryTemplate, tokens)
            : fill(copy.billedEveryDaysTemplate, tokens)
        : fill(
            duration ? copy.prepaidOnceTemplate : copy.prepaidOnceDaysTemplate,
            tokens,
          );

    return {
      key: choice.key,
      variantId: choice.variantId,
      billingOptionId: choice.billingOptionId ?? null,
      name: choice.label || module.getVariantLabel?.(choice.variant) || '',
      amount: total,
      displayPrice: monthlyPrice,
      suffix: duration
        ? copy.perMonthSuffix
        : prepaid
          ? ''
          : copy.perDeliverySuffix,
      billingLabel,
      savings,
      savingsLabel:
        savings > 0
          ? fill(copy.savingsTemplate, { amount: formatMoney(savings) })
          : '',
      // A default billing option wins; otherwise the default variant's per-refill choice is recommended.
      recommended: hasDefault
        ? Boolean(choice.isDefault)
        : !prepaid && Boolean(choice.variant?.is_default),
    };
  });
};

// Profile fields first, then any non-empty checkout draft values on top.
const patientContact = (module: EnrollmentModule): Record<string, string> => {
  const profile = dataObject(
    module.getReferencePatient?.() || module.getStoredPatient?.(),
  );
  const draft = dataObject(module.getCheckoutPatientInfo?.());
  const contact: Record<string, string> = {
    first_name: String(profile.firstName ?? profile.first_name ?? ''),
    last_name: String(profile.lastName ?? profile.last_name ?? ''),
    email: String(profile.email ?? ''),
    phone: String(profile.phone ?? ''),
  };
  for (const key of Object.keys(contact)) {
    if (hasText(draft[key])) contact[key] = draft[key];
  }

  return contact;
};

// The stored login record can lack the phone, so a missing phone also sends the block to the patient's profile.
const hasPatientContact = (
  info: Record<string, any> | null | undefined,
): boolean =>
  hasText(info?.first_name) &&
  hasText(info?.last_name) &&
  hasText(info?.email) &&
  hasText(info?.phone);

interface AddressDraft {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const toAddressDraft = (address: any): AddressDraft => ({
  line1: String(address?.line1 ?? ''),
  line2: String(address?.line2 ?? ''),
  city: String(address?.city ?? ''),
  state: String(address?.state ?? ''),
  zip: String(address?.zip ?? ''),
  country: String(address?.country || 'US'),
});

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
const neutralVars = (text: string): React.CSSProperties => {
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

const ink = 'var(--color-gray-900)';
const softShadow = (shape: string, alpha: number): React.CSSProperties => ({
  boxShadow: `${shape} ${withAlpha(ink, alpha)}`,
});

const cardClass = 'rounded-[20px] bg-white p-4';
const cardStyle = softShadow('0 1px 3px', 0.04);
const headingClass = 'font-normal tracking-[-0.02em] text-gray-900';
// Figma's type scale for the numbered step titles and the medication name (card and order summary).
const stepTitleClass = 'text-2xl leading-[28px] tracking-[-0.04em]';
// Long drug names wrap onto even lines rather than leaving the dose alone on the second.
const medicationNameClass =
  'text-balance text-base leading-5 font-medium tracking-[-0.01em] text-gray-900';
const labelClass = 'block text-sm';
const labelTone: React.CSSProperties = { color: 'var(--checkout-text-label)' };
const secondaryTone: React.CSSProperties = {
  color: 'var(--checkout-text-secondary)',
};
const stepTitle = (step: number, title: string) => `${step}. ${title}`;
const inputClass =
  'h-12 w-full min-w-0 rounded-xl border bg-white px-4 text-base text-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const darkButtonClass =
  'flex h-14 w-full items-center justify-center gap-3 rounded-full px-6 text-lg font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60';
const darkButtonStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(180deg, ${mix(ink, 0.91, 'white')}, ${mix(ink, 0.79, 'black')})`,
  ...softShadow('0 4px 12px', 0.12),
};
const tileStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-gray-100)',
};
const optionRadius: React.CSSProperties = { borderRadius: 14 };

// HSL saturation under 0.15 reads as grey, like the secondaries of most built-in themes.
// Colour values stay out of this comment because the portal validator flags any hex literal.
const isNeutral = (color: string): boolean => {
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
interface Brand {
  primary: string;
  gradient: string;
  tint: string;
  text: string;
}

const makeBrand = (primary: string, secondary: string): Brand => {
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

// A 1px gradient border around an opaque fill, with an optional tint layered on top.
const gradientBorder = (
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

const GradientText: React.FC<{
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

const AccentDot: React.FC<{
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

const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}> = ({ children, onClick, disabled, busy }) => (
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
  </button>
);

// Pixel sizes go inline because the public form's CSS has no size-20 or size-24.
const TILE_SIZES = { lg: 96, md: 80, sm: 40 } as const;

const MediaTile: React.FC<{
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

const DetailTable: React.FC<{ rows: [string, string][] }> = ({ rows }) => {
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

const DrawerToggle: React.FC<{
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
const RadioMark: React.FC<{ selected: boolean; brand: Brand }> = ({
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

const ChoiceRow: React.FC<{
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

const InlineMessage: React.FC<{
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

// ============================================================================
// Renderer
// ============================================================================

interface MedicationItem {
  key: string;
  group: any | null;
  drug: any;
  phaseId: string | null;
  // False for an optional group with nothing chosen yet: the card offers its drugs but nothing is ordered.
  selected: boolean;
}

const SinglePageCheckoutRenderer = forwardRef<
  HTMLDivElement,
  BlockRendererProps
>(({ block, value, onChange, error, disabled, theme: themeProp }, ref) => {
  const survey = useSurveyForm();
  // The EMR enrollment utils (block preview and EMR enrollment) add prepaid quotes and the preferred-drug lookup.
  // Public form links still pass only the older enrollment module.
  const utils = survey.customData?.emrEnrollmentUtils as
    | EnrollmentModule
    | undefined;
  const module = (utils ?? survey.customData?.enrollmentModule) as
    | EnrollmentModule
    | undefined;
  const theme = themeProp ?? survey.theme ?? themes.default;
  const primary = theme.colors?.primary || themes.default.colors.primary;
  const textColor = theme.colors?.text || themes.default.colors.text;
  const brand = makeBrand(primary, theme.colors?.secondary || primary);
  const copy = readCopy(block);
  const benefits = readBenefits(block);
  // The payment disclaimer leads the lines under Complete My Order; each form can add its own after it.
  const footnotes = [copy.paymentDisclaimer, ...readDisclaimers(block)].filter(
    hasText,
  );
  const showImages = block.showDrugImages ?? true;
  const showDoseOptions = block.showTitrationOptions ?? true;
  const fieldName = block.fieldName || BLOCK_TYPE;
  const isEmr = Boolean(module?.isEmr);
  const authToken = getAuthToken(module);

  const [, setRenderKey] = useState(0);
  const refresh = useCallback(() => setRenderKey((key) => key + 1), []);

  // Layout: measure the form container because it is narrower than the viewport.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  // On phones the design runs edge to edge with 16px margins, so the block widens over the host's side padding.
  const [edge, setEdge] = useState(0);
  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof window === 'undefined') return;
    const query = window.matchMedia?.(WIDE_VIEWPORT_QUERY);
    const measure = () => {
      // The parent's box ignores the block's own negative margins, so measuring it never feeds back.
      const container = (
        element.parentElement ?? element
      ).getBoundingClientRect();
      const nextWide =
        Boolean(query?.matches) && container.width >= WIDE_BLOCK_MIN_WIDTH;
      const gapLeft = container.left;
      const gapRight = document.documentElement.clientWidth - container.right;
      // Only widen when the block is centred in plain page padding, never inside a side pane such as builder Preview.
      const centred =
        gapLeft > 0 &&
        gapLeft <= MAX_EDGE_BLEED &&
        Math.abs(gapLeft - gapRight) <= 2;
      setWide(nextWide);
      setEdge(!nextWide && centred ? Math.round(gapLeft) : 0);
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    query?.addEventListener?.('change', measure);
    // A host that slides in (the portal's Preview sheet) moves the block without resizing it, so measure again once it settles.
    const settle = (event: Event) => {
      if (event.target instanceof Node && event.target.contains(element)) {
        measure();
      }
    };
    document.addEventListener('animationend', settle, true);
    document.addEventListener('transitionend', settle, true);
    return () => {
      observer?.disconnect();
      query?.removeEventListener?.('change', measure);
      document.removeEventListener('animationend', settle, true);
      document.removeEventListener('transitionend', settle, true);
    };
  }, []);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const couponBusyRef = useRef(false);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const [submitStalled, setSubmitStalled] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const busy = useRef(false);
  const pendingPayment = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const checkoutRef = useRef<HTMLElement | null>(null);
  const valueRef = useRef<unknown>(value);
  valueRef.current = value;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Prepaid plans: the quote stays in component state and reaches the checkout draft only with the payment, because
  // the module tracks every draft write as a checkout start.
  const prepaidEnabled = isEmr && supportsPrepaid(module);
  const [quoted, setQuoted] = useState<BillingPurchase | null>(() => {
    const draft = prepaidEnabled ? module?.getCheckoutData?.() : null;
    return draft?.billingCheckoutUuid && draft.billingQuote
      ? { checkout_uuid: draft.billingCheckoutUuid, quote: draft.billingQuote }
      : null;
  });
  const purchaseRef = useRef(quoted);
  const [prepaidCoupon, setPrepaidCoupon] = useState(() => {
    const draft = prepaidEnabled ? module?.getCheckoutData?.() : null;
    return draft?.billingQuote ? String(draft.couponCode ?? '') : '';
  });
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const billingOptionId = prepaidEnabled
    ? selectedBillingOptionId(module)
    : null;
  const quoteSelection = prepaidEnabled
    ? module.getEmrCheckoutSelectionState?.()
    : null;
  const quoteContext = JSON.stringify({
    plan: module?.plan?.id ?? null,
    variant: quoteSelection?.variantId ?? null,
    drugs: quoteSelection?.drugSelection ?? null,
    option: billingOptionId,
    coupon: prepaidCoupon,
  });
  // The context of the last accepted quote: a quote counts only while the selection still matches it.
  const quoteContextRef = useRef(quoteContext);
  const purchase =
    quoted && quoteContextRef.current === quoteContext ? quoted : null;
  const prepaid: PrepaidState = { purchase };

  const paymentComplete = isPaymentComplete(value, module, purchase);
  // A coupon request in flight changes the price, so it blocks payment and selection like a pending payment.
  const locked =
    pending || couponBusy || survey.isSubmitting || Boolean(disabled);
  // After payment, price-affecting choices freeze so the saved card or hold always matches the submitted order.
  const selectionLocked = locked || paymentComplete;

  const emit = useCallback(
    (next: Record<string, unknown>) => {
      valueRef.current = next;
      onChange?.(next);
    },
    [onChange],
  );

  // Counts the patient's own selection changes, so a late medication recommendation never overrides them.
  const manualChanges = useRef(0);

  // Every selection change invalidates any applied coupon and clears the last order error, which was about the old
  // selection, then re-renders from module state.
  const update = (write: () => void, unchanged = false) => {
    if (!module || selectionLocked || unchanged) return;
    manualChanges.current += 1;
    write();
    invalidateCoupon(module);
    setPrepaidCoupon('');
    setActionError('');
    refresh();
  };

  // Quote the selected prepaid plan for the current medications and coupon, releasing the previous checkout first.
  const quoteVariantId: string | null = quoteSelection?.variantId ?? null;
  useEffect(() => {
    if (!module || !prepaidEnabled) return;
    if (billingOptionId == null) {
      const stale = purchaseRef.current;
      purchaseRef.current = null;
      if (stale && authToken)
        module
          .cancelBillingCheckout(authToken, stale.checkout_uuid)
          .catch(() => {});
      setQuoted(null);
      setQuoteError('');
      setQuoteBusy(false);
      return;
    }
    if (!authToken || !module.merchant?.id || !quoteVariantId) return;
    let cancelled = false;
    const controller = new AbortController();
    const changed =
      quoteContextRef.current !== quoteContext || quoteRefresh > 0;
    setQuoteBusy(true);
    setQuoteError('');
    const previous = purchaseRef.current;
    const release =
      changed && previous
        ? module
            .cancelBillingCheckout(authToken, previous.checkout_uuid)
            .then(() => {
              // The released checkout is never reused, even if this request is superseded.
              if (purchaseRef.current === previous) purchaseRef.current = null;
              setQuoted((shown) => (shown === previous ? null : shown));
            })
        : Promise.resolve();
    release
      .then(() =>
        module.quoteBillingOption(
          authToken,
          prepaidCoupon || null,
          controller.signal,
        ),
      )
      .then((next: BillingPurchase) => {
        if (cancelled) return;
        const current = purchaseRef.current;
        // An unchanged quote keeps its checkout, so a completed payment stays valid.
        const keep =
          !changed &&
          current !== null &&
          current.quote?.hash === next.quote?.hash &&
          quoteIsLive(current.quote);
        purchaseRef.current = keep ? current : next;
        quoteContextRef.current = quoteContext;
        setQuoted(purchaseRef.current);
      })
      .catch((caught: unknown) => {
        if (
          cancelled ||
          (caught instanceof Error && caught.name === 'AbortError')
        )
          return;
        const message = caught instanceof Error ? caught.message : '';
        setQuoted(null);
        // A rejected coupon moves to the coupon field and the plan is quoted again without it.
        if (prepaidCoupon) {
          setCouponError(message);
          setPrepaidCoupon('');
        } else {
          setQuoteError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteBusy(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    module,
    prepaidEnabled,
    billingOptionId,
    authToken,
    quoteVariantId,
    quoteContext,
    quoteRefresh,
    prepaidCoupon,
  ]);

  // Preferred medication: resolved from the intake answers after a short pause, and applied only when the patient
  // has not changed the selection while it loaded.
  const [preferred, setPreferred] = useState<{
    status: 'idle' | 'loading' | 'applied' | 'kept' | 'none' | 'unavailable';
    drugs: string;
  }>({ status: 'idle', drugs: '' });
  const preferredKey =
    utils && typeof utils.buildPreferredDrugFormResponses === 'function'
      ? JSON.stringify(utils.buildPreferredDrugFormResponses() ?? [])
      : '[]';
  const preferredVariantId: string | null =
    utils?.getSelectedEmrVariantId?.() ?? null;
  useEffect(() => {
    if (
      !utils ||
      disabled ||
      paymentComplete ||
      preferredKey === '[]' ||
      typeof utils.resolvePreferredDrugs !== 'function'
    )
      return;
    let cancelled = false;
    const changesAtStart = manualChanges.current;
    const timer = window.setTimeout(async () => {
      setPreferred({ status: 'loading', drugs: '' });
      try {
        const resolution = await utils.resolvePreferredDrugs();
        if (cancelled) return;
        const applied: any[] =
          manualChanges.current === changesAtStart
            ? (utils.applyPreferredDrugResolution() ?? [])
            : [];
        const drugs = [
          ...new Set(
            applied.map(
              (item) =>
                `${item.drugName}${item.phaseLabel ? ` (${item.phaseLabel})` : ''}`,
            ),
          ),
        ].join(', ');
        const found = (resolution?.form_results ?? []).some(
          (result: any) => result?.preferred_drugs?.length > 0,
        );
        setPreferred({
          status: applied.length ? 'applied' : found ? 'kept' : 'none',
          drugs,
        });
        if (applied.length) {
          invalidateCoupon(utils);
          setPrepaidCoupon('');
          refresh();
        }
      } catch {
        if (!cancelled) setPreferred({ status: 'unavailable', drugs: '' });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    utils,
    preferredKey,
    preferredVariantId,
    disabled,
    paymentComplete,
    refresh,
  ]);

  // Default selections: keep anything chosen earlier in the intake.
  useEffect(() => {
    if (!isEmr || !module) return;
    let changed = false;
    const variants: any[] = module.getVariants?.() ?? [];
    if (variants.length > 0 && !module.getSelectedEmrVariantId?.()) {
      module.setSelectedEmrVariantId(
        module.getDefaultVariant?.()?.id ?? variants[0].id,
      );
      changed = true;
    }
    for (const group of module.getDrugGroups?.() ?? []) {
      if (
        !group.is_required ||
        !group.drugs?.length ||
        module.getDrugGroupSelection(group.id)?.length
      )
        continue;
      const defaultDrug =
        group.drugs.find((drug: any) => drug.is_default_option) ??
        group.drugs[0];
      module.setDrugGroupSelection(group.id, [defaultDrug.id]);
      changed = true;
    }
    if (changed) {
      invalidateCoupon(module);
      refresh();
    }
  }, [isEmr, module, refresh]);

  // Patient contact: only for a verified session, and never read from survey values.
  const syncPatientInfo = useCallback(
    (profile?: unknown) => {
      if (!module || !getAuthToken(module)) return;
      const current = dataObject(module.getCheckoutPatientInfo?.());
      if (hasPatientContact(current)) return;
      const next = patientContact(module);
      const fetched = dataObject(profile);
      for (const key of ['first_name', 'last_name', 'email', 'phone']) {
        if (!hasText(next[key]) && hasText(fetched[key]))
          next[key] = fetched[key];
      }
      if (!Object.values(next).some(hasText)) return;
      if (Object.keys(next).every((key) => (current[key] ?? '') === next[key]))
        return;
      if ((current.email ?? '') !== next.email) invalidateCoupon(module);
      module.setCheckoutPatientInfo(next);
      refresh();
    },
    [module, refresh],
  );
  useEffect(() => {
    if (!module || !authToken) return;
    syncPatientInfo();
    if (
      hasPatientContact(module.getCheckoutPatientInfo?.()) ||
      typeof module.fetchPatientInfo !== 'function'
    )
      return;
    let active = true;
    module
      .fetchPatientInfo(authToken)
      .then((patient: unknown) => {
        if (active) syncPatientInfo(patient);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [module, authToken, syncPatientInfo]);

  // Saved addresses: fetched for the verified token owner only; stale responses are dropped.
  const [addressResource, setAddressResource] = useState<{
    owner: string | null;
    items: any[];
    loading: boolean;
  }>({
    owner: null,
    items: [],
    loading: false,
  });
  useEffect(() => {
    let active = true;
    if (!authToken || typeof module?.fetchPatientAddresses !== 'function') {
      setAddressResource({ owner: null, items: [], loading: false });
      return;
    }
    setAddressResource({ owner: authToken, items: [], loading: true });
    module
      .fetchPatientAddresses(authToken)
      .then((items: unknown) => {
        if (active)
          setAddressResource({
            owner: authToken,
            items: Array.isArray(items) ? items : [],
            loading: false,
          });
      })
      .catch(() => {
        if (active)
          setAddressResource({ owner: authToken, items: [], loading: false });
      });
    return () => {
      active = false;
    };
  }, [authToken, module]);
  const savedAddresses =
    addressResource.owner === authToken ? addressResource.items : [];
  const savedAddressesLoading =
    addressResource.owner === authToken && addressResource.loading;

  const [address, setAddress] = useState<AddressDraft>(() =>
    toAddressDraft(module?.getCheckoutAddress?.()?.address),
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    () => {
      const saved = module?.getCheckoutAddress?.();
      return saved?.useExistingAddress && saved.selectedAddressId != null
        ? String(saved.selectedAddressId)
        : null;
    },
  );
  const typedAddress = useRef(false);

  const chooseSavedAddress = useCallback(
    (saved: any) => {
      if (!module) return;
      syncPatientInfo();
      setAddress(toAddressDraft(saved));
      setSelectedAddressId(String(saved.id));
      module.setCheckoutAddress({ ...saved }, true, String(saved.id));
      refresh();
    },
    [module, refresh, syncPatientInfo],
  );

  // Prefill a saved address once, unless the patient already started typing. The platform's address fetch may already
  // have put the default one in the checkout draft, and the form must show the address the order ships to.
  useEffect(() => {
    if (
      !module ||
      typedAddress.current ||
      selectedAddressId ||
      savedAddresses.length === 0
    )
      return;
    const draft = module.getCheckoutAddress?.();
    const inDraft =
      draft?.useExistingAddress && draft.selectedAddressId != null
        ? savedAddresses.find(
            (saved: any) =>
              String(saved.id) === String(draft.selectedAddressId),
          )
        : undefined;
    if (
      !inDraft &&
      !draft?.useExistingAddress &&
      hasText(draft?.address?.line1)
    )
      return;
    chooseSavedAddress(
      inDraft ??
        savedAddresses.find((saved: any) => saved.is_default) ??
        savedAddresses[0],
    );
  }, [module, savedAddresses, selectedAddressId, chooseSavedAddress]);

  const editAddress = (field: keyof AddressDraft, next: string) => {
    if (!module || locked) return;
    typedAddress.current = true;
    syncPatientInfo();
    const draft = { ...address, [field]: next };
    setAddress(draft);
    setSelectedAddressId(null);
    // An edited address is a new address: never send the saved address id with it.
    module.setCheckoutAddress(
      { ...draft, country: draft.country || 'US' },
      false,
    );
    refresh();
  };

  const chooseNewAddress = () => {
    if (!module || locked) return;
    typedAddress.current = true;
    const draft = toAddressDraft(null);
    setAddress(draft);
    setSelectedAddressId(null);
    module.setCheckoutAddress(draft, false);
    refresh();
  };

  // Payment state and the reset of a stale "complete" value.
  const checkout = isEmr && module ? checkoutState(module, purchase) : null;
  const paymentSignature = checkout?.signature ?? null;
  useEffect(() => {
    if (!module?.isEmr || !value || typeof value !== 'object') return;
    if (value.complete && !isPaymentComplete(value, module, purchase))
      emit({ complete: false });
  }, [value, module, purchase, paymentSignature, authToken, emit]);

  const submitSurvey = survey.submit as unknown as (
    values?: Record<string, unknown>,
  ) => Promise<void> | void;

  const enrollmentRecorded = (): boolean => {
    try {
      return module?.isEnrollmentCompleted?.() === true;
    } catch {
      return false;
    }
  };

  const finishOrder = async (result: unknown) => {
    if (!module || busy.current || survey.isSubmitting) return;
    if (enrollmentRecorded()) {
      setOrderSubmitted(true);
      return;
    }
    busy.current = true;
    setPending(true);
    setActionError('');
    setSubmitStalled(false);
    let submitted = false;
    try {
      const session = await module.validatePatientToken();
      if (session && (session.success === false || session.valid === false)) {
        throw new Error(
          session.error || session.message || copy.verificationRequiredMessage,
        );
      }
      // The verified session carries contact fields the stored login record can lack, such as the phone, and the
      // platform's profile fetch returns nothing for this API's response shape, so fill the gaps before sending.
      const verified = dataObject(session?.patient);
      syncPatientInfo({
        first_name: verified.firstName ?? verified.first_name,
        last_name: verified.lastName ?? verified.last_name,
        email: verified.email,
        phone: verified.phone,
      });
      const shipping = module.getCheckoutAddress?.()?.address;
      const eligibility = shipping
        ? module.validateAddressStateForEmrPlan(shipping)
        : { valid: false };
      if (!eligibility?.valid)
        throw new Error(eligibility?.error || copy.ineligibleStateMessage);
      // Core submit skips validateValue, so re-check the payment against the current selection right before sending.
      if (!isPaymentComplete(result, module, purchaseRef.current))
        throw new Error(copy.selectionChangedMessage);
      await submitSurvey({ ...survey.values, [fieldName]: result });
      submitted = true;
    } catch (caught) {
      if (mountedRef.current)
        setActionError(
          caught instanceof Error && caught.message
            ? caught.message
            : copy.submitErrorMessage,
        );
    } finally {
      busy.current = false;
      if (!submitted) {
        if (mountedRef.current) setPending(false);
      } else {
        // The host leaves the page after a successful enrollment. Keep the button busy while it does, then offer
        // a retry only when the module has no record of the enrollment.
        window.setTimeout(() => {
          if (!mountedRef.current) return;
          setPending(false);
          if (enrollmentRecorded()) setOrderSubmitted(true);
          else setSubmitStalled(true);
        }, 2000);
      }
    }
  };

  const completeOrder = () => {
    if (!module || locked || busy.current || orderSubmitted) return;
    setActionError('');
    if (isPaymentComplete(valueRef.current, module, purchaseRef.current)) {
      void finishOrder(valueRef.current);
      return;
    }
    if (billingOptionId != null && quoteBusy) {
      setActionError(copy.quoteLoadingMessage);
      return;
    }
    const problem = checkoutError(module, copy, prepaid);
    if (problem) {
      setActionError(problem);
      return;
    }
    const form = formRef.current;
    if (!form || form.dataset.ready !== 'true') {
      setActionError(copy.paymentLoadingMessage);
      return;
    }
    if (pendingPayment.current) return;
    pendingPayment.current = true;
    setPending(true);
    form.requestSubmit();
  };

  const applyCoupon = async () => {
    if (!module || selectionLocked) return;
    const code = couponInput.trim();
    if (!code) return;
    const email = patientContact(module).email.trim();
    if (!authToken || !email) {
      setCouponError(copy.couponEmailRequiredText);
      return;
    }
    // A prepaid coupon is priced by the server quote, which runs again with the code.
    if (billingOptionId != null) {
      setPrepaidCoupon(code.toUpperCase());
      setCouponInput('');
      setCouponError('');
      return;
    }
    couponBusyRef.current = true;
    setCouponBusy(true);
    setCouponError('');
    try {
      const plan = dataObject(module.plan);
      const subtotal = checkoutPricing(module).subtotal;
      // The EMR utils take (email, code, subtotal); the older module also needs the plan and drug context.
      const result = utils
        ? await module.applyCoupon(email, code, subtotal)
        : await module.applyCoupon(
            email,
            code,
            plan.id,
            undefined,
            undefined,
            subtotal,
            {
              emrTreatmentPlanId: plan.id,
              selectedMerchantDrugIds: module.getSelectedEmrMerchantDrugIds?.(),
            },
          );
      if (
        result &&
        (result.success === false ||
          result.valid === false ||
          result.isValid === false)
      ) {
        const details = Object.values(dataObject(result.errors))
          .flat()
          .join(' ');
        throw new Error(
          result.error || result.message || details || copy.couponInvalidText,
        );
      }
      setCouponInput('');
    } catch (caught) {
      setCouponError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.couponInvalidText,
      );
    } finally {
      couponBusyRef.current = false;
      setCouponBusy(false);
      refresh();
    }
  };

  const removeCoupon = () => {
    if (!module || selectionLocked) return;
    setPrepaidCoupon('');
    module.setCheckoutCouponData?.(null);
    setCouponError('');
    refresh();
  };

  const jumpToCheckout = () =>
    checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!module || !isEmr) {
    return (
      <div ref={setRootRef} className="w-full min-w-0">
        <InlineMessage>{copy.unavailableMessage}</InlineMessage>
      </div>
    );
  }

  // Module reads happen on every render: the module mutates internally and refresh() re-renders.
  const plan = dataObject(module.plan);
  const options = planChoices(module, copy, purchase);
  const selectedVariantId: string | null =
    module.getSelectedEmrVariantId?.() ??
    checkout?.selection?.variantId ??
    null;
  const selectedKey = choiceKey(selectedVariantId ?? '', billingOptionId);
  const selectedOption =
    options.find((option) => option.key === selectedKey) ?? null;
  const maxSavings = Math.max(0, ...options.map((option) => option.savings));
  const isPrepaid = billingOptionId != null;
  const quote = isPrepaid ? (purchase?.quote ?? null) : null;
  // Payment for a prepaid plan waits for a live quote. The disclaimer under Complete My Order is the agreement to its
  // terms, so the draft marks them accepted with the payment.
  const quoteReady =
    !isPrepaid || (quoteIsLive(quote) && !quoteBusy && !quoteError);
  const variant = checkout?.selection?.variant;
  const bundleSize = Math.max(
    1,
    Number(variant?.default_dispense_bundle_size ?? 1),
  );
  const customVariantPricing = variant?.price != null;
  const pricing = checkoutPricing(module, purchase);
  const contact = authToken ? patientContact(module) : null;
  // Earlier intake blocks normally collect these; ask here only for what the verified profile lacks.
  const profile = authToken
    ? dataObject(module.getReferencePatient?.() || module.getStoredPatient?.())
    : {};
  const contactFields = (
    [
      [
        'first_name',
        copy.firstNameLabel,
        'given-name',
        profile.firstName ?? profile.first_name,
      ],
      [
        'last_name',
        copy.lastNameLabel,
        'family-name',
        profile.lastName ?? profile.last_name,
      ],
      ['email', copy.emailLabel, 'email', profile.email],
    ] as const
  )
    .filter(([, , , known]) => authToken && !hasText(known))
    .map(([key, label, autoComplete]) => ({ key, label, autoComplete }));
  const editContact = (
    field: 'first_name' | 'last_name' | 'email',
    next: string,
  ) => {
    if (!module || selectionLocked) return;
    // Coupons are priced for an email, so a new email drops any applied code.
    if (field === 'email') invalidateCoupon(module);
    module.setCheckoutPatientInfo({ ...patientContact(module), [field]: next });
    refresh();
  };
  const firstName = contact?.first_name?.trim() ?? '';
  const planName = String(plan.name ?? '');
  const headerTitle = fill(
    firstName ? copy.headerTitle : copy.headerTitleFallback,
    { firstName, planName },
  ).trim();
  const benefitsTitle = fill(
    firstName ? copy.benefitsTitle : copy.benefitsTitleFallback,
    { firstName },
  );

  const medications: MedicationItem[] = [
    ...(module.getDrugGroups?.() ?? [])
      .filter((group: any) => group.drugs?.length)
      .map((group: any) => {
        const selectedIds: number[] =
          module.getDrugGroupSelection(group.id) ?? [];
        const selected = group.drugs.find((drug: any) =>
          selectedIds.includes(drug.id),
        );
        const drug =
          selected ??
          group.drugs.find((candidate: any) => candidate.is_default_option) ??
          group.drugs[0];
        return {
          key: `group-${group.id}`,
          group,
          drug,
          phaseId: selected
            ? module.getGroupDrugPhase(group.id, drug.id)
            : null,
          selected: Boolean(selected),
        };
      }),
    ...(module.getStandaloneDrugs?.() ?? []).map((drug: any) => ({
      key: `drug-${drug.id}`,
      group: null,
      drug,
      phaseId: module.getStandaloneDrugPhase(drug.id),
      selected: true,
    })),
  ];
  const ordered = medications.filter((item) => item.selected);
  const medicationTitle = (item: MedicationItem): string => {
    const phase = getSelectedPhase(item.drug, item.phaseId);
    return phase
      ? getPhaseDrugName(phase, item.drug)
      : item.drug?.drug_name || 'Medication';
  };

  const optionalDrugs: any[] = module.getOptionalDrugs?.() ?? [];
  const selectedOptional = optionalDrugs.filter((drug) =>
    module.isOptionalDrugSelected(drug.id),
  );
  const optionalTotal = selectedOptional.reduce(
    (sum, drug) => sum + module.getDrugPrice(drug) * bundleSize,
    0,
  );
  const eligibility = address.state
    ? module.validateAddressStateForEmrPlan({ ...address })
    : { valid: true };
  const Payment = module.StripePaymentForm;
  const hasCouponSupport = typeof module.applyCoupon === 'function';
  const dueNowAmount =
    checkout?.chargeMode === 'save_and_authorize' ? checkout.displayAmount : 0;

  const preferredMessage = {
    idle: '',
    loading: copy.preferredLoadingMessage,
    applied: fill(copy.preferredAppliedTemplate, { drug: preferred.drugs }),
    kept: copy.preferredKeptMessage,
    none: copy.preferredNoneMessage,
    unavailable: copy.preferredUnavailableMessage,
  }[preferred.status];

  const orderedName = ordered.map(medicationTitle).join(' + ');
  const firstOrdered = ordered[0];
  const firstPhase = firstOrdered
    ? getSelectedPhase(firstOrdered.drug, firstOrdered.phaseId)
    : null;
  const summaryChips = firstOrdered
    ? [
        capitalize(firstOrdered.drug?.dosage_form),
        capitalize(
          String(firstPhase?.frequency ?? firstOrdered.drug?.frequency ?? ''),
        ),
      ].filter(hasText)
    : [];
  const summaryRowClass = 'flex items-start justify-between gap-3 py-4';

  const discountField = hasCouponSupport ? (
    pricing.couponCode ? null : discountOpen ? (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={couponInput}
            onChange={(event) => {
              setCouponInput(event.target.value);
              setCouponError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void applyCoupon();
              }
            }}
            placeholder={copy.discountPlaceholder}
            aria-label={copy.discountPlaceholder}
            disabled={selectionLocked}
            autoFocus
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => void applyCoupon()}
            disabled={selectionLocked || !couponInput.trim()}
            className="h-12 shrink-0 rounded-full bg-white px-6 text-base font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            style={softShadow('0 2px 8px', 0.08)}
          >
            {couponBusy ? (
              <Loader2
                className="size-4 animate-spin"
                aria-label={copy.processingLabel}
              />
            ) : (
              copy.applyLabel
            )}
          </button>
        </div>
        {couponError ? (
          <p className="text-base text-red-700" role="alert">
            {couponError}
          </p>
        ) : null}
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setDiscountOpen(true)}
        disabled={selectionLocked}
        className="block w-full rounded-xl bg-white py-3 text-center text-base text-gray-600 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
        style={softShadow('0 2px 10px', 0.06)}
      >
        {copy.discountPlaceholder}
      </button>
    )
  ) : (
    <p className="flex items-center justify-center gap-2 py-1 text-base text-gray-600">
      <Tag className="size-4 shrink-0" aria-hidden="true" />
      {copy.couponUnavailableText}
    </p>
  );

  const orderSummary = (
    <div className="space-y-4">
      {discountField}

      {/* The medication row runs straight into the line items, without a divider. */}
      <div className="border-t border-gray-200">
        {firstOrdered ? (
          <div className="flex items-start gap-3 pt-4">
            {showImages ? (
              <MediaTile
                imageUrl={getPhaseImage(firstPhase, firstOrdered.drug)}
                label={orderedName}
                size="md"
                primary={primary}
              />
            ) : null}
            <div className="min-w-0 space-y-1">
              <p className={medicationNameClass}>{orderedName}</p>
              {selectedOption ? (
                <p className="text-base leading-5" style={secondaryTone}>
                  {fill(copy.summaryPlanTemplate, {
                    plan: selectedOption.name,
                  })}
                </p>
              ) : null}
              {summaryChips.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {/* Text only: the first chip is the dosage form, which isn't always an injection. */}
                  {summaryChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border bg-white px-2.5 py-1 text-xs leading-[14px] tracking-[-0.02em] text-gray-900"
                      style={{ borderColor: 'var(--color-gray-300)' }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <dl className="divide-y divide-gray-200">
          <div className={summaryRowClass}>
            <dt className="min-w-0">
              <span className="block text-balance text-base leading-5 text-gray-900">
                {orderedName || selectedOption?.name}
                {selectedOption && selectedOption.displayPrice > 0 ? (
                  <span>
                    {' ('}
                    {selectedOption.savings > 0 ? (
                      <s className="text-gray-600">
                        {formatMoney(
                          selectedOption.displayPrice + selectedOption.savings,
                        )}
                      </s>
                    ) : null}
                    {selectedOption.savings > 0 ? ' ' : null}
                    {formatMoney(selectedOption.displayPrice)}
                    {selectedOption.suffix})
                  </span>
                ) : null}
              </span>
              {selectedOption?.billingLabel ? (
                <span className="block text-sm text-gray-600">
                  {selectedOption.billingLabel}
                </span>
              ) : null}
            </dt>
            <dd className="shrink-0 text-base leading-5 text-gray-900">
              {/* A prepaid quote prices the whole order, add-ons included, so it is not split per line. */}
              {formatMoney(
                isPrepaid
                  ? pricing.subtotal
                  : Math.max(0, pricing.subtotal - optionalTotal),
                true,
              )}
            </dd>
          </div>
          {selectedOptional.map((drug) => (
            <div key={drug.id} className={summaryRowClass}>
              <dt className="flex min-w-0 items-start gap-3">
                {showImages ? (
                  <MediaTile
                    imageUrl={getPhaseImage(
                      getSelectedPhase(
                        drug,
                        module.getOptionalDrugPhase(drug.id),
                      ),
                      drug,
                    )}
                    label={drug.drug_name}
                    size="sm"
                    primary={primary}
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block text-base leading-5 text-gray-900">
                    {drug.drug_name}
                  </span>
                  <span className="block text-sm text-gray-600">
                    {copy.summaryAddOnLabel}
                  </span>
                </span>
              </dt>
              {isPrepaid ? null : (
                <dd className="shrink-0 text-base leading-5 text-gray-900">
                  {formatMoney(module.getDrugPrice(drug) * bundleSize, true)}
                </dd>
              )}
            </div>
          ))}
          {pricing.couponCode ? (
            <div className={summaryRowClass}>
              <dt className="flex min-w-0 flex-wrap items-center gap-x-2 text-base leading-5 text-gray-600">
                <span>
                  {fill(copy.discountLineTemplate, {
                    code: pricing.couponCode,
                  })}
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  disabled={selectionLocked}
                  className="inline-flex items-center gap-1 text-base text-gray-600 underline underline-offset-4 disabled:opacity-50"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  {copy.changeCouponLabel}
                </button>
              </dt>
              <dd
                className="shrink-0 text-base leading-5"
                style={{
                  color: theme.colors?.success || themes.default.colors.success,
                }}
              >
                - {formatMoney(pricing.discount, true)}
              </dd>
            </div>
          ) : null}
          {hasText(copy.shippingLineLabel) ? (
            <div className={summaryRowClass}>
              <dt className="text-base leading-5 text-gray-600">
                {copy.shippingLineLabel}
              </dt>
              <dd className="shrink-0 text-base leading-5 text-gray-900">
                {formatMoney(0)}
              </dd>
            </div>
          ) : null}
          <div className={summaryRowClass}>
            <dt className="text-base leading-5 font-bold" style={secondaryTone}>
              {checkout?.chargeMode === 'save_and_authorize'
                ? copy.authorizationHoldLabel
                : copy.dueNowLabel}
            </dt>
            <dd className="shrink-0 text-base leading-5 font-bold text-gray-900">
              {formatMoney(dueNowAmount)}
            </dd>
          </div>
        </dl>
      </div>

      <div
        className="flex items-center justify-between gap-3 rounded-2xl px-4 py-4"
        style={{ backgroundImage: brand.tint }}
      >
        <GradientText brand={brand} className="text-xl">
          {copy.totalIfPrescribedLabel}
        </GradientText>
        <GradientText brand={brand} className="text-xl">
          {formatMoney(pricing.total, true)}
        </GradientText>
      </div>
    </div>
  );

  const summaryBar = (
    <button
      type="button"
      onClick={() => setSummaryOpen((open) => !open)}
      aria-expanded={summaryOpen}
      aria-controls={`${fieldName}-order-summary`}
      className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
    >
      <span className="flex min-w-0 items-baseline gap-2 text-base leading-5">
        <span className="truncate font-medium text-gray-900">
          {copy.summaryToggleLabel}
        </span>
        <GradientText brand={brand} className="shrink-0">
          {formatMoney(pricing.total, true)}
        </GradientText>
      </span>
      <ChevronDown
        className={cn(
          'size-5 shrink-0 text-gray-600 transition-transform duration-200',
          summaryOpen && 'rotate-180',
        )}
        aria-hidden="true"
      />
    </button>
  );

  // The steps the shopper acts on are numbered: each medication card, then the plan, then the add-ons.
  const planStep = medications.length + 1;
  const medicationSection = medications.map((item, index) => {
    const phase = getSelectedPhase(item.drug, item.phaseId);
    const phases = getActivePhases(item.drug);
    const drugDrawer = `${item.key}:drug`;
    const doseDrawer = `${item.key}:dose`;
    const canSwitchDrug = Boolean(
      item.group && (item.group.drugs.length > 1 || !item.selected),
    );
    const canChangeDose = item.selected && showDoseOptions && phases.length > 0;
    // Drug names carry the starting dose, so the title follows the selected cycle to agree with the Dose row.
    const cardTitle = item.selected
      ? medicationTitle(item)
      : item.group?.name || copy.drugDrawerTitle;
    const cardImage = item.selected ? getPhaseImage(phase, item.drug) : null;
    const toggleDrawer = (id: string) =>
      setOpenDrawer((open) => (open === id ? null : id));
    const closeDrawer = () => setOpenDrawer(null);

    return (
      <div key={item.key} className={cardClass} style={cardStyle}>
        <div className="space-y-4 rounded-2xl bg-gray-50 p-4">
          <h3 className={cn(headingClass, stepTitleClass)}>
            {stepTitle(index + 1, copy.medicationTitle)}
          </h3>
          <div className="flex items-start gap-3">
            {/* Without a product photo the name takes the full width, so long drug names wrap less on phones. */}
            {showImages && cardImage ? (
              <MediaTile
                imageUrl={cardImage}
                label={cardTitle}
                primary={primary}
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <p className={medicationNameClass}>{cardTitle}</p>
              {item.selected ? (
                <DetailTable
                  rows={[
                    [
                      copy.medicationTypeLabel,
                      capitalize(item.drug?.dosage_form),
                    ],
                    [
                      copy.medicationDoseLabel,
                      String(phase?.strength ?? item.drug?.strength ?? ''),
                    ],
                    [
                      copy.medicationTakeLabel,
                      String(phase?.frequency ?? item.drug?.frequency ?? ''),
                    ],
                  ]}
                />
              ) : null}
            </div>
          </div>

          {canSwitchDrug || canChangeDose ? (
            <div className="space-y-2">
              {hasText(copy.medicationOptionsLabel) ? (
                <p className="text-center text-sm" style={secondaryTone}>
                  {copy.medicationOptionsLabel}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {canSwitchDrug ? (
                  <DrawerToggle
                    label={copy.seeOtherOptionsLabel}
                    open={openDrawer === drugDrawer}
                    onClick={() => toggleDrawer(drugDrawer)}
                    disabled={selectionLocked}
                    controls={`${fieldName}-${drugDrawer}`}
                  />
                ) : null}
                {canChangeDose ? (
                  <DrawerToggle
                    label={copy.changeDoseLabel}
                    open={openDrawer === doseDrawer}
                    onClick={() => toggleDrawer(doseDrawer)}
                    disabled={selectionLocked}
                    controls={`${fieldName}-${doseDrawer}`}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {openDrawer === drugDrawer && canSwitchDrug ? (
            <div
              id={`${fieldName}-${drugDrawer}`}
              className="space-y-2"
              role="radiogroup"
              aria-label={copy.drugDrawerTitle}
            >
              <p className="text-base font-medium text-gray-900">
                {copy.drugDrawerTitle}
              </p>
              {item.group.drugs.map((drug: any) => {
                const addOn = customVariantPricing
                  ? getAddOnUnitPrice(drug, null) * bundleSize
                  : 0;
                return (
                  <ChoiceRow
                    key={drug.id}
                    selected={item.selected && drug.id === item.drug.id}
                    onClick={() => {
                      update(
                        () =>
                          module.setDrugGroupSelection(item.group.id, [
                            drug.id,
                          ]),
                        item.selected && drug.id === item.drug.id,
                      );
                      closeDrawer();
                    }}
                    disabled={selectionLocked}
                    title={drug.drug_name}
                    detail={[capitalize(drug.dosage_form), drug.frequency]
                      .filter(hasText)
                      .join(' · ')}
                    aside={addOn > 0 ? `+${formatMoney(addOn)}` : undefined}
                    imageUrl={getDrugImage(drug)}
                    showImage={showImages}
                    brand={brand}
                    selectedLabel={copy.selectedLabel}
                  />
                );
              })}
            </div>
          ) : null}

          {openDrawer === doseDrawer && canChangeDose ? (
            <div
              id={`${fieldName}-${doseDrawer}`}
              className="space-y-2"
              role="radiogroup"
              aria-label={copy.doseDrawerTitle}
            >
              <p className="text-base font-medium text-gray-900">
                {copy.doseDrawerTitle}
              </p>
              {[null, ...phases].map((option: any) => {
                const phaseId: string | null = option?.id ?? null;
                const addOn =
                  customVariantPricing && option?.add_on_price != null
                    ? Number(option.add_on_price) * bundleSize
                    : 0;
                const writePhase = () =>
                  item.group
                    ? module.setGroupDrugPhase(
                        item.group.id,
                        item.drug.id,
                        phaseId,
                      )
                    : module.setStandaloneDrugPhase(item.drug.id, phaseId);
                return (
                  <ChoiceRow
                    key={phaseId ?? 'standard'}
                    selected={item.phaseId === phaseId}
                    onClick={() => {
                      update(writePhase, item.phaseId === phaseId);
                      closeDrawer();
                    }}
                    disabled={selectionLocked}
                    title={
                      option
                        ? phaseCycleLabel(copy, option)
                        : copy.standardDoseLabel
                    }
                    detail={[
                      option?.strength ?? (option ? '' : item.drug.strength),
                      option?.frequency ?? (option ? '' : item.drug.frequency),
                    ]
                      .filter(hasText)
                      .join(' · ')}
                    aside={addOn > 0 ? `+${formatMoney(addOn)}` : undefined}
                    imageUrl={
                      option
                        ? getPhaseImage(option, item.drug)
                        : getDrugImage(item.drug)
                    }
                    showImage={false}
                    brand={brand}
                    selectedLabel={copy.selectedLabel}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  });

  const planSection = (
    <div className={cn(cardClass, 'space-y-4')} style={cardStyle}>
      <div className="space-y-1">
        <h3 className={cn(headingClass, stepTitleClass)}>
          {stepTitle(planStep, copy.planTitle)}
        </h3>
        {hasText(copy.planSubtitle) ? (
          <p className="text-base text-gray-600">{copy.planSubtitle}</p>
        ) : null}
      </div>
      {options.length === 0 ? (
        <InlineMessage>{copy.emptyPlanMessage}</InlineMessage>
      ) : (
        <div
          className="space-y-2"
          role="radiogroup"
          aria-label={copy.planTitle}
        >
          {options.map((option) => {
            const selected = option.key === selectedKey;
            // Unselected savings bars are grey, darkest for the biggest saving.
            const ratio = maxSavings > 0 ? option.savings / maxSavings : 0;
            const showBar = option.savings > 0 || option.recommended;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  update(() => {
                    module.setSelectedEmrVariantId(option.variantId);
                    if (prepaidEnabled)
                      module.setSelectedEmrBillingOptionId(
                        option.billingOptionId,
                      );
                  }, selected)
                }
                disabled={selectionLocked}
                className={cn(
                  'block w-full overflow-hidden text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  !selected && 'border bg-gray-50',
                )}
                style={{
                  ...optionRadius,
                  ...(selected
                    ? gradientBorder(brand, 'var(--color-gray-50)', brand.tint)
                    : { borderColor: 'var(--checkout-option-border)' }),
                }}
              >
                {showBar ? (
                  <span
                    className={cn(
                      'flex flex-wrap items-center justify-center gap-x-2 px-3 py-1.5 text-[13px] font-medium',
                      selected ? 'text-white' : 'text-gray-900',
                    )}
                    style={
                      selected
                        ? { backgroundImage: brand.gradient }
                        : {
                            backgroundColor: withAlpha(
                              ink,
                              0.04 + 0.08 * ratio,
                            ),
                          }
                    }
                  >
                    {option.savingsLabel ? (
                      <span>{option.savingsLabel}</span>
                    ) : null}
                    {option.recommended ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3.5" aria-hidden="true" />
                        {copy.recommendedLabel}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <span className="flex items-center gap-3 px-4 py-4">
                  <RadioMark selected={selected} brand={brand} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] text-gray-900">
                      {option.name}
                    </span>
                    {option.billingLabel ? (
                      <span className="block text-sm" style={secondaryTone}>
                        {option.billingLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-2xl tracking-[-0.02em] text-gray-900">
                    {formatMoney(option.displayPrice)}
                    <span
                      className="text-base"
                      style={{ letterSpacing: 'normal' }}
                    >
                      {option.suffix}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const addOnSection =
    optionalDrugs.length > 0 ? (
      <div className={cn(cardClass, 'space-y-5')} style={cardStyle}>
        <div className="space-y-1">
          <h3 className={cn(headingClass, stepTitleClass)}>
            {stepTitle(planStep + 1, copy.addOnsTitle)}
          </h3>
          {hasText(copy.addOnsSubtitle) ? (
            <p className="text-base text-gray-600">{copy.addOnsSubtitle}</p>
          ) : null}
        </div>
        {optionalDrugs.map((drug, index) => {
          const isSelected = module.isOptionalDrugSelected(drug.id);
          const phaseId: string | null = module.getOptionalDrugPhase(drug.id);
          const phase = getSelectedPhase(drug, phaseId);
          const phases = getActivePhases(drug);
          const price = module.getDrugPrice(drug) * bundleSize;
          const priceText = price > 0 ? formatMoney(price, true) : '';
          const quantityText = [drug.quantity, drug.quantity_unit]
            .filter((part) => part != null && part !== '')
            .join(' ');
          const description = drug.merchant_drug?.description;
          return (
            <div
              key={drug.id}
              className={cn(
                'space-y-4',
                index > 0 && 'border-t border-gray-200 pt-5',
              )}
            >
              <div className="flex items-center gap-4">
                {showImages ? (
                  <MediaTile
                    imageUrl={getPhaseImage(phase, drug)}
                    label={drug.drug_name}
                    primary={primary}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xl text-gray-900">
                    {phase ? getPhaseDrugName(phase, drug) : drug.drug_name}
                  </p>
                  {priceText && phases.length === 0 && !quantityText ? (
                    <p className="text-base text-gray-600">{priceText}</p>
                  ) : null}
                </div>
              </div>
              {hasText(description) ? (
                <p className="text-base" style={secondaryTone}>
                  {description}
                </p>
              ) : null}
              {hasText(copy.addOnSavingsTitle) ? (
                <div
                  className="flex items-center gap-4 rounded-2xl p-4"
                  style={gradientBorder(brand, 'white')}
                >
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundImage: brand.tint }}
                    aria-hidden="true"
                  >
                    <Tag className="size-5" style={{ color: primary }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base text-gray-900">
                      {copy.addOnSavingsTitle}
                    </p>
                    {hasText(copy.addOnSavingsText) ? (
                      <p className="text-[15px] leading-snug text-gray-600">
                        {copy.addOnSavingsText}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <DetailTable
                rows={[
                  [copy.medicationTypeLabel, capitalize(drug.dosage_form)],
                  [
                    copy.medicationDoseLabel,
                    String(phase?.strength ?? drug.strength ?? ''),
                  ],
                  [
                    copy.medicationTakeLabel,
                    String(
                      phase?.frequency ?? drug.frequency ?? drug.sig ?? '',
                    ),
                  ],
                ]}
              />
              {phases.length > 0 ? (
                <div
                  className="relative rounded-full"
                  style={gradientBorder(brand, 'white')}
                >
                  <select
                    value={phaseId ?? ''}
                    onChange={(event) =>
                      update(() =>
                        module.setOptionalDrugPhase(
                          drug.id,
                          event.target.value || null,
                        ),
                      )
                    }
                    disabled={selectionLocked}
                    aria-label={copy.addOnQuantityLabel}
                    className="h-11 w-full min-w-0 appearance-none rounded-full bg-transparent pl-4 pr-10 text-base text-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {[quantityText || copy.standardDoseLabel, priceText]
                        .filter(Boolean)
                        .join('  ')}
                    </option>
                    {phases.map((option: any) => {
                      const optionQuantity = [
                        option.quantity,
                        option.quantity_unit,
                      ]
                        .filter((part) => part != null && part !== '')
                        .join(' ');
                      return (
                        <option key={option.id} value={option.id}>
                          {optionQuantity ||
                            option.strength ||
                            phaseCycleLabel(copy, option)}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-600"
                    aria-hidden="true"
                  />
                </div>
              ) : quantityText ? (
                <p
                  className="flex h-11 items-center gap-2 rounded-full px-4 text-base text-gray-900"
                  style={gradientBorder(brand, 'white')}
                >
                  <span>
                    {copy.addOnQuantityLabel}: {quantityText}
                  </span>
                  {priceText ? (
                    <span className="font-semibold">{priceText}</span>
                  ) : null}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => update(() => module.toggleOptionalDrug(drug.id))}
                disabled={selectionLocked}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? 'flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-6 text-lg font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-60'
                    : darkButtonClass
                }
                style={
                  isSelected ? softShadow('0 2px 10px', 0.08) : darkButtonStyle
                }
              >
                <span>
                  {isSelected ? copy.addOnAddedLabel : copy.addOnButtonLabel}
                </span>
                <AccentDot icon={isSelected ? Check : Plus} brand={brand} />
              </button>
            </div>
          );
        })}
      </div>
    ) : null;

  // A white band: edge to edge on phones, a rounded panel elsewhere.
  const bandClass = edge ? 'bg-white px-6' : 'rounded-[20px] bg-white px-5';
  const bandStyle = edge ? { marginInline: -16 } : undefined;

  const benefitsSection = (
    <div className={cn(bandClass, 'space-y-6 py-8')} style={bandStyle}>
      {benefits.length > 0 ? (
        <div className="space-y-5">
          <h3 className={cn(headingClass, 'text-2xl')}>{benefitsTitle}</h3>
          <ul className="space-y-3">
            {benefits.map((benefit, index) => {
              const Icon = BENEFIT_ICONS[benefit.icon] ?? Check;
              return (
                <li
                  key={`${benefit.title}-${index}`}
                  className="flex items-start gap-3 text-[17px] leading-snug text-gray-900"
                >
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-gray-900"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-semibold">{benefit.title}</span>
                    {benefit.description ? ` ${benefit.description}` : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <PrimaryButton onClick={jumpToCheckout}>
        {copy.checkoutJumpLabel}
      </PrimaryButton>
    </div>
  );

  const fieldId = (name: string) => `${fieldName}-${name}`;
  const shippingSection = (
    <div className={cn(cardClass, 'space-y-4')} style={cardStyle}>
      <h3
        className={cn(
          headingClass,
          'border-b border-gray-200 pb-3 text-[17px]',
        )}
      >
        {copy.shippingTitle}
      </h3>

      {contactFields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label
            htmlFor={fieldId(field.key)}
            className={labelClass}
            style={labelTone}
          >
            {field.label}
          </label>
          <input
            id={fieldId(field.key)}
            type={field.key === 'email' ? 'email' : 'text'}
            autoComplete={field.autoComplete}
            value={contact?.[field.key] ?? ''}
            onChange={(event) => editContact(field.key, event.target.value)}
            disabled={selectionLocked}
            className={inputClass}
          />
        </div>
      ))}

      {savedAddressesLoading ? (
        <p className="text-base text-gray-600">
          {copy.savedAddressesLoadingText}
        </p>
      ) : null}
      {savedAddresses.length > 0 ? (
        <div
          className="space-y-2"
          role="radiogroup"
          aria-label={copy.savedAddressesLabel}
        >
          <p className={labelClass} style={labelTone}>
            {copy.savedAddressesLabel}
          </p>
          {savedAddresses.map((saved: any) => (
            <ChoiceRow
              key={saved.id}
              selected={selectedAddressId === String(saved.id)}
              onClick={() => {
                if (!locked) chooseSavedAddress(saved);
              }}
              disabled={locked}
              title={describeAddress(saved)}
              showImage={false}
              brand={brand}
              selectedLabel={copy.selectedLabel}
            />
          ))}
          <ChoiceRow
            selected={selectedAddressId === null}
            onClick={chooseNewAddress}
            disabled={locked}
            title={copy.newAddressLabel}
            showImage={false}
            brand={brand}
            selectedLabel={copy.selectedLabel}
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <label
          htmlFor={fieldId('line1')}
          className={labelClass}
          style={labelTone}
        >
          {copy.streetLabel}
        </label>
        <input
          id={fieldId('line1')}
          name="address-line1"
          autoComplete="address-line1"
          value={address.line1}
          onChange={(event) => editAddress('line1', event.target.value)}
          placeholder={copy.streetPlaceholder}
          disabled={locked}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor={fieldId('line2')}
          className={labelClass}
          style={labelTone}
        >
          {copy.address2Label}
        </label>
        <input
          id={fieldId('line2')}
          name="address-line2"
          autoComplete="address-line2"
          value={address.line2}
          onChange={(event) => editAddress('line2', event.target.value)}
          placeholder={copy.address2Placeholder}
          disabled={locked}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor={fieldId('city')}
          className={labelClass}
          style={labelTone}
        >
          {copy.cityLabel}
        </label>
        <input
          id={fieldId('city')}
          name="address-level2"
          autoComplete="address-level2"
          value={address.city}
          onChange={(event) => editAddress('city', event.target.value)}
          placeholder={copy.cityPlaceholder}
          disabled={locked}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor={fieldId('state')}
            className={labelClass}
            style={labelTone}
          >
            {copy.stateLabel}
          </label>
          <div className="relative">
            <select
              id={fieldId('state')}
              name="address-level1"
              autoComplete="address-level1"
              value={address.state}
              onChange={(event) => editAddress('state', event.target.value)}
              disabled={locked}
              aria-invalid={!eligibility.valid}
              aria-describedby={
                eligibility.valid ? undefined : fieldId('state-error')
              }
              className={cn(inputClass, 'appearance-none pr-10')}
              // Core colours selects from --survey-text, so the empty state's placeholder grey goes inline.
              style={
                address.state ? undefined : { color: 'var(--color-gray-400)' }
              }
            >
              <option value="">{copy.statePlaceholder}</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code} className="text-gray-900">
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-600"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <label
            htmlFor={fieldId('zip')}
            className={labelClass}
            style={labelTone}
          >
            {copy.zipLabel}
          </label>
          <input
            id={fieldId('zip')}
            name="postal-code"
            autoComplete="postal-code"
            inputMode="numeric"
            value={address.zip}
            onChange={(event) => editAddress('zip', event.target.value)}
            placeholder={copy.zipPlaceholder}
            disabled={locked}
            className={inputClass}
          />
        </div>
      </div>
      {eligibility.valid ? null : (
        <p
          id={fieldId('state-error')}
          className="text-base text-red-700"
          role="alert"
        >
          {eligibility.error || copy.ineligibleStateMessage}
        </p>
      )}
    </div>
  );

  // A prepaid plan pays like any other plan. A short status shows only while its price loads, fails or expires.
  const prepaidStatus =
    isPrepaid &&
    authToken &&
    !paymentComplete &&
    (quoteBusy || quoteError || !quoteIsLive(quote)) ? (
      <div className="space-y-2 text-base text-gray-900">
        {quoteError ? (
          <InlineMessage tone="error">{quoteError}</InlineMessage>
        ) : quoteBusy || !quote ? (
          <p className="flex items-center gap-2" style={secondaryTone}>
            <Loader2
              className="size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
            {copy.quoteLoadingMessage}
          </p>
        ) : (
          <p style={secondaryTone}>{copy.quoteRequiredMessage}</p>
        )}
        {quoteBusy || (!quote && !quoteError) ? null : (
          <button
            type="button"
            onClick={() => setQuoteRefresh((count) => count + 1)}
            disabled={selectionLocked}
            className="text-base underline underline-offset-4 disabled:opacity-50"
          >
            {copy.quoteRefreshLabel}
          </button>
        )}
      </div>
    ) : null;

  const paymentSection = (
    <div className={cn(cardClass, 'space-y-4')} style={cardStyle}>
      <h3 className={cn(headingClass, 'text-[17px]')}>{copy.paymentTitle}</h3>
      {hasText(copy.paymentNote) ? (
        <p className="text-base text-gray-600">{copy.paymentNote}</p>
      ) : null}
      {prepaidStatus}
      {!Payment || !authToken || !module.merchant || !checkout ? (
        <InlineMessage>{copy.verificationRequiredMessage}</InlineMessage>
      ) : paymentComplete ? (
        <InlineMessage tone="success">
          {copy.paymentConfirmedMessage}
        </InlineMessage>
      ) : !quoteReady ? null : (
        <Payment
          key={`${authToken}:${checkout.signature}`}
          paymentElementLayout="tabs"
          embedded
          hideSubmitButton
          formRef={formRef}
          onProcessingChange={(next: boolean) => {
            if (!next && pendingPayment.current) {
              pendingPayment.current = false;
              setPending(false);
            }
          }}
          amount={Math.round(checkout.displayAmount * 100)}
          currency="USD"
          merchantId={module.merchant.id}
          authToken={authToken}
          chargeMode={checkout.chargeMode}
          authorizationPlanSlug={module.slug ?? undefined}
          authorizationVariantId={checkout.selection?.variantId ?? null}
          authorizationDrugSelections={checkout.selection?.drugSelection}
          {...(isPrepaid
            ? {
                billingCheckoutUuid: purchase?.checkout_uuid,
                authorizationAssignedPlanId: plan.id,
                authorizationCouponCode: prepaidCoupon || undefined,
              }
            : {})}
          beforeSubmit={() => {
            const cancel = () => {
              pendingPayment.current = false;
              setPending(false);
              return false;
            };
            if (
              disabled ||
              busy.current ||
              couponBusyRef.current ||
              survey.isSubmitting
            )
              return cancel();
            const problem = checkoutError(module, copy, prepaid);
            if (problem) {
              setActionError(problem);
              return cancel();
            }
            if (
              checkoutState(module, purchase).signature !== checkout.signature
            ) {
              setActionError(copy.selectionChangedMessage);
              refresh();
              return cancel();
            }
            return true;
          }}
          onSuccess={(paymentMethodId: string, paymentIntentId?: string) => {
            try {
              const result = completePayment(
                module,
                copy,
                checkout.signature,
                prepaid,
                paymentMethodId,
                paymentIntentId,
              );
              emit(result);
              refresh();
              const continuation = pendingPayment.current;
              pendingPayment.current = false;
              setPending(false);
              if (continuation) void finishOrder(result);
            } catch (caught) {
              pendingPayment.current = false;
              setPending(false);
              setActionError(
                caught instanceof Error && caught.message
                  ? caught.message
                  : copy.submitErrorMessage,
              );
            }
          }}
          onError={(message: string) => {
            pendingPayment.current = false;
            setPending(false);
            setActionError(message);
          }}
          appearance={{
            variables: {
              colorPrimary: primary,
              colorText: textColor,
              colorTextPlaceholder: mix(textColor, 0.32, 'white'),
              fontFamily: theme.fonts?.body || theme.fonts?.primary,
              borderRadius: '12px',
            },
          }}
          submitButtonAppearance={{
            className: theme.button?.primary,
            text: copy.completeOrderLabel,
          }}
        />
      )}
    </div>
  );

  const completionSection = (
    <div className="space-y-4 px-6">
      {hasText(copy.cancelNote) ? (
        <p className="pt-2 text-center text-base text-gray-900">
          {copy.cancelNote}
        </p>
      ) : null}
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {actionError ? (
        <InlineMessage tone="error">{actionError}</InlineMessage>
      ) : null}
      {orderSubmitted ? (
        <InlineMessage tone="success">
          {copy.orderSubmittedMessage}
        </InlineMessage>
      ) : null}
      {submitStalled && paymentComplete && !orderSubmitted && !actionError ? (
        <div className="space-y-2">
          <InlineMessage tone="error">{copy.submitErrorMessage}</InlineMessage>
          <button
            type="button"
            onClick={completeOrder}
            disabled={locked}
            className="w-full text-base font-medium underline underline-offset-4 disabled:opacity-50"
          >
            {copy.retryLabel}
          </button>
        </div>
      ) : null}
      <PrimaryButton
        onClick={completeOrder}
        disabled={locked || orderSubmitted}
        busy={pending || survey.isSubmitting}
      >
        {pending || survey.isSubmitting
          ? copy.processingLabel
          : copy.completeOrderLabel}
      </PrimaryButton>
      {footnotes.length > 0 ? (
        <div className="space-y-2">
          {footnotes.map((line, index) => (
            <p
              key={index}
              className="text-center text-[14px] leading-5 text-gray-500"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {hasText(copy.securityNote) ? (
        <p className="text-center text-sm uppercase tracking-wide text-gray-500">
          {copy.securityNote}
        </p>
      ) : null}
      {hasText(copy.supportPhone) ? (
        <div className="space-y-1 pt-2 text-center">
          {hasText(copy.supportLabel) ? (
            <p className="text-lg text-gray-900">{copy.supportLabel}</p>
          ) : null}
          <a
            href={`tel:${copy.supportPhone.replace(/[^\d+]/g, '')}`}
            className="inline-flex items-center gap-2 text-lg text-gray-900 underline-offset-4 hover:underline"
          >
            <Phone className="size-4" aria-hidden="true" />
            {copy.supportPhone}
          </a>
        </div>
      ) : null}
    </div>
  );

  const formColumn = (
    <div
      className="min-w-0 space-y-6"
      style={edge ? { paddingInline: 16 } : undefined}
    >
      {wide ? (
        <h1 className={cn(headingClass, 'text-[28px] leading-tight')}>
          {headerTitle}
        </h1>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className={cn(headingClass, 'text-2xl')}>
            {copy.personalizeTitle}
          </h2>
          {hasText(copy.personalizeSubtitle) ? (
            <p className="text-base text-gray-600">
              {copy.personalizeSubtitle}
            </p>
          ) : null}
        </div>
        {/* InlineMessage is a status region, so the recommendation is announced when it arrives. */}
        {hasText(preferredMessage) ? (
          <InlineMessage>{preferredMessage}</InlineMessage>
        ) : null}
        {medicationSection}
        {planSection}
        {addOnSection}
      </section>

      {benefitsSection}

      <section
        ref={(node) => {
          checkoutRef.current = node;
        }}
        className="scroll-mt-36 space-y-4"
      >
        <div className="space-y-1">
          <h2 className={cn(headingClass, 'text-2xl')}>{copy.checkoutTitle}</h2>
          {hasText(copy.checkoutSubtitle) ? (
            <p className="text-base text-gray-600">{copy.checkoutSubtitle}</p>
          ) : null}
        </div>
        {shippingSection}
        {paymentSection}
        {completionSection}
      </section>
    </div>
  );

  return (
    <div
      ref={setRootRef}
      className="relative w-full min-w-0 text-gray-900"
      // The design sets everything in the theme's heading face (DM Sans for Ivy).
      style={{
        ...neutralVars(textColor),
        fontFamily: theme.fonts?.heading || undefined,
        marginInline: edge ? -edge : undefined,
        width: edge ? `calc(100% + ${edge * 2}px)` : undefined,
      }}
    >
      {/* formColumn keeps the same parent and position in both layouts, so a resize never remounts the card form. */}
      <div
        className={wide ? 'grid items-start gap-8' : 'space-y-6'}
        style={
          wide ? { gridTemplateColumns: 'minmax(0, 1fr) 320px' } : undefined
        }
      >
        {wide ? null : (
          <div
            className={cn(
              'sticky top-0 z-30 bg-white px-4',
              !summaryOpen && 'border-b border-gray-200',
              !edge && 'rounded-[20px]',
            )}
          >
            <h1
              className={cn(
                headingClass,
                'pb-4 pt-6 text-[28px] leading-tight',
              )}
            >
              {headerTitle}
            </h1>
            <div className="border-t border-gray-200">{summaryBar}</div>
            {/* The open summary drops over the page rather than pushing it down. */}
            {summaryOpen ? (
              <div
                id={`${fieldName}-order-summary`}
                className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto bg-white px-4 pb-4"
                style={{
                  ...softShadow('0 24px 24px -12px', 0.1),
                  borderBottomLeftRadius: 24,
                  borderBottomRightRadius: 24,
                }}
              >
                {orderSummary}
              </div>
            ) : null}
          </div>
        )}
        {summaryOpen && !wide ? (
          <div
            className="absolute inset-0 z-20 backdrop-blur-sm"
            style={{ backgroundColor: withAlpha('var(--color-gray-50)', 0.4) }}
            onClick={() => setSummaryOpen(false)}
            aria-hidden="true"
          />
        ) : null}
        {formColumn}
        {wide ? (
          <aside
            className={cn(cardClass, 'sticky top-6 space-y-4 p-5')}
            style={cardStyle}
            aria-label={copy.summaryToggleLabel}
          >
            <h2 className={cn(headingClass, 'text-base leading-5 font-medium')}>
              {copy.summaryToggleLabel}
            </h2>
            <div id={`${fieldName}-order-summary`}>{orderSummary}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
});

SinglePageCheckoutRenderer.displayName = 'SinglePageCheckoutRenderer';

// ============================================================================
// Builder
// ============================================================================

const builderInputClass =
  'h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm';

const SinglePageCheckoutForm: React.FC<ContentBlockItemProps> = ({
  data,
  onUpdate,
}) => {
  const copy = readCopy(data);
  const benefits = readBenefits(data);
  const disclaimers = readDisclaimers(data);
  const handleUpdate = (field: string, next: unknown) =>
    onUpdate?.({ ...data, [field]: next });

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <label htmlFor="spc-fieldName" className="block font-medium">
          Field Name *
        </label>
        <input
          id="spc-fieldName"
          value={data.fieldName || ''}
          onChange={(event) => handleUpdate('fieldName', event.target.value)}
          placeholder={BLOCK_TYPE}
          className={builderInputClass}
        />
        <p className="text-xs text-gray-500">
          Stores the payment confirmation for this checkout.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.showDrugImages ?? true}
            onChange={(event) =>
              handleUpdate('showDrugImages', event.target.checked)
            }
          />
          Show medication images
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.showTitrationOptions ?? true}
            onChange={(event) =>
              handleUpdate('showTitrationOptions', event.target.checked)
            }
          />
          Show the Change dose option
        </label>
      </div>

      {COPY_GROUPS.map((group) => (
        <details
          key={group.title}
          className="rounded-md border border-gray-200 p-3"
        >
          <summary className="cursor-pointer font-medium">
            {group.title}
          </summary>
          <div className="mt-3 space-y-3">
            {group.hint ? (
              <p className="text-xs text-gray-500">{group.hint}</p>
            ) : null}
            {group.fields.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label
                  htmlFor={`spc-${key}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  {label}
                </label>
                {COPY_DEFAULTS[key].length > 60 ? (
                  <textarea
                    id={`spc-${key}`}
                    value={copy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                  />
                ) : (
                  <input
                    id={`spc-${key}`}
                    value={copy[key]}
                    onChange={(event) => handleUpdate(key, event.target.value)}
                    className={builderInputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </details>
      ))}

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer font-medium">Benefits list</summary>
        <div className="mt-3 space-y-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="space-y-2 rounded-md bg-gray-50 p-2">
              <div className="flex gap-2">
                <select
                  aria-label={`Benefit ${index + 1} icon`}
                  value={benefit.icon}
                  onChange={(event) =>
                    handleUpdate(
                      'benefits',
                      benefits.map((entry, position) =>
                        position === index
                          ? {
                              ...entry,
                              icon: event.target.value as BenefitIcon,
                            }
                          : entry,
                      ),
                    )
                  }
                  className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                >
                  {Object.keys(BENEFIT_ICONS).map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Benefit ${index + 1} title`}
                  value={benefit.title}
                  onChange={(event) =>
                    handleUpdate(
                      'benefits',
                      benefits.map((entry, position) =>
                        position === index
                          ? { ...entry, title: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  placeholder="Title"
                  className={builderInputClass}
                />
                <button
                  type="button"
                  aria-label={`Remove benefit ${index + 1}`}
                  onClick={() =>
                    handleUpdate(
                      'benefits',
                      benefits.filter((_, position) => position !== index),
                    )
                  }
                  className="shrink-0 rounded-md border border-gray-300 px-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              <input
                aria-label={`Benefit ${index + 1} description`}
                value={benefit.description}
                onChange={(event) =>
                  handleUpdate(
                    'benefits',
                    benefits.map((entry, position) =>
                      position === index
                        ? { ...entry, description: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder="Description"
                className={builderInputClass}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              handleUpdate('benefits', [
                ...benefits,
                { icon: 'check', title: '', description: '' },
              ])
            }
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1"
          >
            <Plus className="size-4" /> Add benefit
          </button>
        </div>
      </details>

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer font-medium">Disclaimers</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            Extra lines under Complete My Order, after the payment disclaimer.
          </p>
          {disclaimers.map((line, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                aria-label={`Disclaimer ${index + 1}`}
                value={line}
                onChange={(event) =>
                  handleUpdate(
                    'disclaimers',
                    disclaimers.map((entry, position) =>
                      position === index ? event.target.value : entry,
                    ),
                  )
                }
                rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove disclaimer ${index + 1}`}
                onClick={() =>
                  handleUpdate(
                    'disclaimers',
                    disclaimers.filter((_, position) => position !== index),
                  )
                }
                className="shrink-0 self-start rounded-md border border-gray-300 px-2 py-2"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => handleUpdate('disclaimers', [...disclaimers, ''])}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1"
          >
            <Plus className="size-4" /> Add disclaimer
          </button>
        </div>
      </details>
    </div>
  );
};

const SinglePageCheckoutItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  const copy = readCopy(data);

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <p className="font-medium">{copy.personalizeTitle}</p>
      <p className="text-sm text-gray-500">
        {[
          copy.medicationTitle,
          copy.planTitle,
          copy.addOnsTitle,
          copy.shippingTitle,
          copy.paymentTitle,
        ].join(' · ')}
      </p>
      <div className="rounded-full bg-gray-900 py-2 text-center text-sm text-white">
        {copy.completeOrderLabel}
      </div>
    </div>
  );
};

const SinglePageCheckoutPreview: React.FC = () => (
  <div className="flex w-full items-center justify-center py-1">
    <div className="w-4/5 space-y-1 rounded-md border bg-gray-50 p-2 text-xs text-gray-500">
      <div>Plan · Add-ons · Shipping</div>
      <div className="rounded-full bg-gray-900 py-0.5 text-center text-white">
        Checkout
      </div>
    </div>
  </div>
);

// ============================================================================
// Block definition
// ============================================================================

// The portal's Validate Code reads `type` from the source text, so it must be a string literal here.
// Uniloop's default checkout: the single-page checkout with no icon on its dark buttons.
export const UniloopCheckoutBlock: BlockDefinition = {
  type: 'uniloopCheckout',
  name: 'Single Page Checkout (Uniloop default)',
  description:
    'Single-page checkout: medication, delivery plan, add-ons, shipping and payment',
  icon: <ShoppingBag className="h-4 w-4" />,
  defaultData: {
    type: 'uniloopCheckout',
    fieldName: BLOCK_TYPE,
    label: 'Checkout',
    required: true,
    showContinueButton: false,
    autoContinueOnSelect: false,
    isEndBlock: false,
    showDrugImages: true,
    showTitrationOptions: true,
    benefits: DEFAULT_BENEFITS,
    disclaimers: [],
    ...COPY_DEFAULTS,
  },
  renderItem: (props) => <SinglePageCheckoutItem {...props} />,
  renderFormFields: (props) => <SinglePageCheckoutForm {...props} />,
  renderPreview: () => <SinglePageCheckoutPreview />,
  renderBlock: (props) => <SinglePageCheckoutRenderer {...props} />,
  validate: (data: BlockData) =>
    data.fieldName ? null : 'Field name is required',
  // The checkout signature needs the enrollment module, so the renderer re-checks it and resets stale values.
  validateValue: (value: any, data: BlockData) =>
    value?.complete === true && value.paymentMethodId
      ? null
      : readCopy(data).paymentRequiredMessage,
};

export default UniloopCheckoutBlock;
