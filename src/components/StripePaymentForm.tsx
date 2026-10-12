import { enrollmentFetch } from '@/lib/enrollment-api-transport';
import StoreCreditSelection from '@/components/StoreCreditSelection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EmrChargeMode, StripeAuthorizationIntent, StripePaymentMethod, StripeSetupIntent } from '@/lib/enrollment-types';
import {
    completeAuthorizationReturn,
    createAuthorizationIntent,
    createSetupIntent,
    deletePaymentMethod as deletePaymentMethodApi,
    fetchPaymentMethods,
    getDefaultPaymentMethod,
    isSetupIntentProcessing,
    isSetupIntentSucceeded,
    savePaymentMethod,
} from '@/lib/enrollment-utils';
import { formatCurrency } from '@/lib/utils';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Appearance, loadStripe, Stripe, StripeElementsOptions, StripePaymentElementOptions } from '@stripe/stripe-js';
import { AlertCircle, Building2, CheckCircle2, CreditCard, Link, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export interface SubmitButtonAppearance {
    className?: string;
    style?: React.CSSProperties;
    text?: string;
    loadingText?: string;
    processingText?: string;
}

interface StripePaymentFormProps {
    /**
     * Display-only amount shown in the order summary. The actual authorization
     * amount is always recomputed server-side, so this is informational only.
     */
    amount: number;
    currency?: string;
    merchantId: number;
    authToken: string;
    onSuccess: (paymentMethodId: string, paymentIntentId?: string) => void;
    onError: (error: string) => void;
    beforeSubmit?: () => boolean;
    formRef?: React.Ref<HTMLFormElement>;
    embedded?: boolean;
    hideSubmitButton?: boolean;
    onProcessingChange?: (processing: boolean) => void;
    saveOnly?: boolean;
    processing?: boolean;
    /**
     * Charge mode for the EMR enrollment flow.
     * - 'save_only' (default): SetupIntent that saves the card without holding any funds.
     * - 'save_and_authorize': PaymentIntent with manual capture + setup_future_usage.
     *   Server authorizes the first-refill amount and saves the card; merchant captures on approval.
     */
    chargeMode?: EmrChargeMode;
    /**
     * EMR plan slug — required when chargeMode is 'save_and_authorize' so the
     * server can resolve the plan and price the authorization without trusting
     * any amount from the browser.
     */
    authorizationPlanSlug?: string;
    authorizationAssignedPlanId?: number;
    billingCheckoutUuid?: string;
    authorizationCouponCode?: string;
    /** Variant key selected by the patient — used by the server-side pricing call. */
    authorizationVariantId?: string | null;
    /** Drug selections payload — used by the server-side pricing call. */
    authorizationDrugSelections?: unknown;
    // Internal prop - setup intent passed from wrapper to avoid duplicate API calls
    initialSetupIntent?: StripeSetupIntent;
    // Internal prop - authorization payment intent passed from wrapper
    initialAuthorizationIntent?: StripeAuthorizationIntent;
    // PaymentElement layout configuration
    paymentElementLayout?: StripePaymentElementOptions['layout'];
    // Submit button customization
    submitButtonAppearance?: SubmitButtonAppearance;
}

type PendingStripeReturnIntent =
    | { type: 'setup'; intent: StripeSetupIntent; billingCheckoutUuid?: string }
    | { type: 'payment'; intent: StripeAuthorizationIntent; billingCheckoutUuid?: string };

const STRIPE_RETURN_INTENT_STORAGE_KEY = 'unisell:pending-stripe-return-intent';
const STRIPE_RETURN_QUERY_PARAMS = [
    'setup_intent',
    'setup_intent_client_secret',
    'payment_intent',
    'payment_intent_client_secret',
    'redirect_status',
];

const getCleanStripeReturnUrl = (): string => {
    const url = new URL(window.location.href);
    STRIPE_RETURN_QUERY_PARAMS.forEach((param) => url.searchParams.delete(param));

    return url.toString();
};

const getStripeReturnParams = ():
    | { type: 'setup'; id: string; clientSecret: string; redirectStatus: string | null }
    | { type: 'payment'; id: string; clientSecret: string; redirectStatus: string | null }
    | null => {
    const params = new URLSearchParams(window.location.search);
    const setupIntentId = params.get('setup_intent');
    const setupClientSecret = params.get('setup_intent_client_secret');

    if (setupIntentId && setupClientSecret) {
        return {
            type: 'setup',
            id: setupIntentId,
            clientSecret: setupClientSecret,
            redirectStatus: params.get('redirect_status'),
        };
    }

    const paymentIntentId = params.get('payment_intent');
    const paymentClientSecret = params.get('payment_intent_client_secret');

    if (paymentIntentId && paymentClientSecret) {
        return {
            type: 'payment',
            id: paymentIntentId,
            clientSecret: paymentClientSecret,
            redirectStatus: params.get('redirect_status'),
        };
    }

    return null;
};

const storePendingStripeReturnIntent = (pending: PendingStripeReturnIntent): void => {
    try {
        sessionStorage.setItem(STRIPE_RETURN_INTENT_STORAGE_KEY, JSON.stringify(pending));
    } catch {
        // Session storage is best-effort; without it redirect methods cannot be resumed automatically.
    }
};

const clearPendingStripeReturnIntent = (): void => {
    try {
        sessionStorage.removeItem(STRIPE_RETURN_INTENT_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
};

const loadPendingStripeReturnIntent = (returnParams = getStripeReturnParams(), billingCheckoutUuid?: string): PendingStripeReturnIntent | null => {
    if (!returnParams) {
        return null;
    }

    try {
        const stored = sessionStorage.getItem(STRIPE_RETURN_INTENT_STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const pending = JSON.parse(stored) as PendingStripeReturnIntent;
        if ((pending.billingCheckoutUuid ?? null) !== (billingCheckoutUuid ?? null)) {
            return null;
        }
        if (pending.type !== returnParams.type) {
            return null;
        }

        const pendingId = pending.type === 'setup' ? pending.intent.id : pending.intent.payment_intent_id;

        if (pendingId !== returnParams.id) {
            return null;
        }

        if (pending.intent.client_secret !== returnParams.clientSecret) {
            return null;
        }

        return pending;
    } catch {
        return null;
    }
};

const clearStripeReturnQueryParams = (): void => {
    if (!getStripeReturnParams()) {
        return;
    }

    window.history.replaceState({}, document.title, getCleanStripeReturnUrl());
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    return error instanceof Error ? error.message : fallback;
};

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const PaymentReturnStatus: React.FC<{
    title: string;
    description: string;
    isProcessing?: boolean;
}> = ({ title, description, isProcessing = false }) => (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50">
        <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
                {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-700 dark:text-emerald-300" />
                ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                )}
            </div>
            <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">{description}</p>
            </div>
        </div>
    </div>
);

// Helper to get icon for payment method type
const PaymentMethodIcon = ({ type, className }: { type: string; className?: string }) => {
    switch (type) {
        case 'card':
            return <CreditCard className={className} />;
        case 'us_bank_account':
        case 'bank_account':
            return <Building2 className={className} />;
        case 'link':
            return <Link className={className} />;
        case 'amazon_pay':
        case 'klarna':
        case 'afterpay_clearpay':
        case 'cashapp':
            return <Wallet className={className} />;
        default:
            return <CreditCard className={className} />;
    }
};

const PaymentFormContent: React.FC<StripePaymentFormProps> = ({
    amount,
    currency = 'usd',
    merchantId,
    authToken,
    onSuccess,
    onError,
    beforeSubmit,
    processing = false,
    chargeMode = 'save_only',
    billingCheckoutUuid,
    initialSetupIntent,
    initialAuthorizationIntent,
    paymentElementLayout = 'tabs',
    submitButtonAppearance,
    formRef,
    embedded = false,
    hideSubmitButton = false,
    onProcessingChange,
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const isAuthorizeMode = chargeMode === 'save_and_authorize';
    const [loading, setLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<StripePaymentMethod[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('new');
    // Always save the card - required for processing payment after prescription approval
    const saveCard = true;
    const [error, setError] = useState<string | null>(null);
    // Use initialSetupIntent if provided (from wrapper) to avoid duplicate API calls
    const [setupIntent, setSetupIntent] = useState<StripeSetupIntent | null>(initialSetupIntent || null);
    const [authorizationIntent] = useState<StripeAuthorizationIntent | null>(initialAuthorizationIntent || null);
    const [loadingMethods, setLoadingMethods] = useState(true);
    const [deletingMethod, setDeletingMethod] = useState<number | null>(null);
    const [returnStatus, setReturnStatus] = useState<'idle' | 'processing' | 'completed'>(() => {
        return loadPendingStripeReturnIntent(undefined, billingCheckoutUuid) ? 'processing' : 'idle';
    });
    const handledReturnIntentRef = React.useRef<string | null>(null);

    // Load payment methods on mount (setup intent already provided by wrapper)
    useEffect(() => {
        loadPaymentMethods();
    }, []);

    // Only create a NEW setup intent if switching to 'new' AND we don't have one
    // This handles the case where the initial setup intent was used/expired
    useEffect(() => {
        if (selectedPaymentMethod === 'new' && !setupIntent && !initialSetupIntent) {
            initializeSetupIntent();
        }
    }, [selectedPaymentMethod]);

    useEffect(() => {
        if (!stripe) {
            return;
        }

        const returnParams = getStripeReturnParams();
        const pending = loadPendingStripeReturnIntent(returnParams, billingCheckoutUuid);

        if (!returnParams || !pending) {
            return;
        }

        const handledKey = `${returnParams.type}:${returnParams.id}`;
        if (handledReturnIntentRef.current === handledKey) {
            return;
        }
        handledReturnIntentRef.current = handledKey;

        const completeReturnedIntent = async () => {
            setReturnStatus('processing');
            setLoading(true);
            setError(null);

            try {
                if (returnParams.redirectStatus === 'failed') {
                    throw new Error('Payment confirmation failed. Please try again.');
                }

                if (pending.type === 'setup') {
                    const { setupIntent: returnedIntent, error: retrieveError } = await stripe.retrieveSetupIntent(pending.intent.client_secret);

                    if (retrieveError) {
                        throw new Error(retrieveError.message || 'Unable to retrieve payment setup.');
                    }

                    if (!returnedIntent || !isSetupIntentSucceeded(returnedIntent.status) || !returnedIntent.payment_method) {
                        throw new Error('Payment setup was not completed. Please try again.');
                    }

                    const saveResult = await savePaymentMethod(
                        authToken,
                        merchantId,
                        returnedIntent.payment_method as string,
                        pending.intent.customer_id,
                        pending.intent.id,
                        true,
                    );

                    if (!saveResult.success) {
                        throw new Error(saveResult.error || 'Failed to save payment method.');
                    }

                    clearPendingStripeReturnIntent();
                    clearStripeReturnQueryParams();
                    setReturnStatus('completed');
                    onSuccess(returnedIntent.payment_method as string);

                    return;
                }

                let returnedIntent = null;
                let retrieveErrorMessage: string | null = null;

                for (let attempt = 0; attempt < 10; attempt += 1) {
                    const { paymentIntent, error: retrieveError } = await stripe.retrievePaymentIntent(pending.intent.client_secret);

                    if (retrieveError) {
                        retrieveErrorMessage = retrieveError.message || 'Unable to retrieve payment authorization.';
                        break;
                    }

                    returnedIntent = paymentIntent ?? null;

                    if (returnedIntent?.status === 'requires_capture' && returnedIntent.payment_method) {
                        break;
                    }

                    if (
                        returnedIntent &&
                        !['processing', 'requires_action', 'requires_confirmation', 'requires_payment_method'].includes(returnedIntent.status)
                    ) {
                        break;
                    }

                    await wait(1500);
                }

                if (retrieveErrorMessage) {
                    throw new Error(retrieveErrorMessage);
                }

                if (!returnedIntent || !returnedIntent.payment_method || returnedIntent.status !== 'requires_capture') {
                    throw new Error('Payment authorization was not completed. Please try again.');
                }

                const saveResult = await savePaymentMethod(
                    authToken,
                    merchantId,
                    returnedIntent.payment_method as string,
                    pending.intent.customer_id,
                    returnedIntent.id,
                    true,
                );

                if (!saveResult.success) {
                    throw new Error(saveResult.error || 'Failed to save payment method.');
                }

                clearPendingStripeReturnIntent();
                clearStripeReturnQueryParams();
                setReturnStatus('completed');
                onSuccess(returnedIntent.payment_method as string, returnedIntent.id);
            } catch (err: unknown) {
                const message = getErrorMessage(err, 'Unable to resume payment after redirect.');
                setReturnStatus('idle');
                setError(message);
                onError(message);
            } finally {
                setLoading(false);
            }
        };

        completeReturnedIntent();
    }, [stripe, authToken, merchantId, billingCheckoutUuid, onError, onSuccess]);

    // Use utility function to fetch payment methods
    const loadPaymentMethods = async () => {
        try {
            setLoadingMethods(true);
            const methods = await fetchPaymentMethods(authToken, merchantId);
            setPaymentMethods(methods);

            // Select default payment method if exists
            const defaultMethod = getDefaultPaymentMethod(methods);
            if (defaultMethod) {
                setSelectedPaymentMethod(defaultMethod.id.toString());
            }
        } catch (error) {
            console.error('Failed to fetch payment methods:', error);
        } finally {
            setLoadingMethods(false);
        }
    };

    // Use utility function to create setup intent
    const initializeSetupIntent = async (forceNew = false) => {
        const result = await createSetupIntent(authToken, merchantId, forceNew);
        if (result.success && result.setupIntent) {
            setSetupIntent(result.setupIntent);
            return result.setupIntent;
        } else {
            setError(result.error || 'Failed to initialize payment setup');
        }
        return null;
    };

    // Use utility function to delete payment method
    const handleDeletePaymentMethod = async (methodId: number) => {
        if (!confirm('Are you sure you want to remove this payment method?')) {
            return;
        }

        try {
            setDeletingMethod(methodId);
            const result = await deletePaymentMethodApi(authToken, methodId);

            if (result.success) {
                // Refresh payment methods
                await loadPaymentMethods();
                // If deleted method was selected, switch to new
                if (selectedPaymentMethod === methodId.toString()) {
                    setSelectedPaymentMethod('new');
                }
            }
        } catch (error) {
            console.error('Failed to delete payment method:', error);
        } finally {
            setDeletingMethod(null);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (beforeSubmit && !beforeSubmit()) {
            return;
        }

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);
        onProcessingChange?.(true);
        setError(null);

        try {
            if (selectedPaymentMethod === 'new') {
                if (isAuthorizeMode) {
                    await handleAuthorizationSubmit();
                } else {
                    await handleSetupIntentSubmit();
                }
            } else {
                // Use existing payment method — no on-session intent needed.
                // In authorize mode, the server will create the authorization
                // off-session against the saved PM when the enrollment is created.
                onSuccess(selectedPaymentMethod);
            }
        } catch (err: unknown) {
            const message = getErrorMessage(err, 'Payment processing failed');
            setError(message);
            onError(message);
        } finally {
            setLoading(false);
            onProcessingChange?.(false);
        }
    };

    const handleSetupIntentSubmit = async () => {
        if (!stripe || !elements) return;

        if (!setupIntent || !setupIntent.client_secret) {
            setError('Payment setup not initialized');
            setLoading(false);
            return;
        }

        // First, check if the setup intent has already been confirmed
        const { setupIntent: retrievedIntent } = await stripe.retrieveSetupIntent(setupIntent.client_secret);

        let confirmedIntent = retrievedIntent;

        if (retrievedIntent && isSetupIntentProcessing(retrievedIntent.status)) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const { setupIntent: recheckedIntent } = await stripe.retrieveSetupIntent(setupIntent.client_secret);
            confirmedIntent = recheckedIntent;
        }

        if (confirmedIntent && !isSetupIntentSucceeded(confirmedIntent.status)) {
            storePendingStripeReturnIntent({ type: 'setup', intent: setupIntent, billingCheckoutUuid });

            const { error: confirmError, setupIntent: newlyConfirmedIntent } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: getCleanStripeReturnUrl(),
                },
                redirect: 'if_required',
            });

            if (confirmError) {
                if (confirmError.message?.includes('already succeeded')) {
                    const { setupIntent: alreadyConfirmedIntent } = await stripe.retrieveSetupIntent(setupIntent.client_secret);
                    if (alreadyConfirmedIntent && alreadyConfirmedIntent.payment_method) {
                        confirmedIntent = alreadyConfirmedIntent;
                    } else {
                        await initializeSetupIntent(true);
                        setError('Payment setup expired. Please try again.');
                        setLoading(false);
                        return;
                    }
                } else {
                    setError(confirmError.message || 'Failed to confirm payment method');
                    setLoading(false);
                    return;
                }
            } else {
                confirmedIntent = newlyConfirmedIntent;
            }
        }

        if (confirmedIntent && confirmedIntent.payment_method) {
            if (saveCard) {
                const saveResult = await savePaymentMethod(
                    authToken,
                    merchantId,
                    confirmedIntent.payment_method as string,
                    setupIntent.customer_id,
                    setupIntent.id,
                    true,
                );
                if (!saveResult.success) {
                    throw new Error(saveResult.error || 'Failed to save payment method.');
                }
            }

            onSuccess(confirmedIntent.payment_method as string);
            clearPendingStripeReturnIntent();
        } else {
            setError('Unable to retrieve payment method. Please try again.');
            setLoading(false);
        }
    };

    const handleAuthorizationSubmit = async () => {
        if (!stripe || !elements) return;

        if (!authorizationIntent || !authorizationIntent.client_secret) {
            setError('Payment authorization not initialized');
            setLoading(false);
            return;
        }

        const completeAuthorizedIntent = async (paymentMethodId: string, paymentIntentId: string) => {
            if (saveCard) {
                const saveResult = await savePaymentMethod(
                    authToken,
                    merchantId,
                    paymentMethodId,
                    authorizationIntent.customer_id,
                    paymentIntentId,
                    true,
                );

                if (!saveResult.success) {
                    throw new Error(saveResult.error || 'Failed to save payment method.');
                }
            }

            clearPendingStripeReturnIntent();
            onSuccess(paymentMethodId, paymentIntentId);
        };

        const { paymentIntent: currentIntent, error: retrieveError } = await stripe.retrievePaymentIntent(authorizationIntent.client_secret);

        if (retrieveError) {
            setError(retrieveError.message || 'Unable to retrieve payment authorization.');
            setLoading(false);
            return;
        }

        if (currentIntent?.status === 'requires_capture' && currentIntent.payment_method) {
            await completeAuthorizedIntent(currentIntent.payment_method as string, currentIntent.id);
            return;
        }

        storePendingStripeReturnIntent({ type: 'payment', intent: authorizationIntent, billingCheckoutUuid });

        const { error: confirmError, paymentIntent: confirmedIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: getCleanStripeReturnUrl(),
            },
            redirect: 'if_required',
        });

        if (confirmError) {
            if (
                confirmError.code === 'payment_intent_unexpected_state' ||
                confirmError.message?.includes('already succeeded') ||
                confirmError.message?.includes('requires_capture')
            ) {
                const { paymentIntent: retrieved } = await stripe.retrievePaymentIntent(authorizationIntent.client_secret);
                if (retrieved?.status === 'requires_capture' && retrieved.payment_method) {
                    await completeAuthorizedIntent(retrieved.payment_method as string, retrieved.id);
                    return;
                }
            }
            setError(confirmError.message || 'Failed to authorize card');
            setLoading(false);
            return;
        }

        if (confirmedIntent?.status === 'requires_capture' && confirmedIntent.payment_method) {
            await completeAuthorizedIntent(confirmedIntent.payment_method as string, confirmedIntent.id);
        } else {
            setError('Unable to retrieve authorized card. Please try again.');
            setLoading(false);
        }
    };

    if (loadingMethods) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (returnStatus === 'completed') {
        return (
            <PaymentReturnStatus
                title="Payment approved"
                description="Your payment authorization was approved and saved. We are continuing your enrollment."
            />
        );
    }

    if (returnStatus === 'processing') {
        return (
            <PaymentReturnStatus
                title="Confirming payment approval"
                description="We are verifying your authorization with Stripe and updating checkout."
                isProcessing
            />
        );
    }

    return (
        <form ref={formRef} data-ready={Boolean(stripe && elements && !loading && !processing)} onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Methods Selection */}
            <div className="space-y-4">
                <RadioGroup value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                    {/* Existing payment methods */}
                    {paymentMethods.map((method) => (
                        <div key={method.id} className="relative">
                            <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                                <RadioGroupItem value={method.id.toString()} id={`method-${method.id}`} />
                                <Label htmlFor={`method-${method.id}`} className="flex flex-1 cursor-pointer items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <PaymentMethodIcon type={method.type} className="h-5 w-5" />
                                        <div>
                                            <div className="font-medium">{method.display_name}</div>
                                            {method.exp_month && method.exp_year && (
                                                <div className="text-sm text-gray-500">
                                                    Expires {method.exp_month}/{method.exp_year}
                                                </div>
                                            )}
                                            {method.is_expired && <div className="text-sm text-red-500">Expired</div>}
                                        </div>
                                    </div>
                                    {method.is_default && <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">Default</span>}
                                </Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePaymentMethod(method.id)}
                                    disabled={deletingMethod === method.id}
                                >
                                    {deletingMethod === method.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Add new card option */}
                    {paymentMethods.length > 0 && (
                        <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50">
                            <RadioGroupItem value="new" id="method-new" />
                            <Label htmlFor="method-new" className="flex-1 cursor-pointer">
                                <div className="flex items-center space-x-3">
                                    <Plus className="h-5 w-5" />
                                    <span className="font-medium">Add new payment method</span>
                                </div>
                            </Label>
                        </div>
                    )}
                </RadioGroup>
            </div>

            {/* New Payment Method Form */}
            {selectedPaymentMethod === 'new' &&
                (embedded ? (
                    <PaymentElement options={{ layout: paymentElementLayout }} />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Payment Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <PaymentElement
                                options={{
                                    layout: paymentElementLayout,
                                }}
                            />

                            <div className="flex items-center space-x-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                                <CreditCard className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Your payment method will be securely saved to process the payment once your prescription is approved.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}

            {/* Error Message */}
            {error && (
                <Alert variant="default">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-gray-900 dark:text-gray-300">{error}</AlertDescription>
                </Alert>
            )}

            {/* Amount Summary */}
            {!embedded && (
                <div className="rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-lg font-medium">{isAuthorizeMode ? 'Amount to authorize:' : 'Amount due on approval:'}</span>
                        <span className="text-xl font-bold">{formatCurrency(amount / 100, currency)}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        {isAuthorizeMode
                            ? 'This amount will be held on your card now and charged once your prescription is approved. The hold is released if your enrollment is cancelled.'
                            : 'Your payment method will be saved and charged after your order is approved.'}
                    </p>
                </div>
            )}
            {/* Submit Button */}
            {!hideSubmitButton && (
                <div className="w-full">
                    <Button
                        type="submit"
                        className={submitButtonAppearance?.className ?? 'w-full'}
                        style={submitButtonAppearance?.style}
                        disabled={!stripe || loading || processing}
                        size="lg"
                    >
                        {loading || processing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {processing
                                    ? (submitButtonAppearance?.processingText ?? 'Submitting Enrollment...')
                                    : (submitButtonAppearance?.loadingText ?? 'Processing Payment...')}
                            </>
                        ) : (
                            (submitButtonAppearance?.text ?? 'Complete Enrollment')
                        )}
                    </Button>
                </div>
            )}
        </form>
    );
};

// Default appearance configuration for Stripe Elements
const defaultAppearance: Appearance = {
    theme: 'stripe',
    variables: {
        colorPrimary: '#0570de',
        colorBackground: '#ffffff',
        colorText: '#30313d',
        colorDanger: '#df1b41',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '8px',
    },
};

interface StripePaymentFormWrapperProps extends StripePaymentFormProps {
    stripeAccount?: string;
    publishableKey?: string;
    // Custom appearance configuration for Stripe Elements (merged with defaults)
    appearance?: Appearance;
}

const StripePaymentForm: React.FC<StripePaymentFormWrapperProps> = (props) => {
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [elementsOptions, setElementsOptions] = useState<StripeElementsOptions | null>(null);
    // Store setup intent to pass to PaymentFormContent (avoids duplicate API calls)
    const [cachedSetupIntent, setCachedSetupIntent] = useState<StripeSetupIntent | null>(null);
    const [cachedAuthorizationIntent, setCachedAuthorizationIntent] = useState<StripeAuthorizationIntent | null>(null);
    const [completedReturn, setCompletedReturn] = useState(false);
    const [creditSetupOnly, setCreditSetupOnly] = useState(false);
    const [creditVersion, setCreditVersion] = useState(0);
    const [creditBusy, setCreditBusy] = useState(false);
    const cancelUnusedAuthorization = async () => {
        if (cachedAuthorizationIntent?.payment_intent_id) {
            const response = await enrollmentFetch(`/api/patient/payments/store-credits/intents/${cachedAuthorizationIntent.payment_intent_id}`, {
                method: 'DELETE',
                headers: { Accept: 'application/json', Authorization: `Bearer ${props.authToken}` },
            });
            if (!response.ok) throw new Error('Unable to release the previous payment authorization.');
        }
    };
    const creditSelection = (
        <StoreCreditSelection
            authToken={props.authToken}
            merchantId={props.merchantId}
            amount={props.amount}
            currency={props.currency}
            onBusyChange={setCreditBusy}
            beforeChange={cancelUnusedAuthorization}
            reservedCents={cachedAuthorizationIntent?.store_credit_cents ?? 0}
            afterChange={() => {
                hasInitializedRef.current = false;
                setCachedAuthorizationIntent(null);
                setCachedSetupIntent(null);
                setElementsOptions(null);
                setCreditSetupOnly(false);
                setCreditVersion((value) => value + 1);
            }}
        />
    );
    // Track if we've already initialized to prevent duplicate calls
    const hasInitializedRef = React.useRef(false);

    useEffect(() => {
        // Prevent duplicate initialization (React StrictMode, re-renders)
        if (hasInitializedRef.current) {
            return;
        }
        hasInitializedRef.current = true;

        const initializeStripe = async () => {
            const mergedAppearance: Appearance = {
                ...defaultAppearance,
                ...props.appearance,
                variables: {
                    ...defaultAppearance.variables,
                    ...props.appearance?.variables,
                },
                rules: {
                    ...defaultAppearance.rules,
                    ...props.appearance?.rules,
                },
            };

            const returnParams = getStripeReturnParams();
            const pendingReturnIntent = loadPendingStripeReturnIntent(returnParams, props.billingCheckoutUuid);

            if (returnParams?.type === 'payment' && !pendingReturnIntent) {
                for (let attempt = 0; attempt < 10; attempt += 1) {
                    const result = await completeAuthorizationReturn(props.authToken, props.merchantId, returnParams.id, props.billingCheckoutUuid);

                    if (result.success && result.paymentMethodId && result.paymentIntentId) {
                        clearPendingStripeReturnIntent();
                        clearStripeReturnQueryParams();
                        setCompletedReturn(true);
                        props.onSuccess(result.paymentMethodId, result.paymentIntentId);
                        return;
                    }

                    if (!result.retryable) {
                        props.onError(result.error || 'Unable to complete payment authorization.');
                        return;
                    }

                    await wait(1500);
                }

                props.onError('Payment authorization is still pending. Please refresh this page in a moment.');
                return;
            }

            if (pendingReturnIntent) {
                if (pendingReturnIntent.type === 'setup') {
                    const intent = pendingReturnIntent.intent;

                    setCachedSetupIntent(intent);
                    setStripePromise(
                        loadStripe(intent.publishable_key, {
                            stripeAccount: intent.stripe_account,
                        }),
                    );
                    setElementsOptions({
                        clientSecret: intent.client_secret,
                        appearance: mergedAppearance,
                    });
                } else {
                    const intent = pendingReturnIntent.intent;

                    setCachedAuthorizationIntent(intent);
                    setStripePromise(
                        loadStripe(intent.publishable_key, {
                            stripeAccount: intent.stripe_account,
                        }),
                    );
                    setElementsOptions({
                        clientSecret: intent.client_secret,
                        appearance: mergedAppearance,
                    });
                }

                return;
            }

            if (props.chargeMode === 'save_and_authorize') {
                if (!props.authorizationPlanSlug) {
                    console.error('save_and_authorize mode requires authorizationPlanSlug to price the intent server-side.');
                    props.onError('Unable to initialize payment authorization (missing plan context).');
                    return;
                }

                const result = await createAuthorizationIntent(props.authToken, props.merchantId, {
                    idempotencyKey: crypto.randomUUID(),
                    slug: props.authorizationPlanSlug,
                    assignedPlanId: props.authorizationAssignedPlanId,
                    billingCheckoutUuid: props.billingCheckoutUuid,
                    couponCode: props.authorizationCouponCode,
                    variantId: props.authorizationVariantId ?? null,
                    drugSelections: props.authorizationDrugSelections,
                    currency: (props.currency ?? 'usd').toLowerCase(),
                });

                if (!result.success || !result.paymentIntent) {
                    console.error('Failed to initialize Stripe authorization:', result.error);
                    props.onError(result.error || 'Failed to initialize payment authorization');
                    return;
                }

                if (result.paymentIntent.store_credit_only && result.paymentIntent.setup_intent) {
                    const setup = result.paymentIntent.setup_intent;
                    setCreditSetupOnly(true);
                    setCachedSetupIntent(setup);
                    setStripePromise(loadStripe(setup.publishable_key, { stripeAccount: setup.stripe_account }));
                    setElementsOptions({ clientSecret: setup.client_secret, appearance: mergedAppearance });
                    return;
                }
                setCachedAuthorizationIntent(result.paymentIntent);

                const stripe = loadStripe(result.paymentIntent.publishable_key, {
                    stripeAccount: result.paymentIntent.stripe_account,
                });

                setStripePromise(stripe);
                setElementsOptions({
                    clientSecret: result.paymentIntent.client_secret,
                    appearance: mergedAppearance,
                });
                return;
            }

            const result = await createSetupIntent(props.authToken, props.merchantId);

            if (result.success && result.setupIntent) {
                setCachedSetupIntent(result.setupIntent);

                const stripe = loadStripe(result.setupIntent.publishable_key, {
                    stripeAccount: result.setupIntent.stripe_account,
                });

                setStripePromise(stripe);
                setElementsOptions({
                    clientSecret: result.setupIntent.client_secret,
                    appearance: mergedAppearance,
                });
            } else {
                console.error('Failed to initialize Stripe:', result.error);
                props.onError('Failed to initialize payment system');
            }
        };

        initializeStripe();
    }, [props.merchantId, props.authToken, props.chargeMode, props.amount, props.currency, creditVersion]);

    if (completedReturn) {
        return (
            <PaymentReturnStatus
                title="Payment approved"
                description="Your payment authorization was approved and saved. We are continuing your enrollment."
            />
        );
    }

    if (!stripePromise || !elementsOptions) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Initializing payment system...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {creditSelection}
            <Elements key={creditVersion} stripe={stripePromise} options={elementsOptions}>
                <PaymentFormContent
                    {...props}
                    processing={props.processing || creditBusy}
                    chargeMode={creditSetupOnly ? 'save_only' : props.chargeMode}
                    onSuccess={async (methodId, intentId) => {
                        try {
                            if (!intentId && cachedAuthorizationIntent) await cancelUnusedAuthorization();
                            props.onSuccess(methodId, intentId);
                        } catch (issue) {
                            props.onError(issue instanceof Error ? issue.message : 'Unable to finish payment.');
                        }
                    }}
                    initialSetupIntent={cachedSetupIntent || undefined}
                    initialAuthorizationIntent={cachedAuthorizationIntent || undefined}
                />
            </Elements>
        </div>
    );
};

export default StripePaymentForm;
