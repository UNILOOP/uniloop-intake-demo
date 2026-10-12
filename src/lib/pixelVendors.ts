/**
 * Vetted browser-pixel vendor registry.
 *
 * Each entry is a hand-written, XSS-safe implementation of a single vendor's
 * standard browser-pixel bootstrap + event call. No merchant-supplied markup or
 * script is ever evaluated — only a merchant-configured pixel ID (a plain
 * string) flows through these functions. This is the deliberate counterpart to
 * loading arbitrary remote tags: merchants pick a vetted vendor key and provide
 * an ID, and OUR code performs the well-known bootstrap for that vendor.
 *
 * The vendor keys MUST mirror App\Enums\PixelVendor (tiktok, snapchat,
 * pinterest, linkedin, reddit, twitter). If the backend enum gains a vendor,
 * add it here in lockstep.
 *
 * Everything here is SSR-safe: each init/track guards `typeof window` and
 * no-ops on the server. Each init is idempotent — it guards against
 * double-loading the vendor script/global so repeated calls (e.g. multiple
 * pixel instances of the same vendor, or React re-renders) are harmless.
 */

/**
 * The canonical vendor keys, mirroring App\Enums\PixelVendor::values() in
 * declaration order.
 */
export const PIXEL_VENDOR_KEYS = ['tiktok', 'snapchat', 'pinterest', 'linkedin', 'reddit', 'twitter'] as const;

export type PixelVendorKey = (typeof PIXEL_VENDOR_KEYS)[number];

/**
 * A single vetted vendor definition. `init` performs the vendor's standard
 * pixel bootstrap (idempotent); `track` fires a single event for an already
 * initialized pixel.
 */
export interface PixelVendorDefinition {
    label: string;
    /**
     * Config keys the merchant must provide for this vendor. Today every vendor
     * needs only a pixel ID, but the shape leaves room for vendor-specific
     * required fields without changing the registry contract.
     */
    requiredFields: string[];
    init(pixelId: string): void;
    track(pixelId: string, eventName: string, payload: Record<string, unknown>): void;
}

/**
 * A merchant-configured pixel instance, as shipped by the backend
 * (AnalyticsService::getFrontendConfig()'s `pixels` array).
 */
export interface PixelInstance {
    key: string;
    vendor: PixelVendorKey | string | null;
    pixel_id: string | null;
    /** Apply the HIPAA output filter to this pixel's payloads (the channel's hipaa_filter setting). */
    hipaa_filter?: boolean;
}

/**
 * Narrow access to vendor globals on `window` without polluting the global
 * `Window` interface (the survey package already declares some of these with
 * looser signatures). We read/write through this typed view instead.
 */
interface VendorWindow {
    ttq?: TikTokPixel;
    TiktokAnalyticsObject?: string;
    snaptr?: SnapPixel;
    pintrk?: PinterestPixel;
    rdt?: RedditPixel;
    lintrk?: LinkedInPixel;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    twq?: TwitterPixel;
}

interface TikTokPixel {
    (...args: unknown[]): void;
    methods?: string[];
    load?: (id: string) => void;
    track?: (event: string, data?: Record<string, unknown>) => void;
    page?: () => void;
    instance?: (id: string) => unknown;
    _i?: Record<string, unknown[]>;
    _t?: Record<string, number>;
    _o?: Record<string, unknown>;
    setAndDefer?: (target: unknown, method: string) => void;
}

interface SnapPixel {
    (...args: unknown[]): void;
    queue?: unknown[];
    handleRequest?: (...args: unknown[]) => void;
}

interface PinterestPixel {
    (...args: unknown[]): void;
    queue?: unknown[];
    version?: string;
}

interface RedditPixel {
    (...args: unknown[]): void;
    callQueue?: unknown[];
    sendEvent?: (...args: unknown[]) => void;
}

type LinkedInPixel = ((...args: unknown[]) => void) & { q?: unknown[] };

interface TwitterPixel {
    (...args: unknown[]): void;
    exe?: (...args: unknown[]) => void;
    queue?: unknown[];
    version?: string;
}

/**
 * Resolve the typed vendor-global view, or null on the server / when there is
 * no window. Every init/track funnels through this so SSR-safety lives in one
 * place.
 */
function vendorWindow(): (Window & VendorWindow) | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window as Window & VendorWindow;
}

/**
 * Inject a vendor `<script src>` once, keyed by a stable id so repeated calls
 * are no-ops. Returns false if the document is unavailable (SSR).
 */
function injectScriptOnce(scriptId: string, src: string): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    if (document.getElementById(scriptId)) {
        return false;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = src;

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
    } else {
        document.head.appendChild(script);
    }

    return true;
}

/**
 * The vetted vendor registry. Keys mirror App\Enums\PixelVendor.
 */
export const PIXEL_VENDORS: Record<PixelVendorKey, PixelVendorDefinition> = {
    tiktok: {
        label: 'TikTok',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            if (!win.ttq) {
                win.TiktokAnalyticsObject = 'ttq';
                const ttq: TikTokPixel = (() => {
                    /* root callable is unused once methods below are deferred */
                }) as TikTokPixel;
                ttq.methods = [
                    'page',
                    'track',
                    'identify',
                    'instances',
                    'debug',
                    'on',
                    'off',
                    'once',
                    'ready',
                    'alias',
                    'group',
                    'enableCookie',
                    'disableCookie',
                    'holdConsent',
                    'revokeConsent',
                    'grantConsent',
                ];
                ttq.setAndDefer = (target: unknown, method: string): void => {
                    (target as Record<string, unknown>)[method] = (...args: unknown[]): unknown => {
                        const queue = ((ttq as unknown as { _q?: unknown[][] })._q ??= []);
                        queue.push([method, ...args]);
                        return target;
                    };
                };
                for (const method of ttq.methods) {
                    ttq.setAndDefer(ttq, method);
                }
                ttq.load = (id: string): void => {
                    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
                    ttq._i ??= {};
                    ttq._i[id] = [];
                    ttq._t ??= {};
                    ttq._t[id] = Date.now();
                    ttq._o ??= {};
                    ttq._o[id] = {};
                    injectScriptOnce('tiktok-pixel-script', `${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
                };
                win.ttq = ttq;
            }

            win.ttq.load?.(pixelId);
            win.ttq.page?.();
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.ttq) {
                return;
            }

            win.ttq.track?.(eventName, payload);
        },
    },

    snapchat: {
        label: 'Snapchat',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            if (!win.snaptr) {
                const snaptr: SnapPixel = ((...args: unknown[]) => {
                    if (snaptr.handleRequest) {
                        snaptr.handleRequest(...args);
                    } else {
                        (snaptr.queue ??= []).push(args);
                    }
                }) as SnapPixel;
                snaptr.queue = [];
                win.snaptr = snaptr;
                injectScriptOnce('snapchat-pixel-script', 'https://sc-static.net/scevent.min.js');
            }

            win.snaptr('init', pixelId);
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.snaptr) {
                return;
            }

            win.snaptr('track', eventName, payload);
        },
    },

    pinterest: {
        label: 'Pinterest',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            if (!win.pintrk) {
                const pintrk: PinterestPixel = ((...args: unknown[]) => {
                    (pintrk.queue ??= []).push(args);
                }) as PinterestPixel;
                pintrk.queue = [];
                pintrk.version = '3.0';
                win.pintrk = pintrk;
                injectScriptOnce('pinterest-pixel-script', 'https://s.pinimg.com/ct/core.js');
            }

            win.pintrk('load', pixelId);
            win.pintrk('page');
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.pintrk) {
                return;
            }

            win.pintrk('track', eventName, payload);
        },
    },

    linkedin: {
        label: 'LinkedIn',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            win._linkedin_partner_id = pixelId;
            const partnerIds = (win._linkedin_data_partner_ids ??= []);
            if (!partnerIds.includes(pixelId)) {
                partnerIds.push(pixelId);
            }

            if (!win.lintrk) {
                const lintrk = ((...args: unknown[]): void => {
                    (lintrk.q ??= []).push(args);
                }) as LinkedInPixel;
                lintrk.q = [];
                win.lintrk = lintrk;
                injectScriptOnce('linkedin-insight-script', 'https://snap.licdn.com/li.lms-analytics/insight.min.js');
            }
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.lintrk) {
                return;
            }

            const conversionId = payload['conversion_id'];
            win.lintrk('track', conversionId !== undefined ? { conversion_id: conversionId } : { conversion_id: eventName });
        },
    },

    reddit: {
        label: 'Reddit',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            if (!win.rdt) {
                const rdt: RedditPixel = ((...args: unknown[]) => {
                    if (rdt.sendEvent) {
                        rdt.sendEvent(...args);
                    } else {
                        (rdt.callQueue ??= []).push(args);
                    }
                }) as RedditPixel;
                rdt.callQueue = [];
                win.rdt = rdt;
                injectScriptOnce('reddit-pixel-script', 'https://www.redditstatic.com/ads/pixel.js');
            }

            win.rdt('init', pixelId);
            win.rdt('track', 'PageVisit');
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.rdt) {
                return;
            }

            win.rdt('track', eventName, payload);
        },
    },

    twitter: {
        label: 'Twitter',
        requiredFields: ['pixel_id'],
        init(pixelId: string): void {
            const win = vendorWindow();
            if (win === null) {
                return;
            }

            if (!win.twq) {
                const twq: TwitterPixel = ((...args: unknown[]) => {
                    if (twq.exe) {
                        twq.exe(...args);
                    } else {
                        (twq.queue ??= []).push(args);
                    }
                }) as TwitterPixel;
                twq.version = '1.1';
                twq.queue = [];
                win.twq = twq;
                injectScriptOnce('twitter-pixel-script', 'https://static.ads-twitter.com/uwt.js');
            }

            win.twq('config', pixelId);
        },
        track(_pixelId: string, eventName: string, payload: Record<string, unknown>): void {
            const win = vendorWindow();
            if (win === null || !win.twq) {
                return;
            }

            win.twq('event', eventName, payload);
        },
    },
};

/**
 * Type guard: whether a string is one of the vetted vendor keys.
 */
export function isPixelVendorKey(value: string | null | undefined): value is PixelVendorKey {
    return value !== null && value !== undefined && (PIXEL_VENDOR_KEYS as readonly string[]).includes(value);
}

/**
 * Resolve a vetted vendor definition for a key, or null if the key is unknown.
 * Unknown vendors are intentionally ignored (never evaluated) so a stale or
 * malformed backend value can never load arbitrary code.
 */
export function getPixelVendor(vendor: string | null | undefined): PixelVendorDefinition | null {
    if (!isPixelVendorKey(vendor)) {
        return null;
    }

    return PIXEL_VENDORS[vendor];
}

/**
 * Initialize a list of merchant pixel instances. Instances with an unknown or
 * missing vendor, or a missing pixel ID, are skipped. Safe to call repeatedly
 * (each vendor init is idempotent) and on the server (no-op).
 */
export function initPixels(instances: ReadonlyArray<PixelInstance>): void {
    if (typeof window === 'undefined') {
        return;
    }

    for (const instance of instances) {
        const definition = getPixelVendor(instance.vendor);
        if (definition === null || !instance.pixel_id) {
            continue;
        }

        definition.init(instance.pixel_id);
    }
}

/**
 * Fire a single event across a list of merchant pixel instances. Instances with
 * an unknown vendor or missing pixel ID are skipped. Each instance is fired
 * independently so one bad instance cannot suppress the others. Safe on the
 * server (no-op).
 */
export function firePixelEvent(instances: ReadonlyArray<PixelInstance>, eventName: string, payload: Record<string, unknown>): void {
    if (typeof window === 'undefined') {
        return;
    }

    for (const instance of instances) {
        const definition = getPixelVendor(instance.vendor);
        if (definition === null || !instance.pixel_id) {
            continue;
        }

        definition.track(instance.pixel_id, eventName, payload);
    }
}
