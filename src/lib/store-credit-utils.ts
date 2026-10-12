import { enrollmentFetch } from '@/lib/enrollment-api-transport';
export interface StoreCreditBalance {
    enabled: boolean;
    refund_used_credits?: boolean;
    balance_cents: number;
    currency: string;
    use_store_credits: boolean;
}
export async function fetchStoreCredits(authToken: string | undefined, merchantId: number, currency: string = 'usd'): Promise<StoreCreditBalance> {
    const response = await enrollmentFetch(`/api/patient/payments/store-credits?merchant_id=${merchantId}&currency=${encodeURIComponent(currency)}`, {
        headers: { Accept: 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Unable to load store credits.');
    return body;
}
export async function setStoreCreditPreference(
    authToken: string | undefined,
    merchantId: number,
    useStoreCredits: boolean,
    currency: string = 'usd',
): Promise<StoreCreditBalance> {
    const response = await enrollmentFetch('/api/patient/payments/store-credits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ merchant_id: merchantId, use_store_credits: useStoreCredits, currency }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? 'Unable to update store credit preference.');
    return body;
}
