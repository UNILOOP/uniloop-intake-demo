/* eslint-disable @typescript-eslint/no-explicit-any */

import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { loadStripe } from '@stripe/stripe-js';
import { Gift, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { InlineMessage } from './checkout/atoms';
import {
  type BillingPurchase,
  checkoutState,
  completePayment,
  dataObject,
  type EnrollmentModule,
  formatMoney,
  getAuthToken,
} from './checkout/pricing';
import { readCopy } from './checkout/copy';
import {
  cardClass,
  cardStyle,
  darkButtonClass,
  darkButtonStyle,
  headingClass,
  secondaryTone,
} from './checkout/styles';

const DEFAULTS = {
  fieldName: 'upsellOffer',
  label: 'One more thing before we send your order',
  description:
    'Add {drug} to this order for {price}. It is only offered now, and it goes to your provider with the rest of your order.',
  buyLabel: 'Buy now',
  skipLabel: 'No thanks',
  addedMessage: '{drug} is added. Your new total is {total}.',
  noCardMessage: 'Complete the payment step first.',
};

type Decision = { decision: 'added' | 'skipped'; drugId?: number };

const text = (data: BlockData, key: keyof typeof DEFAULTS): string =>
  typeof data[key] === 'string' && data[key] ? data[key] : DEFAULTS[key];

const fillIn = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

// The offered drug: the one already added, else the one set in the builder, else the plan's first optional drug
// the patient hasn't picked.
const findOffer = (module: EnrollmentModule, data: BlockData, addedId?: number) => {
  const drugs: any[] = module?.getOptionalDrugs?.() ?? [];
  const configured = Number(data.drugId);
  return (
    drugs.find((drug) => drug.id === addedId) ??
    drugs.find((drug) => drug.id === configured) ??
    drugs.find((drug) => !module.isOptionalDrugSelected?.(drug.id)) ??
    null
  );
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

const UpsellOfferRenderer: React.FC<BlockRendererProps> = ({ block, value, onChange }) => {
  const survey = useSurveyForm();
  const module = (survey.customData?.emrEnrollmentUtils ?? survey.customData?.enrollmentModule) as EnrollmentModule;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const busyRef = useRef(false);
  const answer = dataObject(value) as Partial<Decision>;
  const drug = module ? findOffer(module, block, answer.drugId) : null;
  // An add the patient later removed at checkout no longer counts, so the offer shows again.
  const stale = answer.decision === 'added' && !module?.isOptionalDrugSelected?.(answer.drugId as number);
  const decision = stale ? undefined : answer.decision;

  // Nothing left to offer, such as when the patient picked the drug at checkout: skip so the page can continue.
  useEffect(() => {
    if (!module) return;
    if (stale) onChange?.(undefined);
    else if (!drug && !decision) onChange?.({ decision: 'skipped' });
  }, [module, drug, decision, stale, onChange]);

  if (!drug) {
    return <InlineMessage>There is no optional medication on this plan to offer.</InlineMessage>;
  }

  const values = {
    drug: String(drug.drug_name),
    price: formatMoney(module.getDrugPrice(drug), true),
    total: formatMoney(total ?? Number(module.getCheckoutData?.()?.total ?? 0), true),
  };

  const choose = async (picked: Decision['decision']) => {
    if (busyRef.current || decision) return;
    setError('');
    if (picked === 'skipped') {
      onChange?.({ decision: picked });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      setTotal(await addToOrder(module, drug.id));
      onChange?.({ decision: picked, drugId: drug.id });
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'The medication could not be added.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardClass} space-y-3`} style={cardStyle}>
        <h2 className={`${headingClass} text-2xl`}>{block.label || DEFAULTS.label}</h2>
        <p className="text-base" style={secondaryTone}>
          {fillIn(text(block, 'description'), values)}
        </p>
      </div>
      {decision === 'added' ? (
        <InlineMessage tone="success">{fillIn(text(block, 'addedMessage'), values)}</InlineMessage>
      ) : decision ? null : (
        <div className="space-y-2">
          <button
            type="button"
            className={darkButtonClass}
            style={darkButtonStyle}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void choose('added')}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            <span>{text(block, 'buyLabel')}</span>
          </button>
          <button
            type="button"
            className="w-full py-2 text-base underline"
            disabled={busy}
            onClick={() => void choose('skipped')}
          >
            {text(block, 'skipLabel')}
          </button>
        </div>
      )}
      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
    </div>
  );
};

const UpsellOfferFields: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const set = (key: string, next: unknown) => onUpdate?.({ ...data, [key]: next });
  const field = (key: keyof typeof DEFAULTS, label: string, long = false) => (
    <div className="space-y-1">
      <Label htmlFor={`upsell-${key}`}>{label}</Label>
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
        <Label htmlFor="upsell-drugId">Optional medication id (empty: the plan&apos;s first one not picked)</Label>
        <Input
          id="upsell-drugId"
          inputMode="numeric"
          value={data.drugId ?? ''}
          onChange={(event) => set('drugId', event.target.value ? Number(event.target.value) : undefined)}
        />
      </div>
      {field('description', 'Offer text ({drug}, {price})', true)}
      {field('buyLabel', 'Buy button')}
      {field('skipLabel', 'Skip link')}
      {field('addedMessage', 'Added message ({drug}, {total})')}
    </div>
  );
};

const UpsellOfferItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
    <p className="font-medium">{data.label || DEFAULTS.label}</p>
    <div className="rounded-full bg-gray-900 py-2 text-center text-sm text-white">{text(data, 'buyLabel')}</div>
  </div>
);

// Shown after payment and before the enrollment is submitted. Buy now adds a plan's optional drug to the same order;
// the patient answers once and the page has no way back to it.
export const UpsellOfferBlock: BlockDefinition = {
  type: 'upsellOffer',
  name: 'Nelson – Upsell offer',
  description: 'After payment: offer an optional medication, added to the same order with a new hold',
  icon: <Gift className="h-4 w-4" />,
  defaultData: {
    type: 'upsellOffer',
    ...DEFAULTS,
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
    value?.decision === 'added' || value?.decision === 'skipped' ? null : 'Choose Buy now or No thanks.',
};

export default UpsellOfferBlock;
