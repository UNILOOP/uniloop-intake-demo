/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BlockData } from '@/packages/survey-form-package/src/types';
import {
  Check,
  CircleDollarSign,
  FlaskConical,
  HeartHandshake,
  Laptop,
  Truck,
  Zap,
} from 'lucide-react';

// The checkout's payment result is stored under this field name unless the form sets another.
export const CHECKOUT_FIELD_NAME = 'singlePageCheckout';

// ============================================================================
// Builder copy
// ============================================================================

export const BENEFIT_ICONS = {
  price: CircleDollarSign,
  physician: Laptop,
  lab: FlaskConical,
  delivery: Zap,
  shipping: Truck,
  care: HeartHandshake,
  check: Check,
} as const;

export type BenefitIcon = keyof typeof BENEFIT_ICONS;

export interface Benefit {
  icon: BenefitIcon;
  title: string;
  description: string;
}

export const DEFAULT_BENEFITS: Benefit[] = [
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

export const COPY_DEFAULTS = {
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
  preferredUnavailableMessage: '',

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
  authorizationHoldLabel: 'Due now:',
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

export type CopyKey = keyof typeof COPY_DEFAULTS;
export type Copy = Record<CopyKey, string>;

export const COPY_GROUPS: {
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

export const readCopy = (block: BlockData): Copy => {
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

export const readBenefits = (block: BlockData): Benefit[] =>
  Array.isArray(block.benefits) ? block.benefits : DEFAULT_BENEFITS;

export const readDisclaimers = (block: BlockData): string[] =>
  Array.isArray(block.disclaimers)
    ? block.disclaimers.filter((line: unknown) => typeof line === 'string')
    : [];

// ============================================================================
// Multi-page checkout: Shipping, then Payment, with Your plan first in the three-page one
// ============================================================================

export const STEP_COPY_DEFAULTS = {
  selectionContinueLabel: 'Continue to shipping',
  selectionMissingMessage: 'Choose your medication and plan to continue.',
  shippingContinueLabel: 'Continue to payment',
  shipToTemplate: 'Shipping to {address}',
  editAddressLabel: 'Edit',
  addressMissingMessage: 'Add your shipping address before you pay.',
  addressMissingLabel: 'Go to shipping',
};

export type StepCopyKey = keyof typeof STEP_COPY_DEFAULTS;
export type StepCopy = Record<StepCopyKey, string>;

export const STEP_COPY_GROUP: {
  title: string;
  hint?: string;
  fields: [StepCopyKey, string][];
} = {
  title: 'Multi-page checkout',
  hint: 'Token: {address}. Your plan and Shipping use their Continue buttons; Payment shows the address line and the missing-address notice.',
  fields: [
    ['selectionContinueLabel', 'Your plan: Continue button'],
    ['selectionMissingMessage', 'Your plan: nothing chosen yet'],
    ['shippingContinueLabel', 'Shipping: Continue button'],
    ['shipToTemplate', 'Payment: address line'],
    ['editAddressLabel', 'Payment: edit address link'],
    ['addressMissingMessage', 'Payment: no address yet'],
    ['addressMissingLabel', 'Payment: link back to shipping'],
  ],
};

export const readStepCopy = (block: BlockData): StepCopy => {
  const data = block as Record<string, unknown>;
  const copy = {} as StepCopy;
  for (const key of Object.keys(STEP_COPY_DEFAULTS) as StepCopyKey[]) {
    copy[key] =
      typeof data[key] === 'string'
        ? (data[key] as string)
        : STEP_COPY_DEFAULTS[key];
  }
  return copy;
};

// An intake answer that points to a medication, used when UniEMR's preferred-drug lookup returns nothing.
// `medication` is a word in the drug's name, such as the molecule.
export interface PreferredMedicationRule {
  fieldName: string;
  answer: string;
  medication: string;
}

// Ivy's GLP-1 intakes: a recent GLP-1 answer comes first, so it wins over an older answer to the medication question.
export const DEFAULT_PREFERRED_MEDICATION_RULES: PreferredMedicationRule[] = [
  {
    fieldName: 'selectablebox138t8r',
    answer: 'Yes, tirzepatide (like Zepbound or Mounjaro)',
    medication: 'Tirzepatide',
  },
  {
    fieldName: 'selectablebox138t8r',
    answer: 'Yes, semaglutide (like Ozempic, Wegovy, or Rybelsus)',
    medication: 'Semaglutide',
  },
  {
    fieldName: 'selectablebox2tbsa3',
    answer: 'Compounded Tirzepatide',
    medication: 'Tirzepatide',
  },
  {
    fieldName: 'selectablebox2tbsa3',
    answer: 'Compounded Semaglutide',
    medication: 'Semaglutide',
  },
];

export const readPreferredMedicationRules = (
  block: BlockData,
): PreferredMedicationRule[] =>
  Array.isArray(block.preferredMedicationRules)
    ? block.preferredMedicationRules.filter(
        (rule: any) =>
          rule &&
          typeof rule.fieldName === 'string' &&
          typeof rule.answer === 'string' &&
          typeof rule.medication === 'string',
      )
    : [];
