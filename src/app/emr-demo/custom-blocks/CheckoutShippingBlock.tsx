import type {
  BlockDefinition,
  ContentBlockItemProps,
} from '@/packages/survey-form-package/src/types';
import { Truck } from 'lucide-react';
import React from 'react';
import { CheckoutBuilderForm } from './checkout/CheckoutBuilderForm';
import { CheckoutRenderer } from './checkout/CheckoutRenderer';
import {
  COPY_DEFAULTS,
  DEFAULT_PREFERRED_MEDICATION_RULES,
  readCopy,
  readStepCopy,
  STEP_COPY_DEFAULTS,
} from './checkout/copy';

const CheckoutShippingItem: React.FC<ContentBlockItemProps> = ({ data }) => {
  const copy = readCopy(data);
  const stepCopy = readStepCopy(data);

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <p className="font-medium">{copy.checkoutTitle}</p>
      <p className="text-sm text-gray-500">{copy.shippingTitle}</p>
      <div className="rounded-full bg-gray-900 py-2 text-center text-sm text-white">
        {stepCopy.shippingContinueLabel}
      </div>
    </div>
  );
};

const CheckoutShippingPreview: React.FC = () => (
  <div className="flex w-full items-center justify-center py-1">
    <div className="w-4/5 space-y-1 rounded-md border bg-gray-50 p-2 text-xs text-gray-500">
      <div>Contact · Address</div>
      <div className="rounded-full bg-gray-900 py-0.5 text-center text-white">
        Continue
      </div>
    </div>
  </div>
);

// ============================================================================
// Block definition
// ============================================================================

// Page 1 of the two-page checkout. It has no field name: the address goes to the checkout draft, Payment submits the
// order, and core then has no value of this block to validate or send.
// The portal's Validate Code reads `type` from the source text, so it must be a string literal here.
export const CheckoutShippingBlock: BlockDefinition = {
  type: 'checkoutShipping',
  name: 'Nelson – Checkout: Shipping',
  description:
    'Two-page checkout, page 1: contact details and the shipping address',
  icon: <Truck className="h-4 w-4" />,
  defaultData: {
    type: 'checkoutShipping',
    label: 'Shipping',
    required: false,
    showContinueButton: false,
    autoContinueOnSelect: false,
    isEndBlock: false,
    showDrugImages: true,
    preferredMedicationRules: DEFAULT_PREFERRED_MEDICATION_RULES,
    ...COPY_DEFAULTS,
    ...STEP_COPY_DEFAULTS,
  },
  renderItem: (props) => <CheckoutShippingItem {...props} />,
  renderFormFields: (props) => (
    <CheckoutBuilderForm {...props} step="shipping" />
  ),
  renderPreview: () => <CheckoutShippingPreview />,
  renderBlock: (props) => <CheckoutRenderer {...props} step="shipping" />,
  validate: () => null,
};

export default CheckoutShippingBlock;
