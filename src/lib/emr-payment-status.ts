import type { PaymentCharged } from '@/types/emr-enrollment';

export type AuthorizationHoldPayment = {
    status: string;
    amount_cents: number;
    uuid?: string;
} & Partial<Pick<PaymentCharged, 'stripe_payment_intent_id' | 'card_brand' | 'card_last4' | 'authorization_expires_at'>>;

export function isCapturedPayment(charge: PaymentCharged | null | undefined): boolean {
    return !!charge && ['completed', 'refunded', 'partially_refunded', 'disputed'].includes(charge.status);
}

export function authorizationHolds(charges: (AuthorizationHoldPayment | null | undefined)[]): AuthorizationHoldPayment[] {
    const seen = new Set<string>();
    return charges.filter((charge): charge is AuthorizationHoldPayment => {
        if (!charge || charge.status !== 'authorized') return false;
        const key = charge.stripe_payment_intent_id ?? charge.uuid;
        if (key && seen.has(key)) return false;
        if (key) seen.add(key);
        return true;
    });
}
