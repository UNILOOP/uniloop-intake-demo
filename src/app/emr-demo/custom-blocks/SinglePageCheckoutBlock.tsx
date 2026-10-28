/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BlockData,
  BlockDefinition,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { ShoppingBag } from 'lucide-react';
import React from 'react';
import { CheckoutBuilderForm } from './checkout/CheckoutBuilderForm';
import { CheckoutRenderer } from './checkout/CheckoutRenderer';
import {
  CHECKOUT_FIELD_NAME,
  COPY_DEFAULTS,
  DEFAULT_BENEFITS,
  readCopy,
} from './checkout/copy';

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
export const SinglePageCheckoutBlock: BlockDefinition = {
  type: 'singlePageCheckout',
  name: 'Nelson – Checkout (WIP)',
  description:
    'Single-page checkout: medication, delivery plan, add-ons, shipping and payment',
  icon: <ShoppingBag className="h-4 w-4" />,
  defaultData: {
    type: 'singlePageCheckout',
    fieldName: CHECKOUT_FIELD_NAME,
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
  renderFormFields: (props) => <CheckoutBuilderForm {...props} />,
  renderPreview: () => <SinglePageCheckoutPreview />,
  renderBlock: (props) => <CheckoutRenderer {...props} />,
  validate: (data: BlockData) =>
    data.fieldName ? null : 'Field name is required',
  // The checkout signature needs the enrollment module, so the renderer re-checks it and resets stale values.
  validateValue: (value: any, data: BlockData) =>
    value?.complete === true && value.paymentMethodId
      ? null
      : readCopy(data).paymentRequiredMessage,
};

export default SinglePageCheckoutBlock;
