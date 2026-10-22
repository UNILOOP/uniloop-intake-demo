/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Copy } from './copy';

export type EnrollmentModule = any;

// ============================================================================
// Formatting and data helpers
// ============================================================================

export const US_STATES: [string, string][] = [
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

export const formatMoney = (amount: number, exact = false): string => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: exact || value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const fill = (
  template: string,
  tokens: Record<string, string | number | null | undefined>,
): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in tokens ? String(tokens[key] ?? '') : match,
  );

export const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '';

export const dataObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};

export const capitalize = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

export const expandHex = (color: string): string | null => {
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
export const mix = (
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

export const withAlpha = (color: string, alpha: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

export const getPrimaryPhoto = (
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

export const getDrugImage = (drug: any): string | null =>
  getPrimaryPhoto(drug?.merchant_drug?.photos);

export const getPhaseImage = (phase: any, drug: any): string | null =>
  getPrimaryPhoto(phase?.local_merchant_drug?.photos) ?? getDrugImage(drug);

export const getPhaseDrugName = (phase: any, drug: any): string =>
  phase?.local_merchant_drug?.display_name ||
  phase?.drug_name ||
  drug?.drug_name ||
  'Medication';

export const getActivePhases = (drug: any): any[] =>
  drug?.has_phases
    ? (drug?.phases ?? []).filter((phase: any) => phase?.is_active)
    : [];

export const getSelectedPhase = (
  drug: any,
  phaseId: string | null,
): any | null =>
  phaseId
    ? (getActivePhases(drug).find((phase: any) => phase.id === phaseId) ?? null)
    : null;

export const phaseCycleLabel = (copy: Copy, phase: any): string => {
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

export const getAddOnUnitPrice = (
  drug: any,
  phaseId: string | null,
): number => {
  const phase = getSelectedPhase(drug, phaseId);
  if (phase?.add_on_price != null) {
    return Number(phase.add_on_price) || 0;
  }

  return Number(drug?.add_on_price ?? 0) || 0;
};

export const describeAddress = (address: any): string =>
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
export interface BillingPurchase {
  checkout_uuid: string;
  quote: any;
}

export interface PrepaidState {
  purchase: BillingPurchase | null;
}

// Prepaid plans need the quote and checkout calls, which only the EMR enrollment utils provide.
export const supportsPrepaid = (
  module: EnrollmentModule | undefined,
): boolean =>
  typeof module?.quoteBillingOption === 'function' &&
  typeof module?.cancelBillingCheckout === 'function' &&
  typeof module?.getSelectedEmrBillingOptionId === 'function';

export const selectedBillingOptionId = (
  module: EnrollmentModule,
): number | null =>
  supportsPrepaid(module)
    ? (module.getSelectedEmrBillingOptionId() ?? null)
    : null;

export const findBillingOption = (
  module: EnrollmentModule,
  id: number | null,
): any | null =>
  id == null
    ? null
    : ((module.plan?.billing_options ?? []).find(
        (option: any) => option.id === id && option.is_active !== false,
      ) ?? null);

export const quoteIsLive = (quote: any): boolean =>
  Boolean(quote && Number(quote.expires_at) > Date.now() / 1000);

// Prepaid amounts come from the quote. Until it arrives, the plan card's price stands in and payment waits. The base
// price leaves out the medication, so the summary would jump when the quote lands.
export const prepaidAmounts = (
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

export const checkoutPricing = (
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
export const invalidateCoupon = (module: EnrollmentModule): void => {
  if (dataObject(module.getCheckoutCouponData?.()).couponCode) {
    module.setCheckoutCouponData?.(null);
  }
};

export const stableCheckoutValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableCheckoutValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableCheckoutValue(entry)]),
    );
  return value;
};

export const checkoutState = (
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

export const getAuthToken = (
  module: EnrollmentModule | undefined,
): string | null =>
  module?.isEmr && module.isTokenValidated?.()
    ? (module.getPatientAuthToken?.() ?? null)
    : null;

export const isPaymentComplete = (
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

// Contact, address and state: everything the order needs before payment.
export const shippingError = (
  module: EnrollmentModule,
  copy: Copy,
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

  return null;
};

export const checkoutError = (
  module: EnrollmentModule,
  copy: Copy,
  prepaid: PrepaidState = { purchase: null },
): string | null => {
  const shipping = shippingError(module, copy);
  if (shipping) return shipping;
  if (
    selectedBillingOptionId(module) != null &&
    !quoteIsLive(prepaid.purchase?.quote)
  )
    return copy.quoteRequiredMessage;

  return null;
};

// The draft carries the accepted quote for a prepaid plan and no billing fields for per-refill billing.
export const billingDraft = (
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

export const completePayment = (
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

export interface PlanChoice {
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

export const choiceKey = (variantId: string, billingOptionId: number | null) =>
  billingOptionId == null
    ? `per_refill:${variantId}`
    : `prepaid:${billingOptionId}`;

// Per-unit add-ons for the chosen medications, as the platform adds them to a variant that has its own price.
export const medicationAddOnPerUnit = (module: EnrollmentModule): number => {
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
export const planChoices = (
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
    // Ivy shows per-month prices in whole dollars, so the price and the savings round on their own and the struck-out
    // price (their sum) stays whole too. Totals that are charged keep their cents.
    const monthlyPrice = duration ? Math.round(total / duration) : total;
    const savings = duration
      ? Math.max(
          0,
          Math.round(monthlyBaseline) -
            Math.round(listPrice(choice) / duration),
        )
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
export const patientContact = (
  module: EnrollmentModule,
): Record<string, string> => {
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
export const hasPatientContact = (
  info: Record<string, any> | null | undefined,
): boolean =>
  hasText(info?.first_name) &&
  hasText(info?.last_name) &&
  hasText(info?.email) &&
  hasText(info?.phone);

export interface AddressDraft {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const toAddressDraft = (address: any): AddressDraft => ({
  line1: String(address?.line1 ?? ''),
  line2: String(address?.line2 ?? ''),
  city: String(address?.city ?? ''),
  state: String(address?.state ?? ''),
  zip: String(address?.zip ?? ''),
  country: String(address?.country || 'US'),
});

// ============================================================================
// Preferred medication rules
// ============================================================================

// Curly and straight apostrophes, case and spacing differ between the intake's options and the rule text.
const normalizeAnswer = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// A selectable box stores a string, an array of strings, or an option object with a label or value.
const answerTexts = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(answerTexts);
  if (value && typeof value === 'object') {
    const option = value as Record<string, unknown>;
    return [option.label, option.value].flatMap(answerTexts);
  }
  return hasText(value) ? [normalizeAnswer(value)] : [];
};

// The first rule whose field holds its answer names the medication; a later answer to the same field never wins.
export const matchPreferredMedication = (
  rules: { fieldName: string; answer: string; medication: string }[],
  answers: Record<string, unknown>,
): string | null => {
  for (const rule of rules) {
    if (
      answerTexts(answers[rule.fieldName]).includes(
        normalizeAnswer(rule.answer),
      )
    )
      return rule.medication;
  }
  return null;
};

// The drug a medication word points to: keep the current pick when it already matches, otherwise prefer the drug with
// the same formulation as the current pick (Tirzepatide + B Vitamin for Semaglutide + B Vitamin), then the default.
export const findPreferredDrug = (
  module: EnrollmentModule,
  medication: string,
): { groupId: any; drug: any; current: boolean } | null => {
  const word = normalizeAnswer(medication);
  if (!word) return null;
  for (const group of module.getDrugGroups?.() ?? []) {
    const drugs: any[] = group.drugs ?? [];
    const matches = drugs.filter((drug) =>
      normalizeAnswer(drug.drug_name).includes(word),
    );
    if (!matches.length) continue;
    const selectedIds: any[] = module.getDrugGroupSelection?.(group.id) ?? [];
    const current = drugs.find((drug) => selectedIds.includes(drug.id));
    if (current && matches.includes(current))
      return { groupId: group.id, drug: current, current: true };
    // Everything after the molecule: " + b vitamin injections".
    const name = normalizeAnswer(current?.drug_name);
    const formulation = name.includes(' ') ? name.slice(name.indexOf(' ')) : '';
    const drug =
      (formulation &&
        matches.find((candidate) =>
          normalizeAnswer(candidate.drug_name).endsWith(formulation),
        )) ||
      matches.find((candidate) => candidate.is_default_option) ||
      matches[0];
    return { groupId: group.id, drug, current: false };
  }
  return null;
};
