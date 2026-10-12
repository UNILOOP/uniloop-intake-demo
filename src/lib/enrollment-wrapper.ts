import { identifyIntercom, updateIntercom } from './intercom';
// ============================================================================
// Unified Class Wrapper
// ============================================================================

import { AnalyticsConfig, AnalyticsManager, type UrlParameters } from './analytics';
import {
    AbandonEventContext as AbandonEventContextType,
    Address as AddressType,
    AnalyticsEventData as AnalyticsEventDataType,
    AnalyticsTarget as AnalyticsTargetType,
    AnalyticsTrackingState as AnalyticsTrackingStateType,
    ApplicableCoupon,
    CheckoutData as CheckoutDataType,
    CheckoutPatientInfo as CheckoutPatientInfoType,
    CheckoutSelectionState as CheckoutSelectionStateType,
    CheckoutValidationErrors,
    CouponsResponse as CouponsResponseType,
    CouponValidationContext,
    DEFAULT_PATIENT_AUTH_CONFIG,
    DEFAULT_PATIENT_AUTH_STORAGE_KEY,
    EmrCheckoutSelectionState as EmrCheckoutSelectionStateType,
    EmrDrugSelectionState as EmrDrugSelectionStateType,
    EmrEnrollmentUtils,
    EmrRefillVariant as EmrRefillVariantType,
    EmrRegionScope as EmrRegionScopeType,
    EmrTreatmentPlanDrugGroup as EmrTreatmentPlanDrugGroupType,
    EmrTreatmentPlanDrug as EmrTreatmentPlanDrugType,
    EmrTreatmentPlan as EmrTreatmentPlanType,
    EnrollmentForm as EnrollmentFormType,
    EnrollmentProviderType,
    EnrollmentState as EnrollmentStateType,
    EnrollmentSubmissionResult,
    EnrollmentUtils,
    EnrollmentUtilsConfig,
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
    PricingOption as PricingOptionType,
    STRIPE_CARD_ELEMENT_OPTIONS,
    StripeInitializationResult,
    StripePaymentMethod,
    SUPPORTED_COUNTRIES,
    SurveyFormAnalyticsProp as SurveyFormAnalyticsPropType,
    TreatmentProduct as TreatmentProductType,
    Treatment as TreatmentType,
    TreatmentVariation as TreatmentVariationType,
    US_STATES,
} from './enrollment-types';
import {
    buildAbandonEventData,
    buildPatientAuthResults,
    buildSurveyCompleteEventData,
    buildTabSwitchEventData,
    calculateTotalWithPricingOption,
    clearPatientAuth,
    clearPendingUpdates,
    createAnalyticsEvent,
    createAnalyticsTrackingState,
    createEmptyAddress,
    createEmptyPatientAuthFormData,
    createEmptyPatientInfo,
    // EMR functions
    createEmrEnrollmentUtils,
    createEnrollmentUtils,
    createStripePaymentHandlers,
    createSurveyFormAnalyticsProp,
    deletePaymentMethod,
    EcommerceEventType,
    enrichEventWithEnrollmentAttribution,
    enrichEventWithPatientData,
    extractPatientInfo,
    feetInchesToInches,
    fetchApplicableCoupons,
    fetchPatientAddresses,
    fetchPatientInfo,
    flushPendingUpdates,
    formatPhoneNumber,
    getAllStatesForCountry,
    getCommonAvailableStates,
    getDefaultPaymentMethod,
    getDefaultPricingOption,
    getEmrPlanAvailableStates,
    getPatientAuthStorageKey,
    getPatientAuthToken,
    getPatientMissingFields,
    getPendingUpdates,
    getPricingOptionLabel,
    getRawPhoneDigits,
    getReferencePatient,
    getSelectedAddress,
    getStoredPatient,
    getStoredPatientAuth,
    getStripePaymentFormProps,
    getTreatmentAvailableStates,
    getVariationAvailableStates,
    handlePatientAuthAnalytics,
    inchesToFeetInches,
    // Analytics functions
    initializeEnrollmentAnalytics,
    initializePatientInfo,
    isSetupIntentProcessing,
    isSetupIntentSucceeded,
    isStateAvailableForEmrPlan,
    isStateAvailableForTreatment,
    isStateAvailableForVariation,
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
    shouldTrackEvent,
    // Checkout data type
    StoredCheckoutData,
    StripePaymentForm,
    toSlug,
    trackAnalyticsEvent,
    trackCheckoutView,
    trackFormPageView,
    trackPaymentAuthorized,
    trackUserAuthenticated,
    updatePatientProfile,
    validateAddress,
    validateAddressStateForEmrPlan,
    validateAddressStateForTreatment,
    validateCheckoutForm,
    validateCoupon,
    validatePatientAuth,
    validatePatientAuthForm,
    validatePatientInfo,
    validatePatientToken,
    variationHasPricingOptions,
} from './enrollment-utils';

export interface EnrollmentModuleConfig extends EnrollmentUtilsConfig {
    /**
     * Optional patient auth config.
     * If not provided, DEFAULT_PATIENT_AUTH_CONFIG is used.
     */
    patientAuthConfig?: PatientAuthConfigType;
    /**
     * Optional storage key for patient auth.
     * If not provided, DEFAULT_PATIENT_AUTH_STORAGE_KEY is used.
     */
    patientAuthStorageKey?: string;
    /** Provider type: 'treatment' (default) or 'emr' */
    providerType?: EnrollmentProviderType;
    /** EMR treatment plan (required when providerType is 'emr') */
    plan?: EmrTreatmentPlanType;
    /** EMR enrollment card handling mode (defaults to 'save_only'). */
    chargeMode?: 'save_only' | 'save_and_authorize';
}

/**
 * A single class that exposes all the existing functionalities
 * via instance methods, while keeping all existing functions intact.
 *
 * Example:
 *   const service = new EnrollmentModule({
 *     treatment,
 *     merchant,
 *     slug,
 *     analyticsManager,
 *     patientAuthConfig: DEFAULT_PATIENT_AUTH_CONFIG,
 *   });
 *
 *   const patient = await service.fetchPatientInfo(authToken);
 *   const authResult = await service.sendPatientOtp({ email }, service.patientAuthConfig);
 */
export class EnrollmentModule {
    readonly providerType: EnrollmentProviderType;
    readonly enrollment: EnrollmentUtils | null;
    readonly emrEnrollment: EmrEnrollmentUtils | null;
    readonly patientAuthConfig: PatientAuthConfigType;
    readonly patientAuthStorageKey: string;
    private readonly _chargeMode: 'save_only' | 'save_and_authorize';

    // Private checkout data storage (in-memory, passed via ref)
    private _checkoutData: StoredCheckoutData | null = null;

    // Private vital ID storage (in-memory only, resets on page reload)
    private _vitalId: number | null = null;

    // Whether token has been validated (gates updatePatientField flush behavior)
    private _tokenValidated: boolean = false;

    // Pending vital data for deferred creation (in-memory, flushed after token validation)
    private _pendingVitalData: Record<string, any> | null = null;
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
    readonly US_STATES = US_STATES;
    readonly SUPPORTED_COUNTRIES = SUPPORTED_COUNTRIES;
    readonly STRIPE_CARD_ELEMENT_OPTIONS = STRIPE_CARD_ELEMENT_OPTIONS;
    readonly DEFAULT_PATIENT_AUTH_CONFIG = DEFAULT_PATIENT_AUTH_CONFIG;
    readonly MINIMAL_PATIENT_AUTH_CONFIG = MINIMAL_PATIENT_AUTH_CONFIG;
    readonly FULL_PROFILE_PATIENT_AUTH_CONFIG = FULL_PROFILE_PATIENT_AUTH_CONFIG;
    readonly PHONE_OTP_PATIENT_AUTH_CONFIG = PHONE_OTP_PATIENT_AUTH_CONFIG;
    readonly PASSWORD_PATIENT_AUTH_CONFIG = PASSWORD_PATIENT_AUTH_CONFIG;
    readonly PATIENT_AUTH_STORAGE_PREFIX = PATIENT_AUTH_STORAGE_PREFIX;
    readonly DEFAULT_PATIENT_AUTH_STORAGE_KEY = DEFAULT_PATIENT_AUTH_STORAGE_KEY;
    readonly PENDING_UPDATES_STORAGE_PREFIX = PENDING_UPDATES_STORAGE_PREFIX;

    // expose Stripe payment form component
    readonly StripePaymentForm = StripePaymentForm;

    constructor(config: EnrollmentModuleConfig) {
        this.providerType = config.providerType ?? 'treatment';
        this.patientAuthConfig = config.patientAuthConfig ?? DEFAULT_PATIENT_AUTH_CONFIG;
        this.patientAuthStorageKey = config.patientAuthStorageKey ?? DEFAULT_PATIENT_AUTH_STORAGE_KEY;
        this._analyticsManager = config.analyticsManager ?? null;
        this._analyticsUrlParams = resolveEnrollmentUrlParameters(config.analyticsUrlParams);
        this._chargeMode = config.chargeMode ?? 'save_only';

        if (this.providerType === 'emr' && config.plan) {
            this.enrollment = null;
            this.emrEnrollment = createEmrEnrollmentUtils({
                plan: config.plan,
                merchant: config.merchant,
                slug: config.slug,
                analyticsManager: config.analyticsManager,
                analyticsUrlParams: this._analyticsUrlParams,
            });
        } else {
            this.enrollment = createEnrollmentUtils(config);
            this.emrEnrollment = null;
        }

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

    private withCurrentEmrCheckoutState(data: Omit<StoredCheckoutData, 'timestamp'>): Omit<StoredCheckoutData, 'timestamp'> {
        const emrState = this.emrEnrollment?.getEmrCheckoutSelectionState();
        if (!emrState || data.billingQuote) return data;

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

    private mergeCheckoutDraftData(data: Partial<Omit<StoredCheckoutData, 'timestamp'>>): void {
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
            variationId: data.variationId ?? existing?.variationId,
            pricingOptionId: data.pricingOptionId ?? existing?.pricingOptionId,
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

    get isEmr(): boolean {
        return this.providerType === 'emr';
    }

    get isTreatment(): boolean {
        return this.providerType === 'treatment';
    }

    get plan(): EmrTreatmentPlanType | null {
        return this.emrEnrollment?.plan ?? null;
    }

    /**
     * Get the analytics target for the current provider.
     * Works for both Treatment and EmrTreatmentPlan.
     */
    private get analyticsTarget(): AnalyticsTargetType | null {
        if (this.providerType === 'emr' && this.plan) {
            return { id: this.plan.id, name: this.plan.name };
        }
        if (this.enrollment?.treatment) {
            const t = this.enrollment.treatment;
            return { id: t.id, name: t.name, currency: t.currency };
        }
        return null;
    }

    /**
     * Update the analytics manager reference.
     * Called when analytics initializes after module construction.
     */
    setAnalyticsManager(manager: AnalyticsManager | null): void {
        this._analyticsManager = manager;
    }

    /**
     * Convenience method to track an analytics event.
     * Uses the stored analytics manager and analytics target internally.
     * Every event is enriched with the known patient info (once available).
     */
    track(eventType: EcommerceEventType | string, data?: Record<string, any>): Promise<void> {
        if (!this._analyticsManager || !this.analyticsTarget) return Promise.resolve();
        return trackAnalyticsEvent(this._analyticsManager, eventType, this.analyticsTarget, data, this._patientInfo, this._analyticsUrlParams);
    }

    /**
     * Like {@link track} but fires the event at most once per session
     * (keyed by `eventType` plus an optional discriminator).
     */
    private trackOnce(eventType: EcommerceEventType | string, data?: Record<string, any>, key?: string): Promise<void> {
        const dedupeKey = key ? `${eventType}:${key}` : eventType;
        if (this._firedOnceEvents.has(dedupeKey)) return Promise.resolve();
        this._firedOnceEvents.add(dedupeKey);
        return this.track(eventType, data);
    }

    /**
     * Store/refresh the patient info used to enrich analytics events.
     * Accepts the richer PatientAuthData shape and narrows it to PatientInfo.
     */
    setPatientInfo(patient: PatientInfoType | PatientAuthDataType | null): void {
        if (!patient) {
            this._patientInfo = null;
            return;
        }
        const anyPatient = patient as Record<string, any>;
        this._patientInfo = {
            id: anyPatient.id ?? null,
            email: anyPatient.email ?? '',
            first_name: anyPatient.first_name ?? anyPatient.firstName ?? '',
            last_name: anyPatient.last_name ?? anyPatient.lastName ?? '',
            phone: anyPatient.phone ?? '',
        };
    }

    getPatientInfo(): PatientInfoType | null {
        return this._patientInfo;
    }

    /**
     * Fire the page-level landing event once for this enrollment page instance.
     */
    trackUserLanded(data?: Record<string, any>): void {
        this.trackOnce('user_landed', data);
    }

    /**
     * Fire `survey_start` at most once per session.
     */
    trackSurveyStart(data?: Record<string, unknown>): void {
        this.trackOnce('survey_start', data);
    }

    /**
     * Fire `survey_complete` at most once per session, using the form-aware
     * builder so the payload carries form-list metadata that the generic
     * canonical builder doesn't produce.
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
     * Send a `survey_abandon` (or `checkout_abandon`) beacon. No-op once the
     * enrollment has been marked completed — prevents the success-redirect's
     * beforeunload from counting a completed enrollment as an abandon.
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
     * Fire `tab_switch` (or `checkout`-stage tab_switch) when visibility goes
     * hidden mid-survey. No-op once the enrollment is completed.
     */
    trackTabSwitch(context: AbandonEventContextType, sortedForms: EnrollmentFormType[]): void {
        if (this._enrollmentCompleted) return;
        const eventData = this.buildTabSwitchEventData(context, sortedForms, 'tab_switch');
        if (!eventData || !this._analyticsManager) return;
        const enriched = enrichEventWithEnrollmentAttribution(eventData, this._patientInfo, this._analyticsUrlParams);
        this._analyticsManager.trackEvent(enriched);
    }

    /**
     * Fire `survey_resume` (or `checkout_resume`) when visibility returns
     * after a prior `tab_switch`. No-op once the enrollment is completed.
     */
    trackSurveyResume(context: AbandonEventContextType, sortedForms: EnrollmentFormType[]): void {
        if (this._enrollmentCompleted) return;
        const eventData = this.buildTabSwitchEventData(context, sortedForms, 'survey_resume');
        if (!eventData || !this._analyticsManager) return;
        const enriched = enrichEventWithEnrollmentAttribution(eventData, this._patientInfo, this._analyticsUrlParams);
        this._analyticsManager.trackEvent(enriched);
    }

    /**
     * Mark the enrollment as completed so subsequent abandon/tab events
     * become no-ops. Auto-called when {@link trackEnrollmentCompletionEvents}
     * fires; callers can also invoke this directly the moment a user reaches
     * final-submit (intent-to-complete) to harden against the unload race.
     */
    markEnrollmentCompleted(): void {
        this._enrollmentCompleted = true;
    }

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
        const properties: Record<string, any> = {};
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
    private trackPatientFieldAnalytics(fieldName: string, value: any): void {
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

    private mergePatientInfoField(fieldName: string, value: any): void {
        const patientInfo = this._patientInfo ?? { id: null, email: '', first_name: '', last_name: '', phone: '' };

        if (fieldName === 'email') patientInfo.email = String(value ?? '');
        if (fieldName === 'firstName') patientInfo.first_name = String(value ?? '');
        if (fieldName === 'lastName') patientInfo.last_name = String(value ?? '');
        if (fieldName === 'phone') patientInfo.phone = String(value ?? '');

        this._patientInfo = patientInfo;
    }

    private buildPatientFieldProperties(fieldName: string, value: any): Record<string, any> {
        const properties: Record<string, any> = {};
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

    getDefaultVariant(): EmrRefillVariantType | null {
        return this.emrEnrollment?.getDefaultVariant() ?? null;
    }

    getSelectedVariant(variantId?: string): EmrRefillVariantType | null {
        return this.emrEnrollment?.getSelectedVariant(variantId) ?? null;
    }

    getEmrBillingChoices(variantId?: string) {
        return this.emrEnrollment?.getBillingChoices(variantId) ?? [];
    }

    getVariants(): EmrRefillVariantType[] {
        return this.emrEnrollment?.getVariants() ?? [];
    }

    getVariantPrice(variant: EmrRefillVariantType): number {
        return this.emrEnrollment?.getVariantPrice(variant) ?? 0;
    }

    getVariantLabel(variant: EmrRefillVariantType): string {
        return this.emrEnrollment?.getVariantLabel(variant) ?? '';
    }

    // ------------------------------------------------------------------------
    // EMR Drug methods
    // ------------------------------------------------------------------------

    getStandaloneDrugs(): EmrTreatmentPlanDrugType[] {
        return this.emrEnrollment?.getStandaloneDrugs() ?? [];
    }

    getOptionalDrugs(): EmrTreatmentPlanDrugType[] {
        return this.emrEnrollment?.getOptionalDrugs() ?? [];
    }

    getDrugGroups(): EmrTreatmentPlanDrugGroupType[] {
        return this.emrEnrollment?.getDrugGroups() ?? [];
    }

    getDrugPrice(drug: EmrTreatmentPlanDrugType): number {
        return this.emrEnrollment?.getDrugPrice(drug) ?? 0;
    }

    getDrugAddOnPrice(drug: EmrTreatmentPlanDrugType, selectedPhaseId: string | null): number {
        return this.emrEnrollment?.getDrugAddOnPrice(drug, selectedPhaseId) ?? 0;
    }

    getGroupDefaultDrug(group: EmrTreatmentPlanDrugGroupType): EmrTreatmentPlanDrugType | null {
        return this.emrEnrollment?.getGroupDefaultDrug(group) ?? null;
    }

    // ------------------------------------------------------------------------
    // EMR Selection state
    // ------------------------------------------------------------------------

    setSelectedEmrBillingOptionId(id: number | null): void {
        this.emrEnrollment?.setBillingOptionId(id);
        this.persistTransientEnrollmentState();
    }

    getSelectedEmrBillingOptionId(): number | null {
        return this.emrEnrollment?.getBillingOptionId() ?? null;
    }

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

    getSelectedEmrVariantId(): string | null {
        return this.emrEnrollment?.getSelectedVariantId() ?? null;
    }

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

    getDrugGroupSelection(groupId: number): number[] {
        return this.emrEnrollment?.getDrugGroupSelection(groupId) ?? [];
    }

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

    isOptionalDrugSelected(drugId: number): boolean {
        return this.emrEnrollment?.isOptionalDrugSelected(drugId) ?? false;
    }

    getEmrCheckoutSelectionState(): EmrCheckoutSelectionStateType | null {
        return this.emrEnrollment?.getEmrCheckoutSelectionState() ?? null;
    }

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

    getStandaloneDrugPhase(drugId: number): string | null {
        return this.emrEnrollment?.getStandaloneDrugPhase(drugId) ?? null;
    }

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

    getOptionalDrugPhase(drugId: number): string | null {
        return this.emrEnrollment?.getOptionalDrugPhase(drugId) ?? null;
    }

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

    getGroupDrugPhase(groupId: number, drugId: number): string | null {
        return this.emrEnrollment?.getGroupDrugPhase(groupId, drugId) ?? null;
    }

    getAllDrugChoices(): Array<{ drugId: number; phaseId: string | null }> {
        return this.emrEnrollment?.getAllDrugChoices() ?? [];
    }

    // ------------------------------------------------------------------------
    // EMR Pricing
    // ------------------------------------------------------------------------

    calculateEmrTotal(): number {
        return this.emrEnrollment?.calculateEmrTotal() ?? 0;
    }

    calculateEmrVariantTotal(): number {
        return this.emrEnrollment?.calculateEmrVariantTotal() ?? 0;
    }

    // ------------------------------------------------------------------------
    // EMR Submission
    // ------------------------------------------------------------------------

    submitEmrEnrollment(formResponses: Record<number, any>, checkoutData: CheckoutDataType | null): Promise<EnrollmentSubmissionResult> | null {
        const promise = this.emrEnrollment?.submitEmrEnrollment(formResponses, checkoutData);
        if (!promise) return null;
        return promise.then(async (result) => {
            if (result.success) {
                await this.trackEnrollmentCompletionEvents('emr_enrollment_created', undefined, result.enrollment);
                if (result.redirect_url) {
                    window.location.href = result.redirect_url;
                }
            }
            return result;
        });
    }

    // ------------------------------------------------------------------------
    // EMR State Availability
    // ------------------------------------------------------------------------

    getEmrPlanAvailableStates(country: string = 'US'): string[] {
        if (!this.emrEnrollment?.plan) return [];
        return getEmrPlanAvailableStates(this.emrEnrollment.plan, country);
    }

    isStateAvailableForEmrPlan(state: string, country: string = 'US'): boolean {
        if (!this.emrEnrollment?.plan) return false;
        return isStateAvailableForEmrPlan(state, this.emrEnrollment.plan, country);
    }

    validateAddressStateForEmrPlan(address: AddressType): { valid: boolean; error?: string } {
        if (!this.emrEnrollment?.plan) return { valid: false, error: 'No EMR plan loaded' };
        return validateAddressStateForEmrPlan(address, this.emrEnrollment.plan);
    }

    // ------------------------------------------------------------------------
    // Provider-aware storage key
    // ------------------------------------------------------------------------

    get emrStorageKey(): string | null {
        return this.emrEnrollment?.storageKey ?? null;
    }

    // ------------------------------------------------------------------------
    // Basic config getters
    // ------------------------------------------------------------------------

    get treatment(): TreatmentType | null {
        return this.enrollment?.treatment ?? null;
    }

    get merchant(): MerchantType | null {
        return this.enrollment?.merchant ?? this.emrEnrollment?.merchant ?? null;
    }

    /**
     * The EMR enrollment charge mode (snapshot from merchant settings at page load).
     * Returned to the StripePaymentForm so it knows whether to use a SetupIntent
     * (save_only) or a manual-capture PaymentIntent (save_and_authorize).
     */
    getChargeMode(): 'save_only' | 'save_and_authorize' {
        return this._chargeMode;
    }

    get slug(): string | null {
        return this.enrollment?.slug ?? this.emrEnrollment?.slug ?? null;
    }

    get storageKey(): string | null {
        return this.enrollment?.storageKey ?? this.emrEnrollment?.storageKey ?? null;
    }

    // ------------------------------------------------------------------------
    // Patient data functions
    // ------------------------------------------------------------------------

    fetchPatientInfo(authToken: string): Promise<PatientInfoType | null> {
        return fetchPatientInfo(authToken);
    }

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

    extractPatientInfo(formResponses: Record<number, any>): PatientInfoType {
        return extractPatientInfo(formResponses);
    }

    // ------------------------------------------------------------------------
    // Checkout validation / address helpers
    // ------------------------------------------------------------------------

    isValidEmail(email: string): boolean {
        return isValidEmail(email);
    }

    validatePatientInfo(patientInfo: CheckoutPatientInfoType): CheckoutValidationErrors {
        return validatePatientInfo(patientInfo);
    }

    validateAddress(
        address: AddressType,
        useExistingAddress: boolean,
        existingAddresses: AddressType[],
        selectedAddressId?: string,
    ): CheckoutValidationErrors {
        return validateAddress(address, useExistingAddress, existingAddresses, selectedAddressId);
    }

    validateCheckoutForm(
        patientInfo: CheckoutPatientInfoType,
        address: AddressType,
        useExistingAddress: boolean,
        existingAddresses: AddressType[],
        selectedAddressId?: string,
    ): { isValid: boolean; errors: CheckoutValidationErrors } {
        return validateCheckoutForm(patientInfo, address, useExistingAddress, existingAddresses, selectedAddressId);
    }

    getSelectedAddress(existingAddresses: AddressType[], selectedAddressId: string | undefined, fallbackAddress: AddressType): AddressType {
        return getSelectedAddress(existingAddresses, selectedAddressId, fallbackAddress);
    }

    createEmptyAddress(country: string = 'US'): AddressType {
        return createEmptyAddress(country);
    }

    createEmptyPatientInfo(): CheckoutPatientInfoType {
        return createEmptyPatientInfo();
    }

    initializePatientInfo(initialData: CheckoutPatientInfoType | null): CheckoutPatientInfoType {
        return initializePatientInfo(initialData);
    }

    // ------------------------------------------------------------------------
    // State availability helpers
    // ------------------------------------------------------------------------

    getAllStatesForCountry(country: string = 'US'): string[] {
        return getAllStatesForCountry(country);
    }

    getTreatmentAvailableStates(treatment: TreatmentType, country: string = 'US'): string[] {
        return getTreatmentAvailableStates(treatment, country);
    }

    getVariationAvailableStates(variation: TreatmentVariationType, treatment: TreatmentType, country: string = 'US'): string[] {
        return getVariationAvailableStates(variation, treatment, country);
    }

    isStateAvailableForTreatment(state: string, treatment: TreatmentType, country: string = 'US'): boolean {
        return isStateAvailableForTreatment(state, treatment, country);
    }

    isStateAvailableForVariation(state: string, variation: TreatmentVariationType, treatment: TreatmentType, country: string = 'US'): boolean {
        return isStateAvailableForVariation(state, variation, treatment, country);
    }

    getCommonAvailableStates(variations: TreatmentVariationType[], treatment: TreatmentType, country: string = 'US'): string[] {
        return getCommonAvailableStates(variations, treatment, country);
    }

    validateAddressStateForTreatment(
        address: AddressType,
        treatment: TreatmentType,
        selectedVariation?: TreatmentVariationType,
    ): { valid: boolean; error?: string } {
        return validateAddressStateForTreatment(address, treatment, selectedVariation);
    }

    // ------------------------------------------------------------------------
    // Treatment variation functions
    // ------------------------------------------------------------------------

    getDefaultVariation(): TreatmentVariationType | null {
        return this.enrollment?.getDefaultVariation() ?? null;
    }

    getSelectedVariation(variationId?: number): TreatmentVariationType | null {
        return this.enrollment?.getSelectedVariation(variationId) ?? null;
    }

    getVariationProducts(variation: TreatmentVariationType): TreatmentProductType[] {
        return this.enrollment?.getVariationProducts(variation) ?? [];
    }

    getVariationPrice(variation: TreatmentVariationType): number {
        return this.enrollment?.getVariationPrice(variation) ?? 0;
    }

    getTreatmentProducts(): TreatmentProductType[] {
        return this.enrollment?.getTreatmentProducts() ?? [];
    }

    getVariations(): TreatmentVariationType[] {
        return this.enrollment?.getVariations() ?? [];
    }

    // ------------------------------------------------------------------------
    // Pricing option functions
    // ------------------------------------------------------------------------

    /**
     * Get common pricing options across all products in a variation
     * Returns only pricing options that exist in ALL products (intersection)
     */
    getCommonPricingOptions(variation: TreatmentVariationType): PricingOptionType[] {
        return this.enrollment?.getCommonPricingOptions(variation) ?? [];
    }

    /**
     * Get the default pricing option from a list
     */
    getDefaultPricingOption(pricingOptions: PricingOptionType[]): PricingOptionType | null {
        return getDefaultPricingOption(pricingOptions);
    }

    /**
     * Calculate total price based on selected pricing option
     */
    calculateTotalWithPricingOption(variation: TreatmentVariationType, pricingOptionId: string): number {
        return calculateTotalWithPricingOption(variation, pricingOptionId);
    }

    /**
     * Get a user-friendly label for a pricing option
     */
    getPricingOptionLabel(option: PricingOptionType): string {
        return getPricingOptionLabel(option);
    }

    /**
     * Check if a variation has pricing options available
     */
    variationHasPricingOptions(variation: TreatmentVariationType): boolean {
        return variationHasPricingOptions(variation);
    }

    // ------------------------------------------------------------------------
    // Selection state management
    // ------------------------------------------------------------------------

    /**
     * Set the selected variation ID
     * Note: This also resets the selected pricing option
     */
    setSelectedVariationId(variationId: number | null): void {
        this.enrollment?.setSelectedVariationId(variationId);
        if (variationId != null) {
            const variation = this.getSelectedVariation(variationId);
            this.track('variation_selected', {
                variation_id: variationId,
                variation_name: variation?.name,
            });
        }
    }

    /**
     * Get the currently selected variation ID
     */
    getSelectedVariationId(): number | null {
        return this.enrollment?.getSelectedVariationId() ?? null;
    }

    /**
     * Set the selected pricing option ID
     */
    setSelectedPricingOptionId(pricingOptionId: string | null): void {
        this.enrollment?.setSelectedPricingOptionId(pricingOptionId);
        if (pricingOptionId) {
            const variation = this.getSelectedVariation();
            const option = variation ? this.getCommonPricingOptions(variation).find((o) => o.id === pricingOptionId) : undefined;
            this.track('pricing_option_selected', {
                pricing_option_id: pricingOptionId,
                pricing_option_label: option ? this.getPricingOptionLabel(option) : undefined,
            });
        }
    }

    /**
     * Get the currently selected pricing option ID
     */
    getSelectedPricingOptionId(): string | null {
        return this.enrollment?.getSelectedPricingOptionId() ?? null;
    }

    /**
     * Get the full checkout selection state with all computed values
     * Includes: variation, pricing option, products, total, billing info
     */
    getCheckoutSelectionState(paymentMethod?: 'upfront' | 'per_schedule' | null): CheckoutSelectionStateType | null {
        return this.enrollment?.getCheckoutSelectionState(paymentMethod) ?? null;
    }

    /**
     * Check if a variation is selected (either explicitly or default)
     */
    hasVariationSelected(): boolean {
        return this.enrollment?.hasVariationSelected() ?? false;
    }

    /**
     * Check if a pricing option is selected
     */
    hasPricingOptionSelected(): boolean {
        return this.enrollment?.hasPricingOptionSelected() ?? false;
    }

    /**
     * Reset all selections (variation and pricing option)
     */
    resetSelections(): void {
        this.enrollment?.resetSelections();
    }

    // ------------------------------------------------------------------------
    // Coupon functions
    // ------------------------------------------------------------------------

    getCoupons(patientEmail: string, variationId?: number, subtotal?: number): Promise<CouponsResponseType> | null {
        if (this.isEmr && this.plan) {
            const selectedMerchantDrugIds = this.getSelectedEmrMerchantDrugIds();

            return fetchApplicableCoupons(patientEmail, this.plan.id, undefined, undefined, subtotal ?? this.calculateEmrTotal(), {
                emrTreatmentPlanId: this.plan.id,
                emrBillingOptionId: this.getSelectedEmrBillingOptionId() ?? undefined,
                emrRefillVariantKey: this.getSelectedEmrVariantId() ?? undefined,
                selectedMerchantDrugIds,
            });
        }

        return this.enrollment?.getCoupons(patientEmail, variationId, subtotal) ?? null;
    }

    fetchApplicableCoupons(
        email: string,
        treatmentId: number,
        variationId?: number,
        productVariationIds?: number[],
        subtotal?: number,
        context?: CouponValidationContext,
    ): Promise<CouponsResponseType> {
        return fetchApplicableCoupons(email, treatmentId, variationId, productVariationIds, subtotal, context);
    }

    validateCoupon(
        email: string,
        couponCode: string,
        treatmentId: number,
        variationId?: number,
        productVariationIds?: number[],
        subtotal?: number,
        context?: CouponValidationContext,
    ): Promise<{ valid: boolean; coupon?: ApplicableCoupon; error?: string }> {
        return validateCoupon(email, couponCode, treatmentId, variationId, productVariationIds, subtotal, context);
    }

    /**
     * Validate and apply a coupon. Fires `coupon_applied` on success.
     * Prefer this over {@link validateCoupon} from checkout blocks so analytics stays centralized.
     */
    async applyCoupon(
        email: string,
        couponCode: string,
        treatmentId: number,
        variationId?: number,
        productVariationIds?: number[],
        subtotal?: number,
        context?: CouponValidationContext,
    ): Promise<{ valid: boolean; coupon?: ApplicableCoupon; error?: string }> {
        const result = await validateCoupon(email, couponCode, treatmentId, variationId, productVariationIds, subtotal, context);
        if (result.valid && result.coupon) {
            this.setCheckoutCouponData(result.coupon, subtotal);
            this.track('coupon_applied', {
                coupon_code: result.coupon.code,
                discount: result.coupon.discount_amount,
                discount_type: result.coupon.type,
            });
        }
        return result;
    }

    /**
     * Notify that a coupon was removed. Fires `coupon_removed`.
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
     * Fire the `checkout_view` event (once per session). Call this when a checkout step is shown.
     */
    trackCheckoutViewed(total?: number): void {
        this.trackOnce('checkout_view', {
            total,
            currency: this.analyticsTarget?.currency || 'USD',
        });
    }

    // ------------------------------------------------------------------------
    // Payment / checkout functions (bound to treatment via enrollment)
    // ------------------------------------------------------------------------

    calculateTotal(paymentMethod: 'upfront' | 'per_schedule' | null = 'upfront', variationId?: number, pricingOptionId?: string): number | null {
        return this.enrollment?.calculateTotal(paymentMethod, variationId, pricingOptionId) ?? null;
    }

    submitEnrollment(
        formResponses: Record<number, any>,
        checkoutData: CheckoutDataType | null,
        paymentMethod: 'upfront' | 'per_schedule' | null,
    ): Promise<EnrollmentSubmissionResult> | null {
        const promise = this.enrollment?.submitEnrollment(formResponses, checkoutData, paymentMethod);
        if (!promise) return null;
        return promise.then(async (result) => {
            if (result.success) {
                await this.trackEnrollmentCompletionEvents('enrollment_complete', paymentMethod, result.enrollment);
            }
            return result;
        });
    }

    /**
     * Fire the completion events once when an enrollment submission succeeds.
     */
    private trackEnrollmentCompletionEvents(
        createdEvent: 'enrollment_complete' | 'emr_enrollment_created',
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

    async fetchPaymentMethods(authToken: string): Promise<StripePaymentMethod[]> {
        const paymentMethods = await (this.enrollment?.fetchPaymentMethods(authToken) ??
            this.emrEnrollment?.fetchPaymentMethods(authToken) ??
            Promise.resolve([]));
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

    getDefaultPaymentMethod(paymentMethods: StripePaymentMethod[]): StripePaymentMethod | undefined {
        return getDefaultPaymentMethod(paymentMethods);
    }

    createSetupIntent(authToken: string, forceNew: boolean = false): Promise<StripeInitializationResult> | null {
        return this.enrollment?.createSetupIntent(authToken, forceNew) ?? null;
    }

    deletePaymentMethod(authToken: string, methodId: number): Promise<{ success: boolean; error?: string }> {
        return deletePaymentMethod(authToken, methodId);
    }

    savePaymentMethod(
        authToken: string,
        paymentMethodId: string,
        customerId: string,
        setupIntentId: string,
        setAsDefault: boolean = true,
    ): Promise<{ success: boolean; error?: string }> | null {
        return this.enrollment?.savePaymentMethod(authToken, paymentMethodId, customerId, setupIntentId, setAsDefault) ?? null;
    }

    isSetupIntentProcessing(status: string): boolean {
        return isSetupIntentProcessing(status);
    }

    isSetupIntentSucceeded(status: string): boolean {
        return isSetupIntentSucceeded(status);
    }

    // ------------------------------------------------------------------------
    // State persistence (bound via enrollment)
    // ------------------------------------------------------------------------

    loadState(): Partial<EnrollmentStateType> | null {
        return this.enrollment?.loadState() ?? this.emrEnrollment?.loadState() ?? null;
    }

    saveState(state: Partial<EnrollmentStateType>): void {
        if (this.enrollment) {
            this.enrollment.saveState(state);
            return;
        }

        this.emrEnrollment?.saveState(state);
    }

    clearState(): void {
        if (this.enrollment) {
            this.enrollment.clearState();
            return;
        }

        this.emrEnrollment?.clearState();
    }

    // ------------------------------------------------------------------------
    // Analytics helpers (basic)
    // ------------------------------------------------------------------------

    enrichEventWithPatientData(eventData: any, patientInfo: PatientInfoType | null): any {
        return enrichEventWithPatientData(eventData, patientInfo);
    }

    toSlug(text: string): string {
        return toSlug(text);
    }

    sendAbandonBeacon(eventData: any, analyticsManager: AnalyticsManager): boolean | null {
        return this.enrollment?.sendAbandonBeacon(eventData, analyticsManager) ?? null;
    }

    // ------------------------------------------------------------------------
    // Analytics - Enrollment Analytics Manager
    // ------------------------------------------------------------------------

    /**
     * Initialize analytics manager for enrollment
     * Returns the analytics manager and any loaded config (for external scripts like GA4, Meta Pixel)
     */
    async initializeAnalytics(): Promise<{ analyticsManager: AnalyticsManager; config: AnalyticsConfig | null }> {
        const target = this.treatment ?? this.plan;
        if (!target || !this.merchant) {
            throw new Error('Treatment/plan and merchant are required to initialize analytics');
        }
        return initializeEnrollmentAnalytics(this.merchant.id, target.id);
    }

    /**
     * Create initial analytics tracking state for deduplication
     */
    createAnalyticsTrackingState(): AnalyticsTrackingStateType {
        return createAnalyticsTrackingState();
    }

    /**
     * Check if an event should be tracked or if it's a duplicate
     * Returns whether to track and the updated state
     */
    shouldTrackEvent(
        eventAction: string,
        eventData: any,
        trackingState: AnalyticsTrackingStateType,
    ): { shouldTrack: boolean; updatedState: AnalyticsTrackingStateType } {
        return shouldTrackEvent(eventAction, eventData, trackingState);
    }

    /**
     * Build abandon event data based on current enrollment context
     */
    buildAbandonEventData(
        context: AbandonEventContextType,
        sortedForms: EnrollmentFormType[],
        abandonReason: 'browser_close' | 'tab_hidden' = 'browser_close',
    ): AnalyticsEventDataType | null {
        if (!this.analyticsTarget) return null;
        return buildAbandonEventData(context, this.analyticsTarget, sortedForms, abandonReason);
    }

    /**
     * Build tab switch event data
     */
    buildTabSwitchEventData(
        context: AbandonEventContextType,
        sortedForms: EnrollmentFormType[],
        eventType: 'tab_switch' | 'survey_resume' | 'checkout_resume',
    ): AnalyticsEventDataType | null {
        if (!this.analyticsTarget) return null;
        return buildTabSwitchEventData(context, this.analyticsTarget, sortedForms, eventType);
    }

    /**
     * Build survey complete event data (fired when all forms are completed)
     */
    buildSurveyCompleteEventData(sortedForms: EnrollmentFormType[]): AnalyticsEventDataType | null {
        if (!this.analyticsTarget || !this.merchant) return null;
        return buildSurveyCompleteEventData(this.analyticsTarget, this.merchant, sortedForms);
    }

    /**
     * Send abandon beacon with enriched patient data
     */
    sendEnrichedAbandonBeacon(eventData: AnalyticsEventDataType, patientInfo: PatientInfoType | null, analyticsManager: AnalyticsManager): boolean {
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
     * Track checkout view event
     */
    trackCheckoutView(analyticsManager: AnalyticsManager, total: number): void {
        if (!this.analyticsTarget) return;
        trackCheckoutView(analyticsManager, this.analyticsTarget.id, total, this.analyticsTarget.currency ?? 'USD');
    }

    /**
     * Track payment authorized event
     */
    trackPaymentAuthorized(analyticsManager: AnalyticsManager, total: number, paymentMethod: string): void {
        if (!this.analyticsTarget) return;
        trackPaymentAuthorized(analyticsManager, this.analyticsTarget.id, total, this.analyticsTarget.currency ?? 'USD', paymentMethod);
    }

    /**
     * Track user authenticated event
     */
    trackUserAuthenticated(analyticsManager: AnalyticsManager, userId?: string): void {
        if (!this.analyticsTarget) return;
        trackUserAuthenticated(analyticsManager, this.analyticsTarget.id, userId);
    }

    /**
     * Track form page view for navigation between forms
     */
    trackFormPageView(analyticsManager: AnalyticsManager, stepIndex: number, totalSteps: number, formName: string): void {
        if (!this.analyticsTarget) return;
        trackFormPageView(analyticsManager, this.analyticsTarget.id, stepIndex, totalSteps, formName);
    }

    /**
     * Create SurveyForm analytics prop object
     * This provides the analytics interface expected by the SurveyForm component
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

    /**
     * Handle patient authentication analytics update
     * Called when patient authenticates to update analytics user ID
     */
    handlePatientAuthAnalytics(analyticsManager: AnalyticsManager, patientId: number): void {
        const existingUserId = analyticsManager.getUserId() ?? null;
        handlePatientAuthAnalytics(analyticsManager, patientId, existingUserId);
    }

    /**
     * Create a standardized analytics event
     * Handles known e-commerce events with standard formatting
     * Can be used by SurveyForm blocks to create events for any type
     *
     * @param eventType - The event type (e.g., 'checkout_started', 'bmi_set', or custom)
     * @param data - Optional data to include in the event
     * @returns The formatted analytics event data, or null if target not available
     */
    createEvent(eventType: EcommerceEventType | string, data?: Record<string, any>): AnalyticsEventDataType | null {
        if (!this.analyticsTarget) return null;
        return createAnalyticsEvent(eventType, this.analyticsTarget, data);
    }

    /**
     * Track a custom analytics event
     * Creates and tracks an event in one call - convenience method for SurveyForm blocks
     *
     * @param analyticsManager - The analytics manager instance
     * @param eventType - The event type (e.g., 'checkout_started', 'bmi_set', or custom)
     * @param data - Optional data to include in the event
     * @param patientInfo - Optional patient info to enrich the event
     */
    trackEvent(
        analyticsManager: AnalyticsManager,
        eventType: EcommerceEventType | string,
        data?: Record<string, any>,
        patientInfo?: PatientInfoType | null,
    ): void {
        if (!this.analyticsTarget) return;
        trackAnalyticsEvent(analyticsManager, eventType, this.analyticsTarget, data, patientInfo);
    }

    // ------------------------------------------------------------------------
    // Stripe component utilities
    // ------------------------------------------------------------------------

    createStripePaymentHandlers(callbacks: {
        onPaymentSuccess: (data: { paymentMethodId: string; patientInfo: any; address: AddressType; useExistingAddress: boolean }) => void;
        onPaymentError: (error: string) => void;
        validateForm: () => boolean;
        getFormData: () => {
            patientInfo: any;
            address: AddressType;
            useExistingAddress: boolean;
            existingAddresses: AddressType[];
            selectedAddressId?: string;
        };
    }) {
        return createStripePaymentHandlers(callbacks);
    }

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

    getPatientAuthStorageKey(identifier?: string): string {
        return getPatientAuthStorageKey(identifier);
    }

    getStoredPatientAuth(storageKey: string = this.patientAuthStorageKey): PatientAuthStorageData | null {
        return getStoredPatientAuth(storageKey);
    }

    savePatientAuth(token: string, patient: PatientAuthDataType, storageKey: string = this.patientAuthStorageKey): void {
        return savePatientAuth(token, patient, storageKey);
    }

    clearPatientAuth(storageKey: string = this.patientAuthStorageKey): void {
        updateIntercom(null);
        return clearPatientAuth(storageKey);
    }

    getPatientAuthToken(storageKey: string = this.patientAuthStorageKey): string | null {
        return getPatientAuthToken(storageKey);
    }

    getStoredPatient(storageKey: string = this.patientAuthStorageKey): PatientAuthDataType | null {
        return getStoredPatient(storageKey);
    }

    // ------------------------------------------------------------------------
    // Patient validation & formatting
    // ------------------------------------------------------------------------

    formatPhoneNumber(value: string): string {
        return formatPhoneNumber(value);
    }

    getRawPhoneDigits(formattedPhone: string): string {
        return getRawPhoneDigits(formattedPhone);
    }

    isValidPatientEmail(email: string): boolean {
        return isValidPatientEmail(email);
    }

    isValidPatientPhone(phone: string): boolean {
        return isValidPatientPhone(phone);
    }

    isValidOtp(otp: string): boolean {
        return isValidOtp(otp);
    }

    getPatientMissingFields(patient: PatientAuthDataType, config: PatientAuthConfigType = this.patientAuthConfig): string[] {
        return getPatientMissingFields(patient, config);
    }

    validatePatientAuthForm(
        formData: Partial<PatientAuthFormDataType>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        step: 'auth' | 'verify' | 'collect',
    ): { isValid: boolean; errors: PatientAuthValidationErrors } {
        return validatePatientAuthForm(formData, config, step);
    }

    createEmptyPatientAuthFormData(): PatientAuthFormDataType {
        return createEmptyPatientAuthFormData();
    }

    // ------------------------------------------------------------------------
    // Patient auth API functions
    // ------------------------------------------------------------------------

    async sendPatientOtp(
        formData: Pick<PatientAuthFormDataType, 'email' | 'phone'>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await sendPatientOtp(formData, config, storageKey);
        if (result.success && result.token && result.patient) {
            void identifyIntercom(result.token);
            this._tokenValidated = true;
            await this.flushPendingVitals();
            this.handleAuthSuccessAnalytics(result, config);
        }
        return result;
    }

    async validatePatientAuth(
        formData: Pick<PatientAuthFormDataType, 'email' | 'phone' | 'otp' | 'password'>,
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await validatePatientAuth(formData, config, storageKey);
        if (result.success && result.token) {
            void identifyIntercom(result.token);
            this._tokenValidated = true;
            await this.flushPendingVitals();
        }
        this.handleAuthSuccessAnalytics(result, config);
        return result;
    }

    async validatePatientToken(
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        const result = await validatePatientToken(config, storageKey);
        if (result.success && result.token) {
            void identifyIntercom(result.token);
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

    async updatePatientProfile(
        formData: Partial<PatientAuthFormDataType>,
        missingFields: string[],
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
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
     * Update specific patient fields (simplified version of updatePatientProfile)
     * Useful for updating individual fields like dateOfBirth, gender, etc.
     * If no patient token exists, updates are queued locally until a token is available.
     */
    async updatePatientField(fieldName: string, value: any, storageKey: string = this.patientAuthStorageKey): Promise<PatientAuthResultType> {
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
            formData.dateOfBirth = value;
        } else if (fieldName === 'gender') {
            formData.gender = value;
            formData.genderBiological = value;
        } else if (fieldName === 'genderBiological') {
            formData.genderBiological = value;
        } else if (fieldName === 'height') {
            formData.height = value;
        } else if (fieldName === 'weight') {
            formData.weight = value;
        } else if (fieldName === 'firstName') {
            formData.firstName = value;
        } else if (fieldName === 'lastName') {
            formData.lastName = value;
        } else if (fieldName === 'middleName') {
            formData.middleName = value;
        } else if (fieldName === 'email') {
            formData.email = value;
        } else if (fieldName === 'phone') {
            formData.phone = value;
        }

        return updatePatientProfile(formData, [fieldName], this.patientAuthConfig, storageKey);
    }

    logoutPatient(storageKey: string = this.patientAuthStorageKey): void {
        this.setTokenValidated(false);
        this._vitalSessionVersion++;
        this._vitalFlushPromise = null;
        this._vitalId = null;
        this.clearPendingVitalData();
        updateIntercom(null);
        return logoutPatient(storageKey);
    }

    /**
     * Flush all pending patient updates to the server
     * Call this after a patient token becomes available to sync locally queued updates
     */
    flushPendingUpdates(
        config: PatientAuthConfigType = this.patientAuthConfig,
        storageKey: string = this.patientAuthStorageKey,
    ): Promise<PatientAuthResultType> {
        return flushPendingUpdates(config, storageKey);
    }

    /**
     * Get all pending patient updates that haven't been synced to the server
     */
    getPendingUpdates(storageKey: string = this.patientAuthStorageKey): PendingUpdatesData | null {
        return getPendingUpdates(storageKey);
    }

    /**
     * Get the reference patient (locally accumulated patient data before token exists)
     */
    getReferencePatient(storageKey: string = this.patientAuthStorageKey): PatientAuthDataType | null {
        return getReferencePatient(storageKey);
    }

    /**
     * Clear all pending updates from local storage
     */
    clearPendingUpdates(storageKey: string = this.patientAuthStorageKey): void {
        return clearPendingUpdates(storageKey);
    }

    // ------------------------------------------------------------------------
    // Patient auth result builder
    // ------------------------------------------------------------------------

    buildPatientAuthResults(patient: PatientAuthDataType, token: string): Record<string, any> {
        return buildPatientAuthResults(patient, token);
    }

    // ------------------------------------------------------------------------
    // Height / weight conversion helpers
    // ------------------------------------------------------------------------

    inchesToFeetInches(totalInches: number | string): { feet: number; inches: number } {
        return inchesToFeetInches(totalInches);
    }

    feetInchesToInches(feet: number, inches: number): number {
        return feetInchesToInches(feet, inches);
    }

    // ------------------------------------------------------------------------
    // Checkout Data Management (in-memory state)
    // ------------------------------------------------------------------------

    /**
     * Store checkout data
     * Should be called by checkout blocks when payment is successfully authorized
     */
    setCheckoutData(data: Omit<StoredCheckoutData, 'timestamp'>): void {
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
     * Get stored checkout data
     * Returns null if no checkout data exists
     */
    getCheckoutData(): StoredCheckoutData | null {
        this.refreshCheckoutDataFromCurrentEmrState();
        return this._checkoutData;
    }

    /**
     * Check if checkout data exists
     */
    hasCheckoutData(): boolean {
        return this._checkoutData !== null;
    }

    /**
     * Clear checkout data
     */
    clearCheckoutData(): void {
        this._checkoutData = null;
        this.persistTransientEnrollmentState();
    }

    // ------------------------------------------------------------------------
    // Partial Checkout Data Setters (for modular blocks)
    // ------------------------------------------------------------------------

    /**
     * Set patient info portion of checkout data
     * Merges with existing checkout data
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
     * Get patient info from checkout data
     */
    getCheckoutPatientInfo(): StoredCheckoutData['patientInfo'] | null {
        return this._checkoutData?.patientInfo ?? null;
    }

    /**
     * Set address portion of checkout data
     * Merges with existing checkout data
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
     * Get address from checkout data
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
     * Set payment data portion of checkout data
     * Merges with existing checkout data
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
     * Get payment data from checkout data
     */
    getCheckoutPaymentData(): {
        stripePaymentMethodId?: string;
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
     * Set or clear coupon data on the persisted checkout draft.
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
     * Get coupon data from the persisted checkout draft.
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
     * Update checkout data with variation and pricing option
     * Called when selection changes
     */
    setCheckoutSelectionData(data: { variationId?: number; pricingOptionId?: string }): void {
        const existing = this._checkoutData;
        if (existing) {
            this._checkoutData = {
                ...existing,
                variationId: data.variationId ?? existing.variationId,
                pricingOptionId: data.pricingOptionId ?? existing.pricingOptionId,
                timestamp: new Date().toISOString(),
            };
            this.persistTransientEnrollmentState();
        }
    }

    /**
     * Check if checkout data is complete (has all required fields)
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
    // Vitals lifecycle (in-memory only, resets on page reload)
    // ------------------------------------------------------------------------

    /**
     * Create or update a patient vital record.
     * First call (when _vitalId is null) creates a new vital via POST.
     * Subsequent calls update the existing vital via PATCH.
     * Requires authentication — does NOT queue to localStorage.
     */
    async updateVital(data: Record<string, any>): Promise<{ success: boolean; vitalId: number | null; error?: string }> {
        const sessionVersion = this._vitalSessionVersion;
        const token = this.getPatientAuthToken();
        if (!token) {
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
                const response = await fetch(`${baseUrl}/vitals`, {
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
                const response = await fetch(`${baseUrl}/vitals/${this._vitalId}`, {
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
            console.error('[EnrollmentModule] Error updating vital:', error);
            return { success: false, vitalId: this._vitalId, error: 'Network error' };
        }
    }

    /**
     * Get the current in-memory vital ID (null if no vital created yet)
     */
    getVitalId(): number | null {
        return this._vitalId;
    }

    /**
     * Clear the in-memory vital ID (forces next updateVital to create a new record)
     */
    clearVitalId(): void {
        this._vitalId = null;
        this.persistTransientEnrollmentState();
    }

    // ------------------------------------------------------------------------
    // Token validation gate
    // ------------------------------------------------------------------------

    isTokenValidated(): boolean {
        return this._tokenValidated;
    }

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

    setPendingVitalData(data: Record<string, any>): void {
        this._pendingVitalData = { ...(this._pendingVitalData || {}), ...data };
        this.persistTransientEnrollmentState();
        this.scheduleVitalSave();
    }

    getPendingVitalData(): Record<string, any> | null {
        return this._pendingVitalData;
    }

    clearPendingVitalData(): void {
        this._pendingVitalData = null;
        this.scheduleVitalSave();
        this.persistTransientEnrollmentState();
    }

    /**
     * Flush pending vital data by creating/updating a vital record.
     * Should only be called after token validation succeeds.
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
}

// ============================================================================
// Type utilities to extract types from EnrollmentModule
// Use these to infer types from the module instance without separate imports
// ============================================================================

/**
 * Extract types from EnrollmentModule methods
 * Usage: const config: EnrollmentModuleTypes['PatientAuthConfig'] = {...}
 */
export namespace EnrollmentModuleTypes {
    export type PatientAuthConfig = PatientAuthConfigType;
    export type PatientAuthFormData = PatientAuthFormDataType;
    export type PatientAuthData = PatientAuthDataType;
    export type PatientAuthResult = PatientAuthResultType;
    export type PatientInfo = PatientInfoType;
    export type Address = AddressType;
    export type Treatment = TreatmentType;
    export type Merchant = MerchantType;
    export type TreatmentVariation = TreatmentVariationType;
    export type TreatmentProduct = TreatmentProductType;
    export type PricingOption = PricingOptionType;
    export type CheckoutPatientInfo = CheckoutPatientInfoType;
    export type CheckoutData = CheckoutDataType;
    export type CheckoutSelectionState = CheckoutSelectionStateType;
    export type EnrollmentState = EnrollmentStateType;
    export type Coupon = ApplicableCoupon;
    export type CouponsResponse = CouponsResponseType;
    export type StoredCheckout = StoredCheckoutData;
    // Analytics types
    export type EnrollmentForm = EnrollmentFormType;
    export type AnalyticsEventData = AnalyticsEventDataType;
    export type AnalyticsTrackingState = AnalyticsTrackingStateType;
    export type SurveyFormAnalyticsProp = SurveyFormAnalyticsPropType;
    export type AbandonEventContext = AbandonEventContextType;
    export type EcommerceEvent = EcommerceEventType;
    // EMR types
    export type ProviderType = EnrollmentProviderType;
    export type EmrPlan = EmrTreatmentPlanType;
    export type EmrDrug = EmrTreatmentPlanDrugType;
    export type EmrDrugGroup = EmrTreatmentPlanDrugGroupType;
    export type EmrVariant = EmrRefillVariantType;
    export type EmrRegion = EmrRegionScopeType;
    export type EmrDrugSelection = EmrDrugSelectionStateType;
    export type EmrSelectionState = EmrCheckoutSelectionStateType;
}
