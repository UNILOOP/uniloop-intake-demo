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
