export interface EmrTreatmentCategory {
    id: number;
    name: string;
    slug: string;
    color: string;
}

export interface EmrBillingOption {
    id: number;
    uuid: string;
    variant_key: string;
    label: string;
    supply_count: number;
    units_per_supply: number;
    base_price_cents: number;
    compare_at_price_cents: number | null;
    currency: string;
    renewal_policy: 'auto_renew' | 'require_new_purchase' | 'end_enrollment';
    effective_renewal_policy: 'auto_renew' | 'require_new_purchase' | 'end_enrollment';
    inherits_renewal_policy: boolean;
    is_active: boolean;
    is_default: boolean;
    sort_order: number;
    revision: number;
}

export interface EmrTreatmentPlanListItem {
    id: number;
    uuid: string;
    name: string;
    code: string | null;
    description: string | null;
    status: string;
    is_active: boolean;
    schedule_type: string | null;
    sync_status: string | null;
    last_synced_at: number | null;
    category: EmrTreatmentCategory | null;
    active_drugs_count: number;
    active_forms_count: number;
}

export interface EmrTreatmentSchedule {
    type: string | null;
    label: string;
    refill_cycle_days: number | null;
    clinical_cycle_days: number | null;
    dispense_bundle_size: number;
    max_refills: number | null;
    has_unlimited_refills: boolean;
}

export interface EmrTreatmentAutomation {
    auto_create_encounter: boolean;
    auto_create_prescriptions: boolean;
    auto_create_lab_orders: boolean;
    requires_doctor_approval: boolean;
}

export interface EmrPhaseLinkedDrug {
    id?: number;
    uuid: string;
    display_name: string | null;
    custom_display_name: string | null;
    brand_name: string | null;
    generic_name: string | null;
    photos: Array<{ url: string; is_primary: boolean; sort_order: number }>;
}

export interface EmrDrugPhase {
    id: string;
    phase_from: number;
    phase_to: number | null;
    drug_name: string | null;
    dosage: string | null;
    strength: string | null;
    frequency: string | null;
    quantity: number | null;
    days_supply: number | null;
    sig: string | null;
    is_active: boolean;
    merchant_drug_id: string | null;
    local_merchant_drug: EmrPhaseLinkedDrug | null;
    add_on_price?: number | null;
}

export interface EmrLinkedDrug {
    id: number;
    uuid: string;
    display_name: string | null;
    custom_display_name: string | null;
    brand_name: string | null;
    generic_name: string | null;
    product_ndc: string | null;
    is_controlled: boolean;
    dea_schedule: string | null;
    price: number | null;
    description: string | null;
    photos: Array<{ url: string; is_primary: boolean; sort_order: number }>;
}

export interface EmrTreatmentPlanDrug {
    uniemr_drug_id?: string;
    uniemr_merchant_drug_id?: string;
    id: number;
    drug_name: string;
    dosage: string | null;
    dosage_unit: string | null;
    strength: string | null;
    dosage_form: string | null;
    route: string | null;
    frequency: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    days_supply: number | null;
    sig: string | null;
    is_required: boolean;
    is_active: boolean;
    is_default_option: boolean;
    is_optional: boolean;
    has_phases: boolean;
    phases: EmrDrugPhase[];
    price: number | null;
    compare_at_price: number | null;
    add_on_price: number | null;
    merchant_drug: EmrLinkedDrug | null;
}

export interface EmrTreatmentPlanDrugGroup {
    uniemr_drug_group_id?: string;
    id: number;
    name: string;
    description: string | null;
    selection_type: 'single' | 'multi';
    is_required: boolean;
    drugs: EmrTreatmentPlanDrug[];
}

export interface EmrLinkedIntakeForm {
    id: number;
    name: string;
    slug: string;
}

export interface EmrTreatmentPlanForm {
    id: number;
    form_name: string;
    form_code: string | null;
    form_type: string | null;
    required_at: string | null;
    schedule_basis: string | null;
    refill_frequency: string | null;
    schedule_description: string;
    sequence: number;
    is_required: boolean;
    is_check_in: boolean;
    blocks_approval: boolean;
    is_active: boolean;
    has_intake_form: boolean;
    intake_form: EmrLinkedIntakeForm | null;
}

export interface EmrRefillVariant {
    enrollment_enabled?: boolean;
    pay_per_refill_enabled?: boolean;
    pay_per_refill_sort_order?: number;
    id: string;
    name: string;
    code: string | null;
    is_default: boolean;
    schedule_type: string;
    default_refill_cycle_days: number;
    clinical_cycle_days: number;
    default_dispense_bundle_size: number;
    max_refills: number | null;
    calculated_price: number | null;
    price: number | null;
    compare_at_price: number | null;
}

export interface EmrRegionScope {
    country_code: string;
    state_code: string | null;
    encounter_type: string;
    is_active: boolean;
}

export interface EmrSyncInfo {
    status: string | null;
    last_synced_at: number | null;
    uniemr_id: string;
}

export interface EmrTreatmentPlan {
    billing_options?: EmrBillingOption[];
    id: number;
    uuid: string;
    name: string;
    code: string | null;
    description: string | null;
    status: string;
    is_active: boolean;
    enrollment_slug: string | null;
    enrollment_status: 'active' | 'inactive';
    enrollment_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
    seo_image_url: string | null;
    seo_meta: Record<string, string> | null;
    category: EmrTreatmentCategory | null;
    schedule: EmrTreatmentSchedule;
    automation: EmrTreatmentAutomation;
    standalone_drugs: EmrTreatmentPlanDrug[];
    optional_drugs: EmrTreatmentPlanDrug[];
    drug_groups: EmrTreatmentPlanDrugGroup[];
    forms: {
        enrollment: EmrTreatmentPlanForm[];
        refill: EmrTreatmentPlanForm[];
    };
    refill_variants: EmrRefillVariant[];
    region_scopes: EmrRegionScope[];
    sync: EmrSyncInfo;
    counts: { drugs: number; forms: number };
}

export interface EmrTreatmentFilters {
    search?: string;
    status?: string;
    category?: string;
    is_active?: string;
}

export interface EmrTreatmentStats {
    total: number;
    active: number;
    synced: number;
}

export interface EmrTreatmentSyncLog {
    id: number;
    sync_type: string;
    status: 'started' | 'completed' | 'failed';
    total_found: number;
    total_created: number;
    total_updated: number;
    total_skipped: number;
    total_errors: number;
    drugs_synced: number;
    forms_created: number;
    error_details: string[] | null;
    started_at: number | null;
    completed_at: number | null;
}

export interface EmrAvailablePlan {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    status: string;
    is_active: boolean;
    schedule_type: string | null;
    drugs_count: number;
    forms_count: number;
    category: { name: string; color: string } | null;
}

export interface EmrSyncStats {
    total_plans: number;
    synced_plans: number;
    not_synced: number;
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
}
