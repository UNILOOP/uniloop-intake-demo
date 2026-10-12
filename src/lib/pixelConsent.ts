import type { PixelMarketingConfig } from './pixelMarketing';

interface PixelState {
    public_key?: string;
    ready: boolean;
    requires_consent?: boolean;
    session_id?: string;
    visitor_token?: string;
    consent?: { analytics?: boolean; marketing?: boolean; requires_consent?: boolean };
}

declare global {
    interface Window {
        UNILOOP_PIXEL_REQUIRED?: boolean;
        UNILOOP_PIXEL_SESSION_ID?: string;
        UNILOOP_PIXEL_STATE?: PixelState;
        UNILOOP_PIXEL_INITIAL_TOKEN?: string;
    }
}

export function pixelConsentAllows(category: 'analytics' | 'marketing'): boolean {
    if (typeof window === 'undefined' || !window.UNILOOP_PIXEL_REQUIRED) return true;
    const state = window.UNILOOP_PIXEL_STATE;
    return state?.ready === true && !state.requires_consent && state.consent?.[category] === true;
}

export function pixelSessionId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.UNILOOP_PIXEL_STATE?.session_id ?? window.UNILOOP_PIXEL_SESSION_ID;
}

export function pixelHeaders(): Record<string, string> {
    if (typeof window === 'undefined' || !window.UNILOOP_PIXEL_REQUIRED) return {};
    const token = window.UNILOOP_PIXEL_STATE?.visitor_token ?? window.UNILOOP_PIXEL_INITIAL_TOKEN;
    return token ? { 'X-Uniloop-Visitor-Token': token, ...(window.UNILOOP_PIXEL_STATE?.public_key ? { 'X-Uniloop-Pixel-Key': window.UNILOOP_PIXEL_STATE.public_key } : {}) } : {};
}

interface PixelRuntimeApi {
    useIdentity(token: string): Promise<unknown>;
    activate(token?: string): Promise<unknown>;
    deactivate(): void;
}

let loadedPixel: string | undefined;
let loadedSession: string | undefined;
export function syncPixelRuntime(context: unknown, disabled = false, marketingConfig?: unknown): void {
    const browser = window as Window & { UniloopPixel?: PixelRuntimeApi; UniloopPixels?: Record<string, PixelRuntimeApi> };
    if (!context || typeof context !== 'object' || disabled) {
        browser.UniloopPixel?.deactivate();
        window.UNILOOP_PIXEL_REQUIRED = disabled;
        loadedPixel = undefined;
        loadedSession = undefined;
        return;
    }
    const pixel = context as { public_key?: string; visitor_token?: string; session_id?: string };
    if (!pixel.public_key || !pixel.visitor_token) return;
    window.UNILOOP_PIXEL_REQUIRED = true;
    window.UNILOOP_PIXEL_MARKETING_CONFIG = (marketingConfig as PixelMarketingConfig | null) ?? null;
    window.UNILOOP_PIXEL_SESSION_ID = pixel.session_id;
    if (loadedPixel === pixel.public_key && loadedSession === pixel.session_id) return;
    loadedPixel = pixel.public_key;
    loadedSession = pixel.session_id;
    const state = window.UNILOOP_PIXEL_STATE;
    if (state?.public_key === pixel.public_key && state.session_id === pixel.session_id && browser.UniloopPixel) return;
    if (state?.public_key !== pixel.public_key) browser.UniloopPixel?.deactivate();
    const existing = browser.UniloopPixels?.[pixel.public_key];
    if (existing) {
        const operation = state?.public_key === pixel.public_key ? existing.useIdentity(pixel.visitor_token) : existing.activate(pixel.visitor_token);
        void operation.catch(() => { window.UNILOOP_PIXEL_STATE = { ready: false, requires_consent: true }; });
        return;
    }
    window.UNILOOP_PIXEL_STATE = { public_key: pixel.public_key, ready: false, requires_consent: true, session_id: pixel.session_id };
    window.UNILOOP_PIXEL_INITIAL_TOKEN = pixel.visitor_token;
    const script = document.createElement('script');
    script.src = `/pixels/${encodeURIComponent(pixel.public_key)}.js`;
    document.head.appendChild(script);
}
