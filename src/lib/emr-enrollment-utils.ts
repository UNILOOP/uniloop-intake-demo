import { enrollmentFetch } from '@/lib/enrollment-api-transport';
import { AnalyticsManager, type UrlParameters } from './analytics';
import {
    AbandonEventContext as AbandonEventContextType,
    Address as AddressType,
    AnalyticsEventData as AnalyticsEventDataType,
    AnalyticsTarget as AnalyticsTargetType,
    AnalyticsTrackingState as AnalyticsTrackingStateType,
    ApplicableCoupon,
    CheckoutData as CheckoutDataType,
    CheckoutPatientInfo as CheckoutPatientInfoType,
    CheckoutValidationErrors,
    CouponsResponse as CouponsResponseType,
    DEFAULT_PATIENT_AUTH_CONFIG,
    DEFAULT_PATIENT_AUTH_STORAGE_KEY,
    EmrCheckoutSelectionState as EmrCheckoutSelectionStateType,
    EmrRefillVariant as EmrRefillVariantType,
    EmrEnrollmentUtils as EmrSelectionUtils,
    EmrTreatmentPlanDrugGroup as EmrTreatmentPlanDrugGroupType,
    EmrTreatmentPlanDrug as EmrTreatmentPlanDrugType,
    EmrTreatmentPlan as EmrTreatmentPlanType,
    EnrollmentForm as EnrollmentFormType,
    EnrollmentState as EnrollmentStateType,
    EnrollmentSubmissionResult,
    FULL_PROFILE_PATIENT_AUTH_CONFIG,
    Merchant as MerchantType,
    MINIMAL_PATIENT_AUTH_CONFIG,
    PASSWORD_PATIENT_AUTH_CONFIG,
    PATIENT_AUTH_STORAGE_PREFIX,
    PatientAuthConfig as PatientAuthConfigType,
    PatientAuthData as PatientAuthDataType,
    PatientAuthFormData as PatientAuthFormDataType,
    PatientAuthResult as PatientAuthResultType,
    PatientAuthStorageData,
    PatientAuthValidationErrors,
    PatientInfo as PatientInfoType,
    PENDING_UPDATES_STORAGE_PREFIX,
    PendingUpdatesData,
    PHONE_OTP_PATIENT_AUTH_CONFIG,
    STRIPE_CARD_ELEMENT_OPTIONS,
    StripeInitializationResult,
    StripePaymentMethod,
    SUPPORTED_COUNTRIES,
    SurveyFormAnalyticsProp as SurveyFormAnalyticsPropType,
    US_STATES,
} from './enrollment-types';
import {
    buildAbandonEventData,
    buildPatientAuthResults,
    buildSurveyCompleteEventData,
    buildTabSwitchEventData,
    clearPendingUpdates,
    completeAuthorizationReturn,
    createAuthorizationIntent,
    createEmptyAddress,
    createEmptyPatientAuthFormData,
    createEmptyPatientInfo,
    // EMR functions
    createEmrEnrollmentUtils as createEmrSelectionUtils,
    createStripePaymentHandlers,
    createSurveyFormAnalyticsProp,
    deletePaymentMethod,
    EcommerceEventType,
    enrichEventWithEnrollmentAttribution,
    extractPatientInfo,
    feetInchesToInches,
    fetchApplicableCoupons,
    fetchPatientAddresses,
    fetchPatientInfo,
    flushPendingUpdates,
    formatPhoneNumber,
    getAllStatesForCountry,
    getDefaultPaymentMethod,
    getEmrPlanAvailableStates,
    getPatientAuthStorageKey,
    getPatientAuthToken,
    getPatientMissingFields,
    getPendingUpdates,
    getRawPhoneDigits,
    getReferencePatient,
    getSelectedAddress,
    getStoredPatient,
    getStoredPatientAuth,
    getStripePaymentFormProps,
    handlePatientAuthAnalytics,
    inchesToFeetInches,
    initializePatientInfo,
    isSetupIntentProcessing,
    isSetupIntentSucceeded,
    isStateAvailableForEmrPlan,
    isValidEmail,
    isValidOtp,
    isValidPatientEmail,
    isValidPatientPhone,
    logoutPatient,
    resolveEnrollmentUrlParameters,
    savePatientAuth,
    savePendingUpdate,
    sendEnrichedAbandonBeacon,
    sendPatientOtp,
    // Checkout data type
    StoredCheckoutData,
    StripePaymentForm,
    trackAnalyticsEvent,
    trackFormPageView,
    updatePatientProfile,
    validateAddress,
    validateAddressStateForEmrPlan,
    validateCheckoutForm,
    validateCoupon,
    validatePatientAuth,
    validatePatientAuthForm,
    validatePatientInfo,
    validatePatientToken,
} from './enrollment-utils';
import { identifyIntercom, updateIntercom } from './intercom';
import { fetchStoreCredits, setStoreCreditPreference } from './store-credit-utils';

/** Checkout draft for an EMR plan; excludes legacy treatment variation/pricing-option IDs. Display amounts are dollars. */
export type EmrCheckoutData = Omit<StoredCheckoutData, 'variationId' | 'pricingOptionId'>;

/** One independent intake answer set. Use schema field names and option values, not display labels. */
export interface EmrPreferredDrugFormResponse {
    /** Local served intake ID; the wrapper resolves its active UniEMR plan form. */
    intake_form_id?: number;
    /** UniEMR active plan-form UUID; recommended when a template is reused. */
    treatment_plan_form_id?: string;
    /** UniEMR template UUID. Must match the plan form when both are supplied. */
    form_template_id?: string;
    form_data: Record<string, unknown>;
}

/** Live form context supplied by the owning enrollment page, shared by every built-in and custom block. */
export interface EmrEnrollmentFormContext {
    forms: EnrollmentFormType[];
    currentFormId: number | null;
    /** Completed responses plus the active form's current values, keyed by local intake ID. */
    answers: Record<number, Record<string, unknown>>;
}

/** Patient-safe independent output. All identifiers here are remote UUIDs. */
export interface EmrPreferredDrug {
    merchant_drug_id: string | null;
    treatment_plan_drug_id: string | null;
    drug_group_id: string | null;
    drug_name: string | null;
    strength: string | null;
    dosage: string | null;
    clinical_cycle_number: number;
    resolved_clinical_cycle: number | null;
    /** Actual source; history-based titration modes may use a fixed-drug fallback. */
    resolution_source: string | null;
}

/** Unambiguous local drug/phase compatible with the selection methods. */
export interface EmrPreferredDrugSelection {
    responseIndex: number;
    drugId: number;
    groupId: number | null;
    kind: 'standalone' | 'optional' | 'group';
    phaseId: string | null;
    drugName: string;
    phaseLabel: string | null;
    clinicalCycle: number;
    resolutionSource: string | null;
}

/** Independent results preserve order/repeats; selections omit ambiguous/unavailable local mappings. */
export interface EmrPreferredDrugResolution {
    clinical_cycle_from: number;
    clinical_cycle_to: number;
    form_results: Array<{
        response_index: number;
        treatment_plan_form_id: string | null;
        form_template_id: string | null;
        preferred_drugs: EmrPreferredDrug[];
    }>;
    selections: EmrPreferredDrugSelection[];
}

/** Server-authoritative commercial purchase quote. Amounts are integer cents. */
export interface EmrBillingPurchase {
    checkout_uuid: string;
    quote: import('./enrollment-types').EmrBillingQuote;
}

/** Configuration for one EMR enrollment session. Reuse one instance across all survey forms. */
export interface EmrEnrollmentUtilsConfig {
    /** EMR plan actually rendered, including assigned A/B variants and commercial billing options. */
    plan: EmrTreatmentPlanType;
    /** Merchant whose Stripe account and enrollment endpoints are used. */
    merchant: MerchantType;
    /** Public enrollment link slug; together with plan.id scopes persisted drafts. */
    slug: string;
    /** Save a card only, or save and authorize without capturing funds. Defaults to save_only. */
    chargeMode?: 'save_only' | 'save_and_authorize';
    /** Authentication requirements; defaults to email OTP with optional profile collection. */
    patientAuthConfig?: PatientAuthConfigType;
    /** Optional independent patient authentication storage namespace. */
    patientAuthStorageKey?: string;
    /** Existing analytics manager. Omit to disable analytics delivery. */
    analyticsManager?: AnalyticsManager | null;
    /** Attribution captured before a Stripe redirect; restored alongside the enrollment draft. */
    analyticsUrlParams?: UrlParameters;
    /** Read the latest form metadata and answers without recreating the session when survey values change. */
    getFormContext?: () => EmrEnrollmentFormContext | null;
}

/**
 * Public EMR enrollment API for built-in and merchant-authored survey blocks.
 * Access the shared instance with useSurveyForm().customData.emrEnrollmentUtils.
 * Selections and checkout/vital drafts persist under the existing EMR storage key.
 * Authentication is validated before background profile/vital writes are allowed.
 * Prices are display estimates in dollars; commercial billing quotes are server-authoritative in cents.
 * Mutations do not trigger React renders: keep UI selections in component state and read refreshed totals after changes.
 */
export class EmrEnrollmentUtils {
    /**
     * Compatibility access to the existing low-level EMR selection helpers. Prefer the public session methods so
     * persistence, quote invalidation and analytics stay synchronized.
     * @group Session
     */
    readonly emrEnrollment: EmrSelectionUtils;

    /**
     * Authentication and required-profile settings used when an auth method does not receive an override.
     * @group Session
     */
    readonly patientAuthConfig: PatientAuthConfigType;

    /**
     * Active patient authentication namespace. Updated after successful authentication with an explicit storage key.
     * @group Session
     */
    get patientAuthStorageKey(): string {
        return this._patientAuthStorageKey;
    }

    private _preferredDrugVersion = 0;
    private _getFormContext?: () => EmrEnrollmentFormContext | null;
    private _preferredDrugController: AbortController | null = null;
    private _preferredDrugResolution: EmrPreferredDrugResolution | null = null;
    private _lastAppliedPreferredDrugKey: string | null = null;
    private _preferredDrugRequests = new WeakMap<
        EmrPreferredDrugResolution,
        { key: string; version: number; variant: string | null; choices: string; contextKey: string; signal: AbortSignal }
    >();

    private _patientAuthStorageKey: string;

    private readonly _chargeMode: 'save_only' | 'save_and_authorize';

    // Private checkout data storage (in-memory, passed via ref)
    private _checkoutData: EmrCheckoutData | null = null;

    // Private vital ID storage (persisted with the EMR enrollment draft)
    private _vitalId: number | null = null;

    // Whether token has been validated (gates updatePatientField flush behavior)
    private _tokenValidated: boolean = false;

    // Pending vital data for deferred creation (in-memory, flushed after token validation)
    private _pendingVitalData: Record<string, unknown> | null = null;

    private _vitalSessionVersion = 0;

    private _vitalSaveTimer: ReturnType<typeof setTimeout> | null = null;

    private _vitalFlushPromise: Promise<{ success: boolean; vitalId: number | null; error?: string }> | null = null;

    // Analytics manager reference (stored from config for auto-fire from selection methods)
    private _analyticsManager: AnalyticsManager | null = null;

    private _analyticsUrlParams: UrlParameters = {};

    // Patient info captured once authenticated/known; used to enrich every auto-fired event
    private _patientInfo: PatientInfoType | null = null;

    // One-shot canonical events that should fire at most once per session
    private _firedOnceEvents: Set<string> = new Set();

    // Set true once the user has reached a completed enrollment. Suppresses
    // any further `survey_abandon`/`tab_switch`/`survey_resume` events so the
    // beforeunload/visibilitychange triggered by the success redirect doesn't
    // count a completed enrollment as an abandon.
    private _enrollmentCompleted: boolean = false;

    // Last-known height (inches) / weight (lbs) for deriving the bmi_set event
    private _bmiHeight: number | null = null;

    private _bmiWeight: number | null = null;

    // expose some core constants via instance
    /**
     * US state abbreviations offered by address controls. Use plan availability methods to apply geographic restrictions.
     * @group Address and checkout
     */
    readonly US_STATES = US_STATES;

    /**
     * Country code/name choices offered by checkout address controls.
     * @group Address and checkout
     */
    readonly SUPPORTED_COUNTRIES = SUPPORTED_COUNTRIES;

    /**
     * Shared Stripe card-element appearance/options for custom card controls.
     * @group Stripe and payments
     */
    readonly STRIPE_CARD_ELEMENT_OPTIONS = STRIPE_CARD_ELEMENT_OPTIONS;

    /**
     * Default email OTP requirements. Pass a copied configuration with overrides for another auth flow.
     * @group Patient authentication
     */
    readonly DEFAULT_PATIENT_AUTH_CONFIG = DEFAULT_PATIENT_AUTH_CONFIG;

    /**
     * Email OTP configuration requiring no profile fields.
     * @group Patient authentication
     */
    readonly MINIMAL_PATIENT_AUTH_CONFIG = MINIMAL_PATIENT_AUTH_CONFIG;

    /**
     * Email OTP configuration requiring name, gender, date of birth, height and weight.
     * @group Patient authentication
     */
    readonly FULL_PROFILE_PATIENT_AUTH_CONFIG = FULL_PROFILE_PATIENT_AUTH_CONFIG;

    /**
     * Phone OTP configuration. Phone values use the patient API contact format.
     * @group Patient authentication
     */
    readonly PHONE_OTP_PATIENT_AUTH_CONFIG = PHONE_OTP_PATIENT_AUTH_CONFIG;

    /**
     * Password authentication configuration; use validatePatientAuth with a password.
     * @group Patient authentication
     */
    readonly PASSWORD_PATIENT_AUTH_CONFIG = PASSWORD_PATIENT_AUTH_CONFIG;

    /**
     * Prefix used for named patient authentication storage keys.
     * @group Patient authentication
     */
    readonly PATIENT_AUTH_STORAGE_PREFIX = PATIENT_AUTH_STORAGE_PREFIX;

    /**
     * The active authentication key for this session, including a configured custom namespace.
     * @group Patient authentication
     * @returns The typed result described above (string).
     * @example const value = utils.DEFAULT_PATIENT_AUTH_STORAGE_KEY;
     */
    get DEFAULT_PATIENT_AUTH_STORAGE_KEY(): string {
        return this.patientAuthStorageKey;
    }

    /**
     * Prefix used for deferred patient profile edits.
     * @group Patient authentication
     */
    readonly PENDING_UPDATES_STORAGE_PREFIX = PENDING_UPDATES_STORAGE_PREFIX;

    // expose Stripe payment form component
    /**
     * Shared React Stripe form with saved cards, setup/authorization and redirect recovery. Obtain it from this session
     * rather than importing a separate Stripe integration.
     * @group Stripe and payments
     */
    readonly StripePaymentForm: typeof StripePaymentForm = StripePaymentForm;

    /**
     * Create an EMR-only enrollment session. Restores selections, checkout and vital drafts from the existing slug/plan
     * storage key. Does not authenticate a stored token; validatePatientToken must succeed before background writes.
     * @group Session
     * @param config Assigned EMR plan, merchant, public slug and optional charge mode, auth or analytics settings.
     * @returns The typed result described above.
     * @example const utils = new EmrEnrollmentUtils({ plan, merchant, slug });
     */
    constructor(config: EmrEnrollmentUtilsConfig) {
        if (!config.plan || !config.merchant || !config.slug) throw new Error('An EMR plan, merchant and enrollment slug are required.');
        this.patientAuthConfig = config.patientAuthConfig ?? DEFAULT_PATIENT_AUTH_CONFIG;
        this._patientAuthStorageKey = config.patientAuthStorageKey ?? DEFAULT_PATIENT_AUTH_STORAGE_KEY;
        this._analyticsManager = config.analyticsManager ?? null;
        this._analyticsUrlParams = resolveEnrollmentUrlParameters(config.analyticsUrlParams);
        this._chargeMode = config.chargeMode ?? 'save_only';
        this._getFormContext = config.getFormContext;
        this.emrEnrollment = createEmrSelectionUtils({ ...config, analyticsUrlParams: this._analyticsUrlParams })!;
        this.restoreTransientEnrollmentState();
        this.persistTransientEnrollmentState();
    }

    private restoreTransientEnrollmentState(): void {
        const savedState = this.loadState();
        if (!savedState) return;

        this._checkoutData = (savedState.checkoutData as unknown as StoredCheckoutData | null | undefined) ?? null;
        this._pendingVitalData = (savedState.pendingVitalData as typeof this._pendingVitalData | undefined) ?? null;
        this._vitalId = typeof savedState.vitalId === 'number' ? savedState.vitalId : null;

        if (this.emrEnrollment && savedState.emrSelectionState) {
            this.emrEnrollment.hydrateEmrSelectionState(savedState.emrSelectionState);
        }
    }

    private persistTransientEnrollmentState(): void {
        if (!this.storageKey) return;
        this.refreshCheckoutDataFromCurrentEmrState();

        this.saveState({
            checkoutData: this._checkoutData as unknown as Record<string, unknown> | null,
            emrSelectionState: this.emrEnrollment?.getEmrCheckoutSelectionState() ?? null,
            pendingVitalData: this._pendingVitalData,
            vitalId: this._vitalId,
            urlParams: this._analyticsUrlParams,
        });
    }

    private withCurrentEmrCheckoutState(data: Omit<EmrCheckoutData, 'timestamp'>): Omit<EmrCheckoutData, 'timestamp'> {
        const emrState = this.emrEnrollment?.getEmrCheckoutSelectionState();
        if (!emrState) return data;
        if (data.billingQuote)
            return {
                ...data,
                emrVariantId: data.emrVariantId ?? emrState.variantId ?? undefined,
                emrDrugSelection: data.emrDrugSelection ?? emrState.drugSelection,
                billingOptionId: data.billingOptionId ?? emrState.billingOptionId ?? undefined,
            };

        const discountAmount = data.discountAmount ?? data.appliedCoupon?.discount_amount;
        const hasCoupon = Boolean(data.appliedCoupon || data.couponCode);
        const refreshedSubtotal = data.subtotal ?? emrState.total;
        const refreshedTotal =
            hasCoupon && typeof discountAmount === 'number' ? Math.max(0, refreshedSubtotal - discountAmount) : (data.total ?? emrState.total);

        return {
            ...data,
            emrVariantId: data.emrVariantId ?? emrState.variantId ?? undefined,
            emrDrugSelection: data.emrDrugSelection ?? emrState.drugSelection,
            subtotal: hasCoupon ? refreshedSubtotal : data.subtotal,
            discountAmount: hasCoupon ? discountAmount : data.discountAmount,
            finalTotal: hasCoupon ? refreshedTotal : data.finalTotal,
            total: refreshedTotal,
        };
    }

    private refreshCheckoutDataFromCurrentEmrState(): void {
        const emrState = this.emrEnrollment?.getEmrCheckoutSelectionState();
        if (!emrState || !this._checkoutData) return;

        if (this._checkoutData.billingQuote) {
            const unchanged =
                this._checkoutData.billingOptionId === emrState.billingOptionId &&
                this._checkoutData.emrVariantId === emrState.variantId &&
                JSON.stringify(this._checkoutData.emrDrugSelection) === JSON.stringify(emrState.drugSelection) &&
                (this._checkoutData.couponCode ?? null) === (this._checkoutData.billingQuote.terms.coupon_code ?? null) &&
                this._checkoutData.billingQuote.expires_at > Date.now() / 1000;
            if (unchanged) {
                return;
            }
            this._checkoutData = {
                ...this._checkoutData,
                billingQuote: undefined,
                billingCheckoutUuid: undefined,
                billingTermsAccepted: false,
                billingOptionId: emrState.billingOptionId ?? undefined,
                stripePaymentIntentId: undefined,
            };
        }
        const discountAmount = this._checkoutData.discountAmount ?? this._checkoutData.appliedCoupon?.discount_amount;
        const hasCoupon = Boolean(this._checkoutData.appliedCoupon || this._checkoutData.couponCode);
        const subtotal = emrState.total;
        const total = hasCoupon && typeof discountAmount === 'number' ? Math.max(0, subtotal - discountAmount) : subtotal;

        this._checkoutData = {
            ...this._checkoutData,
            emrVariantId: emrState.variantId ?? undefined,
            emrDrugSelection: emrState.drugSelection,
            subtotal: hasCoupon ? subtotal : this._checkoutData.subtotal,
            discountAmount: hasCoupon ? discountAmount : this._checkoutData.discountAmount,
            finalTotal: hasCoupon ? total : this._checkoutData.finalTotal,
            total,
        };
    }

    private mergeCheckoutDraftData(data: Partial<Omit<EmrCheckoutData, 'timestamp'>>): void {
        const existing = this._checkoutData;
        const fallbackPatientInfo = existing?.patientInfo ?? { email: '', first_name: '', last_name: '', phone: '' };
        const fallbackAddress = existing?.address ?? createEmptyAddress();

        this._checkoutData = {
            ...existing,
            patientInfo: data.patientInfo ?? fallbackPatientInfo,
            address: data.address ?? fallbackAddress,
            useExistingAddress: data.useExistingAddress ?? existing?.useExistingAddress ?? false,
            selectedAddressId: data.selectedAddressId ?? existing?.selectedAddressId,
            stripePaymentMethodId: data.stripePaymentMethodId ?? existing?.stripePaymentMethodId,
            stripePaymentIntentId: Object.prototype.hasOwnProperty.call(data, 'stripePaymentIntentId')
                ? data.stripePaymentIntentId
                : existing?.stripePaymentIntentId,
            paymentMethod: data.paymentMethod ?? existing?.paymentMethod,
            couponCode: Object.prototype.hasOwnProperty.call(data, 'couponCode') ? data.couponCode : existing?.couponCode,
            appliedCoupon: Object.prototype.hasOwnProperty.call(data, 'appliedCoupon') ? data.appliedCoupon : existing?.appliedCoupon,
            subtotal: data.subtotal ?? existing?.subtotal,
            discountAmount: data.discountAmount ?? existing?.discountAmount,
            finalTotal: data.finalTotal ?? existing?.finalTotal,
            total: data.total ?? existing?.total,
            billingOptionId: Object.prototype.hasOwnProperty.call(data, 'billingOptionId') ? data.billingOptionId : existing?.billingOptionId,
            billingCheckoutUuid: Object.prototype.hasOwnProperty.call(data, 'billingCheckoutUuid')
                ? data.billingCheckoutUuid
                : existing?.billingCheckoutUuid,
            billingQuote: Object.prototype.hasOwnProperty.call(data, 'billingQuote') ? data.billingQuote : existing?.billingQuote,
            billingTermsAccepted: Object.prototype.hasOwnProperty.call(data, 'billingTermsAccepted')
                ? data.billingTermsAccepted
                : existing?.billingTermsAccepted,
            emrVariantId: data.emrVariantId ?? existing?.emrVariantId,
            emrDrugSelection: data.emrDrugSelection ?? existing?.emrDrugSelection,
            patientVitalId: data.patientVitalId ?? existing?.patientVitalId,
            timestamp: new Date().toISOString(),
        };

        this.persistTransientEnrollmentState();
    }

    // ------------------------------------------------------------------------
    // Provider-aware getters
    // ------------------------------------------------------------------------

    /**
     * Always true for this EMR-only session. Shared blocks may use this to select EMR behavior.
     * @group Session
     * @returns The typed result described above (boolean).
     * @example const value = utils.isEmr;
     */
    get isEmr(): boolean {
        return true;
    }

    /**
     * The assigned EMR treatment plan, including refill variants, drugs, phases, regions and commercial billing options.
     * @group Session
     * @returns The typed result described above (EmrTreatmentPlanType).
     * @example const value = utils.plan;
     */
    get plan(): EmrTreatmentPlanType {
        return this.emrEnrollment.plan;
    }

    /**
     * Get the analytics target for the current provider.
     * Uses the assigned EMR plan as the analytics target.
     */
    private get analyticsTarget(): AnalyticsTargetType | null {
        if (this.plan) {
            return { id: this.plan.id, name: this.plan.name };
        }

        return null;
    }

    /**
     * Replace or disable the analytics manager used by session events. Does not alter patient authentication or checkout
     * state.
     * @group Analytics
     * @param manager Analytics manager, or null to disable session event delivery.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setAnalyticsManager(manager);
     */
    setAnalyticsManager(manager: AnalyticsManager | null): void {
        this._analyticsManager = manager;
    }

    /**
     * Send an event enriched with current patient and original enrollment URL attribution. Resolves without sending
     * anything when analytics is disabled.
     * @group Analytics
     * @param eventType Canonical/custom event name understood by the analytics manager.
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example utils.track(eventType);
     */
    track(eventType: EcommerceEventType | string, data?: Record<string, unknown>): Promise<void> {
        if (!this._analyticsManager || !this.analyticsTarget) return Promise.resolve();
        return trackAnalyticsEvent(this._analyticsManager, eventType, this.analyticsTarget, data, this._patientInfo, this._analyticsUrlParams);
    }

    /**
     * Like {@link track} but fires the event at most once per session
     * (keyed by `eventType` plus an optional discriminator).
     */
    private trackOnce(eventType: EcommerceEventType | string, data?: Record<string, unknown>, key?: string): Promise<void> {
        const dedupeKey = key ? `${eventType}:${key}` : eventType;
        if (this._firedOnceEvents.has(dedupeKey)) return Promise.resolve();
        this._firedOnceEvents.add(dedupeKey);
        return this.track(eventType, data);
    }

    /**
     * Set the patient snapshot used for analytics enrichment, normalizing camelCase auth fields to snake_case. Does not
     * update the patient API.
     * @group Patient information
     * @param patient Patient snapshot returned by the authenticated patient API.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setPatientInfo(patient);
     */
    setPatientInfo(patient: PatientInfoType | PatientAuthDataType | null): void {
        if (!patient) {
            this._patientInfo = null;
            return;
        }
        const patientFields = patient as PatientInfoType & PatientAuthDataType;
        this._patientInfo = {
            id: patientFields.id ?? null,
            email: patientFields.email ?? '',
            first_name: patientFields.first_name ?? patientFields.firstName ?? '',
            last_name: patientFields.last_name ?? patientFields.lastName ?? '',
            phone: patientFields.phone ?? '',
        };
    }

    /**
     * Read the patient snapshot currently used for analytics enrichment, or null before identity/profile data is known.
     * @group Patient information
     * @returns The typed result described above (PatientInfoType | null).
     * @example utils.getPatientInfo();
     */
    getPatientInfo(): PatientInfoType | null {
        return this._patientInfo;
    }

    /**
     * Track user_landed once for this page session.
     * @group Analytics
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackUserLanded();
     */
    trackUserLanded(data?: Record<string, unknown>): void {
        this.trackOnce('user_landed', data);
    }

    /**
     * Track survey_start once for this page session.
     * @group Analytics
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackSurveyStart();
     */
    trackSurveyStart(data?: Record<string, unknown>): void {
        this.trackOnce('survey_start', data);
    }

    /**
     * Track survey_complete once with the sorted form list after successful enrollment.
     * @group Analytics
     * @param sortedForms Enrollment forms ordered by sort_order.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackSurveyComplete(sortedForms);
     */
    trackSurveyComplete(sortedForms: EnrollmentFormType[]): void {
        if (this._firedOnceEvents.has('survey_complete')) return;
        if (!this._analyticsManager || !this.analyticsTarget || !this.merchant) return;
        this._firedOnceEvents.add('survey_complete');
        const eventData = buildSurveyCompleteEventData(this.analyticsTarget, this.merchant, sortedForms);
        const enriched = enrichEventWithEnrollmentAttribution(eventData, this._patientInfo, this._analyticsUrlParams);
        this._analyticsManager.trackEvent(enriched);
    }

    /**
     * Send an abandon beacon for survey/checkout stage and return whether it was sent. After completion this is a no-op.
     * @group Analytics
     * @param context Current survey step/form and whether checkout is visible.
     * @param sortedForms Enrollment forms ordered by sort_order.
     * @param reason Abandon trigger: browser_close or tab_hidden.
     * @returns The typed result described above (boolean).
     * @example utils.trackSurveyAbandon(context, sortedForms);
     */
    trackSurveyAbandon(
        context: AbandonEventContextType,
        sortedForms: EnrollmentFormType[],
        reason: 'browser_close' | 'tab_hidden' = 'browser_close',
    ): boolean {
        if (this._enrollmentCompleted) return false;
        const eventData = this.buildAbandonEventData(context, sortedForms, reason);
        if (!eventData || !this._analyticsManager) return false;
        return this.sendEnrichedAbandonBeacon(eventData, this._patientInfo, this._analyticsManager);
    }

    /**
     * Track tab visibility loss for the current form/stage. No-op after completion.
     * @group Analytics
     * @param context Current survey step/form and whether checkout is visible.
     * @param sortedForms Enrollment forms ordered by sort_order.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackTabSwitch(context, sortedForms);
     */
    trackTabSwitch(context: AbandonEventContextType, sortedForms: EnrollmentFormType[]): void {
        if (this._enrollmentCompleted) return;
        const eventData = this.buildTabSwitchEventData(context, sortedForms, 'tab_switch');
        if (!eventData || !this._analyticsManager) return;
        const enriched = enrichEventWithEnrollmentAttribution(eventData, this._patientInfo, this._analyticsUrlParams);
        this._analyticsManager.trackEvent(enriched);
    }

    /**
     * Track resumed visibility after a tab switch with current form/stage metadata. No-op after completion.
     * @group Analytics
     * @param context Current survey step/form and whether checkout is visible.
     * @param sortedForms Enrollment forms ordered by sort_order.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackSurveyResume(context, sortedForms);
     */
    trackSurveyResume(context: AbandonEventContextType, sortedForms: EnrollmentFormType[]): void {
        if (this._enrollmentCompleted) return;
        const eventData = this.buildTabSwitchEventData(context, sortedForms, 'survey_resume');
        if (!eventData || !this._analyticsManager) return;
        const enriched = enrichEventWithEnrollmentAttribution(eventData, this._patientInfo, this._analyticsUrlParams);
        this._analyticsManager.trackEvent(enriched);
    }

    /**
     * Suppress further abandon/tab events for a completed enrollment. Successful submission calls this behavior
     * automatically.
     * @group Analytics
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.markEnrollmentCompleted();
     */
    markEnrollmentCompleted(): void {
        this._enrollmentCompleted = true;
    }

    /**
     * Check whether successful enrollment completion has been recorded for this session.
     * @group Analytics
     * @returns The typed result described above (boolean).
     * @example utils.isEnrollmentCompleted();
     */
    isEnrollmentCompleted(): boolean {
        return this._enrollmentCompleted;
    }

    /**
     * Sync analytics identity from patient data: updates the analytics user id,
     * pushes user properties (set_properties), and stores patient info for event enrichment.
     */
    private syncAnalyticsIdentity(patient: PatientAuthDataType | null | undefined): void {
        if (!patient) return;
        this.setPatientInfo(patient);
        const manager = this._analyticsManager;
        if (!manager) return;
        if (patient.id) {
            handlePatientAuthAnalytics(manager, patient.id, manager.getUserId() ?? null);
        }
        const properties: Record<string, unknown> = {};
        if (patient.id) properties.user_id = patient.id;
        if (patient.email) properties.email = patient.email;
        if (patient.phone) properties.phone = patient.phone;
        if (patient.firstName) properties.first_name = patient.firstName;
        if (patient.middleName) properties.middle_name = patient.middleName;
        if (patient.lastName) properties.last_name = patient.lastName;
        if (patient.dateOfBirth) properties.date_of_birth = patient.dateOfBirth;
        if (patient.gender) properties.gender = patient.gender;
        if (patient.genderBiological) properties.gender_biological = patient.genderBiological;
        if (patient.height) {
            properties.height = patient.height;
            this._bmiHeight = Number(patient.height);
        }
        if (patient.weight) {
            properties.weight = patient.weight;
            this._bmiWeight = Number(patient.weight);
        }
        if (Object.keys(properties).length > 0) {
            manager.setUserProperties(properties);
        }
    }

    /**
     * Fire profile field analytics: `field_complete` for the field, plus `bmi_set`
     * once both height and weight are known.
     */
    private trackPatientFieldAnalytics(fieldName: string, value: unknown): void {
        const present = value !== undefined && value !== null && value !== '';
        this.mergePatientInfoField(fieldName, value);
        const properties = this.buildPatientFieldProperties(fieldName, value);
        this.track('patient_field_updated', { field: fieldName, value_present: present, properties });
        if (fieldName === 'email' && present) {
            this.track('email_submitted', { email: value, properties });
        }
        if (present) {
            this.track('field_complete', { field: fieldName, value_present: true });
        }
        if (fieldName === 'height' && present) this._bmiHeight = Number(value);
        if (fieldName === 'weight' && present) this._bmiWeight = Number(value);
        if (this._bmiHeight && this._bmiWeight && this._bmiHeight > 0) {
            const bmi = Math.round(((703 * this._bmiWeight) / (this._bmiHeight * this._bmiHeight)) * 10) / 10;
            this.trackOnce('bmi_set', { bmi, height: this._bmiHeight, weight: this._bmiWeight }, `${this._bmiHeight}x${this._bmiWeight}`);
        }
    }

    private mergePatientInfoField(fieldName: string, value: unknown): void {
        const patientInfo = this._patientInfo ?? { id: null, email: '', first_name: '', last_name: '', phone: '' };

        if (fieldName === 'email') patientInfo.email = String(value ?? '');
        if (fieldName === 'firstName') patientInfo.first_name = String(value ?? '');
        if (fieldName === 'lastName') patientInfo.last_name = String(value ?? '');
        if (fieldName === 'phone') patientInfo.phone = String(value ?? '');

        this._patientInfo = patientInfo;
    }

    private buildPatientFieldProperties(fieldName: string, value: unknown): Record<string, unknown> {
        const properties: Record<string, unknown> = {};
        if (this._patientInfo?.id) properties.user_id = this._patientInfo.id;
        if (this._patientInfo?.email) properties.email = this._patientInfo.email;
        if (this._patientInfo?.first_name) properties.first_name = this._patientInfo.first_name;
        if (this._patientInfo?.last_name) properties.last_name = this._patientInfo.last_name;
        if (this._patientInfo?.phone) properties.phone = this._patientInfo.phone;

        const fieldMap: Record<string, string> = {
            dateOfBirth: 'date_of_birth',
            firstName: 'first_name',
            lastName: 'last_name',
            middleName: 'middle_name',
            genderBiological: 'gender_biological',
        };
        properties[fieldMap[fieldName] ?? fieldName] = value;

        return properties;
    }

    // ------------------------------------------------------------------------
    // EMR Variant methods
    // ------------------------------------------------------------------------

    /**
     * Return the plan default refill variant, or the first available variant, or null when none exist.
     * @group Refills and billing choices
     * @returns The typed result described above (EmrRefillVariantType | null).
     * @example utils.getDefaultVariant();
     */
    getDefaultVariant(): EmrRefillVariantType | null {
        return this.emrEnrollment?.getDefaultVariant() ?? null;
    }

    /**
     * Resolve a refill variant by its key. With no key, return the current selection or the plan default.
     * @group Refills and billing choices
     * @param variantId Refill variant key from plan.refill_variants, not a legacy treatment variation ID.
     * @returns The typed result described above (EmrRefillVariantType | null).
     * @example utils.getSelectedVariant();
     */
    getSelectedVariant(variantId?: string): EmrRefillVariantType | null {
        return this.emrEnrollment.getSelectedVariant(variantId ?? this.getSelectedEmrVariantId() ?? undefined);
    }

    /**
     * Return ordinary per-refill and active prepaid commercial purchase choices. With no variant key, return choices
     * for every enrollment-enabled variant; use this list to build the complete plan selector rather than getVariants().
     * Prepaid choices come from plan.billing_options supplied by the server. They require saved active offers,
     * prepaid sales enabled and the merchant's prepaid entitlement; this method does not create or fetch missing offers.
     * Display prices are dollars; authoritative prepaid amounts require quoteBillingOption.
     * @group Refills and billing choices
     * @param variantId Refill variant key from plan.refill_variants, not a legacy treatment variation ID.
     * @returns The typed result described above.
     * @example utils.getEmrBillingChoices();
     */
    getEmrBillingChoices(variantId?: string) {
        return this.emrEnrollment?.getBillingChoices(variantId) ?? [];
    }

    /**
     * Return active refill variants available for this plan.
     * @group Refills and billing choices
     * @returns The typed result described above (EmrRefillVariantType[]).
     * @example utils.getVariants();
     */
    getVariants(): EmrRefillVariantType[] {
        return this.emrEnrollment?.getVariants() ?? [];
    }

    /**
     * Read the variant display price in dollars. Does not include optional drugs or commercial prepaid discounts.
     * @group Refills and billing choices
     * @param variant Refill variant returned by getVariants().
     * @returns The typed result described above (number).
     * @example utils.getVariantPrice(variant);
     */
    getVariantPrice(variant: EmrRefillVariantType): number {
        return this.emrEnrollment?.getVariantPrice(variant) ?? 0;
    }

    /**
     * Format the refill cadence/variant label for patient-facing display.
     * @group Refills and billing choices
     * @param variant Refill variant returned by getVariants().
     * @returns The typed result described above (string).
     * @example utils.getVariantLabel(variant);
     */
    getVariantLabel(variant: EmrRefillVariantType): string {
        return this.emrEnrollment?.getVariantLabel(variant) ?? '';
    }

    // ------------------------------------------------------------------------
    // EMR Drug methods
    // ------------------------------------------------------------------------

    /**
     * Build independent clinical answer objects from this session's live enrollment form context. Automatically
     * includes completed forms and the active form's latest values. Uses scoped UniEMR form/template UUIDs; absent
     * metadata lets the wrapper map local IDs. Excludes local-only onboarding/checkout forms and generated medication
     * selection fields (including custom field names) to prevent recommendation feedback loops. Repeated plan forms
     * remain separate entries. No context or no supplied clinical answers returns an empty list.
     * @group Preferred drugs from intake
     * @returns Independent form response objects. Reads current context without mutating answers or session state.
     * @example const responses = utils.buildPreferredDrugFormResponses();
     */
    buildPreferredDrugFormResponses(): EmrPreferredDrugFormResponse[] {
        const context = this._getFormContext?.();
        if (!context) return [];
        return context.forms
            .filter((form) => context.answers[form.id] !== undefined && !(form.treatment_plan_form_id === null && form.form_template_id == null))
            .map((form) => {
                const selectionFields = new Set(['selectedVariation']);
                const visit = (node: unknown): void => {
                    if (!node || typeof node !== 'object') return;
                    const item = node as unknown as Record<string, unknown>;
                    if (item.type === 'variant-selection' && typeof item.fieldName === 'string') selectionFields.add(item.fieldName);
                    Object.values(item).forEach(visit);
                };
                visit(typeof form.form_json === 'string' ? JSON.parse(form.form_json) : form.form_json);
                return {
                    ...(form.treatment_plan_form_id
                        ? { treatment_plan_form_id: form.treatment_plan_form_id }
                        : form.form_template_id
                          ? {}
                          : { intake_form_id: form.id }),
                    ...(form.form_template_id ? { form_template_id: form.form_template_id } : {}),
                    form_data: Object.fromEntries(Object.entries(context.answers[form.id]).filter(([key]) => !selectionFields.has(key))),
                };
            });
    }

    private preferredDrugContextKey(): string {
        return JSON.stringify({ currentFormId: this._getFormContext?.()?.currentFormId ?? null, responses: this.buildPreferredDrugFormResponses() });
    }

    /**
     * Resolve live UniEMR intake rules using this session's current forms/answers, assigned EMR plan and selected refill
     * variant. Evaluates enrollment cycle 1; a history-based preference may resolve a later titration phase. Automatically
     * cancels the previous request and remembers only the latest successful result for applyPreferredDrugResolution().
     * No clinical answers returns an empty result without a request. No enrollment, encounter, prescription or selection
     * is created. Independent answer sets are never merged; empty drug lists mean no matching preference. UniEMR
     * credentials stay on the server and require treatment-plans.resolve-drugs. Check resolution_source for configured
     * history-based fallbacks. Local mapping uses remote catalog/plan UUIDs, never names or prices.
     * @group Preferred drugs from intake
     * @returns Independent form_results and unambiguous local selections. HTTP errors throw an Error with status/errors;
     * 429 includes retryAfter. Superseded/disposed requests may reject with AbortError. Does not mutate drug choices.
     * @example const preferred = await utils.resolvePreferredDrugs();
     */
    async resolvePreferredDrugs(): Promise<EmrPreferredDrugResolution> {
        this._preferredDrugController?.abort();
        const controller = new AbortController();
        this._preferredDrugController = controller;
        this._preferredDrugResolution = null;
        const signal = controller.signal;
        const version = ++this._preferredDrugVersion;
        const variant = this.getSelectedEmrVariantId();
        const choices = JSON.stringify(this.getAllDrugChoices());
        const contextKey = this.preferredDrugContextKey();
        const formResponses = this.buildPreferredDrugFormResponses();
        if (!formResponses.length) return { clinical_cycle_from: 1, clinical_cycle_to: 1, form_results: [], selections: [] };
        const payload = {
            ab_plan_id: this.plan.id,
            form_responses: formResponses,
            clinical_cycle_from: 1,
            clinical_cycle_to: 1,
            ...(variant ? { refill_variant_id: variant } : {}),
        };
        const response = await enrollmentFetch(`/emr/enroll/${encodeURIComponent(this.slug)}/preferred-drugs`, {
            method: 'POST',
            credentials: 'same-origin',
            signal,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
            throw Object.assign(new Error(data.message ?? 'Unable to resolve preferred medications.'), {
                status: response.status,
                errors: data.errors ?? {},
                retryAfter: response.headers?.get('Retry-After') ?? null,
            });
        }
        if (!Array.isArray(data.form_results) || data.form_results.length !== formResponses.length) {
            throw new Error('Medication recommendation response is incomplete.');
        }
        const resolution: EmrPreferredDrugResolution = {
            ...data,
            selections: data.form_results.flatMap((result: EmrPreferredDrugResolution['form_results'][number]) =>
                result.preferred_drugs.flatMap((drug) => this.mapPreferredDrug(drug, result.response_index)),
            ),
        };
        this._preferredDrugRequests.set(resolution, {
            key: JSON.stringify(payload),
            version,
            variant: payload.refill_variant_id ?? null,
            choices,
            signal,
            contextKey,
        });
        if (version === this._preferredDrugVersion && !signal.aborted) this._preferredDrugResolution = resolution;
        return resolution;
    }

    /**
     * Apply unambiguous mapped recommendations using the existing selection/persistence/pricing methods. Conflicting
     * drugs in a single-select group, or different phases for the same drug (including multi-cycle bundles), are skipped.
     * Unmatched results preserve current choices. Only a result from this session's latest request/current variant can
     * apply. Aborted requests and changed drug choices are skipped. Identical inputs apply once per session so revisiting
     * a block preserves the patient's later manual choices. Reads the latest successful resolution internally; changed
     * clinical answers or active forms invalidate it. Calling before resolution or after failure safely returns an empty list.
     * @group Preferred drugs from intake
     * @returns The local selections actually applied. Empty means stale, already applied, unavailable or conflicting.
     * @example await utils.resolvePreferredDrugs(); const selected = utils.applyPreferredDrugResolution();
     */
    applyPreferredDrugResolution(): EmrPreferredDrugSelection[] {
        const resolution = this._preferredDrugResolution;
        if (!resolution) return [];
        const request = this._preferredDrugRequests.get(resolution);
        if (
            !request ||
            request.version !== this._preferredDrugVersion ||
            request.variant !== this.getSelectedEmrVariantId() ||
            request.signal.aborted ||
            request.contextKey !== this.preferredDrugContextKey() ||
            request.choices !== JSON.stringify(this.getAllDrugChoices()) ||
            request.key === this._lastAppliedPreferredDrugKey
        )
            return [];
        this._lastAppliedPreferredDrugKey = request.key;
        const candidates = [
            ...new Map(
                resolution.selections.map((selection) => [
                    `${selection.kind}:${selection.groupId}:${selection.drugId}:${selection.phaseId}`,
                    selection,
                ]),
            ).values(),
        ];
        const applied = candidates.filter((selection) => {
            if (candidates.some((other) => other.drugId === selection.drugId && other.phaseId !== selection.phaseId)) return false;
            const group = this.getDrugGroups().find((item) => item.id === selection.groupId);
            return (
                !group ||
                group.selection_type === 'multi' ||
                !candidates.some((other) => other.groupId === group.id && other.drugId !== selection.drugId)
            );
        });
        const groups = new Map<number, number[]>();
        for (const selection of applied) {
            if (selection.groupId !== null) {
                groups.set(selection.groupId, [...(groups.get(selection.groupId) ?? []), selection.drugId]);
            }
        }
        for (const [groupId, drugIds] of groups) {
            const group = this.getDrugGroups().find((item) => item.id === groupId);
            this.setDrugGroupSelection(
                groupId,
                group?.selection_type === 'multi' ? [...new Set([...this.getDrugGroupSelection(groupId), ...drugIds])] : drugIds,
            );
        }
        for (const selection of applied) {
            if (selection.kind === 'group' && selection.groupId !== null) {
                this.setGroupDrugPhase(selection.groupId, selection.drugId, selection.phaseId);
            } else if (selection.kind === 'optional') {
                if (!this.isOptionalDrugSelected(selection.drugId)) this.toggleOptionalDrug(selection.drugId);
                this.setOptionalDrugPhase(selection.drugId, selection.phaseId);
            } else {
                this.setStandaloneDrugPhase(selection.drugId, selection.phaseId);
            }
        }
        return applied;
    }

    private mapPreferredDrug(preferred: EmrPreferredDrug, responseIndex: number): EmrPreferredDrugSelection[] {
        if (!preferred.merchant_drug_id) return [];
        const candidates = [
            ...this.getStandaloneDrugs().map((drug) => ({ drug, groupId: null, remoteGroupId: null, kind: 'standalone' as const })),
            ...this.getOptionalDrugs().map((drug) => ({ drug, groupId: null, remoteGroupId: null, kind: 'optional' as const })),
            ...this.getDrugGroups().flatMap((group) =>
                group.drugs.map((drug) => ({ drug, groupId: group.id, remoteGroupId: group.uniemr_drug_group_id, kind: 'group' as const })),
            ),
        ].filter(
            ({ drug, remoteGroupId }) =>
                drug.is_active !== false &&
                (!preferred.drug_group_id || preferred.drug_group_id === remoteGroupId) &&
                (!preferred.treatment_plan_drug_id || drug.uniemr_drug_id === preferred.treatment_plan_drug_id),
        );
        const matches: EmrPreferredDrugSelection[] = [];
        for (const { drug, groupId, kind } of candidates) {
            const phases = (drug.phases ?? []).filter((phase) => phase.is_active !== false && phase.merchant_drug_id === preferred.merchant_drug_id);
            const cycle = preferred.resolved_clinical_cycle ?? preferred.clinical_cycle_number;
            const cyclePhases = phases.filter((phase) => phase.phase_from <= cycle && (phase.phase_to == null || phase.phase_to >= cycle));
            const phase = phases.length === 1 ? phases[0] : cyclePhases.length === 1 ? cyclePhases[0] : null;
            if (phases.length > 0 && !phase) continue;
            if (!phase && drug.uniemr_merchant_drug_id !== preferred.merchant_drug_id) continue;
            matches.push({
                responseIndex,
                drugId: drug.id,
                groupId,
                kind,
                phaseId: phase?.id ?? null,
                drugName: phase?.local_merchant_drug?.display_name || phase?.drug_name || drug.drug_name,
                phaseLabel: phase
                    ? `Cycle ${phase.phase_from}${phase.phase_to ? `–${phase.phase_to}` : '+'}${phase.strength ? ` · ${phase.strength}` : ''}`
                    : null,
                clinicalCycle: preferred.clinical_cycle_number,
                resolutionSource: preferred.resolution_source,
            });
        }
        return matches.length === 1 ? matches : [];
    }

    /**
     * Return mandatory standalone drugs configured on the EMR plan.
     * @group Drugs and titration
     * @returns The typed result described above (EmrTreatmentPlanDrugType[]).
     * @example utils.getStandaloneDrugs();
     */
    getStandaloneDrugs(): EmrTreatmentPlanDrugType[] {
        return this.emrEnrollment?.getStandaloneDrugs() ?? [];
    }

    /**
     * Return optional add-on drugs configured on the plan.
     * @group Drugs and titration
     * @returns The typed result described above (EmrTreatmentPlanDrugType[]).
     * @example utils.getOptionalDrugs();
     */
    getOptionalDrugs(): EmrTreatmentPlanDrugType[] {
        return this.emrEnrollment?.getOptionalDrugs() ?? [];
    }

    /**
     * Return plan drug groups with their single/multi-selection rules and member drugs.
     * @group Drugs and titration
     * @returns The typed result described above (EmrTreatmentPlanDrugGroupType[]).
     * @example utils.getDrugGroups();
     */
    getDrugGroups(): EmrTreatmentPlanDrugGroupType[] {
        return this.emrEnrollment?.getDrugGroups() ?? [];
    }

    /**
     * Read a drug display price in dollars before commercial quoting.
     * @group Drugs and titration
     * @param drug Plan drug returned by a plan drug getter.
     * @returns The typed result described above (number).
     * @example utils.getDrugPrice(drug);
     */
    getDrugPrice(drug: EmrTreatmentPlanDrugType): number {
        return this.emrEnrollment?.getDrugPrice(drug) ?? 0;
    }

    /**
     * Read the configured group add-on price in dollars for the drug and selected titration phase. Null phase means the
     * base drug.
     * @group Drugs and titration
     * @param drug Plan drug returned by a plan drug getter.
     * @param selectedPhaseId Titration phase key, or null for the base drug.
     * @returns The typed result described above (number).
     * @example utils.getDrugAddOnPrice(drug, selectedPhaseId);
     */
    getDrugAddOnPrice(drug: EmrTreatmentPlanDrugType, selectedPhaseId: string | null): number {
        return this.emrEnrollment?.getDrugAddOnPrice(drug, selectedPhaseId) ?? 0;
    }

    /**
     * Return the default drug for a group, or null when no default is configured.
     * @group Drugs and titration
     * @param group Plan drug group returned by getDrugGroups().
     * @returns The typed result described above (EmrTreatmentPlanDrugType | null).
     * @example utils.getGroupDefaultDrug(group);
     */
    getGroupDefaultDrug(group: EmrTreatmentPlanDrugGroupType): EmrTreatmentPlanDrugType | null {
        return this.emrEnrollment?.getGroupDefaultDrug(group) ?? null;
    }

    // ------------------------------------------------------------------------
    // EMR Selection state
    // ------------------------------------------------------------------------

    /**
     * Select a commercial billing option ID, or null for ordinary per-refill billing. Persist the selection and
     * invalidate incompatible accepted quotes and payment authorization.
     * @group Refills and billing choices
     * @param id Commercial billing option ID; null means ordinary per-refill billing.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setSelectedEmrBillingOptionId(null);
     */
    setSelectedEmrBillingOptionId(id: number | null): void {
        this.emrEnrollment?.setBillingOptionId(id);
        this.persistTransientEnrollmentState();
    }

    /**
     * Read the selected commercial billing option ID, or null for ordinary per-refill billing.
     * @group Refills and billing choices
     * @returns The typed result described above (number | null).
     * @example utils.getSelectedEmrBillingOptionId();
     */
    getSelectedEmrBillingOptionId(): number | null {
        return this.emrEnrollment?.getBillingOptionId() ?? null;
    }

    /**
     * Select a refill variant by key. Persist clinical selections, refresh checkout totals, invalidate incompatible
     * quotes and fire the variant selection event.
     * @group Refills and billing choices
     * @param variantId Refill variant key from plan.refill_variants, not a legacy treatment variation ID.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setSelectedEmrVariantId(utils.getDefaultVariant()?.id ?? null);
     */
    setSelectedEmrVariantId(variantId: string | null): void {
        this.emrEnrollment?.setSelectedVariantId(variantId);
        this.persistTransientEnrollmentState();
        if (variantId) {
            const variant = this.getSelectedVariant(variantId);
            this.track('emr_variant_selected', {
                variant_id: variantId,
                variant_name: variant?.name,
                variant_price: variant ? this.getVariantPrice(variant) : undefined,
            });
        }
    }

    /**
     * Read the current refill variant key, or null when no variant is selected.
     * @group Refills and billing choices
     * @returns The typed result described above (string | null).
     * @example utils.getSelectedEmrVariantId();
     */
    getSelectedEmrVariantId(): string | null {
        return this.emrEnrollment?.getSelectedVariantId() ?? null;
    }

    /**
     * Set selected plan-drug IDs for a group. Persist choices, refresh checkout totals and record selection events.
     * @group Drugs and titration
     * @param groupId Drug group ID from getDrugGroups().
     * @param drugIds Selected plan-drug IDs within this group.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setDrugGroupSelection(groupId, drugIds);
     */
    setDrugGroupSelection(groupId: number, drugIds: number[]): void {
        this.emrEnrollment?.setDrugGroupSelection(groupId, drugIds);
        this.persistTransientEnrollmentState();
        const group = this.getDrugGroups().find((g) => g.id === groupId);
        drugIds.forEach((drugId) => {
            const drug = group?.drugs.find((d) => d.id === drugId);
            this.track('emr_drug_selected', {
                drug_id: drugId,
                drug_name: drug?.drug_name,
                is_selected: true,
                drug_type: 'group',
            });
        });
    }

    /**
     * Read the selected plan-drug IDs for the specified group.
     * @group Drugs and titration
     * @param groupId Drug group ID from getDrugGroups().
     * @returns The typed result described above (number[]).
     * @example utils.getDrugGroupSelection(groupId);
     */
    getDrugGroupSelection(groupId: number): number[] {
        return this.emrEnrollment?.getDrugGroupSelection(groupId) ?? [];
    }

    /**
     * Toggle an optional plan-drug ID and persist the changed selection, total and analytics event.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.toggleOptionalDrug(drugId);
     */
    toggleOptionalDrug(drugId: number): void {
        this.emrEnrollment?.toggleOptionalDrug(drugId);
        this.persistTransientEnrollmentState();
        const isSelected = this.isOptionalDrugSelected(drugId);
        const drug = this.getOptionalDrugs().find((d) => d.id === drugId);
        this.track('emr_drug_selected', {
            drug_id: drugId,
            drug_name: drug?.drug_name,
            is_selected: isSelected,
            drug_type: 'optional',
        });
    }

    /**
     * Check whether an optional plan-drug ID is selected.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @returns The typed result described above (boolean).
     * @example utils.isOptionalDrugSelected(drugId);
     */
    isOptionalDrugSelected(drugId: number): boolean {
        return this.emrEnrollment?.isOptionalDrugSelected(drugId) ?? false;
    }

    /**
     * Read a fresh selection snapshot containing variant, billing option, selected drugs/phases and display totals in
     * dollars. Changes invalidate incompatible quotes when checkout is read or persisted.
     * @group Drugs and titration
     * @returns The typed result described above (EmrCheckoutSelectionStateType).
     * @example utils.getEmrCheckoutSelectionState();
     */
    getEmrCheckoutSelectionState(): EmrCheckoutSelectionStateType {
        return this.emrEnrollment.getEmrCheckoutSelectionState();
    }

    /**
     * Resolve selected plan drugs and titration phases to local merchant-drug IDs for coupon eligibility. Deduplicates
     * IDs; these differ from plan-drug IDs.
     * @group Drugs and titration
     * @returns The typed result described above (number[]).
     * @example utils.getSelectedEmrMerchantDrugIds();
     */
    getSelectedEmrMerchantDrugIds(): number[] {
        const state = this.getEmrCheckoutSelectionState();
        if (!state) return [];

        const ids = new Set<number>();
        const selectedPhaseByDrug = new Map<number, string | null>();

        Object.entries(state.drugSelection.standaloneDrugPhases).forEach(([drugId, phaseId]) => {
            selectedPhaseByDrug.set(Number(drugId), phaseId);
        });
        Object.entries(state.drugSelection.optionalDrugPhases).forEach(([drugId, phaseId]) => {
            selectedPhaseByDrug.set(Number(drugId), phaseId);
        });
        Object.values(state.drugSelection.groupSelections).forEach((selection) => {
            Object.entries(selection.selectedPhases).forEach(([drugId, phaseId]) => {
                selectedPhaseByDrug.set(Number(drugId), phaseId);
            });
        });

        state.selectedDrugs.forEach((drug) => {
            const phaseId = selectedPhaseByDrug.get(drug.id);
            const phase = phaseId ? drug.phases?.find((candidate) => candidate.id === phaseId) : null;
            const phaseMerchantDrugId = phase?.local_merchant_drug?.id;

            if (phaseMerchantDrugId) {
                ids.add(Number(phaseMerchantDrugId));
                return;
            }

            if (!phaseId && drug.merchant_drug?.id) {
                ids.add(drug.merchant_drug.id);
            }
        });

        return [...ids];
    }

    // ------------------------------------------------------------------------
    // EMR Phase Selection
    // ------------------------------------------------------------------------

    /**
     * Select a phase for a standalone plan drug, or null for the base drug. Persist the phase and invalidate incompatible
     * checkout quotes.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @param phaseId Titration phase key on the plan drug; null uses the base drug.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setStandaloneDrugPhase(drugId, phaseId);
     */
    setStandaloneDrugPhase(drugId: number, phaseId: string | null): void {
        this.emrEnrollment?.setStandaloneDrugPhase(drugId, phaseId);
        this.persistTransientEnrollmentState();
        const drug = this.getStandaloneDrugs().find((d) => d.id === drugId);
        const phase = phaseId ? drug?.phases?.find((p) => p.id === phaseId) : null;
        this.track('emr_drug_phase_selected', {
            drug_id: drugId,
            drug_name: phase?.drug_name || drug?.drug_name,
            phase_id: phaseId,
            phase_strength: phase?.strength,
            phase_dosage: phase?.dosage,
            phase_range: phase ? `${phase.phase_from}${phase.phase_to ? `-${phase.phase_to}` : '+'}` : null,
        });
    }

    /**
     * Read the selected phase key for a standalone plan drug, or null for its base drug.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @returns The typed result described above (string | null).
     * @example utils.getStandaloneDrugPhase(drugId);
     */
    getStandaloneDrugPhase(drugId: number): string | null {
        return this.emrEnrollment?.getStandaloneDrugPhase(drugId) ?? null;
    }

    /**
     * Select a phase for an optional plan drug, or null for its base drug. Persist the phase and refresh checkout totals.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @param phaseId Titration phase key on the plan drug; null uses the base drug.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setOptionalDrugPhase(drugId, phaseId);
     */
    setOptionalDrugPhase(drugId: number, phaseId: string | null): void {
        this.emrEnrollment?.setOptionalDrugPhase(drugId, phaseId);
        this.persistTransientEnrollmentState();
        const drug = this.getOptionalDrugs().find((d) => d.id === drugId);
        const phase = phaseId ? drug?.phases?.find((p) => p.id === phaseId) : null;
        this.track('emr_drug_phase_selected', {
            drug_id: drugId,
            drug_name: phase?.drug_name || drug?.drug_name,
            phase_id: phaseId,
            phase_strength: phase?.strength,
            phase_dosage: phase?.dosage,
            phase_range: phase ? `${phase.phase_from}${phase.phase_to ? `-${phase.phase_to}` : '+'}` : null,
        });
    }

    /**
     * Read the selected phase key for an optional plan drug.
     * @group Drugs and titration
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @returns The typed result described above (string | null).
     * @example utils.getOptionalDrugPhase(drugId);
     */
    getOptionalDrugPhase(drugId: number): string | null {
        return this.emrEnrollment?.getOptionalDrugPhase(drugId) ?? null;
    }

    /**
     * Select a titration phase for a selected drug within a group. Persist phase choices and refresh checkout totals.
     * @group Drugs and titration
     * @param groupId Drug group ID from getDrugGroups().
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @param phaseId Titration phase key on the plan drug; null uses the base drug.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setGroupDrugPhase(groupId, drugId, phaseId);
     */
    setGroupDrugPhase(groupId: number, drugId: number, phaseId: string | null): void {
        this.emrEnrollment?.setGroupDrugPhase(groupId, drugId, phaseId);
        this.persistTransientEnrollmentState();
        const group = this.getDrugGroups().find((g) => g.id === groupId);
        const drug = group?.drugs.find((d) => d.id === drugId);
        const phase = phaseId ? drug?.phases?.find((p) => p.id === phaseId) : null;
        this.track('emr_drug_phase_selected', {
            drug_id: drugId,
            drug_name: phase?.drug_name || drug?.drug_name,
            phase_id: phaseId,
            phase_strength: phase?.strength,
            phase_dosage: phase?.dosage,
            phase_range: phase ? `${phase.phase_from}${phase.phase_to ? `-${phase.phase_to}` : '+'}` : null,
        });
    }

    /**
     * Read the selected titration phase key for a plan drug within a group.
     * @group Drugs and titration
     * @param groupId Drug group ID from getDrugGroups().
     * @param drugId Plan-drug ID; use getSelectedEmrMerchantDrugIds for merchant-drug IDs.
     * @returns The typed result described above (string | null).
     * @example utils.getGroupDrugPhase(groupId, drugId);
     */
    getGroupDrugPhase(groupId: number, drugId: number): string | null {
        return this.emrEnrollment?.getGroupDrugPhase(groupId, drugId) ?? null;
    }

    /**
     * Return selected plan-drug IDs paired with their phase keys across standalone, group and optional drugs.
     * @group Drugs and titration
     * @returns The typed result described above (Array<{ drugId: number; phaseId: string | null }>).
     * @example utils.getAllDrugChoices();
     */
    getAllDrugChoices(): Array<{ drugId: number; phaseId: string | null }> {
        return this.emrEnrollment?.getAllDrugChoices() ?? [];
    }

    // ------------------------------------------------------------------------
    // EMR Pricing
    // ------------------------------------------------------------------------

    /**
     * Read the current complete display subtotal in dollars, including selected phases, group add-ons and optional drugs.
     * Excludes coupons and authoritative commercial quote pricing.
     * @group Drugs and titration
     * @returns The typed result described above (number).
     * @example utils.calculateEmrTotal();
     */
    calculateEmrTotal(): number {
        return this.emrEnrollment.getEmrCheckoutSelectionState().total;
    }

    /**
     * Calculate variant-based display pricing in dollars, including selected optional/group/phase add-ons. Commercial
     * prepaid prices must come from the server quote.
     * @group Drugs and titration
     * @returns The typed result described above (number).
     * @example utils.calculateEmrVariantTotal();
     */
    calculateEmrVariantTotal(): number {
        return this.emrEnrollment?.calculateEmrVariantTotal() ?? 0;
    }

    // ------------------------------------------------------------------------
    // EMR Submission
    // ------------------------------------------------------------------------

    /**
     * Flush queued vitals, then submit intake form answers/files and checkout to the EMR enrollment endpoint. Requires
     * verified authentication. Successful submissions track completion and redirect to redirect_url; failed results
     * contain errors for display.
     * @group Address and checkout
     * @param formResponses Answers keyed by intake form ID; file arrays are uploaded with the submission.
     * @param checkoutData Checkout draft; defaults to the current session draft when omitted.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const result = await utils.submitEmrEnrollment(formResponses);
     */
    async submitEmrEnrollment(
        formResponses: Record<number, Record<string, unknown>>,
        checkoutData: CheckoutDataType | null = this.getCheckoutData(),
    ): Promise<EnrollmentSubmissionResult> {
        if (!this._tokenValidated) return { success: false, errors: { auth: 'Verify your patient session before submitting.' } };
        const vitals = await this.flushPendingVitals();
        if (!vitals.success) return { success: false, errors: { vitals: vitals.error ?? 'Unable to save patient vitals.' } };
        const result = await this.emrEnrollment.submitEmrEnrollment(
            formResponses,
            checkoutData
                ? {
                      ...checkoutData,
                      patientVitalId: this.getVitalId() ?? undefined,
                      chargeMode: checkoutData.chargeMode ?? this.getChargeMode(),
                  }
                : null,
        );
        if (result.success) {
            await this.trackEnrollmentCompletionEvents('emr_enrollment_created', undefined, result.enrollment);
            if (result.redirect_url && typeof window !== 'undefined') window.location.href = result.redirect_url;
        }
        return result;
    }

    // ------------------------------------------------------------------------
    // EMR State Availability
    // ------------------------------------------------------------------------

    /**
     * Return state codes allowed by the assigned EMR plan for the specified country, defaulting to US.
     * @group Address and checkout
     * @param country ISO country code, default US.
     * @returns The typed result described above (string[]).
     * @example utils.getEmrPlanAvailableStates();
     */
    getEmrPlanAvailableStates(country: string = 'US'): string[] {
        if (!this.emrEnrollment?.plan) return [];
        return getEmrPlanAvailableStates(this.emrEnrollment.plan, country);
    }

    /**
     * Check whether a state is allowed by the assigned EMR plan for the specified country.
     * @group Address and checkout
     * @param state State abbreviation used by plan region rules.
     * @param country ISO country code, default US.
     * @returns The typed result described above (boolean).
     * @example utils.isStateAvailableForEmrPlan(state);
     */
    isStateAvailableForEmrPlan(state: string, country: string = 'US'): boolean {
        if (!this.emrEnrollment?.plan) return false;
        return isStateAvailableForEmrPlan(state, this.emrEnrollment.plan, country);
    }

    /**
     * Validate shipping state/country against the assigned EMR plan. Returns valid plus an optional patient-facing error.
     * @group Address and checkout
     * @param address Shipping address with line1, city, state, zip and country; saved addresses include id.
     * @returns The typed result described above ({ valid: boolean; error?: string }).
     * @example utils.validateAddressStateForEmrPlan(address);
     */
    validateAddressStateForEmrPlan(address: AddressType): { valid: boolean; error?: string } {
        if (!this.emrEnrollment?.plan) return { valid: false, error: 'No EMR plan loaded' };
        return validateAddressStateForEmrPlan(address, this.emrEnrollment.plan);
    }

    // ------------------------------------------------------------------------
    // Provider-aware storage key
    // ------------------------------------------------------------------------

    /**
     * Compatibility alias of the EMR draft storage key.
     * @group Session
     * @returns The typed result described above (string | null).
     * @example const value = utils.emrStorageKey;
     */
    get emrStorageKey(): string | null {
        return this.emrEnrollment?.storageKey ?? null;
    }

    /**
     * Merchant configuration used to scope Stripe requests and attribution.
     * @group Session
     * @returns The typed result described above (MerchantType).
     * @example const value = utils.merchant;
     */
    get merchant(): MerchantType {
        return this.emrEnrollment.merchant;
    }

    /**
     * Read the ordinary EMR checkout mode: save_only uses a SetupIntent; save_and_authorize creates a manual-capture
     * hold. Commercial quote terms can override this mode.
     * @group Stripe and payments
     * @returns The typed result described above ('save_only' | 'save_and_authorize').
     * @example utils.getChargeMode();
     */
    getChargeMode(): 'save_only' | 'save_and_authorize' {
        return this._chargeMode;
    }

    /**
     * Public enrollment link slug used for quote and enrollment requests.
     * @group Session
     * @returns The typed result described above (string).
     * @example const value = utils.slug;
     */
    get slug(): string {
        return this.emrEnrollment.slug;
    }

    /**
     * Persisted draft namespace derived from the public enrollment slug and assigned plan ID.
     * @group Session
     * @returns The typed result described above (string).
     * @example const value = utils.storageKey;
     */
    get storageKey(): string {
        return this.emrEnrollment.storageKey;
    }

    // ------------------------------------------------------------------------
    // Patient data functions
    // ------------------------------------------------------------------------

    /**
     * Fetch the authenticated patient profile. Returns null on a failed request; the supplied token must belong to the
     * current patient.
     * @group Patient information
     * @param authToken Verified patient bearer token for the current session.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example utils.fetchPatientInfo(authToken);
     */
    fetchPatientInfo(authToken: string): Promise<PatientInfoType | null> {
        return fetchPatientInfo(authToken);
    }

    /**
     * Fetch saved addresses for the authenticated patient. If checkout has no usable address, persist the first returned
     * address as the default shipping choice.
     * @group Patient information
     * @param authToken Verified patient bearer token for the current session.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.fetchPatientAddresses(authToken);
     */
    async fetchPatientAddresses(authToken: string): Promise<AddressType[]> {
        const addresses = await fetchPatientAddresses(authToken);
        const existingAddress = this.getCheckoutAddress();
        const hasUsableAddress = existingAddress?.useExistingAddress
            ? Boolean(existingAddress.selectedAddressId)
            : Boolean(
                  existingAddress?.address?.line1 && existingAddress.address.city && existingAddress.address.state && existingAddress.address.zip,
              );

        if (!hasUsableAddress && addresses.length > 0) {
            const defaultAddress = addresses.find((address) => Boolean((address as unknown as unknown as Record<string, unknown>).is_default)) ?? addresses[0];

            this.mergeCheckoutDraftData({
                address: defaultAddress,
                useExistingAddress: true,
                selectedAddressId: defaultAddress.id !== undefined ? String(defaultAddress.id) : undefined,
            });
        }

        return addresses;
    }

    /**
     * Extract patient contact/name fields from survey answer objects. Accepts the existing nested auth and information
     * block formats.
     * @group Patient information
     * @param formResponses Answers keyed by intake form ID; file arrays are uploaded with the submission.
     * @returns The typed result described above (PatientInfoType).
     * @example utils.extractPatientInfo(formResponses);
     */
    extractPatientInfo(formResponses: Record<number, Record<string, unknown>>): PatientInfoType {
        return extractPatientInfo(formResponses);
    }

    // ------------------------------------------------------------------------
    // Checkout validation / address helpers
    // ------------------------------------------------------------------------

    /**
     * Check basic email syntax for checkout contact information. Returns a boolean without contacting the server.
     * @group Patient information
     * @param email Patient email used for coupon eligibility and validation.
     * @returns The typed result described above (boolean).
     * @example utils.isValidEmail(email);
     */
    isValidEmail(email: string): boolean {
        return isValidEmail(email);
    }

    /**
     * Validate required checkout name/email fields locally and return a field-error map.
     * @group Address and checkout
     * @param patientInfo Checkout contact fields using first_name, last_name, email and phone.
     * @returns The typed result described above (CheckoutValidationErrors).
     * @example utils.validatePatientInfo(patientInfo);
     */
    validatePatientInfo(patientInfo: CheckoutPatientInfoType): CheckoutValidationErrors {
        return validatePatientInfo(patientInfo);
    }

    /**
     * Validate new shipping fields or a saved address selection locally. Returns a field-error map; use
     * validateAddressStateForEmrPlan separately for availability.
     * @group Address and checkout
     * @param address Shipping address with line1, city, state, zip and country; saved addresses include id.
     * @param useExistingAddress True when choosing a previously saved address.
     * @param existingAddresses Saved patient addresses returned by fetchPatientAddresses.
     * @param selectedAddressId String form of the selected saved address ID.
     * @returns The typed result described above (CheckoutValidationErrors).
     * @example utils.validateAddress(address, useExistingAddress, existingAddresses);
     */
    validateAddress(
        address: AddressType,
        useExistingAddress: boolean,
        existingAddresses: AddressType[],
        selectedAddressId?: string,
    ): CheckoutValidationErrors {
        return validateAddress(address, useExistingAddress, existingAddresses, selectedAddressId);
    }

    /**
     * Validate patient contact information and shipping selection together. Returns isValid and a field-error map;
     * payment and billing-term validation are separate.
     * @group Address and checkout
     * @param patientInfo Checkout contact fields using first_name, last_name, email and phone.
     * @param address Shipping address with line1, city, state, zip and country; saved addresses include id.
     * @param useExistingAddress True when choosing a previously saved address.
     * @param existingAddresses Saved patient addresses returned by fetchPatientAddresses.
     * @param selectedAddressId String form of the selected saved address ID.
     * @returns The typed result described above ({ isValid: boolean; errors: CheckoutValidationErrors }).
     * @example utils.validateCheckoutForm(patientInfo, address, useExistingAddress, existingAddresses);
     */
    validateCheckoutForm(
        patientInfo: CheckoutPatientInfoType,
        address: AddressType,
        useExistingAddress: boolean,
        existingAddresses: AddressType[],
        selectedAddressId?: string,
    ): { isValid: boolean; errors: CheckoutValidationErrors } {
        return validateCheckoutForm(patientInfo, address, useExistingAddress, existingAddresses, selectedAddressId);
    }

    /**
     * Resolve a saved address ID or return the provided new-address fallback.
     * @group Address and checkout
     * @param existingAddresses Saved patient addresses returned by fetchPatientAddresses.
     * @param selectedAddressId String form of the selected saved address ID.
     * @param fallbackAddress New-address form data used when no saved address matches.
     * @returns The typed result described above (AddressType).
     * @example utils.getSelectedAddress(existingAddresses, selectedAddressId, fallbackAddress);
     */
    getSelectedAddress(existingAddresses: AddressType[], selectedAddressId: string | undefined, fallbackAddress: AddressType): AddressType {
        return getSelectedAddress(existingAddresses, selectedAddressId, fallbackAddress);
    }

    /**
     * Create an empty shipping address with the specified country, defaulting to US.
     * @group Address and checkout
     * @param country ISO country code, default US.
     * @returns The typed result described above (AddressType).
     * @example utils.createEmptyAddress();
     */
    createEmptyAddress(country: string = 'US'): AddressType {
        return createEmptyAddress(country);
    }

    /**
     * Create empty checkout first_name, last_name, email and phone fields.
     * @group Address and checkout
     * @returns The typed result described above (CheckoutPatientInfoType).
     * @example utils.createEmptyPatientInfo();
     */
    createEmptyPatientInfo(): EmrCheckoutData['patientInfo'] {
        return this.initializePatientInfo(createEmptyPatientInfo());
    }

    /**
     * Normalize a nullable checkout contact object into complete form fields with empty-string defaults.
     * @group Address and checkout
     * @param initialData Nullable checkout contact fields to normalize.
     * @returns The typed result described above (CheckoutPatientInfoType).
     * @example utils.initializePatientInfo(initialData);
     */
    initializePatientInfo(initialData: CheckoutPatientInfoType | null): EmrCheckoutData['patientInfo'] {
        const info = initializePatientInfo(initialData);
        return { email: info.email ?? '', first_name: info.first_name ?? '', last_name: info.last_name ?? '', phone: info.phone ?? '' };
    }

    // ------------------------------------------------------------------------
    // State availability helpers
    // ------------------------------------------------------------------------

    /**
     * Return supported state codes for a country without applying plan restrictions.
     * @group Address and checkout
     * @param country ISO country code, default US.
     * @returns The typed result described above (string[]).
     * @example utils.getAllStatesForCountry();
     */
    getAllStatesForCountry(country: string = 'US'): string[] {
        return getAllStatesForCountry(country);
    }

    /**
     * Restore default EMR variant/drug selections. Reconcile the checkout draft and invalidate quotes for changed
     * selections.
     * @group Refills and billing choices
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.resetSelections();
     */
    resetSelections(): void {}

    // ------------------------------------------------------------------------
    // Coupon functions
    // ------------------------------------------------------------------------

    /**
     * Fetch applicable coupons for the patient email and current EMR plan, billing option, variant and selected merchant
     * drugs. Optional subtotal is in dollars; defaults to the current clinical display total.
     * @group Coupons and commercial pricing
     * @param patientEmail Patient email used for coupon eligibility.
     * @param subtotal Display subtotal in dollars, before coupon discount.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const coupons = await utils.getCoupons('patient@example.com');
     */
    getCoupons(patientEmail: string, subtotal: number = this.calculateEmrTotal()): Promise<CouponsResponseType> {
        return fetchApplicableCoupons(patientEmail, this.plan.id, undefined, undefined, subtotal, {
            emrTreatmentPlanId: this.plan.id,
            emrBillingOptionId: this.getSelectedEmrBillingOptionId() ?? undefined,
            emrRefillVariantKey: this.getSelectedEmrVariantId() ?? undefined,
            selectedMerchantDrugIds: this.getSelectedEmrMerchantDrugIds(),
        });
    }

    /**
     * Validate a coupon against current EMR selections on the server. On success, persist its discount and discounted
     * total and track coupon_applied. Returns valid/coupon/error; commercial prepaid coupons require a new
     * quoteBillingOption result.
     * @group Coupons and commercial pricing
     * @param email Patient email used for coupon eligibility and validation.
     * @param couponCode Coupon code; null or empty means no coupon.
     * @param subtotal Display subtotal in dollars, before coupon discount.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const result = await utils.applyCoupon('patient@example.com', 'WELCOME');
     */
    async applyCoupon(
        email: string,
        couponCode: string,
        subtotal: number = this.calculateEmrTotal(),
    ): Promise<{ valid: boolean; coupon?: ApplicableCoupon; error?: string }> {
        const result = await validateCoupon(email, couponCode, this.plan.id, undefined, undefined, subtotal, {
            emrTreatmentPlanId: this.plan.id,
            emrBillingOptionId: this.getSelectedEmrBillingOptionId() ?? undefined,
            emrRefillVariantKey: this.getSelectedEmrVariantId() ?? undefined,
            selectedMerchantDrugIds: this.getSelectedEmrMerchantDrugIds(),
        });
        if (result.valid && result.coupon) {
            this.setCheckoutCouponData(result.coupon, subtotal);
            void this.track('coupon_applied', {
                coupon_code: result.coupon.code,
                discount: result.coupon.discount_amount,
                discount_type: result.coupon.type,
            });
        }
        return result;
    }

    /**
     * Clear the persisted coupon/discount, restore the clinical subtotal and track coupon_removed. A changed commercial
     * quote must be requested and accepted again.
     * @group Coupons and commercial pricing
     * @param coupon Applied coupon object; null clears it where supported.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.removeCoupon('WELCOME');
     */
    removeCoupon(coupon: ApplicableCoupon | string): void {
        this.setCheckoutCouponData(null);
        this.track('coupon_removed', {
            coupon_code: typeof coupon === 'string' ? coupon : coupon.code,
            discount: typeof coupon === 'string' ? undefined : coupon.discount_amount,
            discount_type: typeof coupon === 'string' ? undefined : coupon.type,
        });
    }

    /**
     * Track checkout_view once when a checkout step becomes visible. Optional total is in dollars.
     * @group Analytics
     * @param total Display checkout total in dollars.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackCheckoutViewed();
     */
    trackCheckoutViewed(total?: number): void {
        this.trackOnce('checkout_view', {
            total,
            currency: this.analyticsTarget?.currency || 'USD',
        });
    }

    /**
     * Fire the completion events once when an enrollment submission succeeds.
     */
    private trackEnrollmentCompletionEvents(
        createdEvent: 'emr_enrollment_created',
        paymentMethod?: 'upfront' | 'per_schedule' | null,
        enrollment?: EnrollmentSubmissionResult['enrollment'],
    ): Promise<void> {
        this._enrollmentCompleted = true;
        const total = this._checkoutData?.total ?? (this.isEmr ? this.calculateEmrTotal() : undefined);
        const pm = this._checkoutData?.paymentMethod ?? paymentMethod ?? undefined;

        if (enrollment?.patient_id) {
            this._patientInfo = {
                ...(this._patientInfo ?? { id: null, email: '', first_name: '', last_name: '', phone: '' }),
                id: enrollment.patient_id,
            };
            this._analyticsManager?.setUserId(String(enrollment.patient_id));
        }

        const enrollmentData = enrollment
            ? {
                  enrollment_id: enrollment.id,
                  order_id: enrollment.id,
                  enrollment_uuid: enrollment.uuid,
                  enrollment_status: enrollment.status,
                  ...(enrollment.patient_id
                      ? {
                            patient_id: enrollment.patient_id,
                            user_id: String(enrollment.patient_id),
                        }
                      : {}),
              }
            : {};
        const trackingCalls = [
            this.trackOnce(createdEvent, {
                total,
                payment_method: pm,
                ...enrollmentData,
                ...(createdEvent === 'emr_enrollment_created' ? { variant_id: this.getSelectedEmrVariantId() } : {}),
            }),
            this.trackOnce('checkout_completed', { total, ...enrollmentData }),
            this.trackOnce('order_placed', { total, payment_method: pm ?? 'card', ...enrollmentData }),
        ];

        if (enrollment?.is_first_time_order) {
            trackingCalls.push(this.trackOnce('first_time_order', { total, payment_method: pm ?? 'card', ...enrollmentData }));
        }

        return Promise.allSettled(trackingCalls).then((results) => {
            results.forEach((result) => {
                if (result.status === 'rejected') {
                    console.error('[Analytics] Failed to track enrollment completion event:', result.reason);
                }
            });
        });
    }

    // ------------------------------------------------------------------------
    // Stripe payment helpers (bound to merchant via enrollment)
    // ------------------------------------------------------------------------

    /**
     * Fetch saved cards for the current merchant and authenticated patient. When checkout has no card, persist the
     * default payment method.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.fetchPaymentMethods(authToken);
     */
    async fetchPaymentMethods(authToken: string): Promise<StripePaymentMethod[]> {
        const paymentMethods = await (this.emrEnrollment?.fetchPaymentMethods(authToken) ?? Promise.resolve([]));
        const existingPaymentMethod = this._checkoutData?.stripePaymentMethodId;

        if (!existingPaymentMethod) {
            const defaultMethod = getDefaultPaymentMethod(paymentMethods);
            if (defaultMethod) {
                this.mergeCheckoutDraftData({
                    stripePaymentMethodId: String(defaultMethod.id),
                    total: this.emrEnrollment?.getEmrCheckoutSelectionState().total ?? this._checkoutData?.total,
                });
            }
        }

        return paymentMethods;
    }

    /**
     * Return the default saved payment method, or undefined when no default is marked.
     * @group Stripe and payments
     * @param paymentMethods Saved merchant-scoped payment methods returned by fetchPaymentMethods.
     * @returns The typed result described above (StripePaymentMethod | undefined).
     * @example utils.getDefaultPaymentMethod(paymentMethods);
     */
    getDefaultPaymentMethod(paymentMethods: StripePaymentMethod[]): StripePaymentMethod | undefined {
        return getDefaultPaymentMethod(paymentMethods);
    }

    /**
     * Create or reuse a merchant-scoped SetupIntent for saving a card. forceNew requests a fresh intent. Returns
     * success/setupIntent/error; does not capture a payment.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @param forceNew True to request a fresh SetupIntent instead of reusing one.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const setup = await utils.createSetupIntent(token);
     */
    createSetupIntent(authToken: string, forceNew: boolean = false): Promise<StripeInitializationResult> {
        return this.emrEnrollment.createSetupIntent(authToken, forceNew);
    }

    /**
     * Delete the saved payment method identified by its local numeric ID. Returns success and an optional error; does not
     * select a replacement card.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @param methodId Local numeric saved payment method ID.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example utils.deletePaymentMethod(authToken, methodId);
     */
    deletePaymentMethod(authToken: string, methodId: number): Promise<{ success: boolean; error?: string }> {
        return deletePaymentMethod(authToken, methodId);
    }

    /**
     * Save a Stripe payment method after successful setup, using the current merchant, customer and SetupIntent IDs.
     * Returns success/error and optionally marks the card default.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @param paymentMethodId Stripe payment method ID returned after Stripe confirmation.
     * @param customerId Stripe customer ID returned by setup initialization.
     * @param setupIntentId Successfully confirmed Stripe SetupIntent ID.
     * @param setAsDefault Whether to mark this saved card as the patient default for the merchant.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example utils.savePaymentMethod(authToken, paymentMethodId, customerId, setupIntentId);
     */
    savePaymentMethod(
        authToken: string,
        paymentMethodId: string,
        customerId: string,
        setupIntentId: string,
        setAsDefault: boolean = true,
    ): Promise<{ success: boolean; error?: string }> {
        return this.emrEnrollment.savePaymentMethod(authToken, paymentMethodId, customerId, setupIntentId, setAsDefault);
    }

    /**
     * Check whether a Stripe SetupIntent is still processing; callers should wait before enrollment submission.
     * @group Stripe and payments
     * @param status Stripe SetupIntent status string.
     * @returns The typed result described above (boolean).
     * @example utils.isSetupIntentProcessing(status);
     */
    isSetupIntentProcessing(status: string): boolean {
        return isSetupIntentProcessing(status);
    }

    /**
     * Check whether a Stripe SetupIntent has succeeded and can be used to save the card.
     * @group Stripe and payments
     * @param status Stripe SetupIntent status string.
     * @returns The typed result described above (boolean).
     * @example utils.isSetupIntentSucceeded(status);
     */
    isSetupIntentSucceeded(status: string): boolean {
        return isSetupIntentSucceeded(status);
    }

    // ------------------------------------------------------------------------
    // State persistence (bound via enrollment)
    // ------------------------------------------------------------------------

    /**
     * Read the persisted enrollment draft, including survey position/responses, checkout, selections and vital data.
     * Returns an empty object when storage is absent or unavailable.
     * @group Session
     * @returns The typed result described above (Partial<EnrollmentStateType> | null).
     * @example utils.loadState();
     */
    loadState(): Partial<EnrollmentStateType> | null {
        return this.emrEnrollment?.loadState() ?? null;
    }

    /**
     * Merge a partial draft into browser storage. Existing survey responses and attribution are preserved. This does not
     * hydrate current in-memory selections; use selection setters for live changes.
     * @group Session
     * @param state Partial enrollment draft to merge, including survey answers, navigation position or attribution.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.saveState(state);
     */
    saveState(state: Partial<EnrollmentStateType>): void {
        this.emrEnrollment?.saveState(state);
    }

    /**
     * Delete the persisted draft. In-memory selections and authentication remain active; normally called only after
     * successful enrollment.
     * @group Session
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearState();
     */
    clearState(): void {
        this.emrEnrollment?.clearState();
    }

    /**
     * Build the SurveyForm analytics integration using current plan/merchant and patient data, plus React-managed
     * tracking state to deduplicate events.
     * @group Analytics
     * @param analyticsManager Analytics manager used by this SurveyForm integration.
     * @param form Currently rendered intake form metadata.
     * @param patientInfo Current patient snapshot, or a callback returning it for live analytics enrichment.
     * @param trackingState React-managed analytics deduplication state.
     * @param onTrackingStateUpdate React state setter for updated analytics deduplication state.
     * @returns The typed result described above (SurveyFormAnalyticsPropType | null).
     * @example utils.createSurveyFormAnalyticsProp(analyticsManager, form, patientInfo, trackingState, onTrackingStateUpdate);
     */
    createSurveyFormAnalyticsProp(
        analyticsManager: AnalyticsManager | null,
        form: EnrollmentFormType,
        patientInfo: PatientInfoType | null | (() => PatientInfoType | null),
        trackingState: AnalyticsTrackingStateType,
        onTrackingStateUpdate: (newState: AnalyticsTrackingStateType) => void,
    ): SurveyFormAnalyticsPropType | null {
        if (!this.analyticsTarget || !this.merchant) return null;
        return createSurveyFormAnalyticsProp(
            analyticsManager,
            this.analyticsTarget,
            this.merchant,
            form,
            patientInfo,
            trackingState,
            onTrackingStateUpdate,
        );
    }

    // ------------------------------------------------------------------------
    // Stripe component utilities
    // ------------------------------------------------------------------------

    /**
     * Build validated Stripe success/error callbacks from checkout UI callbacks. Does not initialize Stripe or perform a
     * charge itself.
     * @group Stripe and payments
     * @param callbacks Checkout validation and Stripe success/error callbacks described by the typed signature.
     * @returns The typed result described above.
     * @example utils.createStripePaymentHandlers(callbacks);
     */
    createStripePaymentHandlers(callbacks: {
        onPaymentSuccess: (data: {
            paymentMethodId: string;
            patientInfo: CheckoutPatientInfoType;
            address: AddressType;
            useExistingAddress: boolean;
        }) => void;
        onPaymentError: (error: string) => void;
        validateForm: () => boolean;
        getFormData: () => {
            patientInfo: CheckoutPatientInfoType;
            address: AddressType;
            useExistingAddress: boolean;
            existingAddresses: AddressType[];
            selectedAddressId?: string;
        };
    }) {
        return createStripePaymentHandlers(callbacks);
    }

    /**
     * Build the shared Stripe form props from auth token, merchant, amount and callbacks. Amount is a display value in
     * dollars; authorization amounts are computed server-side.
     * @group Stripe and payments
     * @param config Verified auth token, merchant ID, display amount/currency and Stripe success/error callbacks.
     * @returns The typed result described above.
     * @example utils.getStripePaymentFormProps(config);
     */
    getStripePaymentFormProps(config: {
        authToken: string;
        merchantId: number;
        amount: number;
        currency?: string;
        onSuccess: (paymentMethodId: string) => void;
        onError: (error: string) => void;
    }) {
        return getStripePaymentFormProps(config);
    }

    // ------------------------------------------------------------------------
    // Patient auth storage helpers
    // ------------------------------------------------------------------------

    /**
     * Return the active auth key when no identifier is provided, or derive a separate key for a named patient auth block.
     * @group Patient authentication
     * @param identifier Optional auth block identifier for a separate storage namespace.
     * @returns The typed result described above (string).
     * @example utils.getPatientAuthStorageKey();
     */
    getPatientAuthStorageKey(identifier?: string): string {
        return identifier ? getPatientAuthStorageKey(identifier) : this.patientAuthStorageKey;
    }

    /**
     * Read stored patient/token data without contacting the server. A stored token is not proof that the current session
     * has been validated.
     * @group Patient authentication
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns The typed result described above (PatientAuthStorageData | null).
     * @example utils.getStoredPatientAuth();
     */
    getStoredPatientAuth(storageKey: string = this.patientAuthStorageKey): PatientAuthStorageData | null {
        return getStoredPatientAuth(storageKey);
    }

    /**
     * Persist a token and patient snapshot. Does not validate the token or enable background writes; validatePatientToken
     * afterward.
     * @group Patient authentication
     * @param token Verified bearer token returned by authentication.
     * @param patient Patient snapshot returned by the authenticated patient API.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.savePatientAuth(token, patient);
     */
    savePatientAuth(token: string, patient: PatientAuthDataType, storageKey: string = this.patientAuthStorageKey): void {
        return savePatientAuth(token, patient, storageKey);
    }

    /**
     * Log out locally and clear checkout, vital, identity and pending patient drafts through logoutPatient.
     * @group Patient authentication
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearPatientAuth();
     */
    clearPatientAuth(storageKey: string = this.patientAuthStorageKey): void {
        this.logoutPatient(storageKey);
    }

    /**
     * Read the stored bearer token or null. Never send this value to analytics or render it into survey answers.
     * @group Patient authentication
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns The typed result described above (string | null).
     * @example utils.getPatientAuthToken();
     */
    getPatientAuthToken(storageKey: string = this.patientAuthStorageKey): string | null {
        return getPatientAuthToken(storageKey);
    }

    /**
     * Read the stored patient snapshot or null. Use getReferencePatient when pre-authentication profile edits are also
     * needed.
     * @group Patient authentication
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns The typed result described above (PatientAuthDataType | null).
     * @example utils.getStoredPatient();
     */
    getStoredPatient(storageKey: string = this.patientAuthStorageKey): (PatientAuthDataType & Partial<PatientInfoType>) | null {
        return getStoredPatient(storageKey);
    }

    // ------------------------------------------------------------------------
    // Patient validation & formatting
    // ------------------------------------------------------------------------

    /**
     * Format phone digits for display using the existing US patient phone format. Does not modify stored patient data.
     * @group Patient information
     * @param value New field value in the patient API format; heights are inches and weights are pounds.
     * @returns The typed result described above (string).
     * @example utils.formatPhoneNumber(value);
     */
    formatPhoneNumber(value: string): string {
        return formatPhoneNumber(value);
    }

    /**
     * Strip phone formatting to digits for patient API and checkout input.
     * @group Patient information
     * @param formattedPhone Phone display string to normalize to digits.
     * @returns The typed result described above (string).
     * @example utils.getRawPhoneDigits(formattedPhone);
     */
    getRawPhoneDigits(formattedPhone: string): string {
        return getRawPhoneDigits(formattedPhone);
    }

    /**
     * Check patient auth email syntax locally.
     * @group Patient information
     * @param email Patient email used for coupon eligibility and validation.
     * @returns The typed result described above (boolean).
     * @example utils.isValidPatientEmail(email);
     */
    isValidPatientEmail(email: string): boolean {
        return isValidPatientEmail(email);
    }

    /**
     * Check the expected ten-digit US patient phone format locally.
     * @group Patient information
     * @param phone Ten-digit US patient phone number.
     * @returns The typed result described above (boolean).
     * @example utils.isValidPatientPhone(phone);
     */
    isValidPatientPhone(phone: string): boolean {
        return isValidPatientPhone(phone);
    }

    /**
     * Check the expected six-digit OTP format locally. Does not verify the code on the server.
     * @group Patient information
     * @param otp Six-digit verification code for local format checking.
     * @returns The typed result described above (boolean).
     * @example utils.isValidOtp(otp);
     */
    isValidOtp(otp: string): boolean {
        return isValidOtp(otp);
    }

    /**
     * List required profile fields missing from the supplied patient under the given authentication configuration.
     * @group Patient authentication
     * @param patient Patient snapshot returned by the authenticated patient API.
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @returns The typed result described above (string[]).
     * @example utils.getPatientMissingFields(patient);
     */
    getPatientMissingFields(patient: PatientAuthDataType, config: PatientAuthConfigType = this.patientAuthConfig): string[] {
        return getPatientMissingFields(patient, config);
    }

    /**
     * Validate auth, verification or profile-collection input locally. Returns isValid plus per-field errors; makes no
     * network request.
     * @group Patient authentication
     * @param formData Patient input fields required by the chosen operation and auth configuration.
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param step Validation stage: auth, verify or collect.
     * @returns The typed result described above ({ isValid: boolean; errors: PatientAuthValidationErrors }).
     * @example utils.validatePatientAuthForm(formData, undefined, 'auth');
     */
    validatePatientAuthForm(
        formData: Partial<PatientAuthFormDataType>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        step: 'auth' | 'verify' | 'collect',
    ): { isValid: boolean; errors: PatientAuthValidationErrors } {
        return validatePatientAuthForm(formData, config, step);
    }

    /**
     * Create empty patient/contact/verification/profile fields for an authentication UI.
     * @group Patient authentication
     * @returns The typed result described above (PatientAuthFormDataType).
     * @example utils.createEmptyPatientAuthFormData();
     */
    createEmptyPatientAuthFormData(): PatientAuthFormDataType {
        return createEmptyPatientAuthFormData();
    }

    // ------------------------------------------------------------------------
    // Patient auth API functions
    // ------------------------------------------------------------------------

    /**
     * Send an email/phone OTP. New patients may receive a token directly; returning patients still require verification.
     * Successful direct auth enables vital saves and updates analytics identity.
     * @group Patient authentication
     * @param formData Patient input fields required by the chosen operation and auth configuration.
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.sendPatientOtp({ email: 'patient@example.com' });
     */
    async sendPatientOtp(
        formData: Pick<PatientAuthFormDataType, 'email' | 'phone'>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await sendPatientOtp(formData, config, storageKey);
        if (result.success && result.token && result.patient) {
            void identifyIntercom(result.token);
            this._patientAuthStorageKey = storageKey;
            this._tokenValidated = true;
            await this.flushPendingVitals();
            this.handleAuthSuccessAnalytics(result, config);
        }
        return result;
    }

    /**
     * Authenticate with an OTP or password according to config. On success, use the supplied auth storage key, enable
     * vital saves and refresh patient identity. Inspect success/error before navigating.
     * @group Patient authentication
     * @param formData Patient input fields required by the chosen operation and auth configuration.
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.validatePatientAuth({ email: 'patient@example.com', otp: '123456' });
     */
    async validatePatientAuth(
        formData: Pick<PatientAuthFormDataType, 'email' | 'phone' | 'otp' | 'password'>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await validatePatientAuth(formData, config, storageKey);
        if (result.success && result.token) {
            void identifyIntercom(result.token);
            this._patientAuthStorageKey = storageKey;
            this._tokenValidated = true;
            await this.flushPendingVitals();
        }
        this.handleAuthSuccessAnalytics(result, config);
        return result;
    }

    /**
     * Validate the stored bearer token on the server. Successful validation enables profile/vital saves; failed
     * validation disables background writes. Use when resuming an enrollment.
     * @group Patient authentication
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.validatePatientToken();
     */
    async validatePatientToken(
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await validatePatientToken(config, storageKey);
        if (!result.success) this.setTokenValidated(false);
        if (result.success && result.token) {
            void identifyIntercom(result.token);
            this._patientAuthStorageKey = storageKey;
            this._tokenValidated = true;
            await this.flushPendingVitals();
        }
        this.handleAuthSuccessAnalytics(result, config);
        return result;
    }

    /**
     * Fire authentication-related canonical events after a successful auth/token validation.
     * Fires `sign_in` / `sign_up` once, always refreshes identity, and emits `user_authenticated`.
     */
    private handleAuthSuccessAnalytics(result: PatientAuthResultType, config: PatientAuthConfigType): void {
        if (!result.success) return;
        this.syncAnalyticsIdentity(result.patient);
        const method = config.authMethod ?? 'otp';
        if (result.isFirstTimeUser) {
            this.trackOnce('sign_up', { method });
            this.trackOnce('new_user', { method });
        } else {
            this.trackOnce('sign_in', { method });
        }
        this.trackOnce('user_authenticated', {
            patient_id: result.patient?.id,
            method,
            profile_complete: (result.missingFields?.length ?? 0) === 0,
        });
    }

    /**
     * Update the listed profile fields on the patient API. Requires validated authentication; successful updates refresh
     * analytics identity and field events. Inspect success/error before advancing.
     * @group Patient information
     * @param formData Patient input fields required by the chosen operation and auth configuration.
     * @param missingFields Profile field names to send to the API.
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.updatePatientProfile(formData, missingFields);
     */
    async updatePatientProfile(
        formData: Partial<PatientAuthFormDataType>,
        missingFields: string[],
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        if (!this._tokenValidated) return { success: false, error: 'Validate the patient session before saving profile changes.' };
        const result = await updatePatientProfile(formData, missingFields, config, storageKey);
        if (result.success) {
            this.syncAnalyticsIdentity(result.patient);
            for (const [field, value] of Object.entries(formData)) {
                this.trackPatientFieldAnalytics(field, value);
            }
        }
        return result;
    }

    /**
     * Update one supported profile field such as firstName, lastName, email, phone, dateOfBirth, gender,
     * genderBiological, height or weight. Before token validation, queue it locally; afterward send it to the patient
     * API.
     * @group Patient information
     * @param fieldName Supported camelCase patient field name, such as dateOfBirth or firstName.
     * @param value New field value in the patient API format; heights are inches and weights are pounds.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.updatePatientField('dateOfBirth', '1990-01-15');
     */
    async updatePatientField(
        fieldName: string,
        value: string | number,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        // Fire profile analytics regardless of whether the update is sent now or queued
        this.trackPatientFieldAnalytics(fieldName, value);

        // If token has not been validated yet, always queue to pending updates
        // This prevents writing to a stale token's patient before identity is confirmed
        if (!this._tokenValidated) {
            savePendingUpdate(fieldName, value, storageKey);
            const referencePatient = getReferencePatient(storageKey);
            return {
                success: true,
                patient: referencePatient || {},
                token: undefined,
                missingFields: [],
            };
        }

        // Token validated - check if token exists for immediate flush
        const token = getPatientAuthToken(storageKey);

        if (!token) {
            savePendingUpdate(fieldName, value, storageKey);
            const referencePatient = getReferencePatient(storageKey);
            return {
                success: true,
                patient: referencePatient || {},
                token: undefined,
                missingFields: [],
            };
        }

        // Token validated and exists - proceed with immediate update
        const formData: Partial<PatientAuthFormDataType> = {};

        if (fieldName === 'dateOfBirth') {
            formData.dateOfBirth = String(value ?? '');
        } else if (fieldName === 'gender') {
            formData.gender = String(value ?? '');
            formData.genderBiological = String(value ?? '');
        } else if (fieldName === 'genderBiological') {
            formData.genderBiological = String(value ?? '');
        } else if (fieldName === 'height') {
            formData.height = String(value ?? '');
        } else if (fieldName === 'weight') {
            formData.weight = String(value ?? '');
        } else if (fieldName === 'firstName') {
            formData.firstName = String(value ?? '');
        } else if (fieldName === 'lastName') {
            formData.lastName = String(value ?? '');
        } else if (fieldName === 'middleName') {
            formData.middleName = String(value ?? '');
        } else if (fieldName === 'email') {
            formData.email = String(value ?? '');
        } else if (fieldName === 'phone') {
            formData.phone = String(value ?? '');
        }

        return updatePatientProfile(formData, [fieldName], this.patientAuthConfig, storageKey);
    }

    /**
     * Clear stored authentication, queued profile edits, checkout payment/address data and vital drafts. Invalidate
     * in-flight vital responses so a previous patient cannot overwrite the next patient session.
     * @group Patient authentication
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.logoutPatient();
     */
    logoutPatient(storageKey: string = this.patientAuthStorageKey): void {
        this.setTokenValidated(false);
        this._vitalSessionVersion++;
        this._vitalFlushPromise = null;
        this._vitalId = null;
        this.clearPendingVitalData();
        this._patientInfo = null;
        this._checkoutData = null;
        this._firedOnceEvents.clear();
        this.persistTransientEnrollmentState();
        updateIntercom(null);
        return logoutPatient(storageKey);
    }

    /**
     * Save queued profile edits after authentication has been validated. Retains edits on failure. Returns a failed
     * result without a network request when the session is not validated.
     * @group Patient information
     * @param config Authentication/profile requirements, or EMR session configuration for construction.
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example utils.flushPendingUpdates();
     */
    flushPendingUpdates(
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        if (!this._tokenValidated) return Promise.resolve({ success: false, error: 'Validate the patient session before saving profile changes.' });
        return flushPendingUpdates(config, storageKey);
    }

    /**
     * Read deferred profile updates from the selected auth namespace without sending them to the server.
     * @group Patient information
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns The typed result described above (PendingUpdatesData | null).
     * @example utils.getPendingUpdates();
     */
    getPendingUpdates(storageKey: string = this.patientAuthStorageKey): PendingUpdatesData | null {
        return getPendingUpdates(storageKey);
    }

    /**
     * Read the stored patient merged with locally accumulated profile edits. Useful for fields collected before OTP
     * verification.
     * @group Patient information
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns The typed result described above (PatientAuthDataType | null).
     * @example utils.getReferencePatient();
     */
    getReferencePatient(storageKey: string = this.patientAuthStorageKey): PatientAuthDataType | null {
        return getReferencePatient(storageKey);
    }

    /**
     * Discard locally queued profile edits for the selected authentication namespace.
     * @group Patient information
     * @param storageKey Patient auth storage namespace; defaults to the active session key.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearPendingUpdates();
     */
    clearPendingUpdates(storageKey: string = this.patientAuthStorageKey): void {
        return clearPendingUpdates(storageKey);
    }

    // ------------------------------------------------------------------------
    // Patient auth result builder
    // ------------------------------------------------------------------------

    /**
     * Build the legacy survey auth result shape from a verified patient and token. Use only with results returned by
     * authentication.
     * @group Patient authentication
     * @param patient Patient snapshot returned by the authenticated patient API.
     * @param token Verified bearer token returned by authentication.
     * @returns The typed result described above (Record<string, unknown>).
     * @example utils.buildPatientAuthResults(patient, token);
     */
    buildPatientAuthResults(patient: PatientAuthDataType, token: string): Record<string, unknown> {
        return buildPatientAuthResults(patient, token);
    }

    // ------------------------------------------------------------------------
    // Height / weight conversion helpers
    // ------------------------------------------------------------------------

    /**
     * Convert a height in total inches to a feet/inches pair for display.
     * @group Patient information
     * @param totalInches Patient height expressed as total inches.
     * @returns The typed result described above ({ feet: number; inches: number }).
     * @example utils.inchesToFeetInches(totalInches);
     */
    inchesToFeetInches(totalInches: number | string): { feet: number; inches: number } {
        return inchesToFeetInches(totalInches);
    }

    /**
     * Convert feet and inches to the total-inch height expected by the patient API.
     * @group Patient information
     * @param feet Whole feet portion of patient height.
     * @param inches Remaining inches portion of patient height.
     * @returns The typed result described above (number).
     * @example utils.feetInchesToInches(feet, inches);
     */
    feetInchesToInches(feet: number, inches: number): number {
        return feetInchesToInches(feet, inches);
    }

    // ------------------------------------------------------------------------
    // Checkout Data Management (in-memory state)
    // ------------------------------------------------------------------------

    /**
     * Replace and persist the entire checkout draft, including contacts, address, Stripe IDs, coupon and accepted billing
     * quote. Reconcile current clinical selections and track checkout_started.
     * @group Address and checkout
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setCheckoutData(data);
     */
    setCheckoutData(data: Omit<EmrCheckoutData, 'timestamp'>): void {
        const normalizedData = this.withCurrentEmrCheckoutState(data);
        this._checkoutData = {
            ...normalizedData,
            timestamp: new Date().toISOString(),
        };
        this.persistTransientEnrollmentState();
        this.track('checkout_started', {
            total: normalizedData.total,
            currency: this.analyticsTarget?.currency || 'USD',
            has_address: normalizedData.useExistingAddress || !!normalizedData.address?.line1,
            has_patient_info: !!normalizedData.patientInfo?.email,
        });
    }

    /**
     * Read the current checkout draft or null. Reconcile selections and expire incompatible/expired billing quotes before
     * returning data; old accepted terms and authorization IDs are cleared.
     * @group Address and checkout
     * @returns The typed result described above (StoredCheckoutData | null).
     * @example utils.getCheckoutData();
     */
    getCheckoutData(): EmrCheckoutData | null {
        this.refreshCheckoutDataFromCurrentEmrState();
        return this._checkoutData;
    }

    /**
     * Check whether any checkout draft exists. Does not establish that all required fields or payment are present.
     * @group Address and checkout
     * @returns The typed result described above (boolean).
     * @example utils.hasCheckoutData();
     */
    hasCheckoutData(): boolean {
        return this._checkoutData !== null;
    }

    /**
     * Delete the in-memory and persisted checkout draft. Keep clinical selections and patient authentication.
     * @group Address and checkout
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearCheckoutData();
     */
    clearCheckoutData(): void {
        this._checkoutData = null;
        this.persistTransientEnrollmentState();
    }

    // ------------------------------------------------------------------------
    // Partial Checkout Data Setters (for modular blocks)
    // ------------------------------------------------------------------------

    /**
     * Merge checkout contact/name fields into the persisted draft while preserving valid billing acceptance and payment
     * state.
     * @group Address and checkout
     * @param patientInfo Checkout contact fields using first_name, last_name, email and phone.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setCheckoutPatientInfo(patientInfo);
     */
    setCheckoutPatientInfo(patientInfo: CheckoutPatientInfoType): void {
        this.mergeCheckoutDraftData({
            patientInfo: {
                email: patientInfo.email ?? '',
                first_name: patientInfo.first_name ?? '',
                last_name: patientInfo.last_name ?? '',
                phone: patientInfo.phone ?? '',
            },
        });
    }

    /**
     * Read the checkout contact fields, or null before a draft exists.
     * @group Address and checkout
     * @returns The typed result described above (EmrCheckoutData['patientInfo'] | null).
     * @example utils.getCheckoutPatientInfo();
     */
    getCheckoutPatientInfo(): EmrCheckoutData['patientInfo'] | null {
        return this._checkoutData?.patientInfo ?? null;
    }

    /**
     * Merge a new or saved shipping address into checkout and persist it. For saved addresses supply selectedAddressId as
     * well as the address object.
     * @group Address and checkout
     * @param address Shipping address with line1, city, state, zip and country; saved addresses include id.
     * @param useExistingAddress True when choosing a previously saved address.
     * @param selectedAddressId String form of the selected saved address ID.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setCheckoutAddress(address);
     */
    setCheckoutAddress(address: AddressType, useExistingAddress: boolean = false, selectedAddressId?: string): void {
        this.mergeCheckoutDraftData({
            address,
            useExistingAddress,
            selectedAddressId,
        });
        if (useExistingAddress && selectedAddressId) {
            this.track('address_selected', {
                address_id: selectedAddressId,
                is_existing: true,
            });
        } else if (address?.line1) {
            this.track('address_added', {
                state: address.state,
                country: address.country,
            });
        }
    }

    /**
     * Read checkout shipping data, its saved/new choice and selected address ID, or null before a draft exists.
     * @group Address and checkout
     * @returns The typed result described above ({ address: AddressType; useExistingAddress: boolean; selectedAddressId?: string } | null).
     * @example utils.getCheckoutAddress();
     */
    getCheckoutAddress(): { address: AddressType; useExistingAddress: boolean; selectedAddressId?: string } | null {
        if (!this._checkoutData) return null;
        return {
            address: this._checkoutData.address,
            useExistingAddress: this._checkoutData.useExistingAddress,
            selectedAddressId: this._checkoutData.selectedAddressId,
        };
    }

    /**
     * Merge Stripe payment method/authorization IDs and optional pricing/coupon data into checkout. Explicitly passing
     * stripePaymentIntentId: undefined clears an old authorization. Tracks payment_authorized.
     * @group Address and checkout
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setCheckoutPaymentData(data);
     */
    setCheckoutPaymentData(data: {
        stripePaymentMethodId: string;
        stripePaymentIntentId?: string;
        paymentMethod?: 'upfront' | 'per_schedule';
        total?: number;
        couponCode?: string;
        appliedCoupon?: ApplicableCoupon | null;
        subtotal?: number;
        discountAmount?: number;
        finalTotal?: number;
    }): void {
        const existing = this._checkoutData;
        this.mergeCheckoutDraftData(data);
        this.track('payment_authorized', {
            total: data.total ?? existing?.total,
            currency: this.analyticsTarget?.currency || 'USD',
            payment_method: data.paymentMethod ?? existing?.paymentMethod ?? 'card',
        });
    }

    /**
     * Read the saved Stripe IDs and payment/pricing/coupon fields from checkout, or null before a draft exists.
     * @group Address and checkout
     * @returns The typed result described above ({
        stripePaymentMethodId?: string;
        stripePaymentIntentId?: string;
        paymentMethod?: 'upfront' | 'per_schedule';
        total?: number;
        couponCode?: string;
        appliedCoupon?: ApplicableCoupon | null;
        subtotal?: number;
        discountAmount?: number;
        finalTotal?: number;
    } | null).
     * @example utils.getCheckoutPaymentData();
     */
    getCheckoutPaymentData(): {
        stripePaymentMethodId?: string;
        stripePaymentIntentId?: string;
        paymentMethod?: 'upfront' | 'per_schedule';
        total?: number;
        couponCode?: string;
        appliedCoupon?: ApplicableCoupon | null;
        subtotal?: number;
        discountAmount?: number;
        finalTotal?: number;
    } | null {
        if (!this._checkoutData) return null;
        return {
            stripePaymentMethodId: this._checkoutData.stripePaymentMethodId,
            stripePaymentIntentId: this._checkoutData.stripePaymentIntentId,
            paymentMethod: this._checkoutData.paymentMethod,
            total: this._checkoutData.total,
            couponCode: this._checkoutData.couponCode,
            appliedCoupon: this._checkoutData.appliedCoupon,
            subtotal: this._checkoutData.subtotal,
            discountAmount: this._checkoutData.discountAmount,
            finalTotal: this._checkoutData.finalTotal,
        };
    }

    /**
     * Persist an applied coupon and subtotal in dollars, or clear coupon data with null. Changes invalidate commercial
     * quote acceptance and old authorization on reconciliation.
     * @group Coupons and commercial pricing
     * @param coupon Applied coupon object; null clears it where supported.
     * @param subtotal Display subtotal in dollars, before coupon discount.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setCheckoutCouponData(coupon);
     */
    setCheckoutCouponData(coupon: ApplicableCoupon | null, subtotal?: number): void {
        const existing = this._checkoutData;

        if (!coupon) {
            if (!existing) return;

            const restoredTotal = existing.subtotal ?? (this.isEmr ? this.calculateEmrTotal() : existing.total);

            this._checkoutData = {
                ...existing,
                couponCode: undefined,
                appliedCoupon: null,
                subtotal: undefined,
                discountAmount: undefined,
                finalTotal: undefined,
                total: restoredTotal,
                timestamp: new Date().toISOString(),
            };
            this.persistTransientEnrollmentState();
            return;
        }

        const resolvedSubtotal = subtotal ?? existing?.subtotal ?? (this.isEmr ? this.calculateEmrTotal() : existing?.total);
        const finalTotal = typeof resolvedSubtotal === 'number' ? Math.max(0, resolvedSubtotal - coupon.discount_amount) : existing?.total;

        this.mergeCheckoutDraftData({
            couponCode: coupon.code,
            appliedCoupon: coupon,
            subtotal: resolvedSubtotal,
            discountAmount: coupon.discount_amount,
            finalTotal,
            total: finalTotal,
        });
    }

    /**
     * Read persisted coupon code/object and subtotal/discount/final total fields in dollars, or null before checkout
     * exists.
     * @group Coupons and commercial pricing
     * @returns The typed result described above ({
        couponCode?: string;
        appliedCoupon?: ApplicableCoupon | null;
        subtotal?: number;
        discountAmount?: number;
        finalTotal?: number;
    } | null).
     * @example utils.getCheckoutCouponData();
     */
    getCheckoutCouponData(): {
        couponCode?: string;
        appliedCoupon?: ApplicableCoupon | null;
        subtotal?: number;
        discountAmount?: number;
        finalTotal?: number;
    } | null {
        if (!this._checkoutData) return null;

        return {
            couponCode: this._checkoutData.couponCode,
            appliedCoupon: this._checkoutData.appliedCoupon,
            subtotal: this._checkoutData.subtotal,
            discountAmount: this._checkoutData.discountAmount,
            finalTotal: this._checkoutData.finalTotal,
        };
    }

    /**
     * Check basic presence of checkout name/email, shipping fields and a saved Stripe payment method. Does not validate
     * quote acceptance, plan eligibility or server authorization.
     * @group Address and checkout
     * @returns The typed result described above (boolean).
     * @example utils.isCheckoutDataComplete();
     */
    isCheckoutDataComplete(): boolean {
        if (!this._checkoutData) return false;
        const { patientInfo, address, stripePaymentMethodId } = this._checkoutData;
        return !!(
            patientInfo?.email &&
            patientInfo?.first_name &&
            patientInfo?.last_name &&
            address?.line1 &&
            address?.city &&
            address?.state &&
            address?.zip &&
            stripePaymentMethodId
        );
    }

    // ------------------------------------------------------------------------
    // Vitals lifecycle (persisted with the EMR enrollment draft)
    // ------------------------------------------------------------------------

    /**
     * Create a vital record on the first save, then PATCH the persisted record on later saves. Requires a bearer token.
     * Prefer setPendingVitalData/flushPendingVitals to deduplicate concurrent saves. Returns success, vitalId and an
     * optional error.
     * @group Vitals
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.updateVital(data);
     */
    async updateVital(data: Record<string, unknown>): Promise<{ success: boolean; vitalId: number | null; error?: string }> {
        const sessionVersion = this._vitalSessionVersion;
        const token = this.getPatientAuthToken();
        if (!token || !this._tokenValidated) {
            return { success: false, vitalId: null, error: 'Not authenticated' };
        }

        try {
            const baseUrl = '/api/v2/patient';
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };

            if (this._vitalId === null) {
                // POST to create
                const response = await enrollmentFetch(`${baseUrl}/vitals`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                if (sessionVersion !== this._vitalSessionVersion) {
                    return { success: false, vitalId: null, error: 'Patient session changed' };
                }
                if (result.success && result.data?.id) {
                    this._vitalId = result.data.id;
                    this.persistTransientEnrollmentState();
                    return { success: true, vitalId: this._vitalId };
                }
                return { success: false, vitalId: null, error: result.message || 'Failed to create vital' };
            } else {
                // PATCH to update
                const response = await enrollmentFetch(`${baseUrl}/vitals/${this._vitalId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                if (sessionVersion !== this._vitalSessionVersion) {
                    return { success: false, vitalId: null, error: 'Patient session changed' };
                }
                if (result.success) {
                    return { success: true, vitalId: this._vitalId };
                }
                return { success: false, vitalId: this._vitalId, error: result.message || 'Failed to update vital' };
            }
        } catch (error) {
            console.error('[EmrEnrollmentUtils] Error updating vital:', error);
            return { success: false, vitalId: this._vitalId, error: 'Network error' };
        }
    }

    /**
     * Read the vital record ID persisted with this enrollment, or null before the first save.
     * @group Vitals
     * @returns The typed result described above (number | null).
     * @example utils.getVitalId();
     */
    getVitalId(): number | null {
        return this._vitalId;
    }

    /**
     * Forget the persisted vital record ID. The next update creates a new record; pending vital values remain queued.
     * @group Vitals
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearVitalId();
     */
    clearVitalId(): void {
        this._vitalId = null;
        this.persistTransientEnrollmentState();
    }

    // ------------------------------------------------------------------------
    // Token validation gate
    // ------------------------------------------------------------------------

    /**
     * Check whether authentication has been confirmed for this session. Stored tokens alone do not set this flag.
     * @group Patient authentication
     * @returns The typed result described above (boolean).
     * @example utils.isTokenValidated();
     */
    isTokenValidated(): boolean {
        return this._tokenValidated;
    }

    /**
     * Set the background-write gate. Only pass true after trusted patient verification; prefer validatePatientToken or
     * validatePatientAuth. A true value schedules queued vital saves.
     * @group Patient authentication
     * @param validated True only after successful patient session verification.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setTokenValidated(validated);
     */
    setTokenValidated(validated: boolean): void {
        this._tokenValidated = validated;
        this.scheduleVitalSave();
    }

    private scheduleVitalSave(): void {
        if (this._vitalSaveTimer !== null) clearTimeout(this._vitalSaveTimer);
        this._vitalSaveTimer = null;
        if (!this.isEmr || !this._tokenValidated || !this._pendingVitalData) return;
        this._vitalSaveTimer = setTimeout(() => {
            this._vitalSaveTimer = null;
            if (this._tokenValidated) void this.flushPendingVitals();
        }, 500);
    }

    // ------------------------------------------------------------------------
    // Pending vital data (deferred creation until token is validated)
    // ------------------------------------------------------------------------

    /**
     * Merge vital measurements into the persisted draft. After token validation, debounce saves for 500ms; before
     * verification, keep edits queued. Newer edits remain queued while a request is running.
     * @group Vitals
     * @param data Operation data: event metadata, checkout fields or vital measurements according to the method signature.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.setPendingVitalData({ systolic: 120, diastolic: 80 });
     */
    setPendingVitalData(data: Record<string, unknown>): void {
        this._pendingVitalData = { ...(this._pendingVitalData || {}), ...data };
        this.persistTransientEnrollmentState();
        this.scheduleVitalSave();
    }

    /**
     * Read vital measurements not yet acknowledged by the patient API, or null when the draft has been saved.
     * @group Vitals
     * @returns The typed result described above (Record<string, unknown> | null).
     * @example utils.getPendingVitalData();
     */
    getPendingVitalData(): Record<string, unknown> | null {
        return this._pendingVitalData;
    }

    /**
     * Discard unsaved vital measurements and cancel the background save timer. The existing saved vital record is
     * retained.
     * @group Vitals
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.clearPendingVitalData();
     */
    clearPendingVitalData(): void {
        this._pendingVitalData = null;
        this.scheduleVitalSave();
        this.persistTransientEnrollmentState();
    }

    /**
     * Save pending measurements after token validation. Concurrent callers share one request; edits made while saving are
     * sent afterward. Failures retain the draft for an explicit retry. Inspect success before enrollment submission.
     * @group Vitals
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const saved = await utils.flushPendingVitals();
     */
    async flushPendingVitals(): Promise<{ success: boolean; vitalId: number | null; error?: string }> {
        if (this._vitalSaveTimer !== null) clearTimeout(this._vitalSaveTimer);
        this._vitalSaveTimer = null;
        if (this._vitalFlushPromise) return this._vitalFlushPromise;
        if (!this._pendingVitalData) return { success: true, vitalId: this._vitalId };
        if (!this._tokenValidated) return { success: false, vitalId: this._vitalId, error: 'Not authenticated' };

        const pending = this.saveVitalDraft();
        this._vitalFlushPromise = pending;
        try {
            return await pending;
        } finally {
            if (this._vitalFlushPromise === pending) this._vitalFlushPromise = null;
        }
    }

    private async saveVitalDraft(): Promise<{ success: boolean; vitalId: number | null; error?: string }> {
        while (this._pendingVitalData && this._tokenValidated) {
            const sent = { ...this._pendingVitalData };
            const result = await this.updateVital(sent);
            if (!result.success) return result;
            // Only acknowledge fields saved by this request; edits made while saving stay queued.
            const remaining = Object.fromEntries(
                Object.entries(this._pendingVitalData || {}).filter(
                    ([field, value]) => !Object.prototype.hasOwnProperty.call(sent, field) || !Object.is(value, sent[field]),
                ),
            );
            this._pendingVitalData = Object.keys(remaining).length ? remaining : null;
            this.persistTransientEnrollmentState();
        }
        return this._pendingVitalData
            ? { success: false, vitalId: this._vitalId, error: 'Not authenticated' }
            : { success: true, vitalId: this._vitalId };
    }
    private buildAbandonEventData(
        context: AbandonEventContextType,
        sortedForms: EnrollmentFormType[],
        abandonReason: 'browser_close' | 'tab_hidden' = 'browser_close',
    ): AnalyticsEventDataType | null {
        if (!this.analyticsTarget) return null;
        return buildAbandonEventData(context, this.analyticsTarget, sortedForms, abandonReason);
    }
    private buildTabSwitchEventData(
        context: AbandonEventContextType,
        sortedForms: EnrollmentFormType[],
        eventType: 'tab_switch' | 'survey_resume' | 'checkout_resume',
    ): AnalyticsEventDataType | null {
        if (!this.analyticsTarget) return null;
        return buildTabSwitchEventData(context, this.analyticsTarget, sortedForms, eventType);
    }
    private sendEnrichedAbandonBeacon(
        eventData: AnalyticsEventDataType,
        patientInfo: PatientInfoType | null,
        analyticsManager: AnalyticsManager,
    ): boolean {
        if (!this.analyticsTarget || !this.merchant) return false;
        return sendEnrichedAbandonBeacon(
            eventData,
            patientInfo,
            analyticsManager,
            this.merchant.id,
            this.analyticsTarget.id,
            this._analyticsUrlParams,
        );
    }
    /**
     * Track a form navigation page view with the current EMR plan ID and ordered form position.
     * @group Analytics
     * @param analyticsManager Analytics manager used by this SurveyForm integration.
     * @param stepIndex Zero-based position of the current enrollment form.
     * @param totalSteps Total enrollment form count.
     * @param formName Display name of the currently rendered form.
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.trackFormPageView(analyticsManager, stepIndex, totalSteps, formName);
     */
    trackFormPageView(analyticsManager: AnalyticsManager, stepIndex: number, totalSteps: number, formName: string): void {
        trackFormPageView(analyticsManager, this.plan.id, stepIndex, totalSteps, formName);
    }

    /**
     * Create a manual-capture authorization using the current merchant, assigned plan, variant, drug selections, coupon
     * and commercial checkout UUID. The server computes the hold amount. Returns success/paymentIntent/error.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @param currency Stripe currency code, default usd.
     * @returns The typed result described above.
     * @example const hold = await utils.createAuthorizationIntent(token);
     */
    createAuthorizationIntent(authToken: string, currency: string = 'usd') {
        const state = this.getEmrCheckoutSelectionState();
        const checkout = this.getCheckoutData();
        return createAuthorizationIntent(authToken, this.merchant.id, {
            slug: this.slug,
            assignedPlanId: this.plan.id,
            billingCheckoutUuid: checkout?.billingCheckoutUuid,
            couponCode: checkout?.couponCode,
            variantId: state?.variantId,
            drugSelections: state?.drugSelection,
            currency,
        });
    }

    /**
     * Recover a redirected PaymentIntent and save its payment method using the current merchant and commercial checkout
     * UUID. Returns success/IDs/error/retryable; retryable indicates pending processing.
     * @group Stripe and payments
     * @param authToken Verified patient bearer token for the current session.
     * @param paymentIntentId Stripe PaymentIntent ID returned from authorization/redirect.
     * @returns The typed result described above.
     * @example utils.completeAuthorizationReturn(authToken, paymentIntentId);
     */
    completeAuthorizationReturn(authToken: string, paymentIntentId: string) {
        return completeAuthorizationReturn(authToken, this.merchant.id, paymentIntentId, this.getCheckoutData()?.billingCheckoutUuid);
    }

    /**
     * Read the authenticated patient's available store credit and checkout preference. Amounts are integer cents.
     * @group Payments
     * @param authToken Verified patient bearer token for the current session.
     * @param currency Three-letter ISO currency code for the ledger balance; defaults to usd.
     * @returns The merchant setting, currency, balance in cents, selected preference and refund_used_credits policy for spent credits.
     * @example const credits = await utils.getStoreCredits(token);
     */
    getStoreCredits(authToken: string, currency: string = 'usd') {
        return fetchStoreCredits(authToken, this.merchant.id, currency);
    }

    /**
     * Choose whether available store credits should pay for this and future enrollment, refill and order payments.
     * The server checks merchant enablement and serializes all deductions; the browser never changes a balance.
     * @group Payments
     * @param authToken Verified patient bearer token for the current session.
     * @param useStoreCredits Whether to use available credits before charging the card.
     * @param currency Three-letter ISO currency code for the returned balance; defaults to usd.
     * @returns The updated preference, available balance in integer cents and refund_used_credits policy for spent credits.
     * @example await utils.setStoreCreditPreference(token, true);
     */
    setStoreCreditPreference(authToken: string, useStoreCredits: boolean, currency: string = 'usd') {
        return setStoreCreditPreference(authToken, this.merchant.id, useStoreCredits, currency);
    }

    /**
     * Request a server-authoritative commercial quote for the current plan, variant, drug selections and billing option.
     * Coupon code is optional; signal can cancel stale UI requests. Returns checkout_uuid and a quote with amounts in
     * cents. Throws on network, validation or HTTP errors.
     * @group Coupons and commercial pricing
     * @param authToken Verified patient bearer token for the current session.
     * @param couponCode Coupon code; null or empty means no coupon.
     * @param signal Optional AbortSignal to cancel a stale commercial quote request.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example const purchase = await utils.quoteBillingOption(token, 'WELCOME');
     */
    async quoteBillingOption(authToken: string, couponCode: string | null = null, signal?: AbortSignal): Promise<EmrBillingPurchase> {
        const state = this.getEmrCheckoutSelectionState();
        const response = await enrollmentFetch('/api/patient/billing/quote', {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + authToken },
            body: JSON.stringify({
                merchant_id: this.merchant.id,
                slug: this.slug,
                ab_plan_id: this.plan.id,
                variant_id: state?.variantId,
                drug_selections: state?.drugSelection,
                billing_option_id: this.getSelectedEmrBillingOptionId(),
                coupon_code: couponCode || null,
            }),
        });
        const result = await response.json();
        if (!response.ok)
            throw new Error(
                Object.values(result.errors ?? {})
                    .flat()
                    .join(' ') ||
                    result.message ||
                    'Unable to quote this billing option.',
            );
        return result;
    }

    /**
     * Cancel a previous commercial checkout and release its authorization before changing purchase context. Resolves on
     * success; throws on HTTP/network failure so callers can stop the replacement purchase.
     * @group Coupons and commercial pricing
     * @param authToken Verified patient bearer token for the current session.
     * @param checkoutUuid Commercial checkout UUID returned by quoteBillingOption.
     * @returns A promise for the typed result. See the description for success, failure and retry behavior.
     * @example await utils.cancelBillingCheckout(token, purchase.checkout_uuid);
     */
    async cancelBillingCheckout(authToken: string, checkoutUuid: string): Promise<void> {
        const response = await enrollmentFetch('/api/patient/billing/cancel-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + authToken },
            body: JSON.stringify({ checkout_uuid: checkoutUuid }),
        });
        if (!response.ok) throw new Error('Unable to release the previous billing authorization. Retry before selecting another purchase.');
    }

    /**
     * Cancel background vital timers and invalidate outstanding vital responses. Keep persisted drafts for reload/Stripe
     * return recovery. Call when the owning page unmounts.
     * @group Session
     * @returns No value. See the description for persistence, API and analytics effects.
     * @example utils.dispose();
     */
    dispose(): void {
        this._preferredDrugVersion++;
        this._preferredDrugController?.abort();
        this._preferredDrugResolution = null;
        if (this._vitalSaveTimer !== null) clearTimeout(this._vitalSaveTimer);
        this._vitalSaveTimer = null;
        this._vitalSessionVersion++;
        this._tokenValidated = false;
        this._vitalFlushPromise = null;
    }
}

/**
 * Create one shared EMR enrollment session for survey forms or external consumers.
 * @param config EMR plan, merchant, link slug and optional auth/payment/analytics settings.
 * @returns A stateful API; pass it as customData.emrEnrollmentUtils and call dispose on unmount.
 * @example const utils = createEmrEnrollmentUtils({ plan, merchant, slug });
 */
export function createEmrEnrollmentUtils(config: EmrEnrollmentUtilsConfig): EmrEnrollmentUtils {
    return new EmrEnrollmentUtils(config);
}

/** Constructor alias for consumers that prefer an enrollment module name. */
export { EmrEnrollmentUtils as EmrEnrollmentModule };

export type {
    Address,
    ApplicableCoupon,
    CheckoutData,
    CheckoutPatientInfo,
    CheckoutValidationErrors,
    CouponsResponse,
    EmrBillingQuote,
    EmrCheckoutSelectionState,
    EmrDrugSelectionState,
    EmrRefillVariant,
    EmrTreatmentPlan,
    EmrTreatmentPlanDrug,
    EmrTreatmentPlanDrugGroup,
    PatientAuthConfig,
    PatientAuthData,
    PatientAuthFormData,
    PatientAuthResult,
    PatientInfo,
    StripeInitializationResult,
    StripePaymentMethod,
} from './enrollment-types';
