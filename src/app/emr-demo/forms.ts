import { DEFAULT_PREFERRED_MEDICATION_RULES } from './custom-blocks/checkout/copy';

export interface DemoForm {
  id: number;
  key: string;
  name: string;
  form_json: any;
  is_required: boolean;
  sort_order: number;
  required_at: string;
  refill_frequency?: string;
  refill_frequency_n?: number;
  [key: string]: any;
}
export function normalizeForms(
  forms: any[],
  kind: 'enrollment' = 'enrollment',
): DemoForm[] {
  return forms
    .map((form, index) => ({
      ...form,
      id: form.intake_form_id ?? form.intake_form?.id ?? form.id,
      key: `${kind}-${form.plan_form_id ?? form.id}-${index}`,
      name: form.name ?? form.form_name ?? `Form ${index + 1}`,
      form_json:
        typeof (form.form_json ?? form.intake_form?.form_json) === 'string'
          ? JSON.parse(form.form_json ?? form.intake_form.form_json)
          : (form.form_json ?? form.intake_form?.form_json),
      is_required: form.is_required ?? true,
      sort_order: form.sort_order ?? form.sequence ?? index,
      required_at: form.required_at ?? kind,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// `?checkout=two-page` adds a local copy of each checkout form after it, with the single-page checkout split into the
// Shipping and Payment blocks; `?checkout=three-page` puts the Your plan block before them. The copy has no UniEMR form
// ids, so its answers never reach the preferred-drug lookup. Every page gets the same preferred medication rules as
// the portal's multi-page checkout forms.
export function withMultiPageCheckout(
  forms: DemoForm[],
  pages: 2 | 3,
): DemoForm[] {
  return forms.flatMap((form) => {
    let split = false;
    const visit = (node: any): any => {
      if (Array.isArray(node)) {
        return node.flatMap((item) => {
          if (item?.type !== 'singlePageCheckout') return [visit(item)];
          split = true;
          // Shipping always moves on to Payment, so it takes none of the checkout's routing or end-of-form flag.
          const {
            fieldName,
            isEndBlock,
            nextBlockId,
            navigationRules,
            ...copy
          } = item;
          // The first page keeps the checkout's uuid, so rules that led to the checkout now lead to it.
          const selection =
            pages === 3
              ? [
                  {
                    ...copy,
                    type: 'checkoutSelection',
                    label: 'Your plan',
                    required: false,
                    preferredMedicationRules: DEFAULT_PREFERRED_MEDICATION_RULES,
                  },
                ]
              : [];
          return [
            ...selection,
            {
              ...copy,
              ...(pages === 3 ? { uuid: crypto.randomUUID() } : {}),
              type: 'checkoutShipping',
              label: 'Shipping',
              required: false,
              preferredMedicationRules: DEFAULT_PREFERRED_MEDICATION_RULES,
            },
            {
              ...item,
              uuid: crypto.randomUUID(),
              type: 'checkoutPayment',
              preferredMedicationRules: DEFAULT_PREFERRED_MEDICATION_RULES,
            },
          ];
        });
      }
      if (!node || typeof node !== 'object') return node;
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, visit(value)]),
      );
    };
    const formJson = visit(form.form_json);
    if (!split) return [form];
    return [
      form,
      {
        ...form,
        id: -form.id,
        key: `${form.key}-${pages === 3 ? 'three' : 'two'}-page`,
        name: `${form.name} (${pages === 3 ? 'three' : 'two'}-page)`,
        form_json: formJson,
        is_required: false,
        treatment_plan_form_id: null,
        form_template_id: null,
      },
    ];
  });
}

const CHECKOUT_TYPES = new Set(['singlePageCheckout', 'checkoutPayment']);

const hasCheckout = (node: any): boolean =>
  Array.isArray(node)
    ? node.some(hasCheckout)
    : !!node &&
      typeof node === 'object' &&
      (CHECKOUT_TYPES.has(node.type) || Object.values(node).some(hasCheckout));

// `?upsell=1` adds a local upsell form right after the last checkout form, so the offer shows once the card is held
// and before the enrollment is submitted. The value is the optional drug to offer; one the plan lacks (like 1) offers
// the plan's first optional drug the patient hasn't picked.
export function withUpsellOffer(forms: DemoForm[], drug: string): DemoForm[] {
  const last = forms.findLastIndex((form) => hasCheckout(form.form_json));
  if (last < 0) return forms;
  const checkout = forms[last];
  const drugId = Number(drug);
  const upsell: DemoForm = {
    ...checkout,
    id: -1_000_000 - Math.abs(checkout.id),
    key: `${checkout.key}-upsell`,
    name: 'Upsell offer (local)',
    form_json: {
      ...checkout.form_json,
      rootNode: {
        type: 'section',
        uuid: 'upsell-root',
        name: 'Upsell offer',
        items: [
          {
            type: 'set',
            uuid: 'upsell-page',
            name: 'Upsell offer',
            items: [
              {
                type: 'upsellOffer',
                uuid: 'upsell-offer',
                fieldName: 'upsellOffer',
                label: 'One more thing before we send your order',
                required: true,
                ...(Number.isInteger(drugId) && drugId > 0 ? { drugId } : {}),
              },
            ],
          },
        ],
      },
    },
    is_required: false,
    treatment_plan_form_id: null,
    form_template_id: null,
  };
  return [...forms.slice(0, last + 1), upsell, ...forms.slice(last + 1)];
}
