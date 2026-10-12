export interface PixelMarketingConfig {
    gtm_id?: string | null;
    ga4_id?: string | null;
    meta_pixel_id?: string | null;
    convert?: { script_url?: string | null } | null;
    event_mappings?: { events?: { page_view?: { meta?: { enabled?: boolean } } } };
}

interface MarketingConsentState {
    public_key?: string;
    ready?: boolean;
    requires_consent?: boolean;
    consent_pending?: boolean;
    consent_saved?: boolean;
    consent?: { analytics?: boolean; marketing?: boolean; preferences?: boolean };
}

interface MetaPixelApi {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[][];
    push?: MetaPixelApi;
    loaded?: boolean;
    version?: string;
}

interface MarketingBrowser {
    UNILOOP_PIXEL_REQUIRED?: boolean;
    UNILOOP_PIXEL_STATE?: MarketingConsentState;
    UNILOOP_PIXEL_MARKETING_CONFIG?: PixelMarketingConfig | null;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaPixelApi;
    _fbq?: MetaPixelApi;
    _conv_q?: Array<{ what: string }>;
}

declare global {
    interface Window {
        UNILOOP_PIXEL_MARKETING_CONFIG?: PixelMarketingConfig | null;
    }
}

let installed = false;

function approvedConvertUrl(value?: string | null): string | undefined {
    if (!value) return;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return;
        if (!/^cdn-\d{1,3}\.convertexperiments\.com$/.test(url.hostname) || !/^\/v1\/js\/\d{1,20}-\d{1,20}\.js$/.test(url.pathname)) return;
        if ([...url.searchParams.keys()].some((key) => key !== 'environment')) return;
        if (url.searchParams.has('environment') && !/^[a-zA-Z0-9_-]{1,32}$/.test(url.searchParams.get('environment') || '')) return;
        return url.href;
    } catch {
        return;
    }
}

function appendScript(id: string, src: string): void {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    script.referrerPolicy = 'no-referrer';
    document.head.appendChild(script);
}

function consentSignals(state: MarketingConsentState, marketing: boolean): Record<string, string> {
    return {
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        analytics_storage: state.ready && state.consent?.analytics === true ? 'granted' : 'denied',
        functionality_storage: state.ready && state.consent?.preferences === true ? 'granted' : 'denied',
        personalization_storage: marketing && state.consent?.preferences === true ? 'granted' : 'denied',
        security_storage: 'granted',
    };
}

function googleApi(browser: MarketingBrowser): void {
    browser.dataLayer ??= [];
    browser.gtag ??= function () {
        // Google's bootstrap queue consumes an Arguments object.
        // eslint-disable-next-line prefer-rest-params
        browser.dataLayer?.push(arguments);
    };
}

function loadTags(browser: MarketingBrowser, state: MarketingConsentState): void {
    const config = browser.UNILOOP_PIXEL_MARKETING_CONFIG;
    if (!config) return;
    const ga4 = typeof config.ga4_id === 'string' && /^G-[A-Z0-9]{4,20}$/.test(config.ga4_id) ? config.ga4_id : null;
    const gtm = typeof config.gtm_id === 'string' && /^GTM-[A-Z0-9]{4,20}$/.test(config.gtm_id) ? config.gtm_id : null;
    if (ga4 || gtm) {
        googleApi(browser);
        if (!document.getElementById('uniloop-consented-ga4') && !document.getElementById('uniloop-consented-gtm')) {
            browser.gtag?.('consent', 'default', consentSignals({}, false));
        }
        browser.gtag?.('consent', 'update', consentSignals(state, true));
        if (ga4 && !document.getElementById('uniloop-consented-ga4')) {
            browser.gtag?.('js', new Date());
            browser.gtag?.('config', ga4, { send_page_view: false });
            appendScript('uniloop-consented-ga4', 'https://www.googletagmanager.com/gtag/js?id=' + ga4);
        }
        if (gtm && !document.getElementById('uniloop-consented-gtm')) {
            browser.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
            appendScript('uniloop-consented-gtm', 'https://www.googletagmanager.com/gtm.js?id=' + gtm);
        }
    }
    const meta = typeof config.meta_pixel_id === 'string' && /^\d{5,20}$/.test(config.meta_pixel_id) ? config.meta_pixel_id : null;
    if (meta) {
        if (!browser.fbq) {
            const api: MetaPixelApi = Object.assign(
                (...args: unknown[]) => {
                    if (api.callMethod) api.callMethod(...args);
                    else api.queue.push(args);
                },
                { queue: [] as unknown[][], loaded: true, version: '2.0' },
            );
            api.push = api;
            browser.fbq = api;
            browser._fbq = api;
        }
        browser.fbq('consent', 'grant');
        if (!document.getElementById('uniloop-consented-meta')) {
            browser.fbq('init', meta);
            if (config.event_mappings?.events?.page_view?.meta?.enabled !== false) browser.fbq('track', 'PageView');
            appendScript('uniloop-consented-meta', 'https://connect.facebook.net/en_US/fbevents.js');
        }
    }
    const convert = approvedConvertUrl(config.convert?.script_url);
    if (convert) {
        browser._conv_q ??= [];
        browser._conv_q.push({ what: 'consentGiven' });
        appendScript('uniloop-consented-convert', convert);
    }
}

/** Load vetted merchant SDKs only after acknowledged marketing consent. */
export function installPixelMarketingConsent(): () => void {
    if (typeof window === 'undefined' || installed) return () => undefined;
    installed = true;
    const browser = window as unknown as MarketingBrowser;
    let hadGrant = false;
    let grantedPixel: string | undefined;
    let suspended = false;
    let reloading = false;
    const update = () => {
        if (!browser.UNILOOP_PIXEL_REQUIRED) return;
        const state = browser.UNILOOP_PIXEL_STATE || {};
        const privacySignal = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
        const changedPixel = hadGrant && grantedPixel !== state.public_key;
        const allowed = !changedPixel && state.ready === true && !state.requires_consent && state.consent?.marketing === true && !privacySignal;
        if (allowed) {
            hadGrant = true;
            grantedPixel = state.public_key;
            suspended = false;
            loadTags(browser, state);
            return;
        }
        if (!suspended) {
            // Deny immediately, including while a withdrawal is being saved.
            browser.gtag?.('consent', 'update', consentSignals({}, false));
            browser.fbq?.('consent', 'revoke');
            browser._conv_q?.push({ what: 'consentRequired' });
            suspended = true;
        }
        if (hadGrant && state.ready === true && !state.consent_pending && state.consent_saved !== false && !reloading) {
            reloading = true;
            // A settled server receipt makes reload safe and stops autonomous SDKs.
            window.location.reload();
        }
    };
    window.addEventListener('uniloop:consent', update);
    update();
    return () => {
        window.removeEventListener('uniloop:consent', update);
        installed = false;
    };
}
