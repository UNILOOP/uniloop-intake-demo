import type { BlockDefinition } from '@/packages/survey-form-package/src/types';
import { EmrCheckoutBlock } from './EmrCheckoutBlock';
import EmrDrugSelectionBlock from './EmrDrugSelectionBlock';
import { SinglePageCheckoutBlock } from './SinglePageCheckoutBlock';
import { CheckoutSelectionBlock } from './CheckoutSelectionBlock';
import { CheckoutShippingBlock } from './CheckoutShippingBlock';
import { CheckoutPaymentBlock } from './CheckoutPaymentBlock';
import { VerificationInformationBlock } from './authv2/VerificationBlock';
import { NameInformationBlock } from './authv2/NameInformationBlock';
import { DOBInformationBlock } from './authv2/DOBInformation';
import { GenderInformationBlock } from './authv2/GenderBlock';
import { AuthInformationBlock } from './authv2/AuthInformation';
import { BMIInformationBlock } from './authv2/BMIInformationBlock';
import { VitalsInformationBlock } from './authv2/VitalsBlock';
import { registerBlock } from '@/packages/survey-form-package/src/blocks';

/**
 * All EMR-specific custom blocks.
 * To add a new block: import it and push to this array.
 */
export const EmrCustomBlocks: BlockDefinition[] = [
  AuthInformationBlock,
  VerificationInformationBlock,
  NameInformationBlock,
  GenderInformationBlock,
  DOBInformationBlock,
  VitalsInformationBlock,
  EmrDrugSelectionBlock,
  EmrCheckoutBlock,
  SinglePageCheckoutBlock,
  CheckoutSelectionBlock,
  CheckoutShippingBlock,
  CheckoutPaymentBlock,
];

export const getSystemBlocks = () => {
  const blockList = [
    AuthInformationBlock,
    VerificationInformationBlock,
    NameInformationBlock,
    GenderInformationBlock,
    DOBInformationBlock,
    VitalsInformationBlock,
    EmrDrugSelectionBlock,
    EmrCheckoutBlock,
    SinglePageCheckoutBlock,
    CheckoutSelectionBlock,
    CheckoutShippingBlock,
    CheckoutPaymentBlock,
  ];
  blockList.forEach((block) => {
    registerBlock(block);
  });
  return blockList;
};
