import type React from 'react';
import type { LayoutProps } from '@/packages/survey-form-package/src/types';
import { BrandStepLayout } from './BrandStepLayout';

/** Local layouts, picked with `?layout=<type>` on /emr-demo in place of the form's hosted layout. To add one: import it and add it under its layout type. */
export const LocalLayouts: Record<string, React.FC<LayoutProps>> = {
  brandStepLayout: BrandStepLayout,
};
