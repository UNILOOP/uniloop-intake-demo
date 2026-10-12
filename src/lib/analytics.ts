/**
 * Analytics Manager for tracking patient enrollment lifecycle
 *
 * Sends events to backend which distributes to GTM, GA4, and Meta
 * with automatic HIPAA filtering based on merchant settings.
 */

import { pixelConsentAllows, pixelHeaders, pixelSessionId } from './pixelConsent';
import { pixelEventProtectionActive, pixelInternalMetadata, pixelSafeEvent, pixelSafeMetadata } from './pixelEventPrivacy';

import { splitRootLevelKeys, type ExtraFieldValue, type FieldMapValue } from './analyticsFieldFormats';
import { buildMappedAnalyticsPayload } from '../packages/survey-form-package/src/analytics/mappingTransforms';
import { META_STANDARD_EVENTS } from '../packages/survey-form-package/src/analytics/metaEvents';
import { firePixelEvent, initPixels, type PixelInstance } from './pixelVendors';

export interface AnalyticsEvent {
    category: string;
    action: string;
    label?: string;
    value?: number;
    metadata?: Record<string, any>;
    session_id?: string;
    user_id?: string;
    timestamp?: number;
}

export type UrlParameters = Record<string, string | string[]>;

export interface ClientChannelMapping {
    enabled?: boolean;
    name: string;
    /**
     * Canonical source key → output key (string shorthand) or a field-map
     * entry object `{ to, level, type, format }`; see analyticsFieldFormats.ts.
     */
    field_map?: Record<string, FieldMapValue>;
    drop_keys?: string[];
    hash_keys?: string[];
    extra_fields?: Record<string, ExtraFieldValue>;
}

export interface ClientCustomEvent {
    key: string;
    trigger_event: string;
    condition?: {
        all?: Array<{
            path?: string;
            op?: 'equals' | 'not_equals' | 'in' | 'not_in';
            value?: unknown;
        }>;
        path?: string;
        op?: 'equals' | 'not_equals' | 'in' | 'not_in';
        value?: unknown;
    } | null;
    channels: Record<string, ClientChannelMapping>;
}

export interface ClientEventMappings {
    version?: number;
    global_drop_keys?: Record<string, string[]>;
    global_hash_keys?: Record<string, string[]>;
    events?: Record<string, Record<string, ClientChannelMapping>>;
    custom_events?: ClientCustomEvent[];
}

export interface AnalyticsConfig {
    gtm_id?: string | null;
    ga4_id?: string | null;
    meta_pixel_id?: string | null;
    event_mappings?: ClientEventMappings;
    /**
     * Active custom-pixel instances resolved server-side by
     * AnalyticsService::getFrontendConfig(). Each entry's `key` is the dynamic
     * channel key `pixel:{id}` (mirrors the resolver export + AnyChannelKey).
     * Firing is gated on the matching `event_mappings.events[action]['pixel:{id}']`
     * mapping, which is DEFAULT-DISABLED for these dynamic channels.
     */
    pixels?: PixelInstance[];
    /**
     * Per-channel HIPAA filter flags (the merchant's *_format_hipaa settings),
     * so the browser applies the same output-key filter as the server-side
     * resolver. Missing flags mean "off" (older cached configs).
     */
    hipaa?: {
        gtm?: boolean;
        ga4?: boolean;
        meta?: boolean;
    };
    /**
     * Convert Experiences tag descriptor (account/project ids + script url) for
     * the merchant's active Convert channel. The tag itself is rendered
     * server-side in app.blade.php; this is informational for the client.
     */
    friendbuy?: { merchant_id: string } | null;
    convert?: {
        account_id: string;
        project_id: string;
        environment: string;
        script_url: string;
    } | null;
}

/**
 * Cookie utility functions for session management
 */
const ANALYTICS_SESSION_COOKIE = 'analytics_session_id';
const ANALYTICS_USER_COOKIE_PREFIX = 'analytics_user_id_';
const COOKIE_EXPIRY_DAYS = 30;

function setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        while (cookie.charAt(0) === ' ') {
            cookie = cookie.substring(1, cookie.length);
        }
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }

    return null;
}

function deleteCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

export function getCurrentUrlParameters(): UrlParameters {
    if (typeof window === 'undefined' || !window.location?.search) {
        return {};
    }

    const values: UrlParameters = {};
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of params.entries()) {
        if (key === 'ulpx') continue;
        const existingValue = values[key];

        if (Array.isArray(existingValue)) {
            existingValue.push(value);
            continue;
        }

        values[key] = existingValue === undefined ? value : [existingValue, value];
    }

    return values;
}

/**
 * Convert Experiences visitor context, read from the Convert browser tag when
 * the merchant has the Convert channel connected (see app.blade.php).
 *
 *  - `visitor_id` is Convert's own visitor id from window.convert's
 *    getCurrentVisitorData() (the same id the tag reports to Convert).
 *  - `bucketing` maps experience id => variation id for every experience the
 *    visitor is currently bucketed into (window.convert.currentData.experiences).
 *
 * The backend ConvertProvider needs both to report goals against the right
 * A/B variation, so they are attached to every analytics event and to the
 * enrollment submission. Returns null when the tag is not present.
 */
export interface ConvertVisitorContext {
    visitor_id: string;
    bucketing: Record<string, string>;
}

interface ConvertGlobal {
    getCurrentVisitorData?: () => {
        visitorId?: unknown;
        bucketing?: unknown;
    } | null | undefined;
    currentData?: {
        experiences?: unknown;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readConvertVisitorContext(): ConvertVisitorContext | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const convert = (window as unknown as { convert?: ConvertGlobal }).convert;
    let visitorId: string | null = null;
    const bucketing: Record<string, string> = {};

    try {
        const visitorData = typeof convert?.getCurrentVisitorData === 'function' ? convert.getCurrentVisitorData() : null;
        if (visitorData && typeof visitorData.visitorId === 'string' && visitorData.visitorId !== '') {
            visitorId = visitorData.visitorId;
        }
        if (Array.isArray(visitorData?.bucketing)) {
            for (const entry of visitorData.bucketing) {
                if (!isRecord(entry)) continue;
                const experienceId = entry.experienceId ?? entry.experience_id;
                const variationId = entry.variationId ?? entry.variation_id;
                if (experienceId != null && variationId != null) {
                    bucketing[String(experienceId)] = String(variationId);
                }
            }
        }
    } catch {
        // Convert helper not available on this tag version — fall through.
    }

    try {
        const experiences = convert?.currentData?.experiences;
        if (isRecord(experiences)) {
            for (const [experienceId, experience] of Object.entries(experiences)) {
                if (!isRecord(experience)) continue;
                const variation = isRecord(experience.variation) ? experience.variation : undefined;
                const variationId = variation?.id ?? experience.variation_id;
                if (variationId != null) {
                    bucketing[String(experienceId)] = String(variationId);
                }
            }
        }
    } catch {
        // Ignore — bucketing is optional.
    }

    // No cookie fallback on purpose: the `_conv_v` cookie's `vi:` segment is not
    // the visitor id (verified against a live tag), so only the tag's own
    // getCurrentVisitorData() is trusted.
    if (!visitorId) {
        return null;
    }

    return { visitor_id: visitorId, bucketing };
}

function mergeConvertContext(metadata: Record<string, unknown>): Record<string, unknown> {
    const context = readConvertVisitorContext();
    if (!context) {
        return metadata;
    }

    return {
        ...metadata,
        convert_visitor_id: metadata.convert_visitor_id ?? context.visitor_id,
        convert_bucketing: metadata.convert_bucketing ?? context.bucketing,
    };
}

function mergeUrlParameters(metadata?: Record<string, any>): Record<string, any> {
    const urlParams = getCurrentUrlParameters();

    if (Object.keys(urlParams).length === 0) {
        return metadata ?? {};
    }

    return {
        ...metadata,
        url_params: {
            ...urlParams,
            ...(metadata?.url_params ?? {}),
        },
    };
}

export class AnalyticsManager {
    private merchantId: number;
    private sessionId: string;
    private userId: string | undefined;
    private treatmentId: number | undefined;
    private isEnabled: boolean = true; // Always enabled for internal tracking
    private startTime: number;
    private eventMappings: ClientEventMappings | undefined;
    private pixels: PixelInstance[] = [];
    private hipaa: NonNullable<AnalyticsConfig['hipaa']> = {};

    constructor(merchantId: number, treatmentId?: number, config?: AnalyticsConfig | null) {
        this.merchantId = merchantId;
        this.treatmentId = treatmentId;
        this.sessionId = this.getOrCreateSessionId();
        this.userId = this.getStoredUserId();
        this.startTime = Date.now();

        if (config) {
            this.hydrate(config);
        }
    }

    /**
     * Seed the manager with a config already resolved server-side, avoiding
     * the /api/analytics/config roundtrip.
     */
    hydrate(config: AnalyticsConfig): void {
        this.eventMappings = config.event_mappings;
        this.hipaa = config.hipaa ?? {};
        this.loadPixels(config.pixels);
    }

    /**
     * Store the configured custom-pixel instances and bootstrap each vendor
     * once via the vetted pixelVendors registry. initPixels() is idempotent
     * and SSR-safe, so this is harmless to call on every hydrate/initialize.
     */
    private loadPixels(pixels: PixelInstance[] | undefined): void {
        this.pixels = pixels ?? [];

        if (this.pixels.length > 0 && pixelConsentAllows('marketing')) {
            initPixels(this.pixels);
        }
    }

    /**
     * Initialize analytics manager - checks if merchant has analytics configured
     * Note: Analytics is already enabled by default for internal tracking
     */
    async initialize(): Promise<AnalyticsConfig | null> {
        try {
            const response = await fetch(`/api/analytics/config/${this.merchantId}`);

            if (response.ok) {
                const data = await response.json();

                if (data.success) {
                    const config = data.config || {};
                    this.eventMappings = config.event_mappings;
                    this.hipaa = config.hipaa ?? {};
                    this.loadPixels(config.pixels);

                    return config;
                }
            }

            console.log('[Analytics] No config found, using internal tracking only');
            return null;
        } catch (error) {
            console.error('[Analytics] Failed to initialize:', error);
            return null;
        }
    }

    /**
     * Track a custom event
     */
    async trackEvent(event: AnalyticsEvent): Promise<void> {
        if (!this.isEnabled || !pixelConsentAllows('analytics')) {
            console.warn('[Analytics] Analytics not enabled, skipping event:', event);
            return;
        }

        // Update cookie expiration on every event (sliding expiration)
        this.extendSessionCookie();

        const metadata = mergeConvertContext(mergeUrlParameters(event.metadata));
        const metadataPatientId = metadata.patient_id;
        const inferredUserId = event.user_id
            || this.userId
            || (typeof metadataPatientId === 'string' || typeof metadataPatientId === 'number' ? String(metadataPatientId) : undefined);

        const fullEvent = pixelSafeEvent({
            ...event,
            metadata,
            session_id: pixelSessionId() || event.session_id || this.sessionId,
            user_id: inferredUserId,
            timestamp: event.timestamp || Date.now(),
        });

        // Push to GTM dataLayer (applies merchant mapping + fires custom events)
        if (pixelConsentAllows('marketing')) {
            this.loadPixels(this.pixels);
            this.pushToDataLayer(fullEvent);
        // Fire the Meta browser pixel with the merchant-resolved event name +
        // any matching custom events (PG1/PND/etc.). No-op when fbq or the
        // Meta mapping is missing, so safe to call unconditionally.
        this.fireMetaBrowserPixel(fullEvent);
        // Fire each configured custom-pixel instance (TikTok, Snapchat, …)
        // using its own pixel:{id} mapping. Default-disabled, so this only
        // fires when the merchant explicitly enabled the mapping.
        this.fireCustomPixels(fullEvent);
        }

        try {
            const payload = {
                merchant_id: this.merchantId,
                event: { ...fullEvent, metadata: pixelInternalMetadata(metadata, fullEvent.metadata) },
            };

            // console.log('[Analytics] Tracking event:', payload);

            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...pixelHeaders(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[Analytics] Failed to track event:', error);
            } else {
                await response.json();
                // Success — body intentionally ignored.
            }
        } catch (error) {
            console.error('[Analytics] Error tracking event:', error);
        }
    }

    /**
     * Track a page view
     */
    async trackPageView(url: string, title?: string, additionalData?: Record<string, any>): Promise<void> {
        if (!this.isEnabled || !pixelConsentAllows('analytics')) {
            console.warn('[Analytics] Analytics not enabled, skipping page view');
            return;
        }

        // Update cookie expiration on every event (sliding expiration)
        this.extendSessionCookie();

        try {
            const payload = {
                merchant_id: this.merchantId,
                url,
                title,
                additional_data: {
                    url_params: getCurrentUrlParameters(),
                    ...pixelInternalMetadata(additionalData, pixelSafeMetadata(additionalData)),
                    session_id: pixelSessionId() || this.sessionId,
                },
            };

            // console.log('[Analytics] Tracking page view:', payload);

            const response = await fetch('/api/analytics/page-view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...pixelHeaders(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[Analytics] Failed to track page view:', error);
            } else {
                // console.log('[Analytics] Page view tracked successfully');
            }
        } catch (error) {
            console.error('[Analytics] Error tracking page view:', error);
        }
    }

    /**
     * Track survey lifecycle events
     */
    async trackSurveyStart(treatmentId: number, treatmentName: string, formCount: number): Promise<void> {
        await this.trackEvent({
            category: 'survey',
            action: 'survey_start',
            label: treatmentName,
            metadata: {
                treatment_id: treatmentId,
                form_count: formCount,
            },
        });
    }

    async trackSurveyComplete(treatmentId: number, treatmentName: string, completedPages: number): Promise<void> {
        const completionTime = Date.now() - this.startTime;

        await this.trackEvent({
            category: 'survey',
            action: 'survey_complete',
            label: treatmentName,
            value: completionTime,
            metadata: {
                treatment_id: treatmentId,
                completed_pages: completedPages,
                completion_time_ms: completionTime,
            },
        });
    }

    async trackSurveyAbandon(treatmentId: number, treatmentName: string, currentPage: number, totalPages: number): Promise<void> {
        const timeSpent = Date.now() - this.startTime;

        await this.trackEvent({
            category: 'survey',
            action: 'survey_abandon',
            label: treatmentName,
            value: timeSpent,
            metadata: {
                treatment_id: treatmentId,
                current_page: currentPage,
                total_pages: totalPages,
                time_spent_ms: timeSpent,
            },
        });
    }

    async trackFormPageView(treatmentId: number, pageIndex: number, totalPages: number, formName?: string): Promise<void> {
        await this.trackEvent({
            category: 'survey',
            action: 'page_view',
            label: formName || `Form Page ${pageIndex + 1}`,
            metadata: {
                treatment_id: treatmentId,
                page_index: pageIndex,
                total_pages: totalPages,
                form_name: formName,
            },
        });
    }

    async trackUserAuthenticated(treatmentId: number, patientId?: string): Promise<void> {
        await this.trackEvent({
            category: 'survey',
            action: 'user_authenticated',
            metadata: {
                treatment_id: treatmentId,
            },
            user_id: patientId,
        });
    }

    async trackCheckoutView(treatmentId: number, totalAmount: number, currency: string): Promise<void> {
        await this.trackEvent({
            category: 'checkout',
            action: 'checkout_view',
            value: totalAmount,
            metadata: {
                treatment_id: treatmentId,
                currency,
                total: totalAmount,
                amount: totalAmount,
            },
        });
    }

    async trackPaymentAuthorized(treatmentId: number, totalAmount: number, currency: string, paymentMethod?: string): Promise<void> {
        await this.trackEvent({
            category: 'checkout',
            action: 'payment_authorized',
            value: totalAmount,
            metadata: {
                treatment_id: treatmentId,
                currency,
                total: totalAmount,
                amount: totalAmount,
                payment_method: paymentMethod,
            },
        });
    }

    async trackEnrollmentComplete(treatmentId: number, enrollmentId: number, totalAmount: number): Promise<void> {
        await this.trackEvent({
            category: 'enrollment',
            action: 'enrollment_complete',
            value: totalAmount,
            metadata: {
                treatment_id: treatmentId,
                enrollment_id: enrollmentId,
                total: totalAmount,
                amount: totalAmount,
            },
        });
    }

    /**
     * Track timing/performance metrics
     */
    async trackTiming(category: string, variable: string, value: number, label?: string): Promise<void> {
        await this.trackEvent({
            category: category,
            action: 'timing',
            label: label || variable,
            value: value,
            metadata: {
                variable,
                timing_ms: value,
            },
        });
    }

    /**
     * Set user properties
     */
    async setUserProperties(properties: Record<string, any>): Promise<void> {
        await this.trackEvent({
            category: 'user',
            action: 'set_properties',
            metadata: {
                properties,
            },
        });
    }

    /**
     * Get the current session ID
     */
    getSessionId(): string {
        return pixelSessionId() || this.sessionId;
    }

    /**
     * Get the current user ID
     */
    getUserId(): string | undefined {
        return this.userId;
    }

    /**
     * Get Meta Pixel fbp cookie (_fbp)
     * This cookie is critical for Meta Conversion API attribution
     */
    getMetaFbp(): string | null {
        if (!pixelConsentAllows('marketing')) return null;
        return getCookie('_fbp');
    }

    /**
     * Get Meta Pixel fbc cookie (_fbc)
     * This cookie contains the Facebook Click ID for ad attribution
     */
    getMetaFbc(): string | null {
        if (!pixelConsentAllows('marketing')) return null;
        return getCookie('_fbc');
    }

    /**
     * Get all tracking identifiers for backend submission
     * Includes session_id and Meta Pixel cookies
     */
    getTrackingData(): { session_id: string; fbp?: string; fbc?: string; convert_visitor_id?: string; convert_bucketing?: Record<string, string>; url_params?: UrlParameters } {
        const trackingData: { session_id: string; fbp?: string; fbc?: string; convert_visitor_id?: string; convert_bucketing?: Record<string, string>; url_params?: UrlParameters } = {
            session_id: pixelSessionId() || this.sessionId,
        };

        const fbp = this.getMetaFbp();
        if (fbp) {
            trackingData.fbp = fbp;
        }

        const fbc = this.getMetaFbc();
        if (fbc) {
            trackingData.fbc = fbc;
        }

        // Convert Experiences visitor context (A/B bucketing) so server-side
        // lifecycle events can be attributed to the visitor's variation.
        const convert = readConvertVisitorContext();
        if (convert) {
            trackingData.convert_visitor_id = convert.visitor_id;
            trackingData.convert_bucketing = convert.bucketing;
        }

        const urlParams = getCurrentUrlParameters();
        if (Object.keys(urlParams).length > 0) {
            trackingData.url_params = urlParams;
        }

        return trackingData;
    }

    /**
     * Set the user ID for this analytics instance
     * Persists in cookie for this merchant (and treatment if specified)
     */
    setUserId(userId: string | undefined): void {
        this.userId = userId;
        if (typeof window !== 'undefined' && window.UNILOOP_PIXEL_REQUIRED) return;

        if (userId && pixelConsentAllows('analytics')) {
            const cookieName = this.getUserCookieName();
            setCookie(cookieName, userId, COOKIE_EXPIRY_DAYS);
            // console.log('[Analytics] User ID set and persisted:', userId);
        } else {
            this.clearUserId();
        }
    }

    /**
     * Clear the stored user ID
     */
    clearUserId(): void {
        const cookieName = this.getUserCookieName();
        deleteCookie(cookieName);
        this.userId = undefined;
        console.log('[Analytics] User ID cleared');
    }

    /**
     * Get time elapsed since start
     */
    getElapsedTime(): number {
        return Date.now() - this.startTime;
    }

    /**
     * Clear the current session - useful when patient auth changes
     * Also clears user ID to start fresh with new authenticated user
     */
    clearSession(): void {
        console.log('[Analytics] Clearing session:', this.sessionId);
        deleteCookie(ANALYTICS_SESSION_COOKIE);
        this.clearUserId();
        this.sessionId = this.generateSessionId();
        this.setSessionCookie(this.sessionId);
        console.log('[Analytics] New session created:', this.sessionId);
    }

    /**
     * Get or create session ID from cookie
     */
    private getOrCreateSessionId(): string {
        if (typeof window !== 'undefined' && window.UNILOOP_PIXEL_REQUIRED) return pixelSessionId() || '';
        const existingSessionId = getCookie(ANALYTICS_SESSION_COOKIE);

        if (existingSessionId) {
            // console.log('[Analytics] Using existing session from cookie:', existingSessionId);
            return existingSessionId;
        }

        const newSessionId = this.generateSessionId();
        this.setSessionCookie(newSessionId);
        console.log('[Analytics] Created new session:', newSessionId);
        return newSessionId;
    }

    /**
     * Get stored user ID from cookie for this merchant/treatment
     */
    private getStoredUserId(): string | undefined {
        if (!pixelConsentAllows('analytics')) return undefined;
        const cookieName = this.getUserCookieName();
        const userId = getCookie(cookieName);

        if (userId) {
            // console.log('[Analytics] Loaded stored user ID from cookie:', userId);
            return userId;
        }

        return undefined;
    }

    /**
     * Get the cookie name for storing user ID
     * Format: analytics_user_id_{merchantId} or analytics_user_id_{merchantId}_{treatmentId}
     */
    private getUserCookieName(): string {
        if (this.treatmentId) {
            return `${ANALYTICS_USER_COOKIE_PREFIX}${this.merchantId}_${this.treatmentId}`;
        }
        return `${ANALYTICS_USER_COOKIE_PREFIX}${this.merchantId}`;
    }

    /**
     * Set session ID cookie with expiration
     */
    private setSessionCookie(sessionId: string): void {
        if (!pixelConsentAllows('analytics')) return;
        setCookie(ANALYTICS_SESSION_COOKIE, sessionId, COOKIE_EXPIRY_DAYS);
    }

    /**
     * Extend session cookie expiration (sliding expiration)
     */
    private extendSessionCookie(): void {
        if (typeof window !== 'undefined' && window.UNILOOP_PIXEL_REQUIRED) return;
        setCookie(ANALYTICS_SESSION_COOKIE, this.sessionId, COOKIE_EXPIRY_DAYS);
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Merchant event-mapping config returned by /api/analytics/config. Consumers
     * (e.g. the survey-form-package) use this to drive their own browser pixels
     * with the merchant's custom event names and field maps.
     */
    getEventMappings(): ClientEventMappings | undefined {
        return this.eventMappings;
    }

    /**
     * Push event to GTM dataLayer
     * Applies the merchant's event-name + field-map overrides if configured.
     */
    private pushToDataLayer(event: AnalyticsEvent): void {
        if (typeof window === 'undefined' || !(window as any).dataLayer) {
            return;
        }

        const dataLayer = (window as any).dataLayer;
        const gtmMapping = this.resolveChannelMapping(event.action, 'google_tag_manager');
        const gtmGlobalDrops = this.eventMappings?.global_drop_keys?.google_tag_manager;
        const gtmGlobalHashes = this.eventMappings?.global_hash_keys?.google_tag_manager;

        const baseData: Record<string, unknown> = {
            session_id: pixelSessionId() || event.session_id || this.sessionId,
        };
        if (!pixelEventProtectionActive() && (event.user_id || this.userId)) {
            baseData.user_id = event.user_id || this.userId;
        }

        if (this.isMappingEnabled(gtmMapping)) {
            dataLayer.push(this.buildDataLayerEntry(
                gtmMapping?.name ?? event.action,
                baseData,
                this.buildMappedPayload(this.buildCanonicalPayload(event), gtmMapping, gtmGlobalDrops, gtmGlobalHashes, this.hipaa.gtm ?? false),
                gtmMapping,
            ));
        }

        // Each custom event uses its OWN field_map, matching the server-side
        // resolver's behavior. Reusing the parent's mapped payload would
        // silently drop the custom event's rename intent.
        for (const custom of this.matchingCustomEvents(event, 'google_tag_manager')) {
            dataLayer.push(this.buildDataLayerEntry(
                custom.name,
                baseData,
                this.buildMappedPayload(this.buildCanonicalPayload(event), custom, gtmGlobalDrops, gtmGlobalHashes, this.hipaa.gtm ?? false),
                custom,
            ));
        }
    }

    /**
     * Shape one dataLayer push. `event` and the session/user ids sit at the
     * top; the mapped payload goes under `metadata` (data-layer level 1); any
     * field_map output or extra_fields static key the merchant placed at level
     * 0 is hoisted out of `metadata` next to `event`. The event name is never
     * overridable.
     */
    private buildDataLayerEntry(
        name: string,
        baseData: Record<string, unknown>,
        payload: Record<string, unknown>,
        mapping: ClientChannelMapping | undefined,
    ): Record<string, unknown> {
        const { root, nested } = splitRootLevelKeys(payload, mapping?.field_map, mapping?.extra_fields);
        delete root.event;

        return { event: name, ...baseData, ...root, metadata: nested };
    }

    /**
     * Fire the Meta browser pixel using the merchant-resolved event name.
     * Safe to call on every canonical event; no-op when fbq or the mapping is missing.
     */
    fireMetaBrowserPixel(event: AnalyticsEvent): void {
        if (typeof window === 'undefined' || typeof (window as any).fbq !== 'function') {
            return;
        }
        const mapping = this.resolveChannelMapping(event.action, 'meta');
        const metaGlobalDrops = this.eventMappings?.global_drop_keys?.meta;
        const metaGlobalHashes = this.eventMappings?.global_hash_keys?.meta;

        // Fire the merchant-mapped event. Standard Meta event names go through
        // fbq('track', ...); anything else must use fbq('trackCustom', ...) —
        // fbevents.js suppresses non-standard names passed to track and warns
        // in the console.
        if (mapping?.name && this.isMappingEnabled(mapping)) {
            const standardPayload = this.buildMappedPayload(this.buildCanonicalPayload(event), mapping, metaGlobalDrops, metaGlobalHashes, this.hipaa.meta ?? false);
            const fn = META_STANDARD_EVENTS.has(mapping.name) ? 'track' : 'trackCustom';
            (window as any).fbq(fn, mapping.name, standardPayload);
        }

        // Each custom event gets its own field_map applied — mirrors server-side
        // EventMappingResolver::resolveCustomEvents(), which builds the payload
        // from the custom event's mapping, not the parent's.
        for (const custom of this.matchingCustomEvents(event, 'meta')) {
            const customPayload = this.buildMappedPayload(this.buildCanonicalPayload(event), custom, metaGlobalDrops, metaGlobalHashes, this.hipaa.meta ?? false);
            (window as any).fbq('trackCustom', custom.name, customPayload);
        }
    }

    /**
     * Fire each configured custom-pixel instance using its own dynamic channel
     * key `pixel:{id}`. Mirrors the Meta path but fans out per instance:
     *  - resolves the per-action mapping for `pixel:{id}` (DEFAULT-DISABLED, so
     *    we require an explicit `enabled === true`, NOT isMappingEnabled() which
     *    treats a missing flag as on);
     *  - applies the SAME buildMappedPayload() transforms (drop/hash/rename +
     *    extra_fields) so the client-side payload matches the server resolver;
     *  - uses the mapping's `name` as the vendor event name;
     *  - also fans out matching custom events for `pixel:{id}` like the Meta path.
     * SSR-safe: firePixelEvent() / initPixels() no-op without a window, and an
     * empty `pixels` list short-circuits.
     */
    private fireCustomPixels(event: AnalyticsEvent): void {
        if (typeof window === 'undefined' || this.pixels.length === 0) {
            return;
        }

        for (const pixel of this.pixels) {
            // The instance key IS the dynamic channel key (`pixel:{id}`) used by
            // the server resolver export. Without it we can't resolve a mapping.
            const channelKey = pixel.key;
            if (!channelKey) {
                continue;
            }

            const mapping = this.resolveChannelMapping(event.action, channelKey);
            const globalDrops = this.eventMappings?.global_drop_keys?.[channelKey];
            const globalHashes = this.eventMappings?.global_hash_keys?.[channelKey];

            // Dynamic pixel channels are default-disabled server-side; fire only
            // when the merchant explicitly enabled this action's mapping.
            if (mapping?.name && mapping.enabled === true) {
                const payload = this.buildMappedPayload(this.buildCanonicalPayload(event), mapping, globalDrops, globalHashes, pixel.hipaa_filter ?? false);
                firePixelEvent([pixel], mapping.name, payload);
            }

            // Each custom event applies its own field_map, mirroring the Meta path.
            for (const custom of this.matchingCustomEvents(event, channelKey)) {
                if (!custom.name) {
                    continue;
                }
                const customPayload = this.buildMappedPayload(this.buildCanonicalPayload(event), custom, globalDrops, globalHashes, pixel.hipaa_filter ?? false);
                firePixelEvent([pixel], custom.name, customPayload);
            }
        }
    }

    private resolveChannelMapping(action: string, channel: string): ClientChannelMapping | undefined {
        return this.eventMappings?.events?.[action]?.[channel];
    }

    private isMappingEnabled(mapping: ClientChannelMapping | undefined): boolean {
        return mapping === undefined || (mapping.enabled ?? true);
    }

    private buildCanonicalPayload(event: AnalyticsEvent): Record<string, unknown> {
        const payload: Record<string, unknown> = { ...(event.metadata ?? {}) };
        for (const key of ['value', 'label', 'category', 'action', 'session_id', 'user_id', 'timestamp'] as const) {
            const value = event[key];
            if (value !== undefined && value !== null) {
                payload[key] = value;
            }
        }

        return payload;
    }

    private buildMappedPayload(
        payload: Record<string, unknown>,
        mapping: ClientChannelMapping | undefined,
        globalDrops?: string[],
        globalHashes?: string[],
        hipaaFilter = false,
    ): Record<string, unknown> {
        return buildMappedAnalyticsPayload(payload, mapping, globalDrops, globalHashes, [], hipaaFilter);
    }

    private matchingCustomEvents(event: AnalyticsEvent, channel: string): ClientChannelMapping[] {
        const matches: ClientChannelMapping[] = [];
        for (const custom of this.eventMappings?.custom_events ?? []) {
            if (custom.trigger_event !== event.action) continue;
            const channelMapping = custom.channels?.[channel];
            if (!channelMapping) continue;
            if ((channelMapping.enabled ?? true) === false) continue;
            if (!this.evaluateCondition(custom.condition, event)) continue;
            matches.push(channelMapping);
        }
        return matches;
    }

    private evaluateCondition(condition: ClientCustomEvent['condition'], event: AnalyticsEvent): boolean {
        if (!condition) return true;
        if (Array.isArray(condition.all)) {
            return condition.all.every((clause) => this.evaluateConditionClause(clause, event));
        }

        return this.evaluateConditionClause(condition, event);
    }

    private evaluateConditionClause(condition: NonNullable<ClientCustomEvent['condition']>, event: AnalyticsEvent): boolean {
        if (!condition.path) return true;
        const actual = condition.path.split('.').reduce<unknown>((acc, segment) => (acc as any)?.[segment], event as unknown);
        const expected = condition.value;
        switch (condition.op) {
            case 'not_equals':
                return actual != expected;
            case 'in':
                return Array.isArray(expected) && expected.some((v) => v == actual);
            case 'not_in':
                return Array.isArray(expected) && !expected.some((v) => v == actual);
            case 'equals':
            default:
                return actual == expected;
        }
    }
}
