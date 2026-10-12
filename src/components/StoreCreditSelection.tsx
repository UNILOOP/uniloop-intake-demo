import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchStoreCredits, setStoreCreditPreference, type StoreCreditBalance } from '@/lib/store-credit-utils';
import { useEffect, useState } from 'react';

export default function StoreCreditSelection({
    authToken,
    merchantId,
    amount,
    currency = 'usd',
    beforeChange,
    onChange,
    onBusyChange,
    reservedCents = 0,
    afterChange,
}: {
    authToken?: string;
    merchantId: number;
    amount: number;
    currency?: string;
    beforeChange?: () => Promise<void>;
    onChange?: (enabled: boolean) => void | Promise<void>;
    onBusyChange?: (busy: boolean) => void;
    reservedCents?: number;
    afterChange?: () => void;
}) {
    const [credits, setCredits] = useState<StoreCreditBalance | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        fetchStoreCredits(authToken, merchantId, currency)
            .then((value) => {
                if (active) setCredits(value);
            })
            .catch(() => {
                if (active) setError('Unable to load store credits.');
            });
        return () => {
            active = false;
        };
    }, [authToken, merchantId, currency]);
    if (!credits?.enabled)
        return error ? (
            <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : null;
    const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: credits.currency }).format(cents / 100);
    const available = credits.balance_cents + reservedCents;
    let applied = credits.use_store_credits ? Math.min(available, amount) : 0;
    if (amount - applied > 0 && amount - applied < 50) applied = Math.max(0, amount - 50);
    return (
        <div className="space-y-2 rounded-lg border p-4">
            <label className="flex items-start gap-3">
                <Checkbox
                    disabled={busy}
                    checked={credits.use_store_credits}
                    onCheckedChange={async (checked) => {
                        setBusy(true);
                        onBusyChange?.(true);
                        setError('');
                        let released = false;
                        try {
                            await beforeChange?.();
                            released = true;
                            const value = await setStoreCreditPreference(authToken, merchantId, checked === true, currency);
                            setCredits(value);
                            await onChange?.(checked === true);
                        } catch (reason) {
                            setError(reason instanceof Error ? reason.message : 'Unable to update credits.');
                        } finally {
                            if (released) afterChange?.();
                            setBusy(false);
                            onBusyChange?.(false);
                        }
                    }}
                />
                <span>
                    <strong>Use store credits</strong>
                    <span className="text-muted-foreground block text-sm">
                        {formatMoney(available)} available{reservedCents > 0 ? ` (${formatMoney(reservedCents)} reserved for this payment)` : ''}.
                        Apply available credits to this payment and future purchases and refills. Your card pays any remaining balance.
                    </span>
                </span>
            </label>
            {credits.refund_used_credits === false && <p className="text-sm font-medium">Used store credits are nonrefundable.</p>}
            {applied > 0 && (
                <p className="text-sm">
                    Store credits: {formatMoney(applied)} · Remaining card payment: {formatMoney(Math.max(0, amount - applied))}
                </p>
            )}
            {error && (
                <p className="text-destructive text-sm" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
