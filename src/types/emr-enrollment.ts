import type { Paginated } from './emr-treatment';
import type { PatientVital } from './vitals';

export type EnrollmentStatus =
    | 'pending_push'
    | 'active'
    | 'paused'
    | 'completed'
    | 'discontinued'
    | 'cancelled'
    | 'push_failed';

export type WorkflowStatus =
    | 'auto'
    | 'pending_intake'
    | 'pending_review'
    | 'approved'
    | 'rejected'
    | 'revision_requested';

export interface EmrEnrollmentListItem {
    id: number;
    uuid: string;
    status: EnrollmentStatus;
    status_label: string;
    enrolled_date: number | null;
    next_refill_date: number | null;
    refills_completed: number;
    push_status: string | null;
    emr_treatment_plan: { id: number; name: string; code: string | null; schedule_type: string | null } | null;
    patient: { id: number; first_name: string; last_name: string; email: string } | null;
    latest_refill: { refill_number: number; status: string; workflow_status: string | null } | null;
}

export interface PaymentCharged {
    authorization_expires_at?: number | null;
    amount_cents: number;
    amount: number;
    stripe_payment_intent_id: string;
    status: string;
    card_brand: string | null;
    card_last4: string | null;
    charged_at: number;
}

export interface EmrRefill {
    id: number;
    uuid: string;
    refill_number: number;
    refill_label: string;
    status: string;
    workflow_status: WorkflowStatus | null;
    workflow_status_label: string | null;
    dispense_bundle_size: number | null;
    clinical_cycle_from: number | null;
    clinical_cycle_to: number | null;
    refill_date: number | null;
    next_refill_date: number | null;
    is_enrollment: boolean;
    encounter: EmrEncounterItem | null;
    prescriptions: EmrPrescriptionItem[];
    form_submissions: EmrFormSubmissionItem[];
    reviewed_by_name: string | null;
    reviewed_at: number | null;
    review_notes: string | null;
    rejection_reason: string | null;
    completed_at: number | null;
    cancelled_at: number | null;
    payment_charged: PaymentCharged | null;
    can_charge: boolean;
}

export interface EmrEncounterItem {
    id: number;
    uuid: string;
    encounter_number: string | null;
    encounter_type_name: string | null;
    visit_type: string | null;
    encounter_date: number | null;
    status_name: string | null;
    status_label: string;
    provider_name: string | null;
    chief_complaint: string | null;
    assessment: string | null;
    plan: string | null;
    notes: string | null;
    signed_at: number | null;
    closed_at: number | null;
}

export interface EmrPrescriptionItem {
    id: number;
    uuid: string;
    drug_name: string | null;
    display_name: string;
    strength: string | null;
    form: string | null;
    route: string | null;
    dosage: string | null;
    dosage_unit: string | null;
    frequency: string | null;
    sig: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    days_supply: number | null;
    refills_authorized: number;
    refills_remaining: number;
    status: string;
    clinical_cycle_number: number | null;
    provider_name: string | null;
    written_date: number | null;
}

export interface EmrDrugItem {
    id: number;
    name: string;
    strength: string | null;
    dosage: string | null;
    dosage_unit: string | null;
    frequency: string | null;
    dosage_form: string | null;
    price: number;
    selected_phase: number | null;
    phase_info: { phase_from: number; phase_to: number; drug_name: string | null; strength: string | null; dosage: string | null } | null;
    is_selected?: boolean;
    subtotal?: number;
}

export interface EmrGroupSelection {
    group_id: number;
    group_name: string;
    selection_type: string;
    is_required: boolean;
    selected_drugs: EmrDrugItem[];
}

export interface EmrEnrollmentPricing {
    variant_name: string | null;
    variant_price: number;
    bundle_size: number;
    standalone_drugs: EmrDrugItem[];
    group_selections: EmrGroupSelection[];
    optional_drugs: (EmrDrugItem & { is_selected: boolean; subtotal: number })[];
    optional_drugs_total: number;
    add_on_total: number;
    total: number;
}

export interface EmrFormSubmissionItem {
    id: number;
    uuid: string;
    form_name: string | null;
    form_type: string | null;
    status: string;
    total_score: number | null;
    completed_at: number | null;
}

export interface IntakeFormOption {
    id?: string;
    value: string;
    label: string;
}

export interface ProcessedFormResponse {
    field_name: string;
    field_type: string;
    question: string;
    description: string | null;
    answer: string;
    raw_value: any;
    options: IntakeFormOption[] | null;
}

export interface IntakeFormEntry {
    form_name: string;
    form_id: number | null;
    responses: ProcessedFormResponse[];
}

export interface RefillIntakeResponses {
    refill_number: number;
    refill_label: string;
    forms: IntakeFormEntry[];
}

export interface IntakeResponses {
    enrollment: IntakeFormEntry[];
    refills: RefillIntakeResponses[];
}

export interface EmrEnrollmentDetail {
    id: number;
    uuid: string;
    status: EnrollmentStatus;
    status_label: string;
    status_reason: string | null;
    push_status: string | null;
    push_error: string | null;
    is_pushed: boolean;
    can_retry_push: boolean;
    can_force_dispatch: boolean;
    push_attempts: number;
    enrolled_date: number | null;
    next_refill_date: number | null;
    refill_cycle_days: number | null;
    dispense_bundle_size: number | null;
    refills_completed: number;
    max_refills: number | null;
    drug_selections: Record<string, unknown> | null;
    selected_variant_data: Record<string, unknown> | null;
    payment_method: string | null;
    selected_variant_key: string | null;
    pricing: EmrEnrollmentPricing | null;
    address: { line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null; country: string } | null;
    notes: string | null;
    paused_at: number | null;
    completed_at: number | null;
    discontinued_at: number | null;
    cancelled_at: number | null;
    created_at: number;
    plan: {
        id: number;
        uuid: string;
        name: string;
        code: string | null;
        schedule_type: string | null;
        requires_doctor_approval: boolean;
    };
    patient: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string | null;
    };
    refills: EmrRefill[];
    encounters: EmrEncounterItem[];
    prescriptions: EmrPrescriptionItem[];
    form_submissions: EmrFormSubmissionItem[];
    patient_vital: PatientVital | null;
    sync_logs: { id: number; sync_type: string; status: string; error_message: string | null; created_at: number }[];
    uniemr_enrollment_id?: string;
}

export interface EnrollmentFilters {
    search?: string;
    status?: string;
    plan_id?: string;
}

export type PaginatedEnrollments = Paginated<EmrEnrollmentListItem>;
export type PaginatedEncounters = Paginated<EmrEncounterItem & { patient: { id: number; first_name: string; last_name: string; email: string } | null; enrollment: { id: number; uuid: string; emr_treatment_plan: { id: number; name: string } | null } | null }>;
export type PaginatedPrescriptions = Paginated<EmrPrescriptionItem & { patient: { id: number; first_name: string; last_name: string; email: string } | null; encounter: { id: number; uuid: string; encounter_number: string; encounter_date: number | null } | null; merchant_drug: { id: number; display_name: string; brand_name: string | null } | null }>;
