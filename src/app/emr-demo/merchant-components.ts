import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as Recharts from 'recharts';
import * as LayoutStyleHelpers from './layout-style-helper';
import { ensureRandomUUID } from '@/lib/ensure-random-uuid';
import * as survey from '@/packages/survey-form-package/src';
import * as formContext from '@/packages/survey-form-package/src/context/SurveyFormContext';
import * as builderContext from '@/packages/survey-form-package/src/context/SurveyBuilderContext';
import * as emr from '@/lib/emr-enrollment-utils';
import * as enrollment from '@/lib/enrollment-wrapper';
import * as icons from 'lucide-react';
import * as animation from 'framer-motion';
import { cn } from '@/lib/utils';
import { registerBlock } from '@/packages/survey-form-package/src/blocks';

export async function loadMerchantComponents(
  plan: any,
  localTypes: Set<string>,
) {
  const globals = window as any;
  ensureRandomUUID(window.crypto);
  const modules = await Promise.all([
    import('@/packages/survey-form-package/src/components/ui/input'),
    import('@/packages/survey-form-package/src/components/ui/button'),
    import('@/packages/survey-form-package/src/components/ui/label'),
    import('@/packages/survey-form-package/src/components/ui/card'),
    import('@/packages/survey-form-package/src/components/ui/select'),
    import('@/packages/survey-form-package/src/components/ui/checkbox'),
    import('@/packages/survey-form-package/src/components/ui/radio-group'),
    import('@/packages/survey-form-package/src/components/ui/textarea'),
    import('@/packages/survey-form-package/src/components/ui/dialog'),
    import('@/packages/survey-form-package/src/components/ui/tabs'),
    import('@/packages/survey-form-package/src/components/ui/slider'),
    import('@/packages/survey-form-package/src/components/ui/switch'),
    import('@/packages/survey-form-package/src/components/ui/progress'),
    import('@/packages/survey-form-package/src/components/ui/alert'),
    import('@/packages/survey-form-package/src/components/ui/badge'),
    import('@/packages/survey-form-package/src/components/ui/popover'),
    import('@/packages/survey-form-package/src/components/ui/separator'),
    import('@/packages/survey-form-package/src/components/ui/scroll-area'),
    import('@/packages/survey-form-package/src/components/ui/collapsible'),
    import('@/packages/survey-form-package/src/components/ui/toggle'),
    import('@/packages/survey-form-package/src/components/ui/toggle-group'),
  ]);
  Object.assign(globals, {
    React,
    ReactDOM,
    ReactJSXRuntime,
    Recharts,
    LayoutStyleHelpers,
    LucideIcons: icons,
    FramerMotion: animation,
    SurveyPackage: Object.assign(
      {},
      survey,
      ...modules,
      formContext,
      builderContext,
      { cn, SurveyBuilderContext: builderContext },
    ),
    SurveyFormContext: formContext,
    SurveyBuilderContext: builderContext,
    SurveyLayoutComponents: {
      CurrentBlock: survey.CurrentBlock,
      NavigationButtons: survey.NavigationButtons,
      ProgressIndicator: survey.ProgressIndicator,
    },
    EmrEnrollmentUtils: emr,
    EnrollmentUtils: enrollment,
  });
  const definitions: any[] = [];
  for (const block of plan.custom_blocks || []) {
    if (localTypes.has(block.type) || !block.module_url) continue;
    const module = await import(/* webpackIgnore: true */ block.module_url);
    const definition = [module.default, ...Object.values(module)].find(
      (value: any) => value?.type && value?.name && value?.defaultData,
    ) as any;
    if (!definition)
      throw new Error(
        `Merchant block ${block.type} has no BlockDefinition export.`,
      );
    registerBlock(definition);
    definitions.push(definition);
  }
  const layouts: Record<string, any> = {};
  for (const form of plan.enrollment_forms || []) {
    const url = form.custom_layout?.transpiled_code_url;
    if (!url || layouts[url]) continue;
    const module = await import(/* webpackIgnore: true */ url);
    const component =
      module.default ??
      Object.values(module).find((value) => typeof value === 'function');
    if (!component) throw new Error(`Unable to load layout for ${form.name}.`);
    layouts[url] = component;
  }
  return { definitions, layouts };
}
