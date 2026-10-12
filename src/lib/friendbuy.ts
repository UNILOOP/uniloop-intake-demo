export interface FriendbuyConfig {
    merchant_id: string;
}
interface VisitorStatus {
    status: string;
    payload?: { referralCode?: string; referralCodeBlocked?: boolean; isSelfReferral?: boolean };
    signature?: string;
}
type FriendbuyWindow = Window & { friendbuyAPI?: unknown[][] & { merchantId?: string } };
let activeMerchant: string | null = null;
let latest: { payload: string; signature: string; savedAt: number } | null = null;

export function initializeFriendbuy(config?: FriendbuyConfig | null): void {
    if (typeof window === 'undefined' || !config) return;
    if (!/^[0-9a-f-]{36}$/i.test(config.merchant_id)) return;
    const debug = new URLSearchParams(window.location?.search ?? '').get('friendbuy_debug') === '1';
    const browser = window as FriendbuyWindow;
    if (browser.friendbuyAPI?.merchantId && browser.friendbuyAPI.merchantId !== config.merchant_id) return;
    activeMerchant = config.merchant_id;
    try {
        const stored = sessionStorage.getItem(`friendbuy:${activeMerchant}`);
        latest = stored ? JSON.parse(stored) : null;
        if (latest && Date.now() - latest.savedAt > 86400000) latest = null;
    } catch {
        latest = null;
    }
    const api = (browser.friendbuyAPI ??= []);
    if (!api.merchantId) {
        api.merchantId = activeMerchant;
        api.push(['merchant', activeMerchant]);
        for (const src of ['https://static.fbot.me/friendbuy.js', `https://campaign.fbot.me/${activeMerchant}/campaigns.js`]) {
            const script = document.createElement('script');
            script.async = true;
            script.src = src;
            if (debug) {
                script.onload = () => console.info('[Friendbuy] Script loaded', src);
                script.onerror = () => console.info('[Friendbuy] Script failed', src);
            }
            document.head.appendChild(script);
        }
    }
    if (debug) console.info('[Friendbuy] Requesting visitor status');
    api.push([
        'getVisitorStatus',
        (status: VisitorStatus) => {
            if (debug) {
                console.info(
                    '[Friendbuy] Visitor status',
                    JSON.stringify({
                        status: status.status,
                        hasPayload: Boolean(status.payload),
                        hasSignature: Boolean(status.signature),
                        hasReferralCode: Boolean(status.payload?.referralCode),
                        isSelfReferral: status.payload?.isSelfReferral ?? null,
                        referralCodeBlocked: status.payload?.referralCodeBlocked ?? null,
                    }),
                );
            }
            if (status.status !== 'success' || !status.payload) return;
            if (status.payload.isSelfReferral || status.payload.referralCodeBlocked) {
                latest = null;
                try {
                    sessionStorage.removeItem(`friendbuy:${activeMerchant}`);
                } catch {
                    /* Storage is optional. */
                }
                return;
            }
            if (!status.payload.referralCode || !status.signature) return;
            latest = { payload: JSON.stringify(status.payload), signature: status.signature, savedAt: Date.now() };
            try {
                sessionStorage.setItem(`friendbuy:${activeMerchant}`, JSON.stringify(latest));
            } catch {
                /* Storage is optional. */
            }
        },
    ]);
}

export function appendFriendbuyTracking(formData: FormData): void {
    if (!activeMerchant || !latest || Date.now() - latest.savedAt > 86400000) return;
    formData.append('friendbuy_merchant_id', activeMerchant);
    formData.append('friendbuy_status', latest.payload);
    formData.append('friendbuy_signature', latest.signature);
}
