import { enrollmentFetch } from '@/lib/enrollment-api-transport';
import { pixelConsentAllows } from './pixelConsent';
import { AnalyticsConfig, AnalyticsManager, getCurrentUrlParameters, type UrlParameters } from '@/lib/analytics';
import { appendFriendbuyTracking } from '@/lib/friendbuy';
import type {
    EmrCheckoutSelectionState,
    EmrDrugGroupSelection,
    EmrDrugSelectionState,
    EmrEnrollmentUtils,
    EmrEnrollmentUtilsConfig,
    EmrRefillVariant,
    EmrTreatmentPlan,
    EmrTreatmentPlanDrug,
    EmrTreatmentPlanDrugGroup,
} from './enrollment-types';
import {
    AbandonEventContext,
    Address,
    AnalyticsEventData,
    AnalyticsTarget,
    AnalyticsTrackingState,
    ApplicableCoupon,
    CheckoutData,
    CheckoutPatientInfo,
    CheckoutSelectionState,
    CheckoutValidationErrors,
    CouponsResponse,
    CouponValidationContext,
    DEFAULT_PATIENT_AUTH_CONFIG,
    DEFAULT_PATIENT_AUTH_STORAGE_KEY,
    EmrChargeMode,
    EnrollmentForm,
    EnrollmentState,
    EnrollmentSubmissionResult,
    EnrollmentUtils,
    EnrollmentUtilsConfig,
    PATIENT_AUTH_ENDPOINTS,
    PATIENT_AUTH_STORAGE_PREFIX,
    PatientAuthConfig,
    PatientAuthData,
    PatientAuthFormData,
    PatientAuthResult,
    PatientAuthStorageData,
    PatientAuthValidationErrors,
    PatientInfo,
    PENDING_UPDATES_STORAGE_PREFIX,
    PendingPatientUpdate,
    PendingUpdatesData,
    PricingOption,
    StripeInitializationResult,
    StripePaymentMethod,
    SurveyFormAnalyticsProp,
    Treatment,
    TreatmentProduct,
    TreatmentVariation,
    US_STATES,
} from './enrollment-types';

// Re-export StripePaymentForm for convenience
export { default as StripePaymentForm } from '@/components/StripePaymentForm';

// ============================================================================
// Internal Helpers (shared, non-exported)
// ============================================================================

async function safeJson<T = any>(response: Response): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch {
        return {} as T;
    }
}

function buildJsonHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(extra || {}),
    };
}

function buildBearerHeaders(authToken: string, extra?: Record<string, string>): Record<string, string> {
    return buildJsonHeaders({
        Authorization: `Bearer ${authToken}`,
        ...(extra || {}),
    });
}

function isBrowserStorageAvailable(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getPendingUpdatesStorageKey(storageKey: string): string {
    return `${PENDING_UPDATES_STORAGE_PREFIX}${storageKey.replace(PATIENT_AUTH_STORAGE_PREFIX, '')}`;
}

function normalizeUrlParameters(value: unknown): UrlParameters {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const normalized: UrlParameters = {};

    for (const [key, rawValue] of Object.entries(value)) {
        if (typeof rawValue === 'string') {
            normalized[key] = rawValue;
        } else if (Array.isArray(rawValue)) {
            normalized[key] = rawValue.map((entry) => String(entry));
        }
    }

    return normalized;
}

export function resolveEnrollmentUrlParameters(captured?: UrlParameters | null): UrlParameters {
    const capturedParams = normalizeUrlParameters(captured);

    if (Object.keys(capturedParams).length > 0) {
        return capturedParams;
    }

    return getCurrentUrlParameters();
}

function mergeEnrollmentUrlParameters<T extends { metadata?: Record<string, any> }>(eventData: T, urlParams?: UrlParameters | null): T {
    const resolvedUrlParams = resolveEnrollmentUrlParameters(urlParams);

    if (Object.keys(resolvedUrlParams).length === 0) {
        return eventData;
    }

    return {
        ...eventData,
        metadata: {
            ...eventData.metadata,
            url_params: {
                ...resolvedUrlParams,
                ...(eventData.metadata?.url_params ?? {}),
            },
        },
    };
}

function appendAnalyticsTracking(formData: FormData, analyticsManager?: AnalyticsManager | null, urlParams?: UrlParameters | null): void {
    appendFriendbuyTracking(formData);
    const resolvedUrlParams = resolveEnrollmentUrlParameters(urlParams);

    if (Object.keys(resolvedUrlParams).length > 0) {
        formData.append('url_params', JSON.stringify(resolvedUrlParams));
    }

    if (!analyticsManager) return;

    const trackingData = analyticsManager.getTrackingData();
    formData.append('session_id', trackingData.session_id);

    if (trackingData.fbp) formData.append('fbp', trackingData.fbp);
    if (trackingData.fbc) formData.append('fbc', trackingData.fbc);

    // Convert Experiences A/B context, persisted on the enrollment so lifecycle
    // events (charges, refills, …) report against the visitor's variation.
    if (trackingData.convert_visitor_id) {
        formData.append('convert_visitor_id', trackingData.convert_visitor_id);
        formData.append('convert_bucketing', JSON.stringify(trackingData.convert_bucketing ?? {}));
    }
}

function appendCheckoutData(formData: FormData, checkoutData: CheckoutData): void {
    formData.append('patient_info', JSON.stringify(checkoutData.patientInfo));
    formData.append('use_existing_address', checkoutData.useExistingAddress.toString());

    if (checkoutData.useExistingAddress && checkoutData.address.id) {
        formData.append('address_id', checkoutData.address.id.toString());
    } else {
        formData.append('address', JSON.stringify(checkoutData.address));
    }

    if (checkoutData.stripePaymentMethodId) {
        formData.append('stripe_payment_method_id', checkoutData.stripePaymentMethodId);
    } else if (checkoutData.paymentDetails) {
        formData.append('payment_details', JSON.stringify(checkoutData.paymentDetails));
    }

    if (checkoutData.stripePaymentIntentId) {
        formData.append('stripe_payment_intent_id', checkoutData.stripePaymentIntentId);
    }

    const couponCode = checkoutData.couponCode ?? checkoutData.appliedCoupon?.code;
    if (couponCode) {
        formData.append('coupon_code', couponCode);
    }
}

function appendFormResponsesWithFiles(formData: FormData, formResponses: Record<number, any>): void {
    const formResponsesArray = Object.keys(formResponses).map((formId) => {
        const responseData = formResponses[parseInt(formId)];
        const processedData: Record<string, any> = {};

        Object.keys(responseData).forEach((key) => {
            const value = responseData[key];

            if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
                value.forEach((file, index) => {
                    const fileKey = `files[${formId}][${key}][${index}]`;
                    formData.append(fileKey, file);
                });

                processedData[key] = value.map((file) => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                }));
            } else {
                processedData[key] = value;
            }
        });

        return {
            intake_form_id: parseInt(formId),
            response_data: processedData,
        };
    });

    formData.append('form_responses', JSON.stringify(formResponsesArray));
}

// ============================================================================
// Patient Data Functions
// ============================================================================

/**
 * Fetch patient information using auth token
 */
export async function fetchPatientInfo(authToken: string): Promise<PatientInfo | null> {
    try {
        const response = await enrollmentFetch('/api/patient/profile', {
            method: 'GET',
            headers: buildBearerHeaders(authToken),
        });

        if (!response.ok) return null;

        const data = await safeJson<any>(response);
        if (data.success && data.patient) {
            return {
                id: data.patient.id,
                email: data.patient.email || '',
                first_name: data.patient.first_name || data.patient.firstName || '',
                last_name: data.patient.last_name || data.patient.lastName || '',
                phone: data.patient.phone || '',
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching patient info:', error);
        return null;
    }
}

/**
 * Fetch patient addresses using auth token
 */
export async function fetchPatientAddresses(authToken: string): Promise<Address[]> {
    try {
        const response = await enrollmentFetch('/api/patient/addresses', {
            method: 'GET',
            headers: buildBearerHeaders(authToken),
        });

        if (!response.ok) return [];

        const data = await safeJson<any>(response);
        if (data.success && data.addresses) {
            return data.addresses;
        }
        return [];
    } catch (error) {
        console.error('Error fetching patient addresses:', error);
        return [];
    }
}

/**
 * Extract patient information from intake form responses
 */
export function extractPatientInfo(formResponses: Record<number, any>): PatientInfo {
    const patientInfo: PatientInfo = {
        id: null,
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
    };

    Object.values(formResponses).forEach((responseData: any) => {
        // Check for authResults special case first
        if (responseData?.authResults?.patient) {
            const user = responseData.authResults.patient;

            if (!patientInfo.id && user.id) patientInfo.id = user.id;
            if (!patientInfo.email && user.email) patientInfo.email = user.email;

            if (!patientInfo.first_name) {
                if (user.firstName) patientInfo.first_name = user.firstName;
                else if (user.name) patientInfo.first_name = user.name;
            }

            if (!patientInfo.last_name && user.lastName) patientInfo.last_name = user.lastName;
            if (!patientInfo.phone && user.phone) patientInfo.phone = user.phone;
        }

        // Check for individual fields
        ['email', 'patient_email', 'Email', 'EMAIL'].forEach((field) => {
            if (!patientInfo.email && responseData[field]) patientInfo.email = responseData[field];
        });

        ['first_name', 'firstName', 'fname', 'First Name', 'FIRST_NAME'].forEach((field) => {
            if (!patientInfo.first_name && responseData[field]) patientInfo.first_name = responseData[field];
        });

        ['last_name', 'lastName', 'lname', 'Last Name', 'LAST_NAME'].forEach((field) => {
            if (!patientInfo.last_name && responseData[field]) patientInfo.last_name = responseData[field];
        });

        ['phone', 'phone_number', 'mobile', 'Phone', 'PHONE'].forEach((field) => {
            if (!patientInfo.phone && responseData[field]) patientInfo.phone = responseData[field];
        });
    });

    return patientInfo;
}

// ============================================================================
// Checkout Validation Functions
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    return /\S+@\S+\.\S+/.test(email);
}

/**
 * Validate patient info fields
 */
export function validatePatientInfo(patientInfo: CheckoutPatientInfo): CheckoutValidationErrors {
    const errors: CheckoutValidationErrors = {};

    if (!patientInfo.email) {
        errors.email = 'Email is required';
    } else if (!isValidEmail(patientInfo.email)) {
        errors.email = 'Email is invalid';
    }

    if (!patientInfo.first_name) errors.first_name = 'First name is required';
    if (!patientInfo.last_name) errors.last_name = 'Last name is required';
    if (!patientInfo.phone) errors.phone = 'Phone number is required';

    return errors;
}

/**
 * Validate address fields
 */
export function validateAddress(
    address: Address,
    useExistingAddress: boolean,
    existingAddresses: Address[],
    selectedAddressId?: string,
): CheckoutValidationErrors {
    const errors: CheckoutValidationErrors = {};

    if (!useExistingAddress || existingAddresses.length === 0) {
        if (!address.line1) errors.line1 = 'Street address is required';
        if (!address.city) errors.city = 'City is required';
        if (!address.state) errors.state = 'State is required';
        if (!address.zip) errors.zip = 'ZIP code is required';
    } else if (useExistingAddress && !selectedAddressId) {
        errors.selectedAddress = 'Please select an address';
    }

    return errors;
}

/**
 * Validate entire checkout form
 */
export function validateCheckoutForm(
    patientInfo: CheckoutPatientInfo,
    address: Address,
    useExistingAddress: boolean,
    existingAddresses: Address[],
    selectedAddressId?: string,
): { isValid: boolean; errors: CheckoutValidationErrors } {
    const patientErrors = validatePatientInfo(patientInfo);
    const addressErrors = validateAddress(address, useExistingAddress, existingAddresses, selectedAddressId);

    const errors = { ...patientErrors, ...addressErrors };
    const isValid = Object.keys(errors).length === 0;

    return { isValid, errors };
}

/**
 * Get selected address from existing addresses
 */
export function getSelectedAddress(existingAddresses: Address[], selectedAddressId: string | undefined, fallbackAddress: Address): Address {
    if (selectedAddressId) {
        const selected = existingAddresses.find((a) => a.id === Number(selectedAddressId));
        if (selected) return selected;
    }
    return fallbackAddress;
}

/**
 * Create empty address object with defaults
 */
export function createEmptyAddress(country: string = 'US'): Address {
    return {
        line1: '',
        line2: '',
        city: '',
        state: '',
        zip: '',
        country,
    };
}

/**
 * Create empty patient info object
 */
export function createEmptyPatientInfo(): CheckoutPatientInfo {
    return {
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
    };
}

/**
 * Initialize patient info from existing data
 */
export function initializePatientInfo(initialData: CheckoutPatientInfo | null): CheckoutPatientInfo {
    return {
        email: initialData?.email || '',
        first_name: initialData?.first_name || '',
        last_name: initialData?.last_name || '',
        phone: initialData?.phone || '',
    };
}

// ============================================================================
// State Availability Functions
// ============================================================================

/**
 * Get all available states for a country
 * Returns the full list of states/provinces for a given country code
 */
export function getAllStatesForCountry(country: string = 'US'): string[] {
    if (country === 'US') return Array.from(US_STATES);
    // Add support for other countries as needed
    return [];
}

/**
 * Get available states for a treatment in a given country
 * Returns the states defined in treatment's country_state_availability, or all states if not restricted
 */
export function getTreatmentAvailableStates(treatment: Treatment, country: string = 'US'): string[] {
    if (!treatment.country_state_availability) return getAllStatesForCountry(country);
    return treatment.country_state_availability[country] ?? [];
}

/**
 * Get available states for a treatment variation
 * Variations can override treatment-level state availability
 * If variation has no state availability set, it inherits from the treatment
 */
export function getVariationAvailableStates(variation: TreatmentVariation, treatment: Treatment, country: string = 'US'): string[] {
    if (variation.country_state_availability) {
        return variation.country_state_availability[country] ?? [];
    }
    return getTreatmentAvailableStates(treatment, country);
}

/**
 * Check if a state is available for a treatment
 */
export function isStateAvailableForTreatment(state: string, treatment: Treatment, country: string = 'US'): boolean {
    const availableStates = getTreatmentAvailableStates(treatment, country);
    return availableStates.includes(state);
}

/**
 * Check if a state is available for a variation
 */
export function isStateAvailableForVariation(state: string, variation: TreatmentVariation, treatment: Treatment, country: string = 'US'): boolean {
    const availableStates = getVariationAvailableStates(variation, treatment, country);
    return availableStates.includes(state);
}

/**
 * Get the intersection of available states across multiple variations
 * Useful for finding states that are available for all variations
 */
export function getCommonAvailableStates(variations: TreatmentVariation[], treatment: Treatment, country: string = 'US'): string[] {
    if (variations.length === 0) return getTreatmentAvailableStates(treatment, country);

    let commonStates = getVariationAvailableStates(variations[0], treatment, country);

    for (let i = 1; i < variations.length; i++) {
        const variationStates = getVariationAvailableStates(variations[i], treatment, country);
        commonStates = commonStates.filter((state) => variationStates.includes(state));
    }

    return commonStates;
}

/**
 * Validate if an address state is available for a treatment
 * Returns validation result with error message if invalid
 */
export function validateAddressStateForTreatment(
    address: Address,
    treatment: Treatment,
    selectedVariation?: TreatmentVariation,
): { valid: boolean; error?: string } {
    const country = address.country || 'US';
    const state = address.state;

    if (!state) return { valid: false, error: 'State is required' };

    if (selectedVariation) {
        const isAvailable = isStateAvailableForVariation(state, selectedVariation, treatment, country);
        if (!isAvailable) {
            return {
                valid: false,
                error: `This treatment is not available in ${state}. Please select a different state or contact support.`,
            };
        }
        return { valid: true };
    }

    const isAvailable = isStateAvailableForTreatment(state, treatment, country);
    if (!isAvailable) {
        return {
            valid: false,
            error: `This treatment is not available in ${state}. Please select a different state or contact support.`,
        };
    }

    return { valid: true };
}

// ============================================================================
// Treatment Variation Functions
// ============================================================================

/**
 * Get the default variation from a treatment
 * Returns the first variation marked as default, or the first variation if none are marked default
 */
export function getDefaultVariation(treatment: Treatment): TreatmentVariation | null {
    if (!treatment.variations || treatment.variations.length === 0) return null;

    const defaultVariation = treatment.variations.find((v) => v.is_default);
    if (defaultVariation) return defaultVariation;

    return treatment.variations[0];
}

/**
 * Get a specific variation by ID, or fall back to default
 */
export function getSelectedVariation(treatment: Treatment, variationId?: number): TreatmentVariation | null {
    if (!treatment.variations || treatment.variations.length === 0) return null;

    if (variationId) {
        const selected = treatment.variations.find((v) => v.id === variationId);
        if (selected) return selected;
    }

    return getDefaultVariation(treatment);
}

/**
 * Get all products from a variation
 */
export function getVariationProducts(variation: TreatmentVariation): TreatmentProduct[] {
    return variation.products || [];
}

/**
 * Get the price from a variation
 * Falls back to calculating from products if variation price is not set
 */
export function getVariationPrice(variation: TreatmentVariation): number {
    if (variation.price && variation.price > 0) return variation.price;

    return getVariationProducts(variation).reduce((sum, product) => sum + product.price * product.quantity, 0);
}

/**
 * Get all products from a treatment (from default variation)
 */
export function getTreatmentProducts(treatment: Treatment): TreatmentProduct[] {
    const defaultVariation = getDefaultVariation(treatment);
    if (defaultVariation) return getVariationProducts(defaultVariation);
    return [];
}

/**
 * Get all variations from a treatment
 * Returns variations with their products and pricing options
 */
export function getVariations(treatment: Treatment): TreatmentVariation[] {
    return treatment.variations || [];
}

/**
 * Generate a unique key for a pricing option based on billing type and interval
 * Used to match equivalent pricing options across different products
 */
function getPricingOptionKey(option: PricingOption): string {
    if (option.billing_type === 'one_time') {
        return 'one_time';
    }
    if (option.billing_interval === 'custom') {
        return `recurring_custom_${option.billing_interval_days}`;
    }
    return `recurring_${option.billing_interval}`;
}

/**
 * Get common pricing options across all products in a variation
 * Returns only pricing options that exist in ALL products (intersection by billing type/interval)
 * If any product has no pricing options, returns empty array
 *
 * For variations with multiple products, this creates aggregated pricing options
 * with summed prices across all products for each common billing type.
 *
 * For example:
 * - Product A has: one_time ($200), monthly ($50)
 * - Product B has: one_time ($299), six_months ($800)
 * - Result: one_time with aggregated price ($499 = $200 + $299)
 *
 * The returned pricing options have:
 * - id: a composite key like "one_time" or "recurring_monthly"
 * - price_cents: sum of all product prices for that billing type
 * - sale_price_cents: sum of all product sale prices (if all have sale prices)
 */
export function getCommonPricingOptions(variation: TreatmentVariation): PricingOption[] {
    const products = variation.products || [];
    if (products.length === 0) return [];

    const firstProductOptions = products[0].pricing_options || [];
    if (firstProductOptions.length === 0) return [];

    // For single product, return options directly
    if (products.length === 1) {
        return firstProductOptions.filter((opt) => opt.is_active);
    }

    // Build a map of pricing option keys for each product
    const productOptionMaps: Map<string, PricingOption>[] = products.map((product) => {
        const optionMap = new Map<string, PricingOption>();
        for (const opt of product.pricing_options || []) {
            if (opt.is_active) {
                optionMap.set(getPricingOptionKey(opt), opt);
            }
        }
        return optionMap;
    });

    // Find common keys across all products
    const firstProductKeys = Array.from(productOptionMaps[0].keys());
    const commonKeys = firstProductKeys.filter((key) => productOptionMaps.slice(1).every((optMap) => optMap.has(key)));

    if (commonKeys.length === 0) return [];

    // Build aggregated pricing options for each common key
    const aggregatedOptions: PricingOption[] = [];

    for (const key of commonKeys) {
        // Use first product's option as base for metadata
        const baseOption = productOptionMaps[0].get(key)!;

        let totalPriceCents = 0;
        let totalSalePriceCents = 0;
        let allHaveSalePrice = true;
        let hasAnyDefault = false;
        let minSortOrder = Infinity;

        // Sum prices across all products
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const productOption = productOptionMaps[i].get(key)!;

            totalPriceCents += productOption.price_cents * product.quantity;

            if (productOption.sale_price_cents != null) {
                totalSalePriceCents += productOption.sale_price_cents * product.quantity;
            } else {
                allHaveSalePrice = false;
            }

            if (productOption.is_default) hasAnyDefault = true;
            if (productOption.sort_order != null && productOption.sort_order < minSortOrder) {
                minSortOrder = productOption.sort_order;
            }
        }

        aggregatedOptions.push({
            id: key, // Use the billing type key as the ID for aggregated options
            billing_type: baseOption.billing_type,
            billing_interval: baseOption.billing_interval,
            billing_interval_days: baseOption.billing_interval_days,
            price_cents: totalPriceCents,
            sale_price_cents: allHaveSalePrice ? totalSalePriceCents : undefined,
            label: baseOption.label,
            is_default: hasAnyDefault,
            is_active: true,
            sort_order: minSortOrder !== Infinity ? minSortOrder : undefined,
        });
    }

    // Sort by sort_order if available, otherwise maintain order
    return aggregatedOptions.sort((a, b) => {
        const orderA = a.sort_order ?? 999;
        const orderB = b.sort_order ?? 999;
        return orderA - orderB;
    });
}

/**
 * Get the default pricing option from a list of pricing options
 * Returns the first option marked as default, or the first option if none are marked
 */
export function getDefaultPricingOption(pricingOptions: PricingOption[]): PricingOption | null {
    if (pricingOptions.length === 0) return null;

    const defaultOption = pricingOptions.find((opt) => opt.is_default && opt.is_active);
    if (defaultOption) return defaultOption;

    const firstActive = pricingOptions.find((opt) => opt.is_active);
    return firstActive || pricingOptions[0];
}

/**
 * Calculate total price based on a selected pricing option
 * Supports both aggregated pricing option keys (e.g., "one_time", "recurring_monthly")
 * and legacy per-product pricing option IDs.
 *
 * For variations with multiple products, this uses the aggregated pricing from
 * getCommonPricingOptions which already has summed prices.
 *
 * @param variation - The treatment variation containing products
 * @param pricingOptionId - The ID or key of the selected pricing option
 * @returns Total price in dollars (converted from cents)
 */
export function calculateTotalWithPricingOption(variation: TreatmentVariation, pricingOptionId: string): number {
    const products = variation.products || [];
    if (products.length === 0) return variation.price || 0;

    // For single product variations, use direct ID matching
    if (products.length === 1) {
        const options = products[0].pricing_options || [];
        const selectedOption = options.find((opt) => opt.id === pricingOptionId && opt.is_active);

        if (selectedOption) {
            const priceCents = selectedOption.sale_price_cents ?? selectedOption.price_cents;
            return (priceCents * products[0].quantity) / 100;
        }
        return products[0].price * products[0].quantity;
    }

    // For multi-product variations, the pricingOptionId is a billing type key
    // Check if it's an aggregated key (from getCommonPricingOptions)
    const aggregatedOptions = getCommonPricingOptions(variation);
    const aggregatedOption = aggregatedOptions.find((opt) => opt.id === pricingOptionId);

    if (aggregatedOption) {
        // Use the pre-calculated aggregated price
        const priceCents = aggregatedOption.sale_price_cents ?? aggregatedOption.price_cents;
        return priceCents / 100;
    }

    // Fallback: try to match by billing type key across all products
    // This handles cases where pricingOptionId might be a legacy per-product ID
    let totalCents = 0;

    for (const product of products) {
        const options = product.pricing_options || [];

        // First try exact ID match
        let selectedOption = options.find((opt) => opt.id === pricingOptionId && opt.is_active);

        // If no exact match, try matching by billing type key
        if (!selectedOption) {
            selectedOption = options.find((opt) => opt.is_active && getPricingOptionKey(opt) === pricingOptionId);
        }

        if (selectedOption) {
            const priceCents = selectedOption.sale_price_cents ?? selectedOption.price_cents;
            totalCents += priceCents * product.quantity;
        } else {
            // Fallback to product base price
            totalCents += product.price * 100 * product.quantity;
        }
    }

    return totalCents / 100;
}

/**
 * Get pricing option label for display
 */
export function getPricingOptionLabel(option: PricingOption): string {
    if (option.label) return option.label;

    if (option.billing_type === 'one_time') return 'One-time payment';

    switch (option.billing_interval) {
        case 'monthly':
            return 'Monthly';
        case 'quarterly':
            return 'Every 3 months';
        case 'six_months':
            return 'Every 6 months';
        case 'yearly':
            return 'Yearly';
        case 'custom':
            return `Every ${option.billing_interval_days} days`;
        default:
            return 'Recurring';
    }
}

/**
 * Check if a variation has pricing options available
 */
export function variationHasPricingOptions(variation: TreatmentVariation): boolean {
    const commonOptions = getCommonPricingOptions(variation);
    return commonOptions.length > 0;
}

// ============================================================================
// Selection State Management
// ============================================================================

/**
 * Create a selection state manager for tracking selected variation and pricing option
 * This provides in-memory state that can be used across blocks
 */
export function createSelectionStateManager(treatment: Treatment) {
    let selectedVariationId: number | null = null;
    let selectedPricingOptionId: string | null = null;

    return {
        /**
         * Set the selected variation ID
         */
        setSelectedVariationId(variationId: number | null) {
            selectedVariationId = variationId;
            // Reset pricing option when variation changes
            selectedPricingOptionId = null;
        },

        /**
         * Get the selected variation ID
         */
        getSelectedVariationId(): number | null {
            return selectedVariationId;
        },

        /**
         * Set the selected pricing option ID
         */
        setSelectedPricingOptionId(pricingOptionId: string | null) {
            selectedPricingOptionId = pricingOptionId;
        },

        /**
         * Get the selected pricing option ID
         */
        getSelectedPricingOptionId(): string | null {
            return selectedPricingOptionId;
        },

        /**
         * Get the full checkout selection state with computed values
         */
        getCheckoutSelectionState(paymentMethod: 'upfront' | 'per_schedule' | null = null): CheckoutSelectionState {
            const variation = selectedVariationId ? getSelectedVariation(treatment, selectedVariationId) : getDefaultVariation(treatment);

            const variationId = variation?.id ?? null;
            const products = variation ? getVariationProducts(variation) : [];
            const availablePricingOptions = variation ? getCommonPricingOptions(variation) : [];

            let pricingOption: PricingOption | null = null;
            if (selectedPricingOptionId && availablePricingOptions.length > 0) {
                pricingOption = availablePricingOptions.find((o) => o.id === selectedPricingOptionId) || null;
            }

            if (!pricingOption && availablePricingOptions.length > 0) {
                pricingOption = getDefaultPricingOption(availablePricingOptions);
            }

            let total = 0;
            if (pricingOption && variation) {
                total = calculateTotalWithPricingOption(variation, pricingOption.id);
            } else if (variation) {
                total = calculateTotal(treatment, paymentMethod, variationId ?? undefined);
            }

            const billingType = pricingOption?.billing_type ?? null;
            const billingInterval = pricingOption?.billing_interval ?? null;
            const billingLabel = pricingOption ? getPricingOptionLabel(pricingOption) : null;

            return {
                variationId,
                variation,
                pricingOptionId: pricingOption?.id ?? null,
                pricingOption,
                products,
                availablePricingOptions,
                total,
                billingType,
                billingInterval,
                billingLabel,
            };
        },

        /**
         * Check if a variation is selected (either explicitly or default)
         */
        hasVariationSelected(): boolean {
            if (selectedVariationId) return true;
            return getDefaultVariation(treatment) !== null;
        },

        /**
         * Check if a pricing option is selected
         */
        hasPricingOptionSelected(): boolean {
            return selectedPricingOptionId !== null;
        },

        /**
         * Reset all selections
         */
        resetSelections() {
            selectedVariationId = null;
            selectedPricingOptionId = null;
        },
    };
}

export type SelectionStateManager = ReturnType<typeof createSelectionStateManager>;

// ============================================================================
// Coupon Types & Functions
// ============================================================================

/**
 * Fetch applicable coupons for a patient email and treatment
 */
export async function fetchApplicableCoupons(
    email: string,
    treatmentId: number,
    variationId?: number,
    productVariationIds?: number[],
    subtotal?: number,
    context?: CouponValidationContext,
): Promise<CouponsResponse> {
    try {
        const response = await enrollmentFetch('/api/v2/patient/get-coupon', {
            method: 'POST',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                email,
                treatment_id: context?.emrTreatmentPlanId ? undefined : treatmentId,
                emr_treatment_plan_id: context?.emrTreatmentPlanId,
                emr_refill_variant_key: context?.emrRefillVariantKey,
                emr_billing_option_id: context?.emrBillingOptionId,
                emr_treatment_enrollment_id: context?.emrTreatmentEnrollmentId,
                variation_id: variationId,
                product_variation_ids: productVariationIds,
                merchant_drug_ids: context?.selectedMerchantDrugIds,
                selected_merchant_drug_ids: context?.selectedMerchantDrugIds,
                emr_usage_context: context?.emrUsageContext,
                emr_refill_number: context?.emrRefillNumber,
                subtotal,
            }),
        });

        if (response.ok) {
            const data = await safeJson<CouponsResponse>(response);
            return data;
        }

        const errorData = await safeJson<any>(response);
        return {
            success: false,
            coupons: [],
            subtotal: subtotal || 0,
            count: 0,
            error: errorData.error || 'Failed to fetch coupons',
        };
    } catch (error) {
        console.error('Error fetching coupons:', error);
        return {
            success: false,
            coupons: [],
            subtotal: subtotal || 0,
            count: 0,
            error: 'Failed to fetch coupons',
        };
    }
}

/**
 * Validate a specific coupon code for a patient and treatment
 */
export async function validateCoupon(
    email: string,
    couponCode: string,
    treatmentId: number,
    variationId?: number,
    productVariationIds?: number[],
    subtotal?: number,
    context?: CouponValidationContext,
): Promise<{ valid: boolean; coupon?: ApplicableCoupon; error?: string }> {
    try {
        const response = await enrollmentFetch('/api/v2/patient/validate-coupon', {
            method: 'POST',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                email,
                coupon_code: couponCode,
                treatment_id: context?.emrTreatmentPlanId ? undefined : treatmentId,
                emr_treatment_plan_id: context?.emrTreatmentPlanId,
                emr_refill_variant_key: context?.emrRefillVariantKey,
                emr_billing_option_id: context?.emrBillingOptionId,
                emr_treatment_enrollment_id: context?.emrTreatmentEnrollmentId,
                variation_id: variationId,
                product_variation_ids: productVariationIds,
                merchant_drug_ids: context?.selectedMerchantDrugIds,
                selected_merchant_drug_ids: context?.selectedMerchantDrugIds,
                emr_usage_context: context?.emrUsageContext,
                emr_refill_number: context?.emrRefillNumber,
                subtotal,
            }),
        });

        const data = await safeJson<any>(response);

        if (response.ok && data.success && data.valid) {
            return { valid: true, coupon: data.coupon };
        }

        return { valid: false, error: data.error || 'Invalid coupon code' };
    } catch (error) {
        console.error('Error validating coupon:', error);
        return { valid: false, error: 'Failed to validate coupon' };
    }
}

// ============================================================================
// Stripe Payment Types & Functions
// ============================================================================

/**
 * Fetch saved payment methods for a patient
 */
export async function fetchPaymentMethods(authToken: string, merchantId: number): Promise<StripePaymentMethod[]> {
    try {
        const response = await enrollmentFetch(`/api/patient/payments/methods?merchant_id=${merchantId}`, {
            headers: buildBearerHeaders(authToken),
        });

        if (!response.ok) return [];

        const data = await safeJson<any>(response);
        if (data.success && data.payment_methods) {
            return data.payment_methods;
        }
        return [];
    } catch (error) {
        console.error('Failed to fetch payment methods:', error);
        return [];
    }
}

/**
 * Get the default payment method from a list
 */
export function getDefaultPaymentMethod(paymentMethods: StripePaymentMethod[]): StripePaymentMethod | undefined {
    return paymentMethods.find((m) => m.is_default);
}

/**
 * Create a Stripe setup intent for saving payment methods
 */
export async function createSetupIntent(authToken: string, merchantId: number, forceNew: boolean = false): Promise<StripeInitializationResult> {
    try {
        const response = await enrollmentFetch('/api/patient/payments/setup-intent', {
            method: 'POST',
            headers: buildBearerHeaders(authToken),
            body: JSON.stringify({
                merchant_id: merchantId,
                force_new: forceNew,
            }),
        });

        if (response.ok) {
            const data = await safeJson<any>(response);
            if (data.success && data.setup_intent) {
                return { success: true, setupIntent: data.setup_intent };
            }
        }

        const errorData = await safeJson<any>(response);
        return { success: false, error: errorData.error || 'Failed to initialize payment setup' };
    } catch (error) {
        console.error('Failed to create setup intent:', error);
        return { success: false, error: 'Failed to initialize payment setup' };
    }
}

/**
 * Create a Stripe PaymentIntent that authorizes (manual capture) a hold AND saves
 * the card for future off-session use. Used when the merchant's EMR charge mode
 * is "save_and_authorize" — replaces the SetupIntent flow at checkout.
 *
 * IMPORTANT: the amount is computed *server-side* from the plan + variant +
 * drug selections. We never pass an amount from the browser, since the patient
 * could otherwise tamper with the hold amount.
 */
export async function createAuthorizationIntent(
    authToken: string,
    merchantId: number,
    params: {
        slug: string;
        idempotencyKey?: string;
        assignedPlanId?: number;
        billingCheckoutUuid?: string;
        couponCode?: string;
        variantId?: string | null;
        drugSelections?: unknown;
        currency?: string;
    },
): Promise<import('./enrollment-types').StripeAuthorizationIntentResult> {
    try {
        const response = await enrollmentFetch('/api/patient/payments/authorization-intent', {
            method: 'POST',
            headers: buildBearerHeaders(authToken),
            body: JSON.stringify({
                idempotency_key: params.idempotencyKey,
                merchant_id: merchantId,
                ab_plan_id: params.assignedPlanId,
                billing_checkout_uuid: params.billingCheckoutUuid,
                coupon_code: params.couponCode,
                slug: params.slug,
                variant_id: params.variantId ?? null,
                drug_selections: params.drugSelections ? JSON.stringify(params.drugSelections) : undefined,
                currency: params.currency ?? 'usd',
            }),
        });

        if (response.ok) {
            const data = await safeJson<any>(response);
            if (data.success && data.payment_intent) {
                return { success: true, paymentIntent: data.payment_intent };
            }
        }

        const errorData = await safeJson<any>(response);
        return { success: false, error: errorData.error || 'Failed to initialize payment authorization' };
    } catch (error) {
        console.error('Failed to create authorization intent:', error);
        return { success: false, error: 'Failed to initialize payment authorization' };
    }
}

/**
 * Complete a redirect-based authorization return from only the PaymentIntent
 * ID in the URL. This is the fallback for gateways where sessionStorage does
 * not survive the round trip.
 */
export async function completeAuthorizationReturn(
    authToken: string,
    merchantId: number,
    paymentIntentId: string,
    billingCheckoutUuid?: string,
): Promise<{
    success: boolean;
    paymentMethodId?: string;
    paymentIntentId?: string;
    status?: string;
    retryable?: boolean;
    error?: string;
}> {
    try {
        const response = await enrollmentFetch('/api/patient/payments/authorization-return', {
            method: 'POST',
            headers: buildBearerHeaders(authToken),
            body: JSON.stringify({
                merchant_id: merchantId,
                payment_intent_id: paymentIntentId,
                billing_checkout_uuid: billingCheckoutUuid,
                set_as_default: true,
            }),
        });

        const data = await safeJson<any>(response);

        if (response.ok && data.success) {
            return {
                success: true,
                paymentMethodId: data.payment_method_id,
                paymentIntentId: data.payment_intent_id,
            };
        }

        return {
            success: false,
            status: data.status,
            retryable: response.status === 409,
            error: data.error || 'Failed to complete payment authorization',
        };
    } catch (error) {
        console.error('Failed to complete authorization return:', error);
        return { success: false, error: 'Failed to complete payment authorization' };
    }
}

/**
 * Delete a saved payment method
 */
export async function deletePaymentMethod(authToken: string, methodId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await enrollmentFetch(`/api/patient/payments/methods/${methodId}`, {
            method: 'DELETE',
            headers: buildBearerHeaders(authToken),
        });

        if (response.ok) return { success: true };

        const errorData = await safeJson<any>(response);
        return { success: false, error: errorData.error || 'Failed to delete payment method' };
    } catch (error) {
        console.error('Failed to delete payment method:', error);
        return { success: false, error: 'Failed to delete payment method' };
    }
}

/**
 * Save a payment method after Stripe confirmation
 */
export async function savePaymentMethod(
    authToken: string,
    merchantId: number,
    paymentMethodId: string,
    customerId: string,
    setupIntentId: string,
    setAsDefault: boolean = true,
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await enrollmentFetch('/api/patient/payments/save-method', {
            method: 'POST',
            headers: buildBearerHeaders(authToken),
            body: JSON.stringify({
                payment_method_id: paymentMethodId,
                customer_id: customerId,
                merchant_id: merchantId,
                set_as_default: setAsDefault,
                setup_intent_id: setupIntentId,
            }),
        });

        if (response.ok) return { success: true };

        const errorData = await safeJson<any>(response);
        // If the payment method was already saved, still consider it a success
        if (errorData.error?.includes('already exists')) {
            return { success: true };
        }

        return { success: false, error: errorData.error || 'Failed to save payment method' };
    } catch (error) {
        console.error('Failed to save payment method:', error);
        return { success: false, error: 'Failed to save payment method' };
    }
}

/**
 * Check if a setup intent status requires waiting
 */
export function isSetupIntentProcessing(status: string): boolean {
    return status === 'processing';
}

/**
 * Check if a setup intent has succeeded
 */
export function isSetupIntentSucceeded(status: string): boolean {
    return status === 'succeeded';
}

// ============================================================================
// Payment/Checkout Functions
// ============================================================================

/**
 * Calculate total price based on treatment and payment method
 * Uses the default variation or a specified variation for pricing
 *
 * @param treatment - The treatment containing variations
 * @param paymentMethod - Payment method for recurring treatments
 * @param variationId - Optional specific variation ID to use
 * @param pricingOptionId - Optional pricing option ID to use for calculation
 */
export function calculateTotal(
    treatment: Treatment,
    paymentMethod: 'upfront' | 'per_schedule' | null = 'upfront',
    variationId?: number,
    pricingOptionId?: string,
): number {
    const variation = getSelectedVariation(treatment, variationId);
    if (!variation) return treatment.price || 0;

    // If pricing option is specified, use pricing option calculation
    if (pricingOptionId) {
        return calculateTotalWithPricingOption(variation, pricingOptionId);
    }

    const pricing_options = getCommonPricingOptions(variation);
    if (pricing_options.length > 0) {
        let prices: number[] = [];
        pricing_options.forEach((option) => {
            prices.push(calculateTotalWithPricingOption(variation, option.id));
        });
        const lowest_price = Math.min(...prices);

        return lowest_price;
    }

    // // Calculate from variation products (using base prices)
    const variationProducts = getVariationProducts(variation);
    const productTotal = variationProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);

    return productTotal ?? 0;

    // // Use variation-level pricing if available
    // if (variation.price_type === 'fixed' && variation.price) return variation.price;

    // if (variation.price_type === 'per_schedule' && variation.price) {
    //     const schedules = variation.total_schedules || treatment.total_schedules || 1;
    //     return paymentMethod === 'upfront' ? variation.price * schedules : variation.price;
    // }

    // // Calculate from variation products (using base prices)
    // const variationProducts = getVariationProducts(variation);
    // const productTotal = variationProducts.reduce((sum, product) => sum + (product.price * product.quantity), 0);

    // // Check if variation has its own schedule configuration
    // const isRecurring = variation.enable_schedule || treatment.is_recurring;
    // const totalSchedules = variation.total_schedules || treatment.total_schedules;

    // if (isRecurring && totalSchedules) {
    //     return paymentMethod === 'upfront' ? productTotal * totalSchedules : productTotal;
    // }

    // return productTotal;
}

/**
 * Submit enrollment data to backend
 */
export async function submitEnrollment(
    slug: string,
    formResponses: Record<number, any>,
    checkoutData: CheckoutData | null,
    paymentMethod: 'upfront' | 'per_schedule' | null,
    isRecurring: boolean,
    analyticsManager?: AnalyticsManager | null,
    analyticsUrlParams?: UrlParameters | null,
): Promise<EnrollmentSubmissionResult> {
    return new Promise((resolve) => {
        try {
            const formData = new FormData();

            // Add checkout data if provided
            if (checkoutData) {
                appendCheckoutData(formData, checkoutData);
            }

            // Prepare form_responses array with file handling
            appendFormResponsesWithFiles(formData, formResponses);

            if (isRecurring && paymentMethod) {
                formData.append('payment_method', paymentMethod);
            }

            // Add analytics tracking data
            appendAnalyticsTracking(formData, analyticsManager, analyticsUrlParams);

            enrollmentFetch(`/treatment/enroll/${slug}`, {
                method: 'POST', body: formData, headers: { Accept: 'application/json' },
            }).then(async response => {
                const data = await response.json().catch(() => ({}));
                resolve(response.ok ? { success: true } : { success: false, errors: data.errors || { error: data.message } });
            }).catch(() => resolve({ success: false, errors: { error: 'Unable to submit enrollment.' } }));
        } catch (error) {
            console.error('Error submitting enrollment:', error);
            resolve({
                success: false,
                errors: { error: 'An error occurred while submitting your enrollment. Please try again.' },
            });
        }
    });
}

// ============================================================================
// State Persistence Functions
// ============================================================================

/**
 * Get storage key for enrollment state
 */
export function getStorageKey(slug: string, treatmentId: number): string {
    return `treatment_enroll_${slug}_${treatmentId}`;
}

/**
 * Load saved enrollment state from localStorage
 */
export function loadEnrollmentState(storageKey: string): Partial<EnrollmentState> {
    if (!isBrowserStorageAvailable()) return {};

    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
    } catch (error) {
        console.error('Error loading saved state:', error);
    }
    return {};
}

/**
 * Save enrollment state to localStorage
 */
export function saveEnrollmentState(storageKey: string, state: Partial<EnrollmentState>): void {
    if (!isBrowserStorageAvailable()) return;

    try {
        const existing = loadEnrollmentState(storageKey);
        localStorage.setItem(storageKey, JSON.stringify({ ...existing, ...state }));
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

/**
 * Clear saved enrollment state
 */
export function clearEnrollmentState(storageKey: string): void {
    if (isBrowserStorageAvailable()) {
        localStorage.removeItem(storageKey);
    }
}

// ============================================================================
// Analytics Helpers
// ============================================================================

/**
 * Add patient data to event metadata for backend tracking
 */
export function enrichEventWithPatientData(eventData: any, patientInfo: PatientInfo | null): any {
    if (!patientInfo) return eventData;

    const enrichedEvent = {
        ...eventData,
        metadata: {
            ...eventData.metadata,
        },
    };

    if (patientInfo.id) {
        enrichedEvent.metadata.patient_id = patientInfo.id;
        enrichedEvent.user_id = patientInfo.id.toString();
    }

    if (patientInfo.email) enrichedEvent.metadata.patient_email = patientInfo.email;
    if (patientInfo.first_name) enrichedEvent.metadata.patient_first_name = patientInfo.first_name;
    if (patientInfo.last_name) enrichedEvent.metadata.patient_last_name = patientInfo.last_name;
    if (patientInfo.phone) enrichedEvent.metadata.patient_phone = patientInfo.phone;

    if (['sign_up', 'sign_in', 'new_user', 'user_authenticated'].includes(eventData.action)) {
        const properties: Record<string, string> = {};
        if (patientInfo.id) properties.user_id = patientInfo.id.toString();
        if (patientInfo.email) properties.email = patientInfo.email;
        if (patientInfo.first_name) properties.first_name = patientInfo.first_name;
        if (patientInfo.last_name) properties.last_name = patientInfo.last_name;
        if (patientInfo.phone) properties.phone = patientInfo.phone;
        enrichedEvent.metadata.properties = { ...properties, ...eventData.metadata?.properties };
    }

    return enrichedEvent;
}

export function enrichEventWithEnrollmentAttribution(
    eventData: AnalyticsEventData,
    patientInfo: PatientInfo | null,
    urlParams?: UrlParameters | null,
): AnalyticsEventData {
    return enrichEventWithPatientData(mergeEnrollmentUrlParameters(eventData, urlParams), patientInfo);
}

/**
 * Convert text to slug format for URLs
 */
export function toSlug(text: string): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Send abandon event via beacon API (for browser close scenarios)
 */
export function sendAbandonBeacon(eventData: any, analyticsManager: AnalyticsManager, merchantId: number, treatmentId: number): boolean {
    if (!pixelConsentAllows('analytics')) return false;
    const trackingData = analyticsManager.getTrackingData();
    const beaconData = {
        event_type: eventData.action,
        session_id: trackingData.session_id,
        user_id: analyticsManager.getUserId() || undefined,
        merchant_id: merchantId,
        treatment_id: treatmentId,
        event_data: eventData,
        timestamp: Date.now(),
        fbp: trackingData.fbp,
        fbc: trackingData.fbc,
    };

    const beaconUrl = `/api/analytics/beacon`;
    const blob = new Blob([JSON.stringify(beaconData)], { type: 'application/json' });

    if (navigator.sendBeacon) {
        return navigator.sendBeacon(beaconUrl, blob);
    }
    return false;
}

// ============================================================================
// Enrollment Analytics Manager
// ============================================================================

/**
 * Create and initialize analytics manager for enrollment
 * Returns the analytics manager and any loaded config
 */
export async function initializeEnrollmentAnalytics(
    merchantId: number,
    treatmentId: number,
): Promise<{ analyticsManager: AnalyticsManager; config: AnalyticsConfig | null }> {
    const analyticsManager = new AnalyticsManager(merchantId, treatmentId);
    const config = await analyticsManager.initialize();
    return { analyticsManager, config };
}

/**
 * Create initial analytics tracking state
 */
export function createAnalyticsTrackingState(): AnalyticsTrackingState {
    return {
        lastTrackedEvents: {},
        lastUserProperties: '',
        hasFiredSurveyComplete: false,
        hasTrackedAbandon: false,
        hasTrackedTabSwitch: false,
    };
}

/**
 * Check if an event should be tracked or if it's a duplicate
 * Deduplicates survey lifecycle events (survey_start, survey_complete, survey_abandon)
 * Allows all other events (page_view, navigation_*, field_*, etc.)
 */
export function shouldTrackEvent(
    eventAction: string,
    eventData: any,
    trackingState: AnalyticsTrackingState,
): { shouldTrack: boolean; updatedState: AnalyticsTrackingState } {
    // List of event actions that should be deduplicated
    const deduplicateActions = ['survey_start', 'survey_complete', 'survey_abandon'];

    if (!deduplicateActions.includes(eventAction)) {
        // Always track non-lifecycle events (page_view, field interactions, etc.)
        return { shouldTrack: true, updatedState: trackingState };
    }

    // Check if we already tracked this lifecycle event
    const lastEvent = trackingState.lastTrackedEvents[eventAction];
    if (!lastEvent) {
        // First time tracking this event type
        const updatedState = {
            ...trackingState,
            lastTrackedEvents: {
                ...trackingState.lastTrackedEvents,
                [eventAction]: eventData,
            },
        };
        return { shouldTrack: true, updatedState };
    }

    // Compare with last tracked event data
    const currentDataStr = JSON.stringify(eventData);
    const lastDataStr = JSON.stringify(lastEvent);

    if (currentDataStr === lastDataStr) {
        console.log(`[Analytics] Skipping duplicate ${eventAction} event`);
        return { shouldTrack: false, updatedState: trackingState };
    }

    // Data changed, update and track
    const updatedState = {
        ...trackingState,
        lastTrackedEvents: {
            ...trackingState.lastTrackedEvents,
            [eventAction]: eventData,
        },
    };
    return { shouldTrack: true, updatedState };
}

/**
 * Build base metadata from an analytics target (works for both Treatment and EmrTreatmentPlan)
 */
function buildTargetMetadata(target: AnalyticsTarget): Record<string, any> {
    return {
        treatment_id: target.id,
        treatment_name: target.name,
    };
}

/**
 * Build abandon event data based on current context
 * Note: Patient data should be enriched separately using enrichEventWithPatientData
 */
export function buildAbandonEventData(
    context: AbandonEventContext,
    target: AnalyticsTarget,
    sortedForms: EnrollmentForm[],
    abandonReason: 'browser_close' | 'tab_hidden' = 'browser_close',
): AnalyticsEventData {
    const { currentStep, isCheckout, form } = context;

    if (isCheckout) {
        return {
            category: 'checkout',
            action: 'checkout_abandon',
            label: 'Checkout',
            page_url: `/checkout`,
            metadata: {
                ...buildTargetMetadata(target),
                abandon_stage: 'checkout',
                abandon_reason: abandonReason,
            },
        };
    }

    // Form abandonment
    const currentForm = form || sortedForms[currentStep];
    return {
        category: 'survey',
        action: 'survey_abandon',
        label: currentForm?.name || 'Unknown Form',
        page_url: `/survey/${toSlug(currentForm?.name || '')}`,
        metadata: {
            ...buildTargetMetadata(target),
            form_id: currentForm?.id,
            form_name: currentForm?.name,
            enrollment_step: currentStep + 1,
            total_enrollment_steps: sortedForms.length,
            abandon_stage: 'survey',
            abandon_reason: abandonReason,
        },
    };
}

/**
 * Build tab switch event data
 */
export function buildTabSwitchEventData(
    context: AbandonEventContext,
    target: AnalyticsTarget,
    sortedForms: EnrollmentForm[],
    eventType: 'tab_switch' | 'survey_resume' | 'checkout_resume',
): AnalyticsEventData {
    const { currentStep, isCheckout, form } = context;

    if (isCheckout) {
        const action = eventType === 'tab_switch' ? 'tab_switch' : 'checkout_resume';
        return {
            category: 'checkout',
            action,
            label: 'Checkout',
            page_url: `/checkout`,
            metadata: {
                ...buildTargetMetadata(target),
                switch_stage: 'checkout',
                switch_reason: eventType === 'tab_switch' ? 'tab_hidden' : 'tab_visible',
            },
        };
    }

    const currentForm = form || sortedForms[currentStep];
    const action = eventType === 'tab_switch' ? 'tab_switch' : 'survey_resume';
    return {
        category: 'survey',
        action,
        label: currentForm?.name || 'Unknown Form',
        page_url: `/survey/${toSlug(currentForm?.name || '')}`,
        metadata: {
            ...buildTargetMetadata(target),
            form_id: currentForm?.id,
            form_name: currentForm?.name,
            enrollment_step: currentStep + 1,
            total_enrollment_steps: sortedForms.length,
            switch_stage: 'survey',
            switch_reason: eventType === 'tab_switch' ? 'tab_hidden' : 'tab_visible',
        },
    };
}

/**
 * Build survey complete event data (fired when all forms are completed)
 */
export function buildSurveyCompleteEventData(target: AnalyticsTarget, merchant: { id: number }, sortedForms: EnrollmentForm[]): AnalyticsEventData {
    return {
        category: 'survey',
        action: 'survey_complete',
        label: 'All Intake Forms',
        page_url: '/checkout',
        metadata: {
            ...buildTargetMetadata(target),
            total_forms: sortedForms.length,
            merchant_id: merchant.id,
            completion_stage: 'all_intakes_completed',
        },
    };
}

/**
 * Send abandon beacon with enriched patient data
 */
export function sendEnrichedAbandonBeacon(
    eventData: AnalyticsEventData,
    patientInfo: PatientInfo | null,
    analyticsManager: AnalyticsManager,
    merchantId: number,
    treatmentId: number,
    urlParams?: UrlParameters | null,
): boolean {
    const enrichedEventData = enrichEventWithEnrollmentAttribution(eventData, patientInfo, urlParams);
    return sendAbandonBeacon(enrichedEventData, analyticsManager, merchantId, treatmentId);
}

/**
 * Track checkout view event
 */
export function trackCheckoutView(analyticsManager: AnalyticsManager, treatmentId: number, total: number, currency: string): void {
    analyticsManager.trackCheckoutView(treatmentId, total, currency);
}

/**
 * Track payment authorized event
 */
export function trackPaymentAuthorized(
    analyticsManager: AnalyticsManager,
    treatmentId: number,
    total: number,
    currency: string,
    paymentMethod: string,
): void {
    analyticsManager.trackPaymentAuthorized(treatmentId, total, currency, paymentMethod);
}

/**
 * Track user authenticated event
 */
export function trackUserAuthenticated(analyticsManager: AnalyticsManager, treatmentId: number, userId?: string): void {
    analyticsManager.trackUserAuthenticated(treatmentId, userId);
}

/**
 * Track form page view for navigation between forms
 */
export function trackFormPageView(
    analyticsManager: AnalyticsManager,
    treatmentId: number,
    stepIndex: number,
    totalSteps: number,
    formName: string,
): void {
    analyticsManager.trackFormPageView(treatmentId, stepIndex, totalSteps, formName);
}

/**
 * Create SurveyForm analytics prop object
 * This provides the analytics interface expected by the SurveyForm component
 */
export function createSurveyFormAnalyticsProp(
    analyticsManager: AnalyticsManager | null,
    target: AnalyticsTarget,
    merchant: { id: number },
    form: EnrollmentForm,
    patientInfo: PatientInfo | null | (() => PatientInfo | null),
    trackingState: AnalyticsTrackingState,
    onTrackingStateUpdate: (newState: AnalyticsTrackingState) => void,
): SurveyFormAnalyticsProp {
    const targetMeta = buildTargetMetadata(target);
    const getPatientInfo = (): PatientInfo | null => {
        return typeof patientInfo === 'function' ? patientInfo() : patientInfo;
    };

    return {
        enabled: true,
        sessionId: analyticsManager?.getSessionId() || '',
        userId: analyticsManager?.getUserId() || undefined,
        eventMappings: analyticsManager?.getEventMappings(),

        trackEvent: (event: any) => {
            if (!analyticsManager) {
                console.warn('[Analytics] trackEvent called but analyticsManager not initialized yet');
                return;
            }

            const eventAction = event.action || 'survey_event';

            // Skip survey_complete events from individual forms
            // We fire a single survey_complete event when ALL forms are done
            if (eventAction === 'survey_complete') {
                console.log('[Analytics] Skipping individual form survey_complete, will fire once when all forms done');
                return;
            }

            const eventData: AnalyticsEventData = {
                category: 'survey',
                action: eventAction,
                label: eventAction === 'survey_start' ? form.name : event.label || form.name,
                value: event.value,
                page_url: typeof window === 'undefined' ? undefined : window.location.href,
                metadata: {
                    ...targetMeta,
                    form_id: form.id,
                    form_name: form.name,
                    ...event,
                    ...event.metadata,
                },
            };

            // Enrich with patient data
            const currentPatientInfo = getPatientInfo();
            const enrichedEventData = enrichEventWithPatientData(eventData, currentPatientInfo);

            // Check if we should track this event (deduplication)
            const { shouldTrack, updatedState } = shouldTrackEvent(eventAction, enrichedEventData, trackingState);
            if (shouldTrack) {
                analyticsManager.trackEvent(enrichedEventData);
                onTrackingStateUpdate(updatedState);
            } else {
                console.log('[Analytics] Skipped duplicate event:', eventAction);
            }
        },

        trackPageView: (url: string, title?: string, additionalData?: Record<string, any>) => {
            if (!analyticsManager) return;

            const pageViewData: Record<string, any> = {
                ...targetMeta,
                form_id: form.id,
                form_name: form.name,
                ...additionalData,
            };

            // Add patient data if available
            const currentPatientInfo = getPatientInfo();
            if (currentPatientInfo?.id) pageViewData.patient_id = currentPatientInfo.id;
            if (currentPatientInfo?.email) pageViewData.patient_email = currentPatientInfo.email;
            if (currentPatientInfo?.first_name) pageViewData.patient_first_name = currentPatientInfo.first_name;
            if (currentPatientInfo?.last_name) pageViewData.patient_last_name = currentPatientInfo.last_name;
            if (currentPatientInfo?.phone) pageViewData.patient_phone = currentPatientInfo.phone;

            analyticsManager.trackPageView(url, title, pageViewData);
        },

        trackTiming: (category: string, variable: string, value: number, label?: string) => {
            if (!analyticsManager) return;

            const timingEvent: AnalyticsEventData = {
                category: category,
                action: 'timing',
                label: label || variable,
                value: value,
                metadata: {
                    variable,
                    timing_ms: value,
                    ...targetMeta,
                    form_id: form.id,
                    form_name: form.name,
                },
            };

            // Enrich with patient data
            const currentPatientInfo = getPatientInfo();
            const enrichedTimingEvent = enrichEventWithPatientData(timingEvent, currentPatientInfo);
            analyticsManager.trackEvent(enrichedTimingEvent);
        },

        setUserProperties: (properties: Record<string, any>) => {
            if (!analyticsManager) return;

            const fullProperties: Record<string, any> = {
                ...targetMeta,
                merchant_id: merchant.id,
                ...properties,
            };

            // Add patient data to user properties
            const currentPatientInfo = getPatientInfo();
            if (currentPatientInfo?.id) fullProperties.patient_id = currentPatientInfo.id;
            if (currentPatientInfo?.email) fullProperties.patient_email = currentPatientInfo.email;
            if (currentPatientInfo?.first_name) fullProperties.patient_first_name = currentPatientInfo.first_name;
            if (currentPatientInfo?.last_name) fullProperties.patient_last_name = currentPatientInfo.last_name;
            if (currentPatientInfo?.phone) fullProperties.patient_phone = currentPatientInfo.phone;

            const enrichedProperties = enrichEventWithPatientData(fullProperties, currentPatientInfo);
            const propertiesStr = JSON.stringify(enrichedProperties);

            if (propertiesStr === trackingState.lastUserProperties) {
                console.log('[Analytics] Skipping duplicate user properties update');
                return;
            }

            // Update tracking state
            const newState = { ...trackingState, lastUserProperties: propertiesStr };
            onTrackingStateUpdate(newState);

            analyticsManager.setUserProperties(fullProperties);
        },
    };
}

/**
 * Handle patient authentication analytics update
 * Called when patient authenticates to update analytics user ID
 */
export function handlePatientAuthAnalytics(analyticsManager: AnalyticsManager, patientId: number, existingUserId: string | null): void {
    const newUserId = patientId.toString();

    if (existingUserId && existingUserId !== newUserId) {
        // Different patient authenticated - clear session and start fresh
        console.log('[Analytics] Different patient authenticated, clearing session');
        analyticsManager.clearSession();
    }

    // Set the user ID (will persist in cookie)
    analyticsManager.setUserId(newUserId);
}

/**
 * E-commerce event types that have standard formatting
 */
export type EcommerceEventType =
    | 'user_landed'
    | 'survey_start'
    | 'checkout_view'
    | 'checkout_started'
    | 'checkout_completed'
    | 'order_placed'
    | 'first_time_order'
    | 'payment_authorized'
    | 'payment_failed'
    | 'enrollment_complete'
    | 'emr_enrollment_created'
    | 'user_authenticated'
    | 'sign_in'
    | 'sign_up'
    | 'new_user'
    | 'email_submitted'
    | 'patient_field_updated'
    | 'field_complete'
    | 'bmi_set'
    | 'address_added'
    | 'address_selected'
    | 'emr_variant_selected'
    | 'emr_drug_selected'
    | 'emr_drug_phase_selected'
    | 'coupon_applied'
    | 'coupon_removed'
    | 'variation_selected'
    | 'pricing_option_selected';

/**
 * Create a standardized analytics event for e-commerce and custom events
 * Handles known e-commerce events with standard formatting, falls back to generic event for others
 */
export function createAnalyticsEvent(
    eventType: EcommerceEventType | string,
    target: AnalyticsTarget,
    data?: Record<string, any>,
): AnalyticsEventData {
    const baseMetadata = {
        ...buildTargetMetadata(target),
        ...data,
    };

    switch (eventType) {
        // Survey lifecycle
        case 'user_landed':
            return {
                category: 'survey',
                action: 'user_landed',
                label: 'User Landed',
                page_url: '/enroll',
                metadata: {
                    ...baseMetadata,
                    form_count: data?.form_count,
                },
            };

        case 'survey_start':
            return {
                category: 'survey',
                action: 'survey_start',
                label: 'Survey Started',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    form_count: data?.form_count,
                },
            };

        // Checkout events
        case 'checkout_view':
            return {
                category: 'checkout',
                action: 'checkout_view',
                label: 'Checkout Viewed',
                page_url: '/checkout',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                },
            };

        case 'checkout_started':
            return {
                category: 'checkout',
                action: 'checkout_started',
                label: 'Checkout Started',
                page_url: '/checkout',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                },
            };

        case 'checkout_completed':
            return {
                category: 'checkout',
                action: 'checkout_completed',
                label: 'Checkout Completed',
                page_url: '/checkout/complete',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                    order_id: data?.order_id,
                    enrollment_id: data?.enrollment_id,
                    enrollment_uuid: data?.enrollment_uuid,
                    enrollment_status: data?.enrollment_status,
                },
            };

        case 'order_placed':
        case 'first_time_order':
            return {
                category: 'ecommerce',
                action: eventType,
                label: eventType === 'first_time_order' ? 'First Time Order' : 'Order Placed',
                page_url: '/checkout/complete',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                    order_id: data?.order_id,
                    enrollment_id: data?.enrollment_id,
                    enrollment_uuid: data?.enrollment_uuid,
                    enrollment_status: data?.enrollment_status,
                    payment_method: data?.payment_method,
                },
            };

        case 'payment_authorized':
            return {
                category: 'checkout',
                action: 'payment_authorized',
                label: 'Payment Authorized',
                page_url: '/checkout',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                    payment_method: data?.payment_method,
                },
            };

        case 'payment_failed':
            return {
                category: 'checkout',
                action: 'payment_failed',
                label: 'Payment Failed',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    error: data?.error,
                    error_code: data?.error_code,
                },
            };

        case 'enrollment_complete':
            return {
                category: 'ecommerce',
                action: 'enrollment_complete',
                label: 'Enrollment Complete',
                page_url: '/checkout/complete',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                    enrollment_id: data?.enrollment_id,
                    order_id: data?.order_id ?? data?.enrollment_id,
                    enrollment_uuid: data?.enrollment_uuid,
                    enrollment_status: data?.enrollment_status,
                    patient_id: data?.patient_id,
                    payment_method: data?.payment_method,
                },
            };

        case 'emr_enrollment_created':
            return {
                category: 'ecommerce',
                action: 'emr_enrollment_created',
                label: 'EMR Enrollment Created',
                page_url: '/checkout/complete',
                value: data?.total,
                metadata: {
                    ...baseMetadata,
                    currency: data?.currency || target.currency || 'USD',
                    total: data?.total,
                    enrollment_id: data?.enrollment_id,
                    order_id: data?.order_id ?? data?.enrollment_id,
                    enrollment_uuid: data?.enrollment_uuid,
                    enrollment_status: data?.enrollment_status,
                    patient_id: data?.patient_id,
                    variant_id: data?.variant_id,
                    payment_method: data?.payment_method,
                },
            };

        // User authentication events
        case 'user_authenticated':
            return {
                category: 'user',
                action: 'user_authenticated',
                label: 'User Authenticated',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    patient_id: data?.patient_id,
                    method: data?.method,
                    profile_complete: data?.profile_complete,
                },
            };

        case 'sign_in':
            return {
                category: 'user',
                action: 'sign_in',
                label: 'User Sign In',
                page_url: '/auth/signin',
                metadata: {
                    ...baseMetadata,
                    method: data?.method || 'otp',
                },
            };

        case 'sign_up':
            return {
                category: 'user',
                action: 'sign_up',
                label: 'User Sign Up',
                page_url: '/auth/signup',
                metadata: {
                    ...baseMetadata,
                    method: data?.method || 'otp',
                },
            };

        case 'new_user':
            return {
                category: 'user',
                action: 'new_user',
                label: 'New User',
                page_url: '/auth/signup',
                metadata: {
                    ...baseMetadata,
                    method: data?.method || 'otp',
                },
            };

        case 'email_submitted':
            return {
                category: 'user',
                action: 'email_submitted',
                label: 'Email Submitted',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    email: data?.email,
                    field: 'email',
                    value_present: Boolean(data?.email),
                    properties: data?.properties,
                },
            };

        case 'patient_field_updated':
            return {
                category: 'profile',
                action: 'patient_field_updated',
                label: data?.field ? `Patient Field Updated: ${data.field}` : 'Patient Field Updated',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    field: data?.field,
                    value_present: data?.value_present,
                    properties: data?.properties,
                },
            };

        // Profile field events
        case 'field_complete':
            return {
                category: 'profile',
                action: 'field_complete',
                label: data?.field ? `Field Complete: ${data.field}` : 'Field Complete',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    field: data?.field,
                    value_present: data?.value_present,
                },
            };

        // Health/profile events
        case 'bmi_set':
            return {
                category: 'profile',
                action: 'bmi_set',
                label: 'BMI Set',
                page_url: '/survey',
                value: data?.bmi,
                metadata: {
                    ...baseMetadata,
                    bmi: data?.bmi,
                    height: data?.height,
                    weight: data?.weight,
                },
            };

        // Address events
        case 'address_added':
            return {
                category: 'checkout',
                action: 'address_added',
                label: 'Address Added',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    state: data?.state,
                    country: data?.country,
                },
            };

        case 'address_selected':
            return {
                category: 'checkout',
                action: 'address_selected',
                label: 'Address Selected',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    address_id: data?.address_id,
                    is_existing: data?.is_existing,
                },
            };

        // Coupon events
        case 'coupon_applied':
            return {
                category: 'checkout',
                action: 'coupon_applied',
                label: 'Coupon Applied',
                page_url: '/checkout',
                value: data?.discount,
                metadata: {
                    ...baseMetadata,
                    coupon_code: data?.coupon_code,
                    discount: data?.discount,
                    discount_type: data?.discount_type,
                },
            };

        case 'coupon_removed':
            return {
                category: 'checkout',
                action: 'coupon_removed',
                label: 'Coupon Removed',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    coupon_code: data?.coupon_code,
                },
            };

        // Selection events
        case 'variation_selected':
            return {
                category: 'checkout',
                action: 'variation_selected',
                label: 'Variation Selected',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    variation_id: data?.variation_id,
                    variation_name: data?.variation_name,
                },
            };

        case 'pricing_option_selected':
            return {
                category: 'checkout',
                action: 'pricing_option_selected',
                label: 'Pricing Option Selected',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    pricing_option_id: data?.pricing_option_id,
                    pricing_option_label: data?.pricing_option_label,
                },
            };

        // EMR-specific events
        case 'emr_variant_selected':
            return {
                category: 'checkout',
                action: 'emr_variant_selected',
                label: data?.variant_name || 'Variant Selected',
                page_url: '/checkout',
                metadata: {
                    ...baseMetadata,
                    variant_id: data?.variant_id,
                    variant_name: data?.variant_name,
                    variant_price: data?.variant_price,
                },
            };

        case 'emr_drug_selected':
            return {
                category: 'checkout',
                action: 'emr_drug_selected',
                label: data?.drug_name || 'Drug Selected',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    drug_id: data?.drug_id,
                    drug_name: data?.drug_name,
                    is_selected: data?.is_selected,
                    drug_type: data?.drug_type,
                },
            };

        case 'emr_drug_phase_selected':
            return {
                category: 'checkout',
                action: 'emr_drug_phase_selected',
                label: data?.drug_name || 'Phase Selected',
                page_url: '/survey',
                metadata: {
                    ...baseMetadata,
                    drug_id: data?.drug_id,
                    drug_name: data?.drug_name,
                    phase_id: data?.phase_id,
                    phase_strength: data?.phase_strength,
                    phase_dosage: data?.phase_dosage,
                    phase_range: data?.phase_range,
                },
            };

        // Default: generic custom event
        default:
            return {
                category: data?.category || 'custom',
                action: eventType,
                label: data?.label || eventType,
                page_url: data?.page_url || '/survey',
                value: data?.value,
                metadata: baseMetadata,
            };
    }
}

/**
 * Track a custom analytics event via the analytics manager
 * This is a convenience function that creates and tracks an event in one call
 */
export function trackAnalyticsEvent(
    analyticsManager: AnalyticsManager,
    eventType: EcommerceEventType | string,
    target: AnalyticsTarget,
    data?: Record<string, any>,
    patientInfo?: PatientInfo | null,
    urlParams?: UrlParameters | null,
): Promise<void> {
    const eventData = createAnalyticsEvent(eventType, target, data);
    const enrichedEvent = enrichEventWithEnrollmentAttribution(eventData, patientInfo || null, urlParams);
    return analyticsManager.trackEvent(enrichedEvent);
}

// ============================================================================
// Main Utility Factory
// ============================================================================

/**
 * Create enrollment utilities object with bound functions
 */
export function createEnrollmentUtils(config: EnrollmentUtilsConfig): EnrollmentUtils | null {
    const { treatment, merchant, slug, analyticsManager, analyticsUrlParams } = config;
    if (!treatment) return null;

    const storageKey = getStorageKey(slug, treatment.id);

    // Create selection state manager for this enrollment instance
    const selectionManager = createSelectionStateManager(treatment);

    return {
        // Configuration
        treatment,
        merchant,
        slug,
        storageKey,

        // Patient data functions
        fetchPatientInfo,
        fetchPatientAddresses,
        extractPatientInfo,

        // Treatment variation functions (bound to treatment)
        getDefaultVariation: () => getDefaultVariation(treatment),
        getSelectedVariation: (variationId?: number) => getSelectedVariation(treatment, variationId),
        getVariationProducts,
        getVariationPrice,
        getTreatmentProducts: () => getTreatmentProducts(treatment),
        getVariations: () => getVariations(treatment),

        // Pricing option functions
        getCommonPricingOptions,
        getDefaultPricingOption,
        calculateTotalWithPricingOption,
        getPricingOptionLabel,
        variationHasPricingOptions,

        // Selection state management (bound to selectionManager)
        setSelectedVariationId: selectionManager.setSelectedVariationId,
        getSelectedVariationId: selectionManager.getSelectedVariationId,
        setSelectedPricingOptionId: selectionManager.setSelectedPricingOptionId,
        getSelectedPricingOptionId: selectionManager.getSelectedPricingOptionId,
        getCheckoutSelectionState: selectionManager.getCheckoutSelectionState,
        hasVariationSelected: selectionManager.hasVariationSelected,
        hasPricingOptionSelected: selectionManager.hasPricingOptionSelected,
        resetSelections: selectionManager.resetSelections,

        // Coupon functions (bound to treatment)
        getCoupons: (patientEmail: string, variationId?: number, subtotal?: number) =>
            fetchApplicableCoupons(patientEmail, treatment.id, variationId, undefined, subtotal),

        // Payment/checkout functions (bound to treatment)
        calculateTotal: (method?: 'upfront' | 'per_schedule' | null, variationId?: number, pricingOptionId?: string) =>
            calculateTotal(treatment, method, variationId, pricingOptionId),

        submitEnrollment: (formResponses: Record<number, any>, checkoutData: CheckoutData | null, paymentMethod: 'upfront' | 'per_schedule' | null) =>
            submitEnrollment(slug, formResponses, checkoutData, paymentMethod, treatment.is_recurring, analyticsManager, analyticsUrlParams),

        // Checkout validation functions
        validateCheckoutForm,
        validatePatientInfo,
        validateAddress,
        getSelectedAddress,
        createEmptyAddress,
        createEmptyPatientInfo,
        initializePatientInfo,
        isValidEmail,

        // Stripe payment functions (bound to merchantId)
        fetchPaymentMethods: (authToken: string) => fetchPaymentMethods(authToken, merchant.id),
        getDefaultPaymentMethod,
        createSetupIntent: (authToken: string, forceNew?: boolean) => createSetupIntent(authToken, merchant.id, forceNew),
        deletePaymentMethod,
        savePaymentMethod: (authToken: string, paymentMethodId: string, customerId: string, setupIntentId: string, setAsDefault: boolean = true) =>
            savePaymentMethod(authToken, merchant.id, paymentMethodId, customerId, setupIntentId, setAsDefault),
        isSetupIntentProcessing,
        isSetupIntentSucceeded,

        // State persistence functions (bound to storageKey)
        loadState: () => loadEnrollmentState(storageKey),
        saveState: (state: Partial<EnrollmentState>) => saveEnrollmentState(storageKey, state),
        clearState: () => clearEnrollmentState(storageKey),

        // Analytics helpers (bound to merchant/treatment)
        enrichEventWithPatientData,
        toSlug,
        sendAbandonBeacon: (eventData: any, manager: AnalyticsManager) => sendAbandonBeacon(eventData, manager, merchant.id, treatment.id),
    };
}

// ============================================================================
// Stripe Component Utilities
// ============================================================================

/**
 * Create Stripe payment handlers for checkout forms
 * Returns success/error handlers that can be used with StripePaymentForm
 */
export function createStripePaymentHandlers(callbacks: {
    onPaymentSuccess: (data: {
        paymentMethodId: string;
        paymentIntentId?: string;
        patientInfo: any;
        address: Address;
        useExistingAddress: boolean;
    }) => void;
    onPaymentError: (error: string) => void;
    validateForm: () => boolean;
    getFormData: () => {
        patientInfo: any;
        address: Address;
        useExistingAddress: boolean;
        existingAddresses: Address[];
        selectedAddressId?: string;
    };
}) {
    const { onPaymentSuccess, onPaymentError, validateForm, getFormData } = callbacks;

    const handleStripePaymentSuccess = (paymentMethodId: string, paymentIntentId?: string) => {
        if (validateForm()) {
            const formData = getFormData();
            const finalAddress = formData.useExistingAddress
                ? getSelectedAddress(formData.existingAddresses, formData.selectedAddressId, formData.address)
                : formData.address;

            onPaymentSuccess({
                paymentMethodId,
                paymentIntentId,
                patientInfo: formData.patientInfo,
                address: finalAddress,
                useExistingAddress: formData.useExistingAddress,
            });
        }
    };

    const handleStripePaymentError = (error: string) => {
        onPaymentError(error);
    };

    return {
        handleStripePaymentSuccess,
        handleStripePaymentError,
    };
}

/**
 * Get Stripe payment form props configured for enrollment
 * Use this to easily configure StripePaymentForm component
 */
export function getStripePaymentFormProps(config: {
    authToken: string;
    merchantId: number;
    amount: number;
    currency?: string;
    onSuccess: (paymentMethodId: string) => void;
    onError: (error: string) => void;
}) {
    return {
        authToken: config.authToken,
        merchantId: config.merchantId,
        amount: config.amount,
        currency: config.currency || 'usd',
        onSuccess: config.onSuccess,
        onError: config.onError,
    };
}

// ============================================================================
// Patient Auth Types & Utilities
// ============================================================================

/**
 * Create a custom patient auth config by merging with defaults
 */
export function createPatientAuthConfig(overrides: Partial<PatientAuthConfig>): PatientAuthConfig {
    return {
        ...DEFAULT_PATIENT_AUTH_CONFIG,
        ...overrides,
    };
}

// ============================================================================
// Patient Storage Key Functions
// ============================================================================

/**
 * Generate a unique storage key for patient auth data
 * @param identifier - Optional identifier (e.g., merchant ID, form ID) to make key unique
 */
export function getPatientAuthStorageKey(identifier?: string): string {
    return identifier ? `${PATIENT_AUTH_STORAGE_PREFIX}${identifier}` : `${PATIENT_AUTH_STORAGE_PREFIX}default`;
}

/**
 * Get stored patient auth data from localStorage
 */
export function getStoredPatientAuth(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): PatientAuthStorageData | null {
    if (!isBrowserStorageAvailable()) return null;

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored);
    } catch (error) {
        console.error('Error reading patient auth from storage:', error);
    }
    return null;
}

/**
 * Save patient auth data to localStorage
 */
export function savePatientAuth(token: string, patient: PatientAuthData, storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): void {
    if (!isBrowserStorageAvailable()) return;

    try {
        const data: PatientAuthStorageData = {
            token,
            patient,
            authenticatedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving patient auth to storage:', error);
    }
}

/**
 * Clear patient auth data from localStorage
 */
export function clearPatientAuth(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): void {
    if (!isBrowserStorageAvailable()) return;
    localStorage.removeItem(storageKey);
}

/**
 * Get the auth token from stored patient data
 */
export function getPatientAuthToken(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): string | null {
    const stored = getStoredPatientAuth(storageKey);
    return stored?.token || null;
}

/**
 * Get the patient data from storage
 */
export function getStoredPatient(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): PatientAuthData | null {
    const stored = getStoredPatientAuth(storageKey);
    return stored?.patient || null;
}

// ============================================================================
// Pending Updates Management Functions
// ============================================================================

/**
 * Get pending updates from storage
 */
export function getPendingUpdates(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): PendingUpdatesData | null {
    if (!isBrowserStorageAvailable()) return null;

    try {
        const pendingKey = getPendingUpdatesStorageKey(storageKey);
        const stored = localStorage.getItem(pendingKey);
        if (stored) return JSON.parse(stored);
    } catch (error) {
        console.error('Error reading pending updates from storage:', error);
    }
    return null;
}

/**
 * Save pending update
 */
export function savePendingUpdate(fieldName: string, value: any, storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): void {
    if (!isBrowserStorageAvailable()) return;

    try {
        const pendingKey = getPendingUpdatesStorageKey(storageKey);

        // Get existing pending updates or create new
        let pendingData = getPendingUpdates(storageKey);
        if (!pendingData) {
            pendingData = {
                referencePatient: {},
                updates: [],
            };
        }

        // Update reference patient with new value
        if (fieldName === 'dateOfBirth') {
            pendingData.referencePatient.dateOfBirth = value;
        } else if (fieldName === 'gender') {
            pendingData.referencePatient.gender = value;
            pendingData.referencePatient.genderBiological = value;
        } else if (fieldName === 'genderBiological') {
            pendingData.referencePatient.genderBiological = value;
        } else if (fieldName === 'height') {
            pendingData.referencePatient.height = value;
        } else if (fieldName === 'weight') {
            pendingData.referencePatient.weight = value;
        } else if (fieldName === 'firstName') {
            pendingData.referencePatient.firstName = value;
        } else if (fieldName === 'lastName') {
            pendingData.referencePatient.lastName = value;
        } else if (fieldName === 'middleName') {
            pendingData.referencePatient.middleName = value;
        } else if (fieldName === 'email') {
            pendingData.referencePatient.email = value;
        } else if (fieldName === 'phone') {
            pendingData.referencePatient.phone = value;
        }

        // Add to updates queue (avoid duplicates for same field)
        const existingUpdateIndex = pendingData.updates.findIndex((u) => u.fieldName === fieldName);
        const update: PendingPatientUpdate = {
            fieldName,
            value,
            timestamp: new Date().toISOString(),
        };

        if (existingUpdateIndex >= 0) {
            pendingData.updates[existingUpdateIndex] = update;
        } else {
            pendingData.updates.push(update);
        }

        localStorage.setItem(pendingKey, JSON.stringify(pendingData));
    } catch (error) {
        console.error('Error saving pending update to storage:', error);
    }
}

/**
 * Clear pending updates from storage
 */
export function clearPendingUpdates(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): void {
    if (!isBrowserStorageAvailable()) return;
    const pendingKey = getPendingUpdatesStorageKey(storageKey);
    localStorage.removeItem(pendingKey);
}

/**
 * Get reference patient (local accumulated patient data before token exists)
 */
export function getReferencePatient(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): PatientAuthData | null {
    const pendingData = getPendingUpdates(storageKey);
    return pendingData?.referencePatient || null;
}

// ============================================================================
// Patient Validation Functions
// ============================================================================

/**
 * Format phone number to (XXX) XXX-XXXX format
 */
export function formatPhoneNumber(value: string): string {
    const digits = value.replace(/\D/g, '');
    const limitedDigits = digits.slice(0, 10);

    if (limitedDigits.length <= 3) {
        return limitedDigits;
    } else if (limitedDigits.length <= 6) {
        return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    } else {
        return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
    }
}

/**
 * Get raw phone digits from formatted phone number
 */
export function getRawPhoneDigits(formattedPhone: string): string {
    return formattedPhone.replace(/\D/g, '');
}

/**
 * Validate email format
 */
export function isValidPatientEmail(email: string): boolean {
    return email.includes('@') && email.length > 3;
}

/**
 * Validate phone number (must be 10 digits)
 */
export function isValidPatientPhone(phone: string): boolean {
    return getRawPhoneDigits(phone).length === 10;
}

/**
 * Validate OTP (must be at least 4 digits)
 */
export function isValidOtp(otp: string): boolean {
    return otp.length >= 4;
}

/**
 * Get missing required fields for patient profile
 */
export function getPatientMissingFields(patient: PatientAuthData, config: PatientAuthConfig): string[] {
    const missing: string[] = [];

    if (config.requireFirstName && !patient.firstName) missing.push('firstName');
    if (config.requireLastName && !patient.lastName) missing.push('lastName');
    if (config.requireMiddleName && !patient.middleName) missing.push('middleName');
    if (config.requireGender && !patient.gender) missing.push('gender');
    if (config.requireGenderBiological && !patient.genderBiological) missing.push('genderBiological');
    if (config.requireDateOfBirth && !patient.dateOfBirth) missing.push('dateOfBirth');
    if (config.requireHeight && !patient.height) missing.push('height');
    if (config.requireWeight && !patient.weight) missing.push('weight');

    // Check for alternate contact field
    if (config.collectAlternateContact && config.alternateContactRequired) {
        if (config.authField === 'email' && !patient.phone) {
            missing.push('phone');
        } else if (config.authField === 'phone' && !patient.email) {
            missing.push('email');
        }
    }

    return missing;
}

/**
 * Validate patient auth form data
 */
export function validatePatientAuthForm(
    formData: Partial<PatientAuthFormData>,
    config: PatientAuthConfig,
    step: 'auth' | 'verify' | 'collect',
): { isValid: boolean; errors: PatientAuthValidationErrors } {
    const errors: PatientAuthValidationErrors = {};

    if (step === 'auth') {
        if (config.authField === 'email') {
            if (!formData.email) {
                errors.email = 'Email is required';
            } else if (!isValidPatientEmail(formData.email)) {
                errors.email = 'Please enter a valid email address';
            }
        } else {
            if (!formData.phone) {
                errors.phone = 'Phone number is required';
            } else if (!isValidPatientPhone(formData.phone)) {
                errors.phone = 'Please enter a valid 10-digit phone number';
            }
        }
    }

    if (step === 'verify') {
        if (config.authMethod === 'otp') {
            if (!formData.otp) {
                errors.otp = 'Verification code is required';
            } else if (!isValidOtp(formData.otp)) {
                errors.otp = 'Please enter a valid verification code';
            }
        } else {
            if (!formData.password) {
                errors.password = 'Password is required';
            }
        }
    }

    if (step === 'collect') {
        if (config.requireFirstName && !formData.firstName?.trim()) errors.firstName = 'First name is required';
        if (config.requireLastName && !formData.lastName?.trim()) errors.lastName = 'Last name is required';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Create empty patient auth form data
 */
export function createEmptyPatientAuthFormData(): PatientAuthFormData {
    return {
        email: '',
        phone: '',
        password: '',
        otp: '',
        firstName: '',
        middleName: '',
        lastName: '',
        gender: '',
        genderBiological: '',
        dateOfBirth: '',
        height: '',
        weight: '',
    };
}

// ============================================================================
// Patient Auth API Functions
// ============================================================================

/**
 * Build request headers for patient auth API calls
 */
function buildPatientAuthHeaders(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): Record<string, string> {
    const headers: Record<string, string> = buildJsonHeaders();

    const token = getPatientAuthToken(storageKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return headers;
}

/**
 * Send OTP to patient email or phone
 */
export async function sendPatientOtp(
    formData: Pick<PatientAuthFormData, 'email' | 'phone'>,
    config: PatientAuthConfig,
    storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY,
): Promise<PatientAuthResult> {
    try {
        const body = config.authField === 'email' ? { email: formData.email } : { phone: getRawPhoneDigits(formData.phone) };

        const headers = buildPatientAuthHeaders(storageKey);

        const response = await enrollmentFetch(PATIENT_AUTH_ENDPOINTS.sendOtp, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await safeJson<any>(response);

        if (response.ok) {
            // Check if first-time user (token returned directly)
            if (data.isFirstTimeUser && data.token) {
                // Save to storage
                savePatientAuth(data.token, data.patient || {}, storageKey);

                // Auto-flush any pending updates now that we have a token
                const flushResult = await flushPendingUpdates(config, storageKey);
                if (flushResult.success && flushResult.patient) {
                    data.patient = flushResult.patient;
                }

                const missingFields = getPatientMissingFields(data.patient || {}, config);

                return {
                    success: true,
                    patient: data.patient,
                    token: data.token,
                    isFirstTimeUser: true,
                    missingFields,
                };
            }

            // Returning user - OTP sent
            return { success: true, isFirstTimeUser: false };
        }

        return { success: false, error: data.error || 'Failed to send verification code' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send verification code' };
    }
}

/**
 * Validate patient auth (OTP or password)
 */
export async function validatePatientAuth(
    formData: Pick<PatientAuthFormData, 'email' | 'phone' | 'otp' | 'password'>,
    config: PatientAuthConfig,
    storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY,
): Promise<PatientAuthResult> {
    try {
        const body: Record<string, any> = config.authField === 'email' ? { email: formData.email } : { phone: getRawPhoneDigits(formData.phone) };

        if (config.authMethod === 'otp') body.otp = formData.otp;
        else body.password = formData.password;

        const headers = buildPatientAuthHeaders(storageKey);

        const response = await enrollmentFetch(PATIENT_AUTH_ENDPOINTS.validateAuth, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await safeJson<any>(response);

        if (response.ok) {
            let patient = data.patient || data;
            const token = data.token;

            // Save to storage if token present
            if (token) {
                savePatientAuth(token, patient, storageKey);

                // Auto-flush any pending updates now that we have a token
                const flushResult = await flushPendingUpdates(config, storageKey);
                if (!flushResult.success) {
                    return { success: false, token, patient, error: `OTP verified, but patient details could not be saved. ${flushResult.error || 'Check the patient API response.'}` };
                }
                if (flushResult.success && flushResult.patient) {
                    patient = flushResult.patient;
                }
            }

            const missingFields = getPatientMissingFields(patient, config);

            return { success: true, patient, token, missingFields };
        }

        return { success: false, error: data.error || 'Authentication failed' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Authentication failed' };
    }
}

/**
 * Validate existing token
 */
export async function validatePatientToken(
    config: PatientAuthConfig,
    storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY,
): Promise<PatientAuthResult> {
    try {
        const stored = getStoredPatientAuth(storageKey);
        if (!stored?.token) return { success: false, error: 'No token found' };

        const headers = buildPatientAuthHeaders(storageKey);

        const response = await enrollmentFetch(PATIENT_AUTH_ENDPOINTS.validateToken, {
            method: 'POST',
            headers,
            body: JSON.stringify({ token: stored.token }),
        });

        if (response.ok) {
            const data = await safeJson<any>(response);
            let patient = data.patient || data;

            // Check if the current user's email matches the token's patient
            const referencePatient = getReferencePatient(storageKey);
            if (referencePatient?.email && patient.email && referencePatient.email !== patient.email) {
                // Different patient - clear stale token but keep pending updates
                clearPatientAuth(storageKey);
                return { success: false, error: 'Patient mismatch', patient };
            }

            // Identity confirmed - flush pending updates
            const flushResult = await flushPendingUpdates(config, storageKey);
            if (!flushResult.success) {
                return { success: false, token: stored.token, patient, error: `Patient session is valid, but pending patient details could not be saved. ${flushResult.error || 'Check the patient API response.'}` };
            }
            if (flushResult.success && flushResult.patient) {
                patient = flushResult.patient;
            }

            const missingFields = getPatientMissingFields(patient, config);

            return {
                success: true,
                patient,
                token: stored.token,
                missingFields,
            };
        }

        // Token invalid, clear storage
        clearPatientAuth(storageKey);
        return { success: false, error: 'Token expired or invalid' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Token validation failed' };
    }
}

/**
 * Update patient profile
 * If no token exists, queues updates locally and returns success
 * If token exists, makes API call to update profile
 */
export async function updatePatientProfile(
    formData: Partial<PatientAuthFormData>,
    missingFields: string[],
    config: PatientAuthConfig,
    storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY,
    _skipAutoFlush: boolean = false, // Internal flag to prevent recursion
): Promise<PatientAuthResult> {
    try {
        const stored = getStoredPatientAuth(storageKey);
        const token = stored?.token;

        // If no token exists, queue updates locally
        if (!token) {
            for (const fieldName of missingFields) {
                if (fieldName === 'firstName' && formData.firstName) {
                    savePendingUpdate('firstName', formData.firstName, storageKey);
                } else if (fieldName === 'lastName' && formData.lastName) {
                    savePendingUpdate('lastName', formData.lastName, storageKey);
                } else if (fieldName === 'middleName' && formData.middleName) {
                    savePendingUpdate('middleName', formData.middleName, storageKey);
                } else if (fieldName === 'gender' && formData.gender) {
                    savePendingUpdate('gender', formData.gender, storageKey);
                } else if (fieldName === 'genderBiological' && formData.genderBiological) {
                    savePendingUpdate('genderBiological', formData.genderBiological, storageKey);
                } else if (fieldName === 'dateOfBirth' && formData.dateOfBirth) {
                    savePendingUpdate('dateOfBirth', formData.dateOfBirth, storageKey);
                } else if (fieldName === 'height' && formData.height) {
                    savePendingUpdate('height', parseInt(formData.height), storageKey);
                } else if (fieldName === 'weight' && formData.weight) {
                    savePendingUpdate('weight', parseInt(formData.weight), storageKey);
                } else if (fieldName === 'email' && formData.email) {
                    savePendingUpdate('email', formData.email, storageKey);
                } else if (fieldName === 'phone' && formData.phone) {
                    savePendingUpdate('phone', getRawPhoneDigits(formData.phone), storageKey);
                }
            }

            const referencePatient = getReferencePatient(storageKey);
            return {
                success: true,
                patient: referencePatient || {},
                token: undefined,
                missingFields: [],
            };
        }

        // Token exists - first check if there are other pending updates to flush
        if (!_skipAutoFlush) {
            const pendingData = getPendingUpdates(storageKey);
            if (pendingData && pendingData.updates.length > 0) {
                const needsFlush = pendingData.updates.some((update) => !missingFields.includes(update.fieldName));
                if (needsFlush) {
                    const flushResult = await flushPendingUpdates(config, storageKey);
                    if (!flushResult.success) {
                        console.warn('Failed to flush pending updates:', flushResult.error);
                    }
                }
            }
        }

        // Token exists - make API call
        const body: Record<string, any> = {};

        // Add auth field
        if (config.authField === 'email' && formData.email) {
            body.email = formData.email;
        } else if (config.authField === 'phone' && formData.phone) {
            body.phone = getRawPhoneDigits(formData.phone);
        }

        // Add missing fields
        if (missingFields.includes('firstName') && formData.firstName) body.firstName = formData.firstName;
        if (missingFields.includes('lastName') && formData.lastName) body.lastName = formData.lastName;
        if (missingFields.includes('middleName') && formData.middleName) body.middleName = formData.middleName;
        if (missingFields.includes('gender') && formData.gender) body.gender = formData.gender;
        if (missingFields.includes('genderBiological') && formData.genderBiological) body.genderBiological = formData.genderBiological;
        if (missingFields.includes('dateOfBirth') && formData.dateOfBirth) body.dateOfBirth = formData.dateOfBirth;
        if (missingFields.includes('height') && formData.height) body.height = parseInt(formData.height);
        if (missingFields.includes('weight') && formData.weight) body.weight = parseInt(formData.weight);

        // Add alternate contact
        if (missingFields.includes('email') && formData.email) body.email = formData.email;
        if (missingFields.includes('phone') && formData.phone) body.phone = getRawPhoneDigits(formData.phone);

        const headers = buildPatientAuthHeaders(storageKey);

        const response = await enrollmentFetch(PATIENT_AUTH_ENDPOINTS.updateProfile, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await safeJson<any>(response);

        if (response.ok) {
            const patient = data.patient || data;

            // Update storage with new patient data
            savePatientAuth(token, patient, storageKey);

            return { success: true, patient, token };
        }

        return { success: false, error: data.error || 'Failed to update profile' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to update profile' };
    }
}

/**
 * Flush all pending updates to the server once a token becomes available
 * This should be called after successful authentication
 */
export async function flushPendingUpdates(
    config: PatientAuthConfig,
    storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY,
): Promise<PatientAuthResult> {
    try {
        const pendingData = getPendingUpdates(storageKey);
        if (!pendingData || pendingData.updates.length === 0) {
            return { success: true };
        }

        const token = getPatientAuthToken(storageKey);
        if (!token) {
            return { success: false, error: 'No token available to flush updates' };
        }

        const formData: Partial<PatientAuthFormData> = {};
        const missingFields: string[] = [];

        for (const update of pendingData.updates) {
            missingFields.push(update.fieldName);

            if (update.fieldName === 'firstName') formData.firstName = update.value;
            else if (update.fieldName === 'lastName') formData.lastName = update.value;
            else if (update.fieldName === 'middleName') formData.middleName = update.value;
            else if (update.fieldName === 'gender') formData.gender = update.value;
            else if (update.fieldName === 'genderBiological') formData.genderBiological = update.value;
            else if (update.fieldName === 'dateOfBirth') formData.dateOfBirth = update.value;
            else if (update.fieldName === 'height') formData.height = String(update.value);
            else if (update.fieldName === 'weight') formData.weight = String(update.value);
            else if (update.fieldName === 'email') formData.email = update.value;
            else if (update.fieldName === 'phone') formData.phone = update.value;
        }

        // Make the update call (with skipAutoFlush=true to prevent recursion)
        const result = await updatePatientProfile(formData, missingFields, config, storageKey, true);

        if (result.success) {
            clearPendingUpdates(storageKey);
        }

        return result;
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to flush pending updates' };
    }
}

/**
 * Logout patient - clears stored auth data and pending updates
 */
export function logoutPatient(storageKey: string = DEFAULT_PATIENT_AUTH_STORAGE_KEY): void {
    clearPatientAuth(storageKey);
    clearPendingUpdates(storageKey);
}

// ============================================================================
// Patient Auth Result Builder
// ============================================================================

/**
 * Build auth results object for form submission
 */
export function buildPatientAuthResults(patient: PatientAuthData, token: string): Record<string, any> {
    return {
        patient,
        token,
        ...patient,
        isAuthenticated: true,
        timestamp: new Date().toISOString(),
    };
}

// ============================================================================
// Height/Weight Conversion Helpers
// ============================================================================

/**
 * Convert total inches to feet and inches
 */
export function inchesToFeetInches(totalInches: number | string): { feet: number; inches: number } {
    const inches = typeof totalInches === 'string' ? parseInt(totalInches) || 0 : totalInches;
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return { feet, inches: remainingInches };
}

/**
 * Convert feet and inches to total inches
 */
export function feetInchesToInches(feet: number, inches: number): number {
    return feet * 12 + inches;
}

// ============================================================================
// Checkout Data Types
// ============================================================================

/**
 * Standardized checkout data that blocks should store via EnrollmentModule
 */
export interface StoredCheckoutData {
    billingOptionId?: number;
    billingCheckoutUuid?: string;
    billingQuote?: import('./enrollment-types').EmrBillingQuote;
    billingTermsAccepted?: boolean;
    patientInfo: {
        email: string;
        first_name: string;
        last_name: string;
        phone: string;
    };
    address: Address;
    useExistingAddress: boolean;
    selectedAddressId?: string;
    stripePaymentMethodId?: string;
    /**
     * Set only in the save_and_authorize EMR charge mode — the PI confirmed
     * on-session at checkout. Forwarded to the enrollment POST so the server
     * can attach the authorization to the new enrollment row.
     */
    stripePaymentIntentId?: string;
    paymentMethod?: 'upfront' | 'per_schedule';
    chargeMode?: EmrChargeMode;
    couponCode?: string;
    appliedCoupon?: ApplicableCoupon | null;
    subtotal?: number;
    discountAmount?: number;
    finalTotal?: number;
    variationId?: number;
    pricingOptionId?: string;
    total?: number;
    // EMR-specific fields
    emrVariantId?: string;
    emrDrugSelection?: EmrDrugSelectionState;
    // Vitals
    patientVitalId?: number | null;
    timestamp: string;
}

// ============================================================================
// EMR Refill Variant Functions
// ============================================================================

const EMR_SCHEDULE_TYPE_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    six_monthly: 'Every 6 Months',
    yearly: 'Yearly',
    custom: 'Custom',
};

export function getDefaultEmrVariant(plan: EmrTreatmentPlan): EmrRefillVariant | null {
    const variants = getEmrVariants(plan);
    if (variants.length === 0) return null;
    return variants.find((v) => v.is_default) ?? variants[0] ?? null;
}

export function getSelectedEmrVariant(plan: EmrTreatmentPlan, variantId?: string): EmrRefillVariant | null {
    if (!variantId) return getDefaultEmrVariant(plan);
    const variants = getEmrVariants(plan);
    return variants.find((v) => v.id === variantId) ?? getDefaultEmrVariant(plan);
}

export function getEmrVariants(plan: EmrTreatmentPlan): EmrRefillVariant[] {
    return (plan.refill_variants ?? []).filter(
        (variant) =>
            variant.enrollment_enabled !== false &&
            (variant.pay_per_refill_enabled !== false ||
                plan.billing_options?.some((option) => option.is_active && option.variant_key === variant.id)),
    );
}

export function getEmrBillingChoices(plan: EmrTreatmentPlan, variantId?: string) {
    return getEmrVariants(plan)
        .filter((variant) => !variantId || variant.id === variantId)
        .flatMap((variant) => {
            const prepaid = (plan.billing_options ?? [])
                .filter((option) => option.is_active && option.variant_key === variant.id)
                .map((option) => ({
                    key: `prepaid:${option.id}`,
                    variantId: variant.id,
                    billingOptionId: option.id as number | null,
                    label: option.label,
                    price: option.base_price_cents / 100,
                    supplyCount: option.supply_count,
                    sortOrder: option.sort_order ?? 0,
                    isDefault: option.is_default,
                    variant,
                }));
            const ordinary =
                variant.pay_per_refill_enabled !== false
                    ? [
                          {
                              key: `per_refill:${variant.id}`,
                              variantId: variant.id,
                              billingOptionId: null as number | null,
                              label: variant.name,
                              price: getEmrVariantPrice(variant),
                              supplyCount: 1,
                              sortOrder: variant.pay_per_refill_sort_order ?? 0,
                              isDefault: false,
                              variant,
                          },
                      ]
                    : [];
            return [...ordinary, ...prepaid].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
        });
}

function getDefaultEmrBillingChoice(plan: EmrTreatmentPlan, variantId: string | null) {
    const choices = variantId ? getEmrBillingChoices(plan, variantId) : [];
    return choices.find((choice) => choice.isDefault) ?? choices.find((choice) => choice.billingOptionId === null) ?? choices[0];
}

export function getEmrVariantPrice(variant: EmrRefillVariant): number {
    return Number(variant.price ?? variant.calculated_price ?? 0) || 0;
}

export function getEmrVariantLabel(variant: EmrRefillVariant): string {
    if (variant.name) return variant.name;
    return EMR_SCHEDULE_TYPE_LABELS[variant.schedule_type] ?? variant.schedule_type ?? 'Unknown';
}

// ============================================================================
// EMR Drug Functions
// ============================================================================

export function getEmrStandaloneDrugs(plan: EmrTreatmentPlan): EmrTreatmentPlanDrug[] {
    return (plan.standalone_drugs ?? []).filter((d) => d.is_active);
}

export function getEmrOptionalDrugs(plan: EmrTreatmentPlan): EmrTreatmentPlanDrug[] {
    return (plan.optional_drugs ?? []).filter((d) => d.is_active);
}

export function getEmrDrugGroups(plan: EmrTreatmentPlan): EmrTreatmentPlanDrugGroup[] {
    return (plan.drug_groups ?? []).map((group) => ({
        ...group,
        drugs: group.drugs.filter((d) => d.is_active),
    }));
}

export function getEmrDrugPrice(drug: EmrTreatmentPlanDrug): number {
    return Number(drug.price ?? drug.merchant_drug?.price ?? 0) || 0;
}

export function getEmrDrugAddOnPrice(drug: EmrTreatmentPlanDrug, selectedPhaseId: string | null): number {
    if (selectedPhaseId && drug.has_phases && drug.phases.length > 0) {
        const phase = drug.phases.find((p) => p.id === selectedPhaseId);
        if (phase?.add_on_price != null) return Number(phase.add_on_price) || 0;
    }
    return Number(drug.add_on_price ?? 0) || 0;
}

export function getEmrGroupDefaultDrug(group: EmrTreatmentPlanDrugGroup): EmrTreatmentPlanDrug | null {
    const activeDrugs = group.drugs.filter((d) => d.is_active);
    if (activeDrugs.length === 0) return null;
    return activeDrugs.find((d) => d.is_default_option) ?? activeDrugs[0] ?? null;
}

// ============================================================================
// EMR Pricing Calculator
// ============================================================================

export function calculateEmrBasePrice(plan: EmrTreatmentPlan, groupSelections: Record<number, number[]>): number {
    // Sum standalone drug prices
    const standaloneTotal = getEmrStandaloneDrugs(plan).reduce((sum, drug) => sum + getEmrDrugPrice(drug), 0);

    // Sum selected group drug prices
    let groupTotal = 0;
    for (const group of getEmrDrugGroups(plan)) {
        const selectedIds = groupSelections[group.id];
        if (selectedIds && selectedIds.length > 0) {
            const selectedDrugs = group.drugs.filter((d) => selectedIds.includes(d.id));
            groupTotal += selectedDrugs.reduce((sum, d) => sum + getEmrDrugPrice(d), 0);
        } else {
            // Default: use the default drug for the group
            const defaultDrug = getEmrGroupDefaultDrug(group);
            if (defaultDrug) {
                groupTotal += getEmrDrugPrice(defaultDrug);
            }
        }
    }

    return standaloneTotal + groupTotal;
}

export function calculateEmrTotal(
    plan: EmrTreatmentPlan,
    variantId?: string,
    groupSelections?: Record<number, number[]>,
    selectedOptionalDrugIds?: number[],
): number {
    const variant = getSelectedEmrVariant(plan, variantId);
    if (!variant) return 0;

    const bundleSize = Math.max(1, variant.default_dispense_bundle_size ?? 1);
    const basePrice = calculateEmrBasePrice(plan, groupSelections ?? {}) * bundleSize;

    const optionalDrugs = getEmrOptionalDrugs(plan);
    const optionalIds = selectedOptionalDrugIds ?? [];
    const optionalPrice = optionalDrugs.filter((d) => optionalIds.includes(d.id)).reduce((sum, d) => sum + getEmrDrugPrice(d), 0) * bundleSize;

    return basePrice + optionalPrice;
}

/**
 * Enrollment-facing pricing: variant price is the full package,
 * optional drugs and add-on prices (for custom pricing) are added on top.
 */
export function calculateEmrVariantTotal(
    plan: EmrTreatmentPlan,
    variantId?: string,
    selectedOptionalDrugIds?: number[],
    groupSelections?: Record<number, { selectedDrugIds: number[]; selectedPhases: Record<number, string | null> }>,
    standaloneDrugPhases?: Record<number, string | null>,
): number {
    const variant = getSelectedEmrVariant(plan, variantId);
    if (!variant) return 0;

    const bundleSize = Math.max(1, variant.default_dispense_bundle_size ?? 1);
    const variantPrice = Number(variant.price ?? variant.calculated_price ?? 0) || 0;
    const optionalDrugs = getEmrOptionalDrugs(plan);
    const optionalTotal =
        optionalDrugs.filter((d) => (selectedOptionalDrugIds ?? []).includes(d.id)).reduce((sum, d) => sum + getEmrDrugPrice(d), 0) * bundleSize;

    // Add-on pricing: only when variant uses custom pricing
    let addOnTotal = 0;
    if (variant.price != null) {
        if (groupSelections) {
            for (const group of getEmrDrugGroups(plan)) {
                const gs = groupSelections[group.id];
                if (!gs) continue;
                for (const drugId of gs.selectedDrugIds) {
                    const drug = group.drugs.find((d) => d.id === drugId);
                    if (!drug) continue;
                    addOnTotal += getEmrDrugAddOnPrice(drug, gs.selectedPhases[drugId] ?? null) * bundleSize;
                }
            }
        }
        if (standaloneDrugPhases) {
            for (const drug of getEmrStandaloneDrugs(plan)) {
                const phaseId = standaloneDrugPhases[drug.id] ?? null;
                if (phaseId) {
                    const phase = drug.phases.find((p) => p.id === phaseId);
                    if (phase?.add_on_price != null) {
                        addOnTotal += (Number(phase.add_on_price) || 0) * bundleSize;
                    }
                }
            }
        }
    }

    return variantPrice + addOnTotal + optionalTotal;
}

// ============================================================================
// EMR State Availability
// ============================================================================

export function getEmrPlanAvailableStates(plan: EmrTreatmentPlan, country: string = 'US'): string[] {
    const scopes = plan.region_scopes ?? [];
    const matching = scopes.filter((s) => s.country_code === country && s.is_active);

    if (matching.length === 0) {
        return getAllStatesForCountry(country);
    }

    // If any scope has null state_code, it means all states for that country
    if (matching.some((s) => !s.state_code)) {
        return getAllStatesForCountry(country);
    }

    return matching.map((s) => s.state_code!).filter(Boolean);
}

export function isStateAvailableForEmrPlan(state: string, plan: EmrTreatmentPlan, country: string = 'US'): boolean {
    return getEmrPlanAvailableStates(plan, country).includes(state);
}

export function validateAddressStateForEmrPlan(address: Address, plan: EmrTreatmentPlan): { valid: boolean; error?: string } {
    if (!address.state) return { valid: true };
    const country = address.country || 'US';
    if (isStateAvailableForEmrPlan(address.state, plan, country)) {
        return { valid: true };
    }
    return { valid: false, error: 'This treatment plan is not available in your state.' };
}

// ============================================================================
// EMR Selection State Manager
// ============================================================================

export function createEmrSelectionStateManager(plan: EmrTreatmentPlan) {
    let selectedVariantId: string | null = getDefaultEmrVariant(plan)?.id ?? null;
    let billingOptionId: number | null = getDefaultEmrBillingChoice(plan, selectedVariantId)?.billingOptionId ?? null;
    const groupSelections: Record<number, EmrDrugGroupSelection> = {};
    let selectedOptionalDrugIds: number[] = [];
    const standaloneDrugPhases: Record<number, string | null> = {};
    const optionalDrugPhases: Record<number, string | null> = {};

    // Auto-initialize standalone drug phases
    for (const drug of getEmrStandaloneDrugs(plan)) {
        standaloneDrugPhases[drug.id] = null;
    }

    // Auto-initialize optional drug phases
    for (const drug of getEmrOptionalDrugs(plan)) {
        optionalDrugPhases[drug.id] = null;
    }

    // Auto-initialize group selections with defaults
    for (const group of getEmrDrugGroups(plan)) {
        const defaultDrug = getEmrGroupDefaultDrug(group);
        const selectedPhases: Record<number, string | null> = {};
        if (defaultDrug) {
            selectedPhases[defaultDrug.id] = null;
        }
        groupSelections[group.id] = {
            groupId: group.id,
            groupName: group.name,
            selectionType: group.selection_type,
            isRequired: group.is_required,
            selectedDrugIds: defaultDrug ? [defaultDrug.id] : [],
            selectedPhases,
        };
    }

    return {
        setBillingOptionId(id: number | null): void {
            const choices = selectedVariantId ? getEmrBillingChoices(plan, selectedVariantId) : [];
            billingOptionId =
                (choices.find((choice) => choice.billingOptionId === id) ?? getDefaultEmrBillingChoice(plan, selectedVariantId))?.billingOptionId ??
                null;
        },
        getBillingOptionId(): number | null {
            return billingOptionId;
        },
        setSelectedVariantId(variantId: string | null): void {
            selectedVariantId = getSelectedEmrVariant(plan, variantId ?? undefined)?.id ?? null;
            const choices = selectedVariantId ? getEmrBillingChoices(plan, selectedVariantId) : [];
            if (!choices.some((choice) => choice.billingOptionId === billingOptionId)) {
                billingOptionId = getDefaultEmrBillingChoice(plan, selectedVariantId)?.billingOptionId ?? null;
            }
        },

        getSelectedVariantId(): string | null {
            return selectedVariantId;
        },

        setDrugGroupSelection(groupId: number, drugIds: number[]): void {
            const group = groupSelections[groupId];
            if (!group) return;
            if (group.selectionType === 'single' && drugIds.length > 1) {
                group.selectedDrugIds = [drugIds[drugIds.length - 1]];
            } else {
                group.selectedDrugIds = [...drugIds];
            }
            // Initialize phases for newly selected drugs
            for (const drugId of group.selectedDrugIds) {
                if (!(drugId in group.selectedPhases)) {
                    group.selectedPhases[drugId] = null;
                }
            }
        },

        getDrugGroupSelection(groupId: number): number[] {
            return groupSelections[groupId]?.selectedDrugIds ?? [];
        },

        toggleOptionalDrug(drugId: number): void {
            const idx = selectedOptionalDrugIds.indexOf(drugId);
            if (idx >= 0) {
                selectedOptionalDrugIds = selectedOptionalDrugIds.filter((id) => id !== drugId);
            } else {
                selectedOptionalDrugIds = [...selectedOptionalDrugIds, drugId];
            }
        },

        isOptionalDrugSelected(drugId: number): boolean {
            return selectedOptionalDrugIds.includes(drugId);
        },

        // Phase selection methods
        setStandaloneDrugPhase(drugId: number, phaseId: string | null): void {
            standaloneDrugPhases[drugId] = phaseId;
        },

        getStandaloneDrugPhase(drugId: number): string | null {
            return standaloneDrugPhases[drugId] ?? null;
        },

        setOptionalDrugPhase(drugId: number, phaseId: string | null): void {
            optionalDrugPhases[drugId] = phaseId;
        },

        getOptionalDrugPhase(drugId: number): string | null {
            return optionalDrugPhases[drugId] ?? null;
        },

        setGroupDrugPhase(groupId: number, drugId: number, phaseId: string | null): void {
            const group = groupSelections[groupId];
            if (!group) return;
            group.selectedPhases[drugId] = phaseId;
        },

        getGroupDrugPhase(groupId: number, drugId: number): string | null {
            return groupSelections[groupId]?.selectedPhases[drugId] ?? null;
        },

        getAllDrugChoices(): Array<{ drugId: number; phaseId: string | null }> {
            const choices: Array<{ drugId: number; phaseId: string | null }> = [];

            // Standalone drugs
            for (const drug of getEmrStandaloneDrugs(plan)) {
                choices.push({ drugId: drug.id, phaseId: standaloneDrugPhases[drug.id] ?? null });
            }

            // Group drugs
            for (const group of getEmrDrugGroups(plan)) {
                const gs = groupSelections[group.id];
                if (gs) {
                    for (const drugId of gs.selectedDrugIds) {
                        choices.push({ drugId, phaseId: gs.selectedPhases[drugId] ?? null });
                    }
                }
            }

            // Optional drugs
            for (const drugId of selectedOptionalDrugIds) {
                choices.push({ drugId, phaseId: optionalDrugPhases[drugId] ?? null });
            }

            return choices;
        },

        getEmrCheckoutSelectionState(): EmrCheckoutSelectionState {
            const variant = getSelectedEmrVariant(plan, selectedVariantId ?? undefined);

            const flatGroupSelections: Record<number, number[]> = {};
            for (const [gid, gs] of Object.entries(groupSelections)) {
                flatGroupSelections[Number(gid)] = gs.selectedDrugIds;
            }

            const standaloneDrugs = getEmrStandaloneDrugs(plan);
            const groupDrugs: EmrTreatmentPlanDrug[] = [];
            for (const group of getEmrDrugGroups(plan)) {
                const selectedIds = flatGroupSelections[group.id] ?? [];
                groupDrugs.push(...group.drugs.filter((d) => selectedIds.includes(d.id)));
            }
            const optionalDrugs = getEmrOptionalDrugs(plan).filter((d) => selectedOptionalDrugIds.includes(d.id));

            // Variant-based pricing: variant price covers standalone + group drugs
            const bundleSize = Math.max(1, variant?.default_dispense_bundle_size ?? 1);
            const variantPrice = variant ? Number(variant.price ?? variant.calculated_price ?? 0) || 0 : 0;
            const optionalPrice = optionalDrugs.reduce((sum, d) => sum + getEmrDrugPrice(d), 0) * bundleSize;

            // Add-on pricing: only applies when variant uses custom pricing
            const isCustomPricing = variant?.price != null;
            let addOnTotal = 0;

            if (isCustomPricing) {
                // Group drug add-ons
                for (const group of getEmrDrugGroups(plan)) {
                    const gs = groupSelections[group.id];
                    if (!gs) continue;
                    for (const drugId of gs.selectedDrugIds) {
                        const drug = group.drugs.find((d) => d.id === drugId);
                        if (!drug) continue;
                        addOnTotal += getEmrDrugAddOnPrice(drug, gs.selectedPhases[drugId] ?? null) * bundleSize;
                    }
                }
                // Standalone drug phase add-ons
                for (const drug of getEmrStandaloneDrugs(plan)) {
                    const phaseId = standaloneDrugPhases[drug.id] ?? null;
                    if (phaseId) {
                        const phase = drug.phases.find((p) => p.id === phaseId);
                        if (phase?.add_on_price != null) {
                            addOnTotal += (Number(phase.add_on_price) || 0) * bundleSize;
                        }
                    }
                }
            }

            return {
                billingOptionId,
                variantId: selectedVariantId,
                variant: variant ?? null,
                drugSelection: {
                    groupSelections: { ...groupSelections },
                    selectedOptionalDrugIds: [...selectedOptionalDrugIds],
                    standaloneDrugPhases: { ...standaloneDrugPhases },
                    optionalDrugPhases: { ...optionalDrugPhases },
                },
                selectedDrugs: [...standaloneDrugs, ...groupDrugs, ...optionalDrugs],
                baseTotal: variantPrice,
                addOnTotal,
                optionalTotal: optionalPrice,
                total: variantPrice + addOnTotal + optionalPrice,
                compareAtPrice: variant?.compare_at_price ?? null,
                scheduleLabel: variant ? getEmrVariantLabel(variant) : null,
                scheduleType: variant?.schedule_type ?? null,
            };
        },

        hydrateEmrSelectionState(state: EmrCheckoutSelectionState | null | undefined): void {
            if (!state) return;

            selectedVariantId = getSelectedEmrVariant(plan, state.variantId ?? undefined)?.id ?? selectedVariantId;
            const choices = selectedVariantId ? getEmrBillingChoices(plan, selectedVariantId) : [];
            billingOptionId =
                (
                    choices.find((choice) => choice.billingOptionId === (state.billingOptionId ?? null)) ??
                    getDefaultEmrBillingChoice(plan, selectedVariantId)
                )?.billingOptionId ?? null;

            for (const [groupId, savedGroupSelection] of Object.entries(state.drugSelection?.groupSelections ?? {})) {
                const groupKey = Number(groupId);
                const currentGroupSelection = groupSelections[groupKey];
                if (!currentGroupSelection) continue;

                groupSelections[groupKey] = {
                    ...currentGroupSelection,
                    ...savedGroupSelection,
                    selectedDrugIds: [...(savedGroupSelection.selectedDrugIds ?? currentGroupSelection.selectedDrugIds)],
                    selectedPhases: {
                        ...currentGroupSelection.selectedPhases,
                        ...(savedGroupSelection.selectedPhases ?? {}),
                    },
                };
            }

            selectedOptionalDrugIds = [...(state.drugSelection?.selectedOptionalDrugIds ?? selectedOptionalDrugIds)];

            for (const [drugId, phaseId] of Object.entries(state.drugSelection?.standaloneDrugPhases ?? {})) {
                standaloneDrugPhases[Number(drugId)] = phaseId;
            }

            for (const [drugId, phaseId] of Object.entries(state.drugSelection?.optionalDrugPhases ?? {})) {
                optionalDrugPhases[Number(drugId)] = phaseId;
            }
        },

        resetSelections(): void {
            selectedVariantId = getDefaultEmrVariant(plan)?.id ?? null;
            billingOptionId = getDefaultEmrBillingChoice(plan, selectedVariantId)?.billingOptionId ?? null;
            selectedOptionalDrugIds = [];
            for (const drug of getEmrStandaloneDrugs(plan)) {
                standaloneDrugPhases[drug.id] = null;
            }
            for (const drug of getEmrOptionalDrugs(plan)) {
                optionalDrugPhases[drug.id] = null;
            }
            for (const group of getEmrDrugGroups(plan)) {
                const defaultDrug = getEmrGroupDefaultDrug(group);
                const selectedPhases: Record<number, string | null> = {};
                if (defaultDrug) {
                    selectedPhases[defaultDrug.id] = null;
                }
                groupSelections[group.id] = {
                    groupId: group.id,
                    groupName: group.name,
                    selectionType: group.selection_type,
                    isRequired: group.is_required,
                    selectedDrugIds: defaultDrug ? [defaultDrug.id] : [],
                    selectedPhases,
                };
            }
        },
    };
}

// ============================================================================
// EMR Enrollment Submission
// ============================================================================

export async function submitEmrEnrollment(
    slug: string,
    formResponses: Record<number, any>,
    checkoutData: CheckoutData | null,
    drugSelection: EmrDrugSelectionState | null,
    variantId: string | null,
    analyticsManager?: AnalyticsManager | null,
    planId?: number | null,
    analyticsUrlParams?: UrlParameters | null,
): Promise<EnrollmentSubmissionResult> {
    try {
        const formData = new FormData();

        // The plan actually rendered. On an A/B main link this is the assigned
        // variant, so the enrollment lands on the offer the patient saw.
        if (planId) {
            formData.append('ab_plan_id', String(planId));
        }

        // Add drug selection and variant
        if (drugSelection) {
            formData.append('drug_selections', JSON.stringify(drugSelection));
        }
        if (variantId) {
            formData.append('variant_id', variantId);
        }

        // Add checkout data
        if (checkoutData?.billingOptionId) {
            formData.append('billing_option_id', String(checkoutData.billingOptionId));
            formData.append('billing_checkout_uuid', checkoutData.billingCheckoutUuid ?? '');
            formData.append('billing_terms_accepted', checkoutData.billingTermsAccepted ? '1' : '0');
        }
        if (checkoutData) {
            formData.append('patient_info', JSON.stringify(checkoutData.patientInfo));
            formData.append('use_existing_address', String(checkoutData.useExistingAddress));
            if (checkoutData.useExistingAddress && checkoutData.address?.id) {
                formData.append('address_id', String(checkoutData.address.id));
            } else {
                formData.append('address', JSON.stringify(checkoutData.address));
            }
            if (checkoutData.stripePaymentMethodId) {
                formData.append('stripe_payment_method_id', checkoutData.stripePaymentMethodId);
            }
            if (checkoutData.stripePaymentIntentId) {
                formData.append('stripe_payment_intent_id', checkoutData.stripePaymentIntentId);
            }
            if (checkoutData.chargeMode) {
                formData.append('charge_mode', checkoutData.chargeMode);
            }
            if (checkoutData.paymentMethod) {
                formData.append('payment_method', checkoutData.paymentMethod);
            }
            if (checkoutData.patientVitalId) {
                formData.append('patient_vital_id', String(checkoutData.patientVitalId));
            }
            if (checkoutData.couponCode) {
                formData.append('coupon_code', checkoutData.couponCode);
            }
        }

        // Build form_responses array with file handling
        const formResponsesArray = Object.keys(formResponses).map((formId) => {
            const responseData = formResponses[parseInt(formId)];
            const processedData: Record<string, any> = {};

            Object.keys(responseData).forEach((key) => {
                const value = responseData[key];
                if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
                    value.forEach((file: File, index: number) => {
                        formData.append(`files[${formId}][${key}][${index}]`, file);
                    });
                    processedData[key] = value.map((file: File) => ({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    }));
                } else {
                    processedData[key] = value;
                }
            });

            return { intake_form_id: parseInt(formId), response_data: processedData };
        });

        formData.append('form_responses', JSON.stringify(formResponsesArray));

        // Append analytics tracking
        appendAnalyticsTracking(formData, analyticsManager, analyticsUrlParams);

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        const response = await enrollmentFetch(`/emr/enroll/${slug}`, {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { success: false, errors: errorData.errors || { error: 'An error occurred while submitting your enrollment.' } };
        }

        const data = await response.json().catch(() => ({}));

        return {
            success: true,
            enrollment: data.enrollment,
            redirect_url: data.redirect_url,
        };
    } catch (error) {
        return { success: false, errors: { error: 'An error occurred while submitting your enrollment. Please try again.' } };
    }
}

// ============================================================================
// EMR Storage Key
// ============================================================================

export function getEmrStorageKey(slug: string, planId: number): string {
    return `emr_plan_enroll_${slug}_${planId}`;
}

// ============================================================================
// EMR Enrollment Utils Factory
// ============================================================================

export function createEmrEnrollmentUtils(config: EmrEnrollmentUtilsConfig): EmrEnrollmentUtils | null {
    const { plan, merchant, slug, analyticsManager, analyticsUrlParams } = config;
    if (!plan) return null;

    const storageKey = getEmrStorageKey(slug, plan.id);
    const selectionManager = createEmrSelectionStateManager(plan);

    return {
        // Configuration
        plan,
        merchant,
        slug,
        storageKey,

        // Patient data functions (reused)
        fetchPatientInfo,
        fetchPatientAddresses,
        extractPatientInfo,

        // EMR Refill Variant functions
        getDefaultVariant: () => getDefaultEmrVariant(plan),
        getSelectedVariant: (variantId?: string) => getSelectedEmrVariant(plan, variantId),
        getVariants: () => getEmrVariants(plan),
        getBillingChoices: (variantId?: string) => getEmrBillingChoices(plan, variantId),
        getVariantPrice: getEmrVariantPrice,
        getVariantLabel: getEmrVariantLabel,

        // EMR Drug functions
        getStandaloneDrugs: () => getEmrStandaloneDrugs(plan),
        getOptionalDrugs: () => getEmrOptionalDrugs(plan),
        getDrugGroups: () => getEmrDrugGroups(plan),
        getDrugPrice: getEmrDrugPrice,
        getDrugAddOnPrice: getEmrDrugAddOnPrice,
        getGroupDefaultDrug: getEmrGroupDefaultDrug,

        // EMR Selection state management
        setBillingOptionId: selectionManager.setBillingOptionId,
        getBillingOptionId: selectionManager.getBillingOptionId,
        setSelectedVariantId: selectionManager.setSelectedVariantId,
        getSelectedVariantId: selectionManager.getSelectedVariantId,
        setDrugGroupSelection: selectionManager.setDrugGroupSelection,
        getDrugGroupSelection: selectionManager.getDrugGroupSelection,
        toggleOptionalDrug: selectionManager.toggleOptionalDrug,
        isOptionalDrugSelected: selectionManager.isOptionalDrugSelected,
        getEmrCheckoutSelectionState: selectionManager.getEmrCheckoutSelectionState,
        hydrateEmrSelectionState: selectionManager.hydrateEmrSelectionState,
        resetSelections: selectionManager.resetSelections,

        // Phase selection
        setStandaloneDrugPhase: selectionManager.setStandaloneDrugPhase,
        getStandaloneDrugPhase: selectionManager.getStandaloneDrugPhase,
        setOptionalDrugPhase: selectionManager.setOptionalDrugPhase,
        getOptionalDrugPhase: selectionManager.getOptionalDrugPhase,
        setGroupDrugPhase: selectionManager.setGroupDrugPhase,
        getGroupDrugPhase: selectionManager.getGroupDrugPhase,
        getAllDrugChoices: selectionManager.getAllDrugChoices,

        // EMR Pricing
        calculateEmrTotal: (variantId?: string) => {
            const state = selectionManager.getEmrCheckoutSelectionState();
            const flatGroupSelections: Record<number, number[]> = {};
            for (const [gid, gs] of Object.entries(state.drugSelection.groupSelections)) {
                flatGroupSelections[Number(gid)] = gs.selectedDrugIds;
            }
            return calculateEmrTotal(
                plan,
                variantId ?? state.variantId ?? undefined,
                flatGroupSelections,
                state.drugSelection.selectedOptionalDrugIds,
            );
        },

        // EMR Variant-based pricing (variant price + optional add-ons)
        calculateEmrVariantTotal: (variantId?: string) => {
            const state = selectionManager.getEmrCheckoutSelectionState();
            return calculateEmrVariantTotal(
                plan,
                variantId ?? state.variantId ?? undefined,
                state.drugSelection.selectedOptionalDrugIds,
                state.drugSelection.groupSelections,
                state.drugSelection.standaloneDrugPhases,
            );
        },

        // EMR Submission
        submitEmrEnrollment: (formResponses, checkoutData) => {
            const state = selectionManager.getEmrCheckoutSelectionState();
            return submitEmrEnrollment(
                slug,
                formResponses,
                checkoutData,
                state.drugSelection,
                state.variantId,
                analyticsManager,
                plan.id,
                analyticsUrlParams,
            );
        },

        // Checkout validation (reused from generic)
        validateCheckoutForm,
        validatePatientInfo,
        validateAddress,
        getSelectedAddress,
        createEmptyAddress,
        createEmptyPatientInfo,
        initializePatientInfo,
        isValidEmail,

        // Stripe payment (reused, bound to merchantId)
        fetchPaymentMethods: (authToken: string) => fetchPaymentMethods(authToken, merchant.id),
        getDefaultPaymentMethod,
        createSetupIntent: (authToken: string, forceNew?: boolean) => createSetupIntent(authToken, merchant.id, forceNew),
        deletePaymentMethod,
        savePaymentMethod: (authToken: string, paymentMethodId: string, customerId: string, setupIntentId: string, setAsDefault?: boolean) =>
            savePaymentMethod(authToken, merchant.id, paymentMethodId, customerId, setupIntentId, setAsDefault),
        isSetupIntentProcessing,
        isSetupIntentSucceeded,

        // State persistence (reused)
        loadState: () => loadEnrollmentState(storageKey),
        saveState: (state: Partial<EnrollmentState>) => saveEnrollmentState(storageKey, state),
        clearState: () => clearEnrollmentState(storageKey),

        // Analytics helpers (reused)
        enrichEventWithPatientData,
        toSlug,
        sendAbandonBeacon: (eventData: any, am: AnalyticsManager) => sendEnrichedAbandonBeacon(eventData, null, am, merchant.id, plan.id),
    };
}
