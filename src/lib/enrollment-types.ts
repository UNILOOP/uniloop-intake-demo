// ============================================================================
// Types
// ============================================================================

import type { NavigationHistoryEntry } from '@/packages/survey-form-package/src/types';
import type { EmrRefillVariant, EmrRegionScope, EmrTreatmentPlan, EmrTreatmentPlanDrug, EmrTreatmentPlanDrugGroup } from '@/types/emr-treatment';
import { AnalyticsManager, type UrlParameters } from './analytics';

export type { EmrRefillVariant, EmrRegionScope, EmrTreatmentPlan, EmrTreatmentPlanDrug, EmrTreatmentPlanDrugGroup };

export type EnrollmentProviderType = 'treatment' | 'emr';

/* ------------------------------------------------------------------
 *  Miscellaneous
 * ---------------------------------------------------------------- */
export interface MerchantBusinessWithAddress {
  id: number;
  name: string;
  logo_url: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  google_tag_id?: string | null;
  google_analytics_id?: string | null;
  google_analytics_api_secret?: string;
  meta_pixel_id?: string;
  meta_access_token?: string;
  gtm_format_hipaa?: boolean;
  ga4_format_hipaa?: boolean;
  meta_format_hipaa?: boolean;
  telegra_order_push_enabled: boolean;
  provider_type?: 'telegra' | 'openloop' | 'uniemr';
  openloop_order_push_enabled?: boolean;
  theme_settings: Record<string, any>;
  analytics_event_mappings?: Record<string, any> | null;
  favicon_url?: string | null;
  address?: {
    id: number;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    zip: string | null;
    country: string;
    full_address: string;
  };
}


export interface Address {
    id?: number;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

/**
 * Pricing option for a product variation
 * Represents different billing options (one-time, monthly, yearly, etc.)
 */
export interface PricingOption {
    id: string;
    billing_type: 'one_time' | 'recurring';
    billing_interval?: 'monthly' | 'quarterly' | 'six_months' | 'yearly' | 'custom';
    billing_interval_days?: number;
    price_cents: number;
    sale_price_cents?: number;
    label?: string;
    is_default: boolean;
    is_active: boolean;
    sort_order?: number;
}

export interface Photos {
    id: number;
    url: string;
    is_default: boolean;
}

export interface TreatmentProduct {
    id: number;
    product_name: string;
    variation_name: string;
    dosage?: string;
    dosage_unit?: string;
    quantity: number;
    price: number;
    pricing_options?: PricingOption[];
    photos?: Photos;
}

export interface CountryStateAvailability {
    [countryCode: string]: string[]; // { "US": ["CA", "NY", "TX"], "CA": ["ON", "BC"] }
}

export interface TreatmentVariation {
    id: number;
    name: string;
    description?: string;
    is_default: boolean;
    price?: number;
    price_type?: string;
    currency?: string;
    country_state_availability?: CountryStateAvailability | null;
    enable_schedule?: boolean;
    total_schedules?: number;
    schedule_frequency?: string;
    products: TreatmentProduct[];
}

export interface Treatment {
    id: number;
    name: string;
    description?: string;
    price?: number;
    currency: string;
    price_type: string;
    is_recurring: boolean;
    recurrence_pattern?: string;
    duration_value?: number;
    duration_unit?: string;
    total_schedules?: number;
    country_state_availability?: CountryStateAvailability | null;
    variations?: TreatmentVariation[];
}

export interface Merchant {
    id: number;
    name: string;
    logo?: string;
    business: MerchantBusinessWithAddress;
}

export interface PatientInfo {
    id: number | null;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
}

export interface EmrBillingQuote {
    hash: string;
    expires_at: number;
    subtotal_cents: number;
    discount_cents: number;
    net_cents: number;
    currency: string;
    terms: {
        coupon_code?: string | null;
        option_id: number;
        supply_count: number;
        units_per_supply: number;
        coverage_units: number;
        renewal_policy: 'auto_renew' | 'require_new_purchase' | 'end_enrollment';
        charge_mode: EmrChargeMode;
        save_only_charge_timing: string | null;
        refill_cycle_days: number | null;
        subtotal_cents: number;
    };
}

export interface CheckoutData {
    billingOptionId?: number;
    billingCheckoutUuid?: string;
    billingQuote?: EmrBillingQuote;
    billingTermsAccepted?: boolean;
    patientInfo: any;
    useExistingAddress: boolean;
    address: Address;
    stripePaymentMethodId?: string;
    stripePaymentIntentId?: string;
    chargeMode?: EmrChargeMode;
    paymentDetails?: any;
    paymentMethod?: string;
    patientVitalId?: number | null;
    couponCode?: string;
    appliedCoupon?: ApplicableCoupon | null;
    subtotal?: number;
    discountAmount?: number;
    finalTotal?: number;
}

export interface EnrollmentSubmissionResult {
    success: boolean;
    errors?: Record<string, string>;
    redirect_url?: string;
    enrollment?: {
        id: number;
        uuid: string;
        patient_id?: number;
        status?: string;
        is_first_time_order?: boolean;
    };
}

export interface EnrollmentState {
    currentStep: number;
    formResponses: Record<number, any>;
    formStates: Record<number, { savedData?: any; currentPage?: number; navigationHistory?: NavigationHistoryEntry[] }>;
    paymentMethod: 'upfront' | 'per_schedule' | null;
    authToken: string | null;
    patientInfo: PatientInfo | null;
    checkoutData?: Record<string, unknown> | null;
    emrSelectionState?: EmrCheckoutSelectionState | null;
    pendingVitalData?: Record<string, unknown> | null;
    vitalId?: number | null;
    urlParams?: UrlParameters;
}

export interface EnrollmentUtilsConfig {
    treatment?: Treatment;
    merchant: Merchant;
    slug: string;
    onError?: (errors: Record<string, string>) => void;
    onSuccess?: () => void;
    analyticsManager?: AnalyticsManager | null;
    analyticsUrlParams?: UrlParameters;
}

export interface CheckoutValidationErrors {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    selectedAddress?: string;
    payment?: string;
}

export interface CheckoutPatientInfo {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
}

/**
 * Interface for the current checkout selection state
 */
export interface CheckoutSelectionState {
    variationId: number | null;
    variation: TreatmentVariation | null;
    pricingOptionId: string | null;
    pricingOption: PricingOption | null;
    products: TreatmentProduct[];
    availablePricingOptions: PricingOption[];
    total: number;
    billingType: 'one_time' | 'recurring' | null;
    billingInterval: string | null;
    billingLabel: string | null;
}

export interface ApplicableCoupon {
    id: number;
    code: string;
    description: string | null;
    type: 'percentage' | 'fixed_amount';
    value: number;
    discount_amount: number;
    formatted_discount: string;
    minimum_amount: number | null;
    maximum_discount: number | null;
    emr_usage_scope?: 'initial_enrollment' | 'initial_enrollment_and_refills' | 'refills_only';
    emr_usage_scope_label?: string;
    emr_refill_limit?: number | null;
    valid_until: string | null;
    applicable_to: string[];
    savings_percentage: number;
}

export interface CouponValidationContext {
    emrTreatmentPlanId?: number;
    emrRefillVariantKey?: string;
    emrBillingOptionId?: number;
    emrTreatmentEnrollmentId?: number;
    selectedMerchantDrugIds?: number[];
    emrUsageContext?: 'initial_enrollment' | 'refill';
    emrRefillNumber?: number;
}

export interface CouponsResponse {
    success: boolean;
    coupons: ApplicableCoupon[];
    subtotal: number;
    count: number;
    error?: string;
}

export interface StripePaymentMethod {
    id: number;
    type: string;
    brand?: string;
    last4: string;
    exp_month?: string;
    exp_year?: string;
    bank_name?: string;
    is_default: boolean;
    is_expired: boolean;
    display_name: string;
}

export interface StripeSetupIntent {
    id: string;
    client_secret: string;
    customer_id: string;
    stripe_account: string;
    publishable_key: string;
}

export interface StripeInitializationResult {
    success: boolean;
    setupIntent?: StripeSetupIntent;
    error?: string;
}

export interface StripeAuthorizationIntent {
    store_credit_only?: boolean;
    setup_intent?: StripeSetupIntent;
    store_credit_cents?: number;
    total_amount_cents?: number;
    payment_intent_id: string;
    client_secret: string;
    customer_id: string;
    stripe_account: string;
    publishable_key: string;
    amount: number;
    currency: string;
}

export interface StripeAuthorizationIntentResult {
    success: boolean;
    paymentIntent?: StripeAuthorizationIntent;
    error?: string;
}

export type EmrChargeMode = 'save_only' | 'save_and_authorize';

export interface EnrollmentUtils {
    // Configuration
    treatment?: Treatment;
    merchant: Merchant;
    slug: string;
    storageKey: string;

    // Patient data functions
    fetchPatientInfo: (authToken: string) => Promise<PatientInfo | null>;
    fetchPatientAddresses: (authToken: string) => Promise<Address[]>;
    extractPatientInfo: (formResponses: Record<number, any>) => PatientInfo;

    // Treatment variation functions
    getDefaultVariation: () => TreatmentVariation | null;
    getSelectedVariation: (variationId?: number) => TreatmentVariation | null;
    getVariationProducts: (variation: TreatmentVariation) => TreatmentProduct[];
    getVariationPrice: (variation: TreatmentVariation) => number;
    getTreatmentProducts: () => TreatmentProduct[];
    getVariations: () => TreatmentVariation[];

    // Pricing option functions
    getCommonPricingOptions: (variation: TreatmentVariation) => PricingOption[];
    getDefaultPricingOption: (pricingOptions: PricingOption[]) => PricingOption | null;
    calculateTotalWithPricingOption: (variation: TreatmentVariation, pricingOptionId: string) => number;
    getPricingOptionLabel: (option: PricingOption) => string;
    variationHasPricingOptions: (variation: TreatmentVariation) => boolean;

    // Selection state management
    setSelectedVariationId: (variationId: number | null) => void;
    getSelectedVariationId: () => number | null;
    setSelectedPricingOptionId: (pricingOptionId: string | null) => void;
    getSelectedPricingOptionId: () => string | null;
    getCheckoutSelectionState: (paymentMethod?: 'upfront' | 'per_schedule' | null) => CheckoutSelectionState;
    hasVariationSelected: () => boolean;
    hasPricingOptionSelected: () => boolean;
    resetSelections: () => void;

    // Coupon functions
    getCoupons: (patientEmail: string, variationId?: number, subtotal?: number) => Promise<CouponsResponse>;

    // Payment/checkout functions
    calculateTotal: (paymentMethod?: 'upfront' | 'per_schedule' | null, variationId?: number, pricingOptionId?: string) => number;
    submitEnrollment: (
        formResponses: Record<number, any>,
        checkoutData: CheckoutData | null,
        paymentMethod: 'upfront' | 'per_schedule' | null,
    ) => Promise<EnrollmentSubmissionResult>;

    // Checkout validation functions
    validateCheckoutForm: (
        patientInfo: CheckoutPatientInfo,
        address: Address,
        useExistingAddress: boolean,
        existingAddresses: Address[],
        selectedAddressId?: string,
    ) => { isValid: boolean; errors: CheckoutValidationErrors };
    validatePatientInfo: (patientInfo: CheckoutPatientInfo) => CheckoutValidationErrors;
    validateAddress: (
        address: Address,
        useExistingAddress: boolean,
        existingAddresses: Address[],
        selectedAddressId?: string,
    ) => CheckoutValidationErrors;
    getSelectedAddress: (existingAddresses: Address[], selectedAddressId: string | undefined, fallbackAddress: Address) => Address;
    createEmptyAddress: (country?: string) => Address;
    createEmptyPatientInfo: () => CheckoutPatientInfo;
    initializePatientInfo: (initialData: CheckoutPatientInfo | null) => CheckoutPatientInfo;
    isValidEmail: (email: string) => boolean;

    // Stripe payment functions
    fetchPaymentMethods: (authToken: string) => Promise<StripePaymentMethod[]>;
    getDefaultPaymentMethod: (paymentMethods: StripePaymentMethod[]) => StripePaymentMethod | undefined;
    createSetupIntent: (authToken: string, forceNew?: boolean) => Promise<StripeInitializationResult>;
    deletePaymentMethod: (authToken: string, methodId: number) => Promise<{ success: boolean; error?: string }>;
    savePaymentMethod: (
        authToken: string,
        paymentMethodId: string,
        customerId: string,
        setupIntentId: string,
        setAsDefault?: boolean,
    ) => Promise<{ success: boolean; error?: string }>;
    isSetupIntentProcessing: (status: string) => boolean;
    isSetupIntentSucceeded: (status: string) => boolean;

    // State persistence functions
    loadState: () => Partial<EnrollmentState>;
    saveState: (state: Partial<EnrollmentState>) => void;
    clearState: () => void;

    // Analytics helpers
    enrichEventWithPatientData: (eventData: any, patientInfo: PatientInfo | null) => any;
    toSlug: (text: string) => string;
    sendAbandonBeacon: (eventData: any, analyticsManager: AnalyticsManager) => boolean;
}

export interface StripePaymentCallbacks {
    onSuccess: (paymentMethodId: string) => void;
    onError: (error: string) => void;
}

export interface StripePaymentConfig {
    amount: number;
    currency?: string;
    authToken: string;
    merchantId: number;
    saveOnly?: boolean;
}

export interface StripePaymentResult {
    paymentMethodId: string;
    success: boolean;
}

export interface PatientAuthData {
    id?: number;
    email?: string;
    phone?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    gender?: string;
    genderBiological?: string;
    dateOfBirth?: string;
    height?: number;
    weight?: number;
}

export interface PendingPatientUpdate {
    fieldName: string;
    value: any;
    timestamp: string;
}

export interface PendingUpdatesData {
    referencePatient: PatientAuthData;
    updates: PendingPatientUpdate[];
}

export interface PatientAuthStorageData {
    token: string;
    patient: PatientAuthData;
    authenticatedAt: string;
}

export interface PatientAuthFormData {
    email: string;
    phone: string;
    password: string;
    otp: string;
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    genderBiological: string;
    dateOfBirth: string;
    height: string;
    weight: string;
}

export interface PatientAuthConfig {
    authMethod: 'otp' | 'password';
    authField: 'email' | 'phone';
    // Required fields configuration
    requireFirstName?: boolean;
    requireLastName?: boolean;
    requireMiddleName?: boolean;
    requireGender?: boolean;
    requireGenderBiological?: boolean;
    requireDateOfBirth?: boolean;
    requireHeight?: boolean;
    requireWeight?: boolean;
    collectAlternateContact?: boolean;
    alternateContactRequired?: boolean;
}

export interface PatientAuthResult {
    success: boolean;
    patient?: PatientAuthData;
    token?: string;
    error?: string;
    isFirstTimeUser?: boolean;
    missingFields?: string[];
}

export interface PatientAuthValidationErrors {
    email?: string;
    phone?: string;
    password?: string;
    otp?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    height?: string;
    weight?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * US States list for address selection
 */
export const US_STATES = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
] as const;

/**
 * Supported countries for shipping
 */
export const SUPPORTED_COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
] as const;

/**
 * Stripe card element styling options
 */
export const STRIPE_CARD_ELEMENT_OPTIONS = {
    style: {
        base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
                color: '#aab7c4',
            },
        },
        invalid: {
            color: '#9e2146',
        },
    },
};

/**
 * Unique storage key prefix for patient auth data
 * Uses a specific prefix to avoid conflicts with other localStorage keys
 */
export const PATIENT_AUTH_STORAGE_PREFIX = 'patient_auth_';

// Default storage key for patient auth - used when no custom key is provided
export const DEFAULT_PATIENT_AUTH_STORAGE_KEY = `${PATIENT_AUTH_STORAGE_PREFIX}default`;

// Storage key prefix for pending patient updates
export const PENDING_UPDATES_STORAGE_PREFIX = 'pending_patient_updates_';

// Hardcoded API endpoints for patient auth - not configurable
export const PATIENT_AUTH_ENDPOINTS = {
    sendOtp: '/api/v2/patient/send-otp',
    validateAuth: '/api/v2/patient/validate',
    updateProfile: '/api/v2/patient/update',
    validateToken: '/api/patient/validate-token',
} as const;

/**
 * Default patient auth configuration
 * Developers can spread this and override specific values
 */
export const DEFAULT_PATIENT_AUTH_CONFIG: PatientAuthConfig = {
    authMethod: 'otp',
    authField: 'email',
    requireFirstName: true,
    requireLastName: true,
    requireMiddleName: false,
    requireGender: false,
    requireGenderBiological: false,
    requireDateOfBirth: false,
    requireHeight: false,
    requireWeight: false,
    collectAlternateContact: false,
    alternateContactRequired: false,
};

/**
 * Minimal config - only email OTP auth, no profile fields required
 */
export const MINIMAL_PATIENT_AUTH_CONFIG: PatientAuthConfig = {
    authMethod: 'otp',
    authField: 'email',
    requireFirstName: false,
    requireLastName: false,
};

/**
 * Full profile config - all fields required
 */
export const FULL_PROFILE_PATIENT_AUTH_CONFIG: PatientAuthConfig = {
    ...DEFAULT_PATIENT_AUTH_CONFIG,
    requireFirstName: true,
    requireLastName: true,
    requireGender: true,
    requireDateOfBirth: true,
    requireHeight: true,
    requireWeight: true,
};

/**
 * Phone OTP config
 */
export const PHONE_OTP_PATIENT_AUTH_CONFIG: PatientAuthConfig = {
    ...DEFAULT_PATIENT_AUTH_CONFIG,
    authField: 'phone',
};

/**
 * Password auth config
 */
export const PASSWORD_PATIENT_AUTH_CONFIG: PatientAuthConfig = {
    ...DEFAULT_PATIENT_AUTH_CONFIG,
    authMethod: 'password',
};

// ============================================================================
// EMR Enrollment Types
// ============================================================================

/** Represents a drug choice — either the drug directly or a specific titration phase */
export interface EmrDrugChoice {
    drugId: number;
    phaseId: string | null;
}

export interface EmrDrugGroupSelection {
    groupId: number;
    groupName: string;
    selectionType: 'single' | 'multi';
    isRequired: boolean;
    selectedDrugIds: number[];
    selectedPhases: Record<number, string | null>;
}

export interface EmrDrugSelectionState {
    groupSelections: Record<number, EmrDrugGroupSelection>;
    selectedOptionalDrugIds: number[];
    standaloneDrugPhases: Record<number, string | null>;
    optionalDrugPhases: Record<number, string | null>;
}

export interface EmrCheckoutSelectionState {
    billingOptionId?: number | null;
    variantId: string | null;
    variant: EmrRefillVariant | null;
    drugSelection: EmrDrugSelectionState;
    selectedDrugs: EmrTreatmentPlanDrug[];
    baseTotal: number;
    addOnTotal: number;
    optionalTotal: number;
    total: number;
    compareAtPrice: number | null;
    scheduleLabel: string | null;
    scheduleType: string | null;
}

export interface EmrEnrollmentUtilsConfig {
    plan: EmrTreatmentPlan;
    merchant: Merchant;
    slug: string;
    onError?: (errors: Record<string, string>) => void;
    onSuccess?: () => void;
    analyticsManager?: AnalyticsManager | null;
    analyticsUrlParams?: UrlParameters;
}

export interface EmrEnrollmentUtils {
    // Configuration
    plan: EmrTreatmentPlan;
    merchant: Merchant;
    slug: string;
    storageKey: string;

    // Patient data functions (same as EnrollmentUtils)
    fetchPatientInfo: (authToken: string) => Promise<PatientInfo | null>;
    fetchPatientAddresses: (authToken: string) => Promise<Address[]>;
    extractPatientInfo: (formResponses: Record<number, any>) => PatientInfo;

    // EMR Refill Variant functions
    getDefaultVariant: () => EmrRefillVariant | null;
    getSelectedVariant: (variantId?: string) => EmrRefillVariant | null;
    getVariants: () => EmrRefillVariant[];
    getBillingChoices: (variantId?: string) => ReturnType<typeof import('./enrollment-utils').getEmrBillingChoices>;
    getVariantPrice: (variant: EmrRefillVariant) => number;
    getVariantLabel: (variant: EmrRefillVariant) => string;

    // EMR Drug functions
    getStandaloneDrugs: () => EmrTreatmentPlanDrug[];
    getOptionalDrugs: () => EmrTreatmentPlanDrug[];
    getDrugGroups: () => EmrTreatmentPlanDrugGroup[];
    getDrugPrice: (drug: EmrTreatmentPlanDrug) => number;
    getDrugAddOnPrice: (drug: EmrTreatmentPlanDrug, selectedPhaseId: string | null) => number;
    getGroupDefaultDrug: (group: EmrTreatmentPlanDrugGroup) => EmrTreatmentPlanDrug | null;

    setBillingOptionId: (id: number | null) => void;
    getBillingOptionId: () => number | null;

    // EMR Selection state management
    setSelectedVariantId: (variantId: string | null) => void;
    getSelectedVariantId: () => string | null;
    setDrugGroupSelection: (groupId: number, drugIds: number[]) => void;
    getDrugGroupSelection: (groupId: number) => number[];
    toggleOptionalDrug: (drugId: number) => void;
    isOptionalDrugSelected: (drugId: number) => boolean;
    getEmrCheckoutSelectionState: () => EmrCheckoutSelectionState;
    hydrateEmrSelectionState: (state: EmrCheckoutSelectionState | null | undefined) => void;
    resetSelections: () => void;

    // Phase selection
    setStandaloneDrugPhase: (drugId: number, phaseId: string | null) => void;
    getStandaloneDrugPhase: (drugId: number) => string | null;
    setOptionalDrugPhase: (drugId: number, phaseId: string | null) => void;
    getOptionalDrugPhase: (drugId: number) => string | null;
    setGroupDrugPhase: (groupId: number, drugId: number, phaseId: string | null) => void;
    getGroupDrugPhase: (groupId: number, drugId: number) => string | null;
    getAllDrugChoices: () => EmrDrugChoice[];

    // EMR Pricing
    calculateEmrTotal: (variantId?: string) => number;
    calculateEmrVariantTotal: (variantId?: string) => number;

    // EMR Submission
    submitEmrEnrollment: (formResponses: Record<number, any>, checkoutData: CheckoutData | null) => Promise<EnrollmentSubmissionResult>;

    // Checkout validation functions (reused from generic)
    validateCheckoutForm: (
        patientInfo: CheckoutPatientInfo,
        address: Address,
        useExistingAddress: boolean,
        existingAddresses: Address[],
        selectedAddressId?: string,
    ) => { isValid: boolean; errors: CheckoutValidationErrors };
    validatePatientInfo: (patientInfo: CheckoutPatientInfo) => CheckoutValidationErrors;
    validateAddress: (
        address: Address,
        useExistingAddress: boolean,
        existingAddresses: Address[],
        selectedAddressId?: string,
    ) => CheckoutValidationErrors;
    getSelectedAddress: (existingAddresses: Address[], selectedAddressId: string | undefined, fallbackAddress: Address) => Address;
    createEmptyAddress: (country?: string) => Address;
    createEmptyPatientInfo: () => CheckoutPatientInfo;
    initializePatientInfo: (initialData: CheckoutPatientInfo | null) => CheckoutPatientInfo;
    isValidEmail: (email: string) => boolean;

    // Stripe payment functions (reused)
    fetchPaymentMethods: (authToken: string) => Promise<StripePaymentMethod[]>;
    getDefaultPaymentMethod: (paymentMethods: StripePaymentMethod[]) => StripePaymentMethod | undefined;
    createSetupIntent: (authToken: string, forceNew?: boolean) => Promise<StripeInitializationResult>;
    deletePaymentMethod: (authToken: string, methodId: number) => Promise<{ success: boolean; error?: string }>;
    savePaymentMethod: (
        authToken: string,
        paymentMethodId: string,
        customerId: string,
        setupIntentId: string,
        setAsDefault?: boolean,
    ) => Promise<{ success: boolean; error?: string }>;
    isSetupIntentProcessing: (status: string) => boolean;
    isSetupIntentSucceeded: (status: string) => boolean;

    // State persistence
    loadState: () => Partial<EnrollmentState>;
    saveState: (state: Partial<EnrollmentState>) => void;
    clearState: () => void;

    // Analytics helpers
    enrichEventWithPatientData: (eventData: any, patientInfo: PatientInfo | null) => any;
    toSlug: (text: string) => string;
    sendAbandonBeacon: (eventData: any, analyticsManager: AnalyticsManager) => boolean;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Interface for sorted enrollment forms used in analytics tracking
 */
export interface EnrollmentForm {
    id: number;
    /** Scoped UniEMR form identifiers for preferred-drug resolution. */
    treatment_plan_form_id?: string | null;
    form_template_id?: string | null;
    name: string;
    description?: string;
    form_json?: any;
    is_required: boolean;
    sort_order: number;
}

/**
 * Analytics-relevant subset shared by both Treatment and EmrTreatmentPlan.
 * Used by analytics utility functions so they work for both provider types.
 */
export interface AnalyticsTarget {
    id: number;
    name: string;
    currency?: string;
}

/**
 * Analytics event data structure for enrollment tracking
 */
export interface AnalyticsEventData {
    category: string;
    action: string;
    label?: string;
    value?: number;
    page_url?: string;
    metadata?: Record<string, any>;
    user_id?: string;
}

/**
 * Configuration for analytics tracking in enrollment
 */
export interface EnrollmentAnalyticsConfig {
    merchantId: number;
    treatmentId: number;
    treatmentName: string;
    treatmentCurrency: string;
    sortedForms: EnrollmentForm[];
}

/**
 * Analytics state tracking for deduplication
 */
export interface AnalyticsTrackingState {
    lastTrackedEvents: Record<string, any>;
    lastUserProperties: string;
    hasFiredSurveyComplete: boolean;
    hasTrackedAbandon: boolean;
    hasTrackedTabSwitch: boolean;
}

/**
 * Analytics prop interface for SurveyForm component
 */
export interface SurveyFormAnalyticsProp {
    enabled: boolean;
    sessionId: string;
    userId?: string;
    /**
     * Merchant event-mapping config (event name overrides, field maps,
     * custom-event definitions). Forwarded to the survey-form-package's
     * internal Meta / GTM providers so their browser pixels honor the
     * same mapping the backend resolver applies.
     */
    eventMappings?: import('./analytics').ClientEventMappings;
    trackEvent: (event: any) => void;
    trackPageView: (url: string, title?: string, additionalData?: Record<string, any>) => void;
    trackTiming: (category: string, variable: string, value: number, label?: string) => void;
    setUserProperties: (properties: Record<string, any>) => void;
}

/**
 * Abandon event context for tracking
 */
export interface AbandonEventContext {
    currentStep: number;
    isCheckout: boolean;
    form?: EnrollmentForm;
}
