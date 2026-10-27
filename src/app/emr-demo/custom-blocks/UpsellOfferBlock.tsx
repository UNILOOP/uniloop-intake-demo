/* eslint-disable @typescript-eslint/no-explicit-any */

import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { themes } from '@/packages/survey-form-package/src/themes';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { loadStripe } from '@stripe/stripe-js';
import { CircleCheck, Gift, Loader2, Timer } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { InlineMessage, MediaTile } from './checkout/atoms';
import {
  type BillingPurchase,
  checkoutState,
  completePayment,
  dataObject,
  type EnrollmentModule,
  formatMoney,
  getAuthToken,
  getDrugImage,
} from './checkout/pricing';
import { readCopy } from './checkout/copy';
import {
  cardClass,
  cardStyle,
  darkButtonClass,
  darkButtonStyle,
  headingClass,
  medicationNameClass,
  secondaryTone,
} from './checkout/styles';

const DEFAULTS = {
  fieldName: 'upsellOffer',
  label: 'One more thing before we send your order',
  paidLabel: 'Payment approved',
  thankYouHeading: 'Thank you! Your payment is approved.',
  thankYouText: 'Your order goes to your provider when you finish this page.',
  description:
    'Add {drug} to this order for {price}. It is only offered now, and it goes to your provider with the rest of your order.',
  buyLabel: 'Add to my order • {price}',
  skipLabel: 'Decline this offer',
  timerLabel: 'This offer ends in {time}',
  addedMessage: '{drug} is added. Your new total is {total}.',
  doneMessage: 'Your order is ready. Continue to finish.',
  expiredMessage: 'This offer has ended. Continue to finish.',
  noCardMessage: 'Complete the payment step first.',
};

type TextKey = Exclude<keyof typeof DEFAULTS, 'fieldName'>;
type Layout = 'offer' | 'thank-you';
type Decisions = Record<string, 'added' | 'skipped'>;
// `decisions` holds each offered drug's answer; `deadline` is when the offer runs out (ms); `done` is set once
// nothing is left to offer, and is what lets the page continue.
type Answer = { decisions?: Decisions; deadline?: number; done?: boolean };

const text = (data: BlockData, key: TextKey): string =>
  typeof data[key] === 'string' && data[key] ? data[key] : DEFAULTS[key];

const fillIn = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

// Ids from the builder, in priority order: "1355, 1044". The spike's single `drugId` still counts.
const parseIds = (raw: unknown): number[] =>
  String(raw ?? '')
    .split(/[\s,]+/)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

// One image per offer, one line each: "<id> <url>". The drug's catalogue photo comes first.
const parseImages = (raw: unknown): Map<number, string> =>
  new Map(
    String(raw ?? '')
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .filter(([id, url]) => Number(id) > 0 && url)
      .map(([id, url]) => [Number(id), url] as [number, string]),
  );

// A builder id is either the plan's drug id or the catalogue drug's id. The catalogue id is the same on every plan,
// so one form can serve all arms of an A/B test.
const isDrug = (drug: any, id: number) => drug.id === id || drug.merchant_drug?.id === id;

// The plan's optional drugs to offer, in the builder's order (empty: every optional drug, in plan order). Ids that
// aren't on this plan are left out, so the next priority takes their place.
const offerList = (module: EnrollmentModule, data: BlockData): any[] => {
  const drugs: any[] = module?.getOptionalDrugs?.() ?? [];
  const ids = parseIds(data.drugIds ?? data.drugId);
  if (!ids.length) return drugs;
  const ordered = ids.map((id) => drugs.find((drug) => isDrug(drug, id))).filter(Boolean);
  return ordered.filter((drug, index) => ordered.indexOf(drug) === index);
};

// The spike saved one answer as { decision, drugId }; read it as the newer per-drug answers.
const readAnswer = (value: unknown): Answer => {
  const raw = dataObject(value) as any;
  if (raw.decisions) return raw;
  if (raw.decision) return { decisions: raw.drugId ? { [raw.drugId]: raw.decision } : {}, done: true };
  return {};
};

// The deadline outlives a reload: it's kept per payment, so a new payment gets a fresh offer.
const deadlineKey = (block: BlockData, module: EnrollmentModule) => {
  const paid = module?.getCheckoutData?.();
  const payment = paid?.stripePaymentIntentId || paid?.stripePaymentMethodId;
  return payment ? `upsell-deadline:${block.uuid ?? block.fieldName}:${payment}` : null;
};

const storedDeadline = (key: string | null): number | undefined => {
  if (!key) return undefined;
  try {
    return Number(localStorage.getItem(key)) || undefined;
  } catch {
    return undefined;
  }
};

const storeDeadline = (key: string | null, deadline: number) => {
  if (!key) return;
  try {
    localStorage.setItem(key, String(deadline));
  } catch {
    // Without storage the deadline still holds for this page view.
  }
};

const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

// Adds the drug to the order the patient just paid for. A prepaid plan gets a new quote. When payment placed a hold
// (a new card in authorize mode), the hold can't grow, so the checkout is called again with the drug: a new hold
// confirmed with that card, written to the draft the enrollment submits. The first hold is then released: a prepaid
// plan's by cancelling its old checkout, a per-refill plan's directly. Any failure puts the order back as it was.
const addToOrder = async (module: EnrollmentModule, drugId: number) => {
  const token = getAuthToken(module);
  const before = module.getCheckoutData?.();
  const paymentMethodId = before?.stripePaymentMethodId;
  if (!token || !before || !paymentMethodId) throw new Error(DEFAULTS.noCardMessage);

  // Only a new card is held at payment. A saved card's id is Uniloop's own, and the server holds it when the
  // enrollment is created, so then the new selection is enough.
  const authorize = Boolean(before.stripePaymentIntentId);
  const copy = readCopy({} as BlockData);
  // Nothing on the server releases the first hold; Stripe drops it only after about 7 days, so the patient would see
  // two pending charges until then. Releasing it here keeps the second one off the card.
  const releaseOld = () => {
    if (before.billingCheckoutUuid)
      Promise.resolve(module.cancelBillingCheckout?.(token, before.billingCheckoutUuid)).catch(() => {});
    else if (before.stripePaymentIntentId)
      Promise.resolve(module.cancelAuthorizationIntent?.(token, before.stripePaymentIntentId)).catch(() => {});
  };

  module.toggleOptionalDrug(drugId);
  let purchase: BillingPurchase | null = null;
  try {
    // A changed selection drops a prepaid plan's quote, so it needs a new one either way.
    if (before.billingOptionId != null) {
      purchase = await module.quoteBillingOption(token, before.couponCode ?? null);
      module.setCheckoutData({
        ...module.getCheckoutData(),
        billingCheckoutUuid: purchase!.checkout_uuid,
        billingQuote: purchase!.quote,
        billingTermsAccepted: true,
      });
    }
    if (!authorize) {
      // No hold yet, so the enrollment holds or charges the new selection.
      const checkout = checkoutState(module, purchase);
      completePayment(module, copy, checkout.signature, { purchase }, paymentMethodId);
      releaseOld();
      return checkout.total;
    }

    const hold = await module.createAuthorizationIntent(token);
    const intent = hold?.paymentIntent;
    if (!hold?.success || !intent?.client_secret)
      throw new Error(hold?.error || 'The new hold could not be placed.');
    const stripe = await loadStripe(intent.publishable_key, {
      stripeAccount: intent.stripe_account,
    });
    if (!stripe) throw new Error('Stripe did not load.');
    const confirmed = await stripe.confirmCardPayment(intent.client_secret, {
      payment_method: paymentMethodId,
    });
    if (confirmed.error || confirmed.paymentIntent?.status !== 'requires_capture')
      throw new Error(confirmed.error?.message || 'The card did not accept the new hold.');

    const checkout = checkoutState(module, purchase);
    completePayment(module, copy, checkout.signature, { purchase }, paymentMethodId, confirmed.paymentIntent.id);
    releaseOld();
    return checkout.total;
  } catch (caught) {
    module.toggleOptionalDrug(drugId);
    module.setCheckoutData(before);
    if (purchase)
      Promise.resolve(module.cancelBillingCheckout?.(token, purchase.checkout_uuid)).catch(() => {});
    throw caught;
  }
};

const UpsellOfferRenderer: React.FC<BlockRendererProps> = ({ block, value, onChange, theme: themeProp }) => {
  const survey = useSurveyForm();
  const module = (survey.customData?.emrEnrollmentUtils ?? survey.customData?.enrollmentModule) as EnrollmentModule;
  const theme = themeProp ?? survey.theme ?? themes.default;
  const primary = theme.colors?.primary || themes.default.colors.primary;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const layout: Layout = block.layout === 'thank-you' ? 'thank-you' : 'offer';
  const timerMs = Math.max(0, Number(block.timerMinutes) || 0) * 60_000;
  const answer = readAnswer(value);
  const decisions = answer.decisions ?? {};
  const offers = module ? offerList(module, block) : [];
  // An add the patient later removed at checkout no longer counts, so that offer shows again.
  const stale = offers.filter(
    (drug) => decisions[drug.id] === 'added' && !module?.isOptionalDrugSelected?.(drug.id),
  );
  const current = offers.find(
    (drug) =>
      (!decisions[drug.id] || stale.includes(drug)) && !module?.isOptionalDrugSelected?.(drug.id),
  );
  const added = offers.filter((drug) => decisions[drug.id] === 'added' && !stale.includes(drug));
  const key = module ? deadlineKey(block, module) : null;
  const deadline = timerMs ? (answer.deadline ?? storedDeadline(key)) : undefined;
  const expired = deadline != null && now >= deadline;

  // Keep the answer in step with the order: drop stale adds, start the timer, decline what's left when it runs out,
  // and mark the page done once nothing is left to offer (such as when the patient picked the drug at checkout).
  useEffect(() => {
    if (!module || busyRef.current) return;
    const next: Answer = { ...answer, decisions: { ...decisions } };
    stale.forEach((drug) => delete next.decisions![drug.id]);
    if (timerMs && !next.deadline) {
      next.deadline = deadline ?? Date.now() + timerMs;
      storeDeadline(key, next.deadline);
    }
    if (expired) offers.forEach((drug) => (next.decisions![drug.id] ??= 'skipped'));
    next.done = expired || !current;
    if (JSON.stringify(next) !== JSON.stringify(dataObject(value))) onChange?.(next);
  });

  useEffect(() => {
    if (!deadline || answer.done) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [deadline, answer.done]);

  if (!module) return <InlineMessage>The offer shows once the treatment plan has loaded.</InlineMessage>;

  const orderTotal = formatMoney(total ?? Number(module.getCheckoutData?.()?.total ?? 0), true);
  const lastAdded = added[added.length - 1];
  const images = parseImages(block.images);
  const showOffer = current && !expired;

  const choose = async (drug: any, picked: 'added' | 'skipped') => {
    if (busyRef.current) return;
    setError('');
    if (picked === 'skipped') {
      onChange?.({ ...answer, decisions: { ...decisions, [drug.id]: picked } });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      setTotal(await addToOrder(module, drug.id));
      onChange?.({ ...answer, decisions: { ...decisions, [drug.id]: picked } });
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'The medication could not be added.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const offerCard = (drug: any) => {
    const price = module.getDrugPrice(drug);
    const compareAt = Number(drug.compare_at_price) || 0;
    const values = { drug: String(drug.drug_name), price: formatMoney(price, true), total: orderTotal };
    const imageUrl =
      getDrugImage(drug) ?? images.get(drug.id) ?? images.get(drug.merchant_drug?.id) ?? null;
    return (
      <div className={`${cardClass} space-y-4`} style={cardStyle}>
        <h2 className={`${headingClass} text-2xl`}>{block.label || DEFAULTS.label}</h2>
        {deadline ? (
          <div
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${primary} 10%, white)`,
              color: `color-mix(in srgb, ${primary} 55%, black)`,
            }}
            role="timer"
            aria-live="off"
          >
            <Timer className="size-4" aria-hidden="true" />
            {fillIn(text(block, 'timerLabel'), { time: formatTime(deadline - now) })}
          </div>
        ) : null}
        <div className="flex items-center gap-4">
          <MediaTile imageUrl={imageUrl} label={values.drug} primary={primary} />
          <div className="min-w-0 space-y-1">
            <p className={medicationNameClass}>{values.drug}</p>
            <p className="text-base">
              {compareAt > price ? (
                <s className="mr-2" style={secondaryTone}>
                  {formatMoney(compareAt, true)}
                </s>
              ) : null}
              <span className="font-medium">{values.price}</span>
            </p>
          </div>
        </div>
        <p className="text-base" style={secondaryTone}>
          {fillIn(text(block, 'description'), values)}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            className={darkButtonClass}
            style={darkButtonStyle}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void choose(drug, 'added')}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            <span>{fillIn(text(block, 'buyLabel'), values)}</span>
          </button>
          <button
            type="button"
            className="w-full py-2 text-base underline"
            disabled={busy}
            onClick={() => void choose(drug, 'skipped')}
          >
            {text(block, 'skipLabel')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {layout === 'thank-you' ? (
        <div className={`${cardClass} flex items-start gap-3`} style={cardStyle}>
          <CircleCheck className="mt-1 size-7 shrink-0" style={{ color: primary }} aria-hidden="true" />
          <div className="space-y-1">
            <h2 className={`${headingClass} text-2xl`}>{text(block, 'thankYouHeading')}</h2>
            <p className="text-base" style={secondaryTone}>
              {text(block, 'thankYouText')}
            </p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-base font-medium">
          <CircleCheck className="size-5" style={{ color: primary }} aria-hidden="true" />
          {text(block, 'paidLabel')}
        </p>
      )}
      {lastAdded ? (
        <InlineMessage tone="success">
          {fillIn(text(block, 'addedMessage'), { drug: String(lastAdded.drug_name), total: orderTotal })}
        </InlineMessage>
      ) : null}
      {showOffer ? offerCard(current) : null}
      {!showOffer && !lastAdded ? (
        <InlineMessage>{text(block, expired ? 'expiredMessage' : 'doneMessage')}</InlineMessage>
      ) : null}
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
    </div>
  );
};

const selectClass = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm';

const UpsellOfferFields: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const set = (key: string, next: unknown) => onUpdate?.({ ...data, [key]: next });
  const field = (key: TextKey, label: string, long = false) => (
    <div className="space-y-1">
      <Label className="text-sm" htmlFor={`upsell-${key}`}>{label}</Label>
      {long ? (
        <Textarea
          id={`upsell-${key}`}
          value={text(data, key)}
          onChange={(event) => set(key, event.target.value)}
        />
      ) : (
        <Input id={`upsell-${key}`} value={text(data, key)} onChange={(event) => set(key, event.target.value)} />
      )}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="upsell-drugIds">
          Optional medications to offer, in order (plan or catalogue drug ids; empty: every optional drug on the plan)
        </Label>
        <Input
          id="upsell-drugIds"
          placeholder="1355, 1388"
          value={data.drugIds ?? data.drugId ?? ''}
          onChange={(event) => set('drugIds', event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="upsell-layout">Look</Label>
        <select
          id="upsell-layout"
          className={selectClass}
          value={data.layout === 'thank-you' ? 'thank-you' : 'offer'}
          onChange={(event) => set('layout', event.target.value)}
        >
          <option value="offer">Offer page (after payment)</option>
          <option value="thank-you">Thank-you page with the offer below</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="upsell-timerMinutes">Countdown in minutes (empty: no countdown)</Label>
        <Input
          id="upsell-timerMinutes"
          inputMode="numeric"
          value={data.timerMinutes ?? ''}
          onChange={(event) => set('timerMinutes', event.target.value ? Number(event.target.value) : undefined)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="upsell-images">Images when the drug has no photo (one per line: id url)</Label>
        <Textarea
          id="upsell-images"
          value={data.images ?? ''}
          onChange={(event) => set('images', event.target.value)}
        />
      </div>
      {data.layout === 'thank-you' ? (
        <>
          {field('thankYouHeading', 'Thank-you heading')}
          {field('thankYouText', 'Thank-you text', true)}
        </>
      ) : (
        field('paidLabel', 'Payment line')
      )}
      {field('timerLabel', 'Countdown text ({time})')}
      {field('description', 'Offer text ({drug}, {price})', true)}
      {field('buyLabel', 'Buy button ({price})')}
      {field('skipLabel', 'Decline link')}
      {field('addedMessage', 'Added message ({drug}, {total})')}
      {field('doneMessage', 'Message when nothing was added')}
      {field('expiredMessage', 'Message when the countdown ran out')}
    </div>
  );
};

const UpsellOfferItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
    <p className="font-medium">{data.label || DEFAULTS.label}</p>
    <div className="rounded-full bg-gray-900 py-2 text-center text-sm text-white">
      {fillIn(text(data, 'buyLabel'), { price: '$' })}
    </div>
  </div>
);

// Shown after payment and before the enrollment is submitted. It offers the plan's optional drugs in the builder's
// order, one at a time; Buy now adds one to the same order, and each is answered once with no way back to it.
export const UpsellOfferBlock: BlockDefinition = {
  type: 'upsellOffer',
  name: 'Nelson – Upsell offer',
  description: 'After payment: offer optional medications in order, added to the same order with a new hold',
  icon: <Gift className="h-4 w-4" />,
  defaultData: {
    type: 'upsellOffer',
    ...DEFAULTS,
    layout: 'offer',
    required: true,
  },
  renderItem: (props) => <UpsellOfferItem {...props} />,
  renderFormFields: (props) => <UpsellOfferFields {...props} />,
  renderPreview: () => (
    <div className="flex w-full items-center justify-center py-1 text-xs text-gray-500">Upsell offer</div>
  ),
  renderBlock: (props) => <UpsellOfferRenderer {...props} />,
  validate: (data: BlockData) => (data.fieldName ? null : 'Field name is required'),
  validateValue: (value: any) =>
    readAnswer(value).done ? null : 'Choose to add the offer or decline it.',
};

export default UpsellOfferBlock;
