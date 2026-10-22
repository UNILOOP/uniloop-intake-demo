/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { themes } from '@/packages/survey-form-package/src/themes';
import type { BlockRendererProps } from '@/packages/survey-form-package/src/types';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Lock,
  Phone,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccentDot,
  ChoiceRow,
  DetailTable,
  DrawerToggle,
  gradientBorder,
  GradientText,
  InlineMessage,
  MediaTile,
  PrimaryButton,
  RadioMark,
} from './atoms';
import {
  BENEFIT_ICONS,
  CHECKOUT_FIELD_NAME,
  readBenefits,
  readCopy,
  readDisclaimers,
  readPreferredMedicationRules,
  readStepCopy,
} from './copy';
import {
  capitalize,
  checkoutError,
  checkoutPricing,
  checkoutState,
  choiceKey,
  completePayment,
  dataObject,
  describeAddress,
  findPreferredDrug,
  fill,
  formatMoney,
  getActivePhases,
  getAddOnUnitPrice,
  getAuthToken,
  getDrugImage,
  getPhaseDrugName,
  getPhaseImage,
  getSelectedPhase,
  hasPatientContact,
  hasText,
  invalidateCoupon,
  isPaymentComplete,
  matchPreferredMedication,
  mix,
  patientContact,
  phaseCycleLabel,
  planChoices,
  quoteIsLive,
  selectedBillingOptionId,
  shippingError,
  supportsPrepaid,
  toAddressDraft,
  US_STATES,
  withAlpha,
  type AddressDraft,
  type BillingPurchase,
  type EnrollmentModule,
  type PrepaidState,
} from './pricing';
import {
  cardClass,
  cardStyle,
  darkButtonClass,
  darkButtonStyle,
  headingClass,
  ink,
  inputClass,
  labelClass,
  labelTone,
  makeBrand,
  medicationNameClass,
  neutralVars,
  optionRadius,
  secondaryTone,
  softShadow,
  stepTitle,
  stepTitleClass,
} from './styles';

// Two columns need a desktop viewport and enough room inside the form container.
const WIDE_VIEWPORT_QUERY = '(min-width: 992px)';
const WIDE_BLOCK_MIN_WIDTH = 720;
// Core pads the form 24-32px on each side; anything wider is a layout this block should not reach over.
const MAX_EDGE_BLEED = 48;

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

export type CheckoutStep = 'single' | 'selection' | 'shipping' | 'payment';

export interface CheckoutRendererProps extends BlockRendererProps {
  // single: the whole checkout on one page. shipping and payment: the pages of the two-page checkout. selection: the
  // first page of the three-page checkout (medication, plan and add-ons), before shipping and payment.
  step?: CheckoutStep;
}

// The first block of a type anywhere in the form.
const findBlock = (node: any, type: string): any => {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  for (const item of node.items ?? []) {
    const found = findBlock(item, type);
    if (found) return found;
  }
  return null;
};

// One order at a time across the two pages: Back and forward remount the Payment block, and a fresh mount must not
// start a second submit while the first is still checking the session.
const orderInFlight = { current: false };
// A card confirmation in flight. Back stays usable meanwhile, so a page mounted during it must not change the order the
// card is being confirmed for.
const paymentInFlight = { current: false };

// What the two-page checkout keeps between its pages for one plan and patient. `pickedFor` and `preferredFor` hold the
// intake answers the patient chose a medication under, or a preferred medication was applied for, so a remount
// undoes neither and new answers apply again. `notice` is the message that applying left, and `coupon` the prepaid
// code, which otherwise lives only in the Payment page's state. `load` marks the page load that wrote the medication
// fields: a reload starts the order from the plan's default medication again, so they no longer hold after one.
interface CheckoutMemory {
  patient?: string;
  load?: string;
  pickedFor?: string;
  preferredFor?: string;
  notice?: { status: 'applied' | 'kept' | 'none'; drugs: string };
  coupon?: string;
}

const memoryKey = (module: EnrollmentModule): string =>
  `uniloop-checkout:${module?.slug ?? dataObject(module?.plan).id ?? ''}`;

const memoryPatient = (module: EnrollmentModule): string | undefined => {
  const id = dataObject(module?.getStoredPatient?.()).id;
  return id == null ? undefined : String(id);
};

// Both checkout blocks share it, and it changes only when the page reloads.
const pageLoad = (): string => String(window.performance?.timeOrigin ?? '');

// The memory belongs to one patient: once the stored patient differs, it reads as empty. Medication fields from an
// earlier page load read as empty too.
const readMemory = (module: EnrollmentModule): CheckoutMemory => {
  try {
    const stored: CheckoutMemory = dataObject(
      JSON.parse(window.sessionStorage.getItem(memoryKey(module)) ?? '{}'),
    );
    const patient = memoryPatient(module);
    if (patient && stored.patient && stored.patient !== patient) return {};
    if (stored.load === pageLoad()) return stored;
    const { pickedFor, preferredFor, notice, ...kept } = stored;
    return kept;
  } catch {
    return {};
  }
};

const clearMemory = (module: EnrollmentModule) => {
  try {
    window.sessionStorage.removeItem(memoryKey(module));
  } catch {
    // Nothing was stored.
  }
};

// Releases a prepaid checkout and drops it from the draft, so no later page brings back a cancelled checkout.
const releaseCheckout = (module: EnrollmentModule, held: BillingPurchase) => {
  const draft = module.getCheckoutData?.();
  if (draft?.billingCheckoutUuid === held.checkout_uuid)
    module.setCheckoutData?.({
      ...draft,
      billingCheckoutUuid: undefined,
      billingQuote: undefined,
      billingTermsAccepted: false,
    });
  const token = getAuthToken(module);
  if (token)
    Promise.resolve(
      module.cancelBillingCheckout?.(token, held.checkout_uuid),
    ).catch(() => {});
};

const writeMemory = (module: EnrollmentModule, next: CheckoutMemory) => {
  try {
    window.sessionStorage.setItem(
      memoryKey(module),
      JSON.stringify({
        ...readMemory(module),
        ...next,
        patient: memoryPatient(module) ?? readMemory(module).patient,
        load: pageLoad(),
      }),
    );
  } catch {
    // Without storage the page still works; a remount may then apply the preferred medication again.
  }
};

export const CheckoutRenderer = forwardRef<
  HTMLDivElement,
  CheckoutRendererProps
>((props, ref) => {
  const { block, value, onChange, error, disabled, theme: themeProp } = props;
  const step = props.step ?? 'single';
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
  const fieldName = block.fieldName || CHECKOUT_FIELD_NAME;
  const stepMode = step !== 'single';
  // The pages before Payment hold no order of their own: they read it from Payment's field and never quote.
  const beforePayment = step === 'selection' || step === 'shipping';
  const stepCopy = readStepCopy(block);
  const preferredRules = stepMode ? readPreferredMedicationRules(block) : [];
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
    if (draft?.billingQuote) return String(draft.couponCode ?? '');
    return step === 'payment' && prepaidEnabled
      ? String(readMemory(module).coupon ?? '')
      : '';
  });
  useEffect(() => {
    if (step === 'payment' && module)
      writeMemory(module, { coupon: prepaidCoupon });
  }, [step, module, prepaidCoupon]);
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

  // The pages before Payment have no value of their own, so they read the order from the Payment page's field: once
  // paid, nothing on them may change the price or the medication either.
  const paymentFieldName = useMemo(() => {
    if (!beforePayment) return CHECKOUT_FIELD_NAME;
    const payment = findBlock(survey.surveyData?.rootNode, 'checkoutPayment');
    return payment ? payment.fieldName || CHECKOUT_FIELD_NAME : CHECKOUT_FIELD_NAME;
  }, [beforePayment, survey.surveyData?.rootNode]);
  const hasSelectionPage = useMemo(
    () => Boolean(findBlock(survey.surveyData?.rootNode, 'checkoutSelection')),
    [survey.surveyData?.rootNode],
  );
  // In the three-page checkout the choices sit on their own page, so Payment leaves them out.
  const choicesShown =
    step !== 'shipping' && (step !== 'payment' || !hasSelectionPage);
  // The preferred medication is applied where the patient first sees the order: Your plan when the form has it, so the
  // medication never changes on a page that shows no choices.
  const preselects = step === 'selection' || !hasSelectionPage;
  const shippingOrder = dataObject(
    beforePayment ? survey.values?.[paymentFieldName] : null,
  );
  const paymentComplete =
    beforePayment
      ? shippingOrder.complete === true &&
        hasText(shippingOrder.paymentMethodId) &&
        shippingOrder.paymentMethodId ===
          module?.getCheckoutData?.()?.stripePaymentMethodId
      : isPaymentComplete(value, module, purchase);
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
  const answersKeyRef = useRef('');
  const update = (write: () => void, unchanged = false, pick = false) => {
    if (!module || selectionLocked || unchanged || paymentInFlight.current)
      return;
    manualChanges.current += 1;
    if (stepMode && choicesShown && pick)
      writeMemory(module, { pickedFor: answersKeyRef.current });
    // Payment reads its prepaid code back from memory, and that code was for the old selection.
    if (beforePayment) writeMemory(module, { coupon: '' });
    write();
    invalidateCoupon(module);
    setPrepaidCoupon('');
    setActionError('');
    refresh();
  };

  // Quote the selected prepaid plan for the current medications and coupon, releasing the previous checkout first.
  const quoteVariantId: string | null = quoteSelection?.variantId ?? null;
  useEffect(() => {
    if (!module || !prepaidEnabled || beforePayment) return;
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
        const current = purchaseRef.current;
        // On the two pages every Payment mount quotes again, so a quote that ends up unused is released.
        const unused = () =>
          stepMode &&
          current?.checkout_uuid !== next.checkout_uuid &&
          releaseCheckout(module, next);
        if (cancelled) {
          unused();
          return;
        }
        // An unchanged quote keeps its checkout, so a completed payment stays valid.
        const keep =
          !changed &&
          current !== null &&
          current.quote?.hash === next.quote?.hash &&
          quoteIsLive(current.quote);
        // Back and forward quote again on every Payment page, so the two pages release the checkout a new quote replaces.
        if (
          stepMode &&
          !keep &&
          current &&
          current.checkout_uuid !== next.checkout_uuid
        )
          releaseCheckout(module, current);
        if (keep) unused();
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
      if (!stepMode) controller.abort();
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
    step,
    stepMode,
  ]);

  // Back from Payment releases an unpaid prepaid checkout, so nothing stays held while the patient is on Shipping.
  // Payment quotes again when it mounts.
  const moduleRef = useRef(module);
  moduleRef.current = module;
  useEffect(
    () => () => {
      if (step !== 'payment') return;
      const held = purchaseRef.current;
      const current = moduleRef.current;
      if (
        !held ||
        !current ||
        pendingPayment.current ||
        busy.current ||
        orderInFlight.current ||
        isPaymentComplete(valueRef.current, current, held)
      )
        return;
      purchaseRef.current = null;
      releaseCheckout(current, held);
    },
    [step],
  );

  // Preferred medication: resolved from the intake answers after a short pause, and applied only when the patient
  // has not changed the selection while it loaded.
  const [preferred, setPreferred] = useState<{
    status: 'idle' | 'loading' | 'applied' | 'kept' | 'none' | 'unavailable';
    drugs: string;
  }>({ status: 'idle', drugs: '' });
  // In the two-page checkout both pages preselect, so Shipping's order summary already shows the preferred medication.
  const preferredKey =
    utils &&
    typeof utils.buildPreferredDrugFormResponses === 'function'
      ? JSON.stringify(utils.buildPreferredDrugFormResponses() ?? [])
      : '[]';
  const preferredVariantId: string | null =
    utils?.getSelectedEmrVariantId?.() ?? null;
  // Preferred medication rules: when UniEMR's lookup names nothing, the block's own rules read the intake answers.
  const resolverApplies = Boolean(
    utils &&
    typeof utils.resolvePreferredDrugs === 'function' &&
    preferredKey !== '[]',
  );
  const intakeAnswers = (): Record<string, unknown> => {
    const answers: Record<string, unknown> = {};
    const completed = dataObject(survey.customData?.completedFormResponses);
    for (const form of Object.values(completed))
      Object.assign(answers, dataObject(form));
    // The same responses preferredKey holds, without walking the forms again.
    const responses: any[] = JSON.parse(preferredKey);
    for (const response of responses)
      Object.assign(answers, dataObject(response?.form_data));
    return answers;
  };
  // Only the multi-page checkout preselects from these rules, so only its pages read the answers on every render.
  const rulesAnswers =
    stepMode && preferredRules.length ? intakeAnswers() : {};
  const rulesKey = `rules:${JSON.stringify(
    preferredRules.map((rule) => rulesAnswers[rule.fieldName] ?? null),
  )}`;
  // The intake answers both preselects work from: a pick or a preselect holds until these change. The checkout's own
  // answer is left out, since it changes with every payment and says nothing about the medication. Both pages leave
  // out the same field names, so a preselect or pick made on one page holds on the other. A form left with no answers
  // is dropped too: the checkout form's own entry appears only once it holds a value.
  const intakeKey = (): string =>
    JSON.stringify(
      (JSON.parse(preferredKey) as any[]).flatMap((response) => {
        const answers = { ...dataObject(response?.form_data) };
        delete answers[CHECKOUT_FIELD_NAME];
        delete answers[fieldName];
        delete answers[paymentFieldName];
        return Object.keys(answers).length
          ? [{ ...dataObject(response), form_data: answers }]
          : [];
      }),
    );
  const answersKey = stepMode ? `${intakeKey()}|${rulesKey}` : '';
  answersKeyRef.current = answersKey;
  useEffect(() => {
    if (
      !utils ||
      !preselects ||
      disabled ||
      paymentComplete ||
      preferredKey === '[]' ||
      typeof utils.resolvePreferredDrugs !== 'function'
    )
      return;
    if (stepMode) {
      const memory = readMemory(module);
      if (memory.pickedFor === answersKey) return;
      if (memory.preferredFor === answersKey) {
        if (memory.notice) setPreferred(memory.notice);
        return;
      }
    }
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
        const notice = {
          status: applied.length ? 'applied' : found ? 'kept' : 'none',
          drugs,
        } as const;
        setPreferred(notice);
        if (stepMode && (applied.length || found))
          writeMemory(module, { preferredFor: answersKey, notice });
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
    preselects,
    preferredKey,
    preferredVariantId,
    disabled,
    paymentComplete,
    refresh,
    stepMode,
    step,
    module,
    answersKey,
  ]);

  useEffect(() => {
    if (
      !stepMode ||
      !preselects ||
      !module ||
      !isEmr ||
      disabled ||
      paymentComplete ||
      preferredRules.length === 0
    )
      return;
    // Wait for the lookup, and leave the selection to it when it found a preference.
    if (
      resolverApplies &&
      preferred.status !== 'none' &&
      preferred.status !== 'unavailable'
    )
      return;
    const memory = readMemory(module);
    if (memory.pickedFor === answersKey) return;
    if (memory.preferredFor === answersKey) {
      if (memory.notice) setPreferred(memory.notice);
      return;
    }
    const medication = matchPreferredMedication(
      preferredRules,
      intakeAnswers(),
    );
    const target = medication ? findPreferredDrug(module, medication) : null;
    if (!target) {
      writeMemory(module, {
        preferredFor: answersKey,
        notice: { status: 'none', drugs: '' },
      });
      return;
    }
    if (!target.current) {
      module.setDrugGroupSelection(target.groupId, [target.drug.id]);
      invalidateCoupon(module);
      setPrepaidCoupon('');
    }
    const notice = {
      status: 'applied',
      drugs: String(target.drug.drug_name),
    } as const;
    writeMemory(module, { preferredFor: answersKey, notice });
    setPreferred(notice);
    refresh();
    // intakeAnswers reads the same answers answersKey is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    preselects,
    module,
    isEmr,
    disabled,
    paymentComplete,
    answersKey,
    resolverApplies,
    preferred.status,
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

  // The layout's Back stays usable while the card is confirmed. If the page has gone when the confirmation fails, the
  // checkout it was for is released here, since the unmount skipped it.
  const releaseAfterUnmount = () => {
    const held = purchaseRef.current;
    if (!stepMode || mountedRef.current || !held || !module) return;
    purchaseRef.current = null;
    releaseCheckout(module, held);
  };

  const finishOrder = async (result: unknown): Promise<void> => {
    if (!module || busy.current || survey.isSubmitting) return;
    if (stepMode && orderInFlight.current) {
      setPending(true);
      const started = Date.now();
      while (orderInFlight.current && Date.now() - started < 15000)
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      if (!mountedRef.current) return;
      setPending(false);
      if (orderInFlight.current) {
        setActionError(copy.submitErrorMessage);
        return;
      }
      return finishOrder(result);
    }
    if (enrollmentRecorded()) {
      setOrderSubmitted(true);
      return;
    }
    busy.current = true;
    if (stepMode) orderInFlight.current = true;
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
      // Back during the session check unmounts the page; the order then waits until the patient completes it again.
      if (stepMode && !mountedRef.current) return;
      await submitSurvey({ ...survey.values, [fieldName]: result });
      submitted = true;
      // Core's submit swallows a failed order, so the memory goes only once the enrollment is recorded.
      if (stepMode && enrollmentRecorded()) clearMemory(module);
    } catch (caught) {
      if (mountedRef.current)
        setActionError(
          caught instanceof Error && caught.message
            ? caught.message
            : copy.submitErrorMessage,
        );
    } finally {
      busy.current = false;
      if (stepMode) orderInFlight.current = false;
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
    paymentInFlight.current = true;
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

  // Until the first lookup for these answers settles, the summary would show the plan's default medication and then
  // switch to the preferred one, so it shows the lookup's loading line instead.
  const pageMemory = stepMode && module ? readMemory(module) : {};
  const summaryPending =
    stepMode &&
    preselects &&
    resolverApplies &&
    !disabled &&
    !paymentComplete &&
    (preferred.status === 'idle' || preferred.status === 'loading') &&
    pageMemory.preferredFor !== answersKey &&
    pageMemory.pickedFor !== answersKey;

  const orderSummary = summaryPending ? (
    <p
      role="status"
      className="flex items-center gap-2 border-t border-gray-200 pt-4 text-base text-gray-600"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      {copy.preferredLoadingMessage}
    </p>
  ) : (
    <div className="space-y-4">
      {beforePayment ? null : discountField}

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
                  hidden={beforePayment}
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
        {summaryPending ? null : (
          <GradientText brand={brand} className="shrink-0">
            {formatMoney(pricing.total, true)}
          </GradientText>
        )}
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
                        true,
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
                      update(writePhase, item.phaseId === phaseId, true);
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

  // Your plan leaves for Shipping once every required medication group has a pick and a plan is chosen, and the
  // preferred medication lookup has settled: the pages after it no longer change the medication.
  const continueToShipping = () => {
    if (locked || summaryPending) return;
    const missing =
      (module.getDrugGroups?.() ?? []).some(
        (group: any) =>
          group.is_required &&
          group.drugs?.length &&
          !module.getDrugGroupSelection(group.id)?.length,
      ) ||
      ((module.getVariants?.() ?? []).length > 0 &&
        !module.getSelectedEmrVariantId?.());
    setActionError(missing ? stepCopy.selectionMissingMessage : '');
    if (!missing) survey.goToNextBlock();
  };

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
      {step === 'selection' ? (
        <div className="space-y-4">
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          {actionError ? (
            <InlineMessage tone="error">{actionError}</InlineMessage>
          ) : null}
          <PrimaryButton
            icon={ArrowRight}
            onClick={continueToShipping}
            disabled={locked || summaryPending}
            brand={brand}
          >
            {stepCopy.selectionContinueLabel}
          </PrimaryButton>
        </div>
      ) : (
        <PrimaryButton icon={ArrowRight} onClick={jumpToCheckout} brand={brand}>
          {copy.checkoutJumpLabel}
        </PrimaryButton>
      )}
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
              paymentInFlight.current = false;
              setPending(false);
              releaseAfterUnmount();
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
              paymentInFlight.current = false;
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
              paymentInFlight.current = false;
              setPending(false);
              if (continuation) void finishOrder(result);
            } catch (caught) {
              pendingPayment.current = false;
              paymentInFlight.current = false;
              setPending(false);
              releaseAfterUnmount();
              setActionError(
                caught instanceof Error && caught.message
                  ? caught.message
                  : copy.submitErrorMessage,
              );
            }
          }}
          onError={(message: string) => {
            pendingPayment.current = false;
            paymentInFlight.current = false;
            setPending(false);
            releaseAfterUnmount();
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
        icon={Lock}
        onClick={completeOrder}
        disabled={locked || orderSubmitted}
        busy={pending || survey.isSubmitting}
        brand={brand}
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

  const continueToPayment = () => {
    if (!module || locked) return;
    syncPatientInfo();
    const problem = shippingError(module, copy);
    setActionError(problem ?? '');
    if (!problem) survey.goToNextBlock();
  };

  const shippingContinue = (
    <div className="space-y-4 px-6">
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {actionError ? (
        <InlineMessage tone="error">{actionError}</InlineMessage>
      ) : null}
      <PrimaryButton
        icon={ArrowRight}
        onClick={continueToPayment}
        disabled={locked}
        brand={brand}
      >
        {stepCopy.shippingContinueLabel}
      </PrimaryButton>
    </div>
  );

  // Payment shows where the order ships and goes back to Shipping to change it.
  const shippingAddress = module.getCheckoutAddress?.()?.address;
  const hasShippingAddress =
    hasText(shippingAddress?.line1) && hasText(shippingAddress?.zip);
  const addressLine = (
    <div
      className={cn(cardClass, 'flex items-start justify-between gap-3')}
      style={cardStyle}
    >
      <p
        className="min-w-0 text-base text-gray-900"
        style={hasShippingAddress ? undefined : secondaryTone}
      >
        {hasShippingAddress
          ? fill(stepCopy.shipToTemplate, {
              address: describeAddress(shippingAddress),
            })
          : stepCopy.addressMissingMessage}
      </p>
      <button
        type="button"
        onClick={survey.goToPreviousBlock}
        disabled={locked || !survey.canGoBack}
        className="shrink-0 text-base text-gray-900 underline underline-offset-4 disabled:opacity-50"
      >
        {hasShippingAddress
          ? stepCopy.editAddressLabel
          : stepCopy.addressMissingLabel}
      </button>
    </div>
  );

  const checkoutHeading = (
    <div className="space-y-1">
      <h2 className={cn(headingClass, 'text-2xl')}>{copy.checkoutTitle}</h2>
      {hasText(copy.checkoutSubtitle) ? (
        <p className="text-base text-gray-600">{copy.checkoutSubtitle}</p>
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

      {step === 'shipping' ? (
        <section className="space-y-4">
          {checkoutHeading}
          {shippingSection}
          {shippingContinue}
        </section>
      ) : (
        <>
          {choicesShown ? (
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
          ) : null}

          {choicesShown ? benefitsSection : null}

          {step === 'selection' ? null : (
            <section
              ref={(node) => {
                checkoutRef.current = node;
              }}
              className="scroll-mt-36 space-y-4"
            >
              {checkoutHeading}
              {step === 'payment' ? addressLine : shippingSection}
              {paymentSection}
              {completionSection}
            </section>
          )}
        </>
      )}
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

CheckoutRenderer.displayName = 'CheckoutRenderer';
