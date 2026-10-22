/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BlockData,
  BlockDefinition,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { CreditCard } from 'lucide-react';
import React from 'react';
import { CheckoutBuilderForm } from './checkout/CheckoutBuilderForm';
import { CheckoutRenderer } from './checkout/CheckoutRenderer';
import {
  CHECKOUT_FIELD_NAME,
  COPY_DEFAULTS,
  DEFAULT_BENEFITS,
  DEFAULT_PREFERRED_MEDICATION_RULES,
  readCopy,
  STEP_COPY_DEFAULTS,
} from './checkout/copy';

const CheckoutPaymentItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  const copy = readCopy(data);

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <p className="font-medium">{copy.personalizeTitle}</p>
      <p className="text-sm text-gray-500">
        {[
          copy.medicationTitle,
          copy.planTitle,
          copy.addOnsTitle,
          copy.paymentTitle,
        ].join(' · ')}
      </p>
      <div className="rounded-full bg-gray-900 py-2 text-center text-sm text-white">
        {copy.completeOrderLabel}
      </div>
    </div>
  );
};

const CheckoutPaymentPreview: React.FC = () => (
  <div className="flex w-full items-center justify-center py-1">
    <div className="w-4/5 space-y-1 rounded-md border bg-gray-50 p-2 text-xs text-gray-500">
      <div>Medication · Plan · Payment</div>
      <div className="rounded-full bg-gray-900 py-0.5 text-center text-white">
        Complete order
      </div>
    </div>
  </div>
);

// ============================================================================
// Block definition
// ============================================================================

// Page 2 of the two-page checkout. It stores the same payment result as the single-page checkout, under the same
// default field name, so the enrollment receives the same payload.
// The portal's Validate Code reads `type` from the source text, so it must be a string literal here.
export const CheckoutPaymentBlock: BlockDefinition = {
  type: 'checkoutPayment',
  name: 'Nelson – Checkout: Payment',
  description:
    'Two-page checkout, page 2: medication, delivery plan, add-ons and payment',
  icon: <CreditCard className="h-4 w-4" />,
  defaultData: {
    type: 'checkoutPayment',
    fieldName: CHECKOUT_FIELD_NAME,
    label: 'Payment',
    required: true,
    showContinueButton: false,
    autoContinueOnSelect: false,
    isEndBlock: false,
    showDrugImages: true,
    showTitrationOptions: true,
    benefits: DEFAULT_BENEFITS,
    disclaimers: [],
    preferredMedicationRules: DEFAULT_PREFERRED_MEDICATION_RULES,
    ...COPY_DEFAULTS,
    ...STEP_COPY_DEFAULTS,
  },
  renderItem: (props) => <CheckoutPaymentItem {...props} />,
  renderFormFields: (props) => (
    <CheckoutBuilderForm {...props} step="payment" />
  ),
  renderPreview: () => <CheckoutPaymentPreview />,
  renderBlock: (props) => <CheckoutRenderer {...props} step="payment" />,
  validate: (data: BlockData) =>
    data.fieldName ? null : 'Field name is required',
  // The checkout signature needs the enrollment module, so the renderer re-checks it and resets stale values.
  validateValue: (value: any, data: BlockData) =>
    value?.complete === true && value.paymentMethodId
      ? null
      : readCopy(data).paymentRequiredMessage,
};

export default CheckoutPaymentBlock;
