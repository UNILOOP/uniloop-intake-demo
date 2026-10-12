import type { Address, ApplicableCoupon, EmrBillingQuote } from '@/lib/enrollment-types';
import { Alert, AlertDescription } from '@/packages/survey-form-package/src/components/ui/alert';
import { Badge } from '@/packages/survey-form-package/src/components/ui/badge';
import { Button } from '@/packages/survey-form-package/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/packages/survey-form-package/src/components/ui/card';
import { Checkbox } from '@/packages/survey-form-package/src/components/ui/checkbox';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/packages/survey-form-package/src/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/packages/survey-form-package/src/components/ui/select';
import { useSurveyForm } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import type { BlockDefinition, BlockRendererProps, ContentBlockItemProps } from '@/packages/survey-form-package/src/types';
import type { EmrBillingOption } from '@/types/emr-treatment';
import {
    AlertCircle,
    Check,
    CreditCard,
    Heart,
    Loader2,
    Lock,
    Mail,
    MapPin,
    Package,
    Phone,
    Pill,
    Shield,
    TicketPercent,
    User,
    X,
} from 'lucide-react';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EmrEnrollmentUtils as EnrollmentModule } from '@/lib/emr-enrollment-utils';

const fmt = (amount: number | string | null | undefined): string => `$${(Number(amount) || 0).toFixed(2)}`;

const getDrugImage = (drug: any): string | null => {
    const photos = drug?.merchant_drug?.photos;
    if (!photos?.length) return null;
    const primary = photos.find((p: any) => p.is_primary);
    return (primary ?? photos[0])?.url ?? null;
};

const DrugThumb: React.FC<{ drug: any; primaryColor: string }> = ({ drug, primaryColor }) => {
    const url = getDrugImage(drug);
    if (url) {
        return <img src={url} alt={drug.drug_name} className="h-8 w-8 shrink-0 rounded-md object-cover" />;
    }
    return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${primaryColor}10` }}>
            <Pill className="h-4 w-4" style={{ color: primaryColor }} />
        </div>
    );
};

// ============================================================
// Builder Components
// ============================================================

const EmrCheckoutBlockForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
    const handle = (field: string, value: any) => onUpdate?.({ ...data, [field]: value });
    return (
        <div className="space-y-4 text-sm">
            <div className="space-y-2">
                <Label>Field Name</Label>
                <Input value={data.fieldName ?? ''} onChange={(e) => handle('fieldName', e.target.value)} placeholder="emrCheckout" />
            </div>
            <div className="space-y-2">
                <Label>Title</Label>
                <Input value={data.title ?? ''} onChange={(e) => handle('title', e.target.value)} placeholder="Complete Your Order" />
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={data.showOrderSummary ?? true} onCheckedChange={(v) => handle('showOrderSummary', v)} />
                <Label>Show Order Summary</Label>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={data.showContactInfo ?? true} onCheckedChange={(v) => handle('showContactInfo', v)} />
                <Label>Show Contact Information</Label>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={data.collectPhone ?? true} onCheckedChange={(v) => handle('collectPhone', v)} />
                <Label>Collect Phone Number</Label>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={data.showAddress ?? true} onCheckedChange={(v) => handle('showAddress', v)} />
                <Label>Show Shipping Address</Label>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox checked={data.allowSavedAddresses ?? true} onCheckedChange={(v) => handle('allowSavedAddresses', v)} />
                <Label>Allow Saved Addresses</Label>
            </div>
        </div>
    );
};

const EmrCheckoutBlockItem: React.FC<ContentBlockItemProps> = ({ data }) => (
    <div className="flex items-center gap-2 text-sm text-slate-600">
        <CreditCard className="h-4 w-4" />
        <span>{data.fieldName || 'emrCheckout'}</span>
        <Badge variant="secondary" className="text-[10px]">
            EMR Checkout
        </Badge>
    </div>
);

const EmrCheckoutBlockPreview: React.FC = () => <div className="text-xs text-slate-400 italic">EMR Checkout (requires enrollment module)</div>;

type CompletedCheckoutValue = {
    success: true;
    paymentMethodId: string;
    paymentIntentId?: string;
    billingOptionId?: number;
    billingCheckoutUuid?: string;
    billingQuote?: EmrBillingQuote;
    billingTermsAccepted?: boolean;
    total?: number;
    patientInfo?: { email: string; first_name: string; last_name: string; phone: string };
    address?: Address;
    useExistingAddress?: boolean;
    selectedAddressId?: string;
    variantId?: string;
};

const getCompletedCheckoutValue = (value: unknown): CompletedCheckoutValue | null => {
    if (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        'paymentMethodId' in value &&
        value.success === true &&
        typeof value.paymentMethodId === 'string' &&
        (value.paymentMethodId.length > 0 || ('total' in value && value.total === 0))
    ) {
        return value as CompletedCheckoutValue;
    }

    return null;
};

// ============================================================
// Runtime Renderer
// ============================================================

const EmrCheckoutRenderer = forwardRef<HTMLDivElement, BlockRendererProps>(({ block, onChange, theme, disabled }, ref) => {
    const { customData, values, goToNextBlock } = useSurveyForm();
    const enrollmentModule = (customData?.emrEnrollmentUtils ?? customData?.enrollmentModule) as EnrollmentModule | undefined;

    const themeConfig = theme ?? null;
    const primaryColor = themeConfig?.colors?.primary || '#10b981';

    const fieldName = (block as any)?.fieldName || 'emrCheckout';
    const showOrderSummary = (block as any)?.showOrderSummary !== false;
    const showContactInfo = (block as any)?.showContactInfo !== false;
    const collectPhone = (block as any)?.collectPhone !== false;
    const showAddress = (block as any)?.showAddress !== false;
    const allowSavedAddresses = (block as any)?.allowSavedAddresses !== false;

    // State
    const [patientInfo, setPatientInfo] = useState({ first_name: '', last_name: '', email: '', phone: '' });
    const [address, setAddress] = useState<Address>({ line1: '', line2: '', city: '', state: '', zip: '', country: 'US' });
    const [useExistingAddress, setUseExistingAddress] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [existingAddresses, setExistingAddresses] = useState<any[]>([]);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<ApplicableCoupon | null>(null);
    const [applicableCoupons, setApplicableCoupons] = useState<ApplicableCoupon[]>([]);
    const [couponError, setCouponError] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [loadingCoupons, setLoadingCoupons] = useState(false);

    const [billingOptionId, setBillingOptionId] = useState<number | null>(() => enrollmentModule?.getSelectedEmrBillingOptionId?.() ?? null);
    const [billingPurchase, setBillingPurchase] = useState<{ checkout_uuid: string; quote: EmrBillingQuote } | null>(() => {
        const saved = enrollmentModule?.getCheckoutData?.();
        return saved?.billingCheckoutUuid && saved.billingQuote ? { checkout_uuid: saved.billingCheckoutUuid, quote: saved.billingQuote } : null;
    });
    const [billingAccepted, setBillingAccepted] = useState(() => Boolean(enrollmentModule?.getCheckoutData?.()?.billingTermsAccepted));
    const [billingCouponCode, setBillingCouponCode] = useState(() => enrollmentModule?.getCheckoutData?.()?.couponCode ?? '');
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingError, setBillingError] = useState('');
    const [quoteRefresh, setQuoteRefresh] = useState(0);

    // Dedup refs
    const lastSavedRef = useRef('');
    const lastAddressSavedRef = useRef('');
    const lastCouponFetchRef = useRef('');
    const completedCheckoutAdvancedRef = useRef(false);

    // EMR state from selection block
    const emrState = enrollmentModule?.isEmr ? enrollmentModule.getEmrCheckoutSelectionState() : null;
    const ordinaryTotal = emrState?.total ?? 0;
    const total = billingOptionId ? (billingPurchase?.quote.subtotal_cents ?? 0) / 100 : ordinaryTotal;
    const selectedMerchantDrugIds = (enrollmentModule?.getSelectedEmrMerchantDrugIds?.() ?? []).slice().sort((a: number, b: number) => a - b);
    const couponDiscount = billingOptionId ? (billingPurchase?.quote.discount_cents ?? 0) / 100 : (appliedCoupon?.discount_amount ?? 0);
    const finalTotal = Math.max(0, total - couponDiscount);
    const couponContextKey = JSON.stringify({
        planId: enrollmentModule?.plan?.id ?? null,
        billingOptionId,
        variantId: emrState?.variantId ?? null,
        total,
        selectedMerchantDrugIds,
    });
    const chargeMode: 'save_only' | 'save_and_authorize' =
        billingOptionId && billingPurchase ? billingPurchase.quote.terms.charge_mode : (enrollmentModule?.getChargeMode?.() ?? 'save_only');

    const billingOptions: EmrBillingOption[] = useMemo(
        () =>
            (enrollmentModule?.plan?.billing_options ?? []).filter(
                (option: { is_active: boolean; variant_key: string }) => option.is_active && option.variant_key === emrState?.variantId,
            ),
        [enrollmentModule?.plan?.billing_options, emrState?.variantId],
    );
    const billingChoices = enrollmentModule?.getEmrBillingChoices?.(emrState?.variantId ?? undefined) ?? [];
    const billingContextKey = JSON.stringify({
        plan: enrollmentModule?.plan?.id,
        variant: emrState?.variantId,
        drugs: emrState?.drugSelection,
        option: billingOptionId,
        coupon: billingCouponCode,
    });
    const billingContextRef = useRef(billingContextKey);
    const purchaseRef = useRef(billingPurchase);
    const hasPurchaseChoice = !enrollmentModule?.getEmrBillingChoices || billingChoices.length > 0;
    const billingReady =
        !billingOptionId || Boolean(billingPurchase && !billingLoading && !billingError && billingPurchase.quote.expires_at > Date.now() / 1000);
    const checkoutIsCurrent = useCallback(
        (value: unknown): boolean => {
            const completed = getCompletedCheckoutValue(value);
            if (!completed) return false;
            if (!billingOptionId) return !completed.billingOptionId;
            return Boolean(
                billingReady &&
                    completed.billingOptionId === billingOptionId &&
                    completed.billingCheckoutUuid === billingPurchase?.checkout_uuid &&
                    completed.billingQuote?.hash === billingPurchase?.quote.hash &&
                    completed.billingTermsAccepted,
            );
        },
        [billingOptionId, billingPurchase, billingReady],
    );

    useEffect(() => {
        const selected = enrollmentModule?.getSelectedEmrBillingOptionId?.() ?? null;
        if (selected !== billingOptionId) {
            setBillingOptionId(selected);
            setBillingAccepted(false);
            setBillingPurchase(null);
        }
    }, [emrState?.variantId, billingOptionId, enrollmentModule, billingOptions]);

    useEffect(() => {
        if (!billingOptionId || !authToken || !enrollmentModule?.merchant?.id || !emrState?.variantId) {
            if (!billingOptionId) {
                if (purchaseRef.current && authToken) {
                    enrollmentModule?.cancelBillingCheckout(authToken, purchaseRef.current.checkout_uuid).catch(() => undefined);
                    purchaseRef.current = null;
                }
                setBillingPurchase(null);
                setBillingError('');
                setBillingLoading(false);
            }
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        const changed = billingContextRef.current !== billingContextKey || quoteRefresh > 0;
        if (changed) {
            setBillingAccepted(false);
        }
        setBillingLoading(true);
        setBillingError('');
        const cancelPrevious =
            changed && purchaseRef.current ? enrollmentModule.cancelBillingCheckout(authToken, purchaseRef.current.checkout_uuid) : Promise.resolve();
        cancelPrevious
            .then(() => enrollmentModule.quoteBillingOption(authToken, billingCouponCode || null, controller.signal))
            .then((result) => {
                if (cancelled) return;
                const previous = purchaseRef.current;
                const reusable =
                    !changed && previous !== null && previous.quote.hash === result.quote.hash && previous.quote.expires_at > Date.now() / 1000;
                const purchase = reusable ? previous : result;
                if (!reusable) {
                    setBillingAccepted(false);
                }
                purchaseRef.current = purchase;
                billingContextRef.current = billingContextKey;
                setBillingPurchase(purchase);
            })
            .catch((error) => {
                if (!cancelled && error.name !== 'AbortError') {
                    setBillingError(error.message);
                    setBillingPurchase(null);
                }
            })
            .finally(() => {
                if (!cancelled) setBillingLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [billingContextKey, authToken, enrollmentModule, quoteRefresh]);

    // ── Restore persisted checkout draft from enrollment module ──
    useEffect(() => {
        const checkoutData = enrollmentModule?.getCheckoutData?.();
        if (!checkoutData) return;

        if (checkoutData.patientInfo) {
            setPatientInfo({
                first_name: checkoutData.patientInfo.first_name ?? '',
                last_name: checkoutData.patientInfo.last_name ?? '',
                email: checkoutData.patientInfo.email ?? '',
                phone: checkoutData.patientInfo.phone ?? '',
            });
        }

        if (checkoutData.address) {
            setAddress(checkoutData.address);
        }

        setUseExistingAddress(Boolean(checkoutData.useExistingAddress));
        setSelectedAddressId(checkoutData.selectedAddressId ? String(checkoutData.selectedAddressId) : '');

        if (checkoutData.appliedCoupon) {
            setAppliedCoupon(checkoutData.appliedCoupon);
            setCouponCode(checkoutData.appliedCoupon.code);
            setCouponError('');
        } else if (checkoutData.couponCode) {
            setCouponCode(checkoutData.couponCode);
        }
    }, [enrollmentModule]);

    // ── Extract patient info & auth token from form values ──
    useEffect(() => {
        if (!enrollmentModule || !values) return;

        const storedPatient = enrollmentModule.getStoredPatient?.();
        if (storedPatient) {
            const phone = storedPatient.phone ? enrollmentModule.formatPhoneNumber(storedPatient.phone) : '';
            setPatientInfo({
                first_name: storedPatient.first_name || storedPatient.firstName || '',
                last_name: storedPatient.last_name || storedPatient.lastName || '',
                email: storedPatient.email || '',
                phone,
            });
        } else {
            const extracted = enrollmentModule.extractPatientInfo?.(values);
            if (extracted?.email || extracted?.first_name) {
                const phone = extracted.phone ? enrollmentModule.formatPhoneNumber(extracted.phone) : '';
                setPatientInfo({ ...extracted, phone });
            }
        }

        let token = enrollmentModule.getPatientAuthToken?.();
        if (!token) {
            Object.values(values).forEach((v: any) => {
                if (v?.authResults?.token) token = v.authResults.token;
                else if (v?.token) token = v.token;
            });
        }
        if (token) setAuthToken(token);
    }, [values, enrollmentModule]);

    // ── Fetch patient data from API ──
    useEffect(() => {
        if (!authToken || !enrollmentModule) return;
        const fetch = async () => {
            const patient = await enrollmentModule.fetchPatientInfo?.(authToken);
            if (patient) {
                const phone = patient.phone ? enrollmentModule.formatPhoneNumber(patient.phone) : '';
                setPatientInfo({ first_name: patient.first_name || '', last_name: patient.last_name || '', email: patient.email || '', phone });
            }
        };
        fetch();
    }, [authToken, enrollmentModule]);

    // ── Auto-save patient info ──
    useEffect(() => {
        if (!enrollmentModule || !patientInfo.first_name || !patientInfo.last_name || !patientInfo.email) return;
        if (!enrollmentModule.isValidEmail?.(patientInfo.email)) return;
        const key = JSON.stringify(patientInfo);
        if (lastSavedRef.current === key) return;
        lastSavedRef.current = key;
        enrollmentModule.setCheckoutPatientInfo?.({
            ...patientInfo,
            phone: enrollmentModule.getRawPhoneDigits?.(patientInfo.phone) || patientInfo.phone,
        });
    }, [patientInfo, enrollmentModule]);

    // ── Fetch existing addresses ──
    useEffect(() => {
        if (!authToken || !enrollmentModule) return;
        const fetch = async () => {
            const addrs = await enrollmentModule.fetchPatientAddresses?.(authToken);
            if (addrs?.length > 0) {
                setExistingAddresses(addrs);
                const checkoutAddress = enrollmentModule.getCheckoutAddress?.();
                const restoredAddressId = checkoutAddress?.selectedAddressId ? String(checkoutAddress.selectedAddressId) : '';
                if (checkoutAddress?.address) {
                    setAddress(checkoutAddress.address);
                }
                if (allowSavedAddresses) {
                    setUseExistingAddress(true);
                    setSelectedAddressId(restoredAddressId || String(addrs[0].id));
                }
            }
        };
        fetch();
    }, [authToken, enrollmentModule]);

    // ── Track checkout view (once) ──
    useEffect(() => {
        if (!enrollmentModule?.isEmr) return;
        enrollmentModule.trackCheckoutViewed?.(finalTotal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enrollmentModule]);

    useEffect(() => {
        if (!appliedCoupon) return;
        enrollmentModule?.removeCoupon?.(appliedCoupon);
        setAppliedCoupon(null);
        setCouponError('Coupon removed because your selection changed.');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [couponContextKey]);

    useEffect(() => {
        if (!enrollmentModule?.isEmr) {
            setLoadingCoupons(false);
            return;
        }

        if (!patientInfo.email || !enrollmentModule.isValidEmail?.(patientInfo.email) || !enrollmentModule.plan?.id) {
            lastCouponFetchRef.current = '';
            setApplicableCoupons([]);
            setLoadingCoupons(false);
            return;
        }

        const fetchKey = `${patientInfo.email}-${couponContextKey}`;
        if (lastCouponFetchRef.current === fetchKey) return;

        let cancelled = false;
        lastCouponFetchRef.current = fetchKey;
        setLoadingCoupons(true);

        const fetchCoupons = async () => {
            try {
                const response = await enrollmentModule.getCoupons(patientInfo.email, total);

                if (!cancelled) {
                    setApplicableCoupons(response?.success ? (response.coupons ?? []) : []);
                }
            } catch {
                if (!cancelled) {
                    setApplicableCoupons([]);
                }
            } finally {
                if (!cancelled) {
                    setLoadingCoupons(false);
                }
            }
        };

        fetchCoupons();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientInfo.email, couponContextKey, enrollmentModule]);

    // If the patient returned from a redirect payment method and the survey
    // state already contains a completed checkout value, do not render Stripe
    // again. Rehydrate the enrollment module and continue from this block.
    useEffect(() => {
        const completedCheckoutValue = getCompletedCheckoutValue(values?.[fieldName]);
        if (completedCheckoutAdvancedRef.current || !enrollmentModule || !completedCheckoutValue || !checkoutIsCurrent(completedCheckoutValue)) {
            return;
        }

        completedCheckoutAdvancedRef.current = true;
        setProcessing(true);

        enrollmentModule.setCheckoutPaymentData?.({
            stripePaymentMethodId: completedCheckoutValue.paymentMethodId,
            stripePaymentIntentId: completedCheckoutValue.paymentIntentId,
            total: completedCheckoutValue.total ?? finalTotal,
        });

        enrollmentModule.setCheckoutData?.({
            patientInfo: completedCheckoutValue.patientInfo ?? patientInfo,
            address: completedCheckoutValue.address ?? address,
            useExistingAddress: completedCheckoutValue.useExistingAddress ?? useExistingAddress,
            selectedAddressId: completedCheckoutValue.selectedAddressId,
            stripePaymentMethodId: completedCheckoutValue.paymentMethodId,
            stripePaymentIntentId: completedCheckoutValue.paymentIntentId,
            billingOptionId: billingOptionId ?? undefined,
            billingCheckoutUuid: billingPurchase?.checkout_uuid,
            billingQuote: billingPurchase?.quote,
            billingTermsAccepted: billingAccepted,
            chargeMode,
            emrVariantId: completedCheckoutValue.variantId ?? emrState?.variantId ?? undefined,
            emrDrugSelection: emrState?.drugSelection ?? undefined,
            patientVitalId: enrollmentModule.getVitalId?.() ?? undefined,
            total: completedCheckoutValue.total ?? finalTotal,
        });

        queueMicrotask(() => {
            goToNextBlock?.({ [fieldName]: completedCheckoutValue });
        });
    }, [
        address,
        billingAccepted,
        billingOptionId,
        billingPurchase,
        checkoutIsCurrent,
        chargeMode,
        emrState?.drugSelection,
        emrState?.variantId,
        enrollmentModule,
        fieldName,
        finalTotal,
        goToNextBlock,
        patientInfo,
        useExistingAddress,
        values,
    ]);

    // ── Sync selected address ──
    useEffect(() => {
        if (useExistingAddress && selectedAddressId && existingAddresses.length > 0) {
            const selected = existingAddresses.find((a: any) => a.id === Number(selectedAddressId));
            if (selected) setAddress(selected);
        }
    }, [selectedAddressId, useExistingAddress, existingAddresses]);

    // ── Auto-save address ──
    useEffect(() => {
        if (!enrollmentModule) return;
        const valid = useExistingAddress
            ? selectedAddressId && existingAddresses.length > 0
            : address.line1 && address.city && address.state && address.zip;
        if (!valid) return;
        const key = JSON.stringify({
            id: address.id,
            line1: address.line1,
            city: address.city,
            state: address.state,
            zip: address.zip,
            useExistingAddress,
            selectedAddressId,
        });
        if (lastAddressSavedRef.current === key) return;
        lastAddressSavedRef.current = key;
        enrollmentModule.setCheckoutAddress?.(address, useExistingAddress, useExistingAddress ? selectedAddressId : undefined);
    }, [address, useExistingAddress, selectedAddressId, existingAddresses, enrollmentModule]);

    // ── Validate ──
    const validateForm = (): boolean => {
        const errs: Record<string, string> = {};
        if (!hasPurchaseChoice) errs.billing = 'No purchase options are available for this treatment.';
        if (billingOptionId && (!billingReady || !billingAccepted))
            errs.billing = 'Confirm the current billing quote and renewal terms before continuing.';
        if (!patientInfo.first_name?.trim()) errs.first_name = 'First name is required';
        if (!patientInfo.last_name?.trim()) errs.last_name = 'Last name is required';
        if (!patientInfo.email?.trim()) errs.email = 'Email is required';
        else if (!enrollmentModule?.isValidEmail?.(patientInfo.email)) errs.email = 'Please enter a valid email';
        if (showAddress && !useExistingAddress) {
            if (!address.line1?.trim()) errs.line1 = 'Street address is required';
            if (!address.city?.trim()) errs.city = 'City is required';
            if (!address.state) errs.state = 'State is required';
            if (!address.zip?.trim()) errs.zip = 'ZIP code is required';
        }
        setErrors(errs);
        const isValid = Object.keys(errs).length === 0;

        if (isValid) {
            const patientInfoRaw = { ...patientInfo, phone: enrollmentModule?.getRawPhoneDigits?.(patientInfo.phone) || patientInfo.phone };
            enrollmentModule?.setCheckoutData?.({
                patientInfo: patientInfoRaw,
                address,
                useExistingAddress,
                selectedAddressId: useExistingAddress ? selectedAddressId : undefined,
                billingOptionId: billingOptionId ?? undefined,
                billingCheckoutUuid: billingPurchase?.checkout_uuid,
                billingQuote: billingPurchase?.quote,
                billingTermsAccepted: billingAccepted,
                chargeMode,
                emrVariantId: emrState?.variantId ?? undefined,
                emrDrugSelection: emrState?.drugSelection ?? undefined,
                patientVitalId: enrollmentModule.getVitalId?.() ?? undefined,
                total: finalTotal,
            });
        }

        return isValid;
    };

    // ── Stripe success ──
    const handleStripeSuccess = async (paymentMethodId: string, paymentIntentId?: string) => {
        if (!enrollmentModule) return;
        completedCheckoutAdvancedRef.current = true;
        setProcessing(true);
        try {
            const patientInfoRaw = { ...patientInfo, phone: enrollmentModule.getRawPhoneDigits?.(patientInfo.phone) || patientInfo.phone };

            enrollmentModule.setCheckoutPaymentData?.({
                stripePaymentMethodId: paymentMethodId,
                stripePaymentIntentId: paymentIntentId,
                total: finalTotal,
                couponCode: billingOptionId ? billingCouponCode || undefined : appliedCoupon?.code,
                appliedCoupon,
                subtotal: total,
                discountAmount: couponDiscount,
                finalTotal,
            });

            enrollmentModule.setCheckoutData?.({
                patientInfo: patientInfoRaw,
                address,
                useExistingAddress,
                selectedAddressId: useExistingAddress ? selectedAddressId : undefined,
                stripePaymentMethodId: paymentMethodId,
                stripePaymentIntentId: paymentIntentId,
                billingOptionId: billingOptionId ?? undefined,
                billingCheckoutUuid: billingPurchase?.checkout_uuid,
                billingQuote: billingPurchase?.quote,
                billingTermsAccepted: billingAccepted,
                chargeMode,
                emrVariantId: emrState?.variantId ?? undefined,
                emrDrugSelection: emrState?.drugSelection ?? undefined,
                patientVitalId: enrollmentModule.getVitalId?.() ?? undefined,
                couponCode: billingOptionId ? billingCouponCode || undefined : appliedCoupon?.code,
                appliedCoupon,
                subtotal: total,
                discountAmount: couponDiscount,
                finalTotal,
                total: finalTotal,
            });

            const result = {
                success: true,
                patientInfo: patientInfoRaw,
                address,
                useExistingAddress,
                selectedAddressId: useExistingAddress ? selectedAddressId : undefined,
                paymentMethodId,
                paymentIntentId,
                billingOptionId: billingOptionId ?? undefined,
                billingCheckoutUuid: billingPurchase?.checkout_uuid,
                billingQuote: billingPurchase?.quote,
                billingTermsAccepted: billingAccepted,
                chargeMode,
                variantId: emrState?.variantId,
                couponCode: billingOptionId ? billingCouponCode || undefined : appliedCoupon?.code,
                coupon: appliedCoupon,
                subtotal: total,
                discount: couponDiscount,
                total: finalTotal,
                timestamp: new Date().toISOString(),
            };

            onChange?.(result as any);
            setProcessing(false);
            goToNextBlock?.({ [fieldName]: result });
        } catch {
            setErrors({ general: 'An error occurred during checkout' });
            setProcessing(false);
        }
    };

    const handleNoPaymentCheckout = async () => {
        if (!enrollmentModule || !validateForm()) return;
        setProcessing(true);
        try {
            const patientInfoRaw = { ...patientInfo, phone: enrollmentModule.getRawPhoneDigits?.(patientInfo.phone) || patientInfo.phone };
            enrollmentModule.setCheckoutData?.({
                patientInfo: patientInfoRaw,
                address,
                useExistingAddress,
                selectedAddressId: useExistingAddress ? selectedAddressId : undefined,
                emrVariantId: emrState?.variantId ?? undefined,
                emrDrugSelection: emrState?.drugSelection ?? undefined,
                patientVitalId: enrollmentModule.getVitalId?.() ?? undefined,
                couponCode: billingOptionId ? billingCouponCode || undefined : appliedCoupon?.code,
                appliedCoupon,
                subtotal: total,
                discountAmount: couponDiscount,
                finalTotal,
                total: finalTotal,
            });

            const result = {
                success: true,
                paymentMethodId: '',
                billingOptionId: billingOptionId ?? undefined,
                billingCheckoutUuid: billingPurchase?.checkout_uuid,
                billingQuote: billingPurchase?.quote,
                billingTermsAccepted: billingAccepted,
                patientInfo: patientInfoRaw,
                address,
                useExistingAddress,
                selectedAddressId: useExistingAddress ? selectedAddressId : undefined,
                variantId: emrState?.variantId,
                couponCode: billingOptionId ? billingCouponCode || undefined : appliedCoupon?.code,
                coupon: appliedCoupon,
                subtotal: total,
                discount: couponDiscount,
                total: finalTotal,
                timestamp: new Date().toISOString(),
            };

            onChange?.(result as any);
            setProcessing(false);
            goToNextBlock?.({ [fieldName]: result });
        } catch {
            setErrors({ general: 'An error occurred during checkout' });
            setProcessing(false);
        }
    };

    const handleStripeError = (msg: string) => {
        setErrors({ payment: msg });
        setProcessing(false);
    };

    // ── Guards ──
    if (!enrollmentModule) {
        return (
            <div ref={ref}>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Checkout system not initialized.</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!enrollmentModule.isEmr) {
        return (
            <div ref={ref}>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>This checkout block requires an EMR enrollment module.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const isDisabled = disabled || processing || !hasPurchaseChoice || !billingReady;
    const couponControlsDisabled = disabled || processing || billingLoading || couponLoading;
    const suggestedCoupons = applicableCoupons.filter((coupon) => coupon.code !== appliedCoupon?.code);

    // ── Stripe component ──
    const StripeForm = enrollmentModule.StripePaymentForm;
    // ── Drugs for order summary ──
    const checkoutBundleSize = Math.max(1, emrState?.variant?.default_dispense_bundle_size ?? 1);
    const standaloneDrugs = enrollmentModule.getStandaloneDrugs?.() ?? [];
    const drugGroups = enrollmentModule.getDrugGroups?.() ?? [];
    const selectedOptionalDrugs = (enrollmentModule.getOptionalDrugs?.() ?? []).filter((d: any) => enrollmentModule.isOptionalDrugSelected(d.id));

    // Resolve the selected phase for a drug to show the correct name/strength
    const resolvePhaseDisplay = (drug: any, phaseId: string | null) => {
        if (!phaseId || !drug?.has_phases || !drug?.phases?.length) {
            return { name: drug?.drug_name || 'Medication', strength: drug?.strength };
        }
        const phase = drug.phases.find((p: any) => p.id === phaseId);
        if (!phase) {
            return { name: drug?.drug_name || 'Medication', strength: drug?.strength };
        }
        return {
            name: phase.local_merchant_drug?.display_name || phase.drug_name || drug?.drug_name || 'Medication',
            strength: phase.strength ?? drug?.strength,
        };
    };

    // Resolve selected drugs from each group
    const selectedGroupDrugs: Array<{ groupName: string; drug: any; phaseId: string | null }> = [];
    for (const group of drugGroups) {
        const selectedIds = enrollmentModule.getDrugGroupSelection?.(group.id) ?? [];
        for (const drug of group.drugs) {
            if (selectedIds.includes(drug.id)) {
                const phaseId = emrState?.drugSelection?.groupSelections?.[group.id]?.selectedPhases?.[drug.id] ?? null;
                selectedGroupDrugs.push({ groupName: group.name, drug, phaseId });
            }
        }
    }

    const handleApplyCoupon = async (code?: string) => {
        const codeToApply = (code ?? couponCode).trim().toUpperCase();

        if (!codeToApply) {
            setCouponError('Enter a coupon code');
            return;
        }

        if (!patientInfo.email || !enrollmentModule.isValidEmail?.(patientInfo.email)) {
            setCouponError('Enter a valid email before applying a coupon');
            return;
        }

        if (billingOptionId) {
            setBillingCouponCode(codeToApply);
            setCouponError('');
            return;
        }
        setCouponLoading(true);
        setCouponError('');
        try {
            const result = await enrollmentModule.applyCoupon(patientInfo.email, codeToApply, total);

            if (result?.valid && result.coupon) {
                setAppliedCoupon(result.coupon);
                setCouponCode(result.coupon.code);
            } else {
                setAppliedCoupon(null);
                setCouponError(result?.error || 'Coupon could not be applied');
            }
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setBillingCouponCode('');
        if (appliedCoupon) {
            enrollmentModule.removeCoupon?.(appliedCoupon);
        }
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError('');
    };

    return (
        <div className="emr-checkout-block w-full min-w-0 space-y-6" ref={ref}>
            {!hasPurchaseChoice && (
                <Alert>
                    <AlertDescription>No purchase options are available for this treatment.</AlertDescription>
                </Alert>
            )}
            {billingChoices.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Choose how to pay</CardTitle>
                        <CardDescription>Your clinical check-ins and dispensing schedule stay the same.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <RadioGroup
                            value={
                                billingChoices.find((choice: { billingOptionId: number | null }) => choice.billingOptionId === billingOptionId)
                                    ?.key ?? ''
                            }
                            onValueChange={(value) => {
                                const choice = billingChoices.find((item: { key: string }) => item.key === value);
                                if (!choice) return;
                                const next = choice.billingOptionId;
                                setBillingOptionId(next);
                                setBillingAccepted(false);
                                setBillingPurchase(null);
                                enrollmentModule.setSelectedEmrBillingOptionId(next);
                                completedCheckoutAdvancedRef.current = false;
                            }}
                        >
                            {billingChoices.map(
                                (choice: { key: string; billingOptionId: number | null; label: string; price: number; supplyCount: number }) => (
                                    <Label key={choice.key} className="flex items-center gap-3 rounded-lg border p-4">
                                        <RadioGroupItem value={choice.key} />
                                        <span>
                                            <span className="block font-medium">{choice.billingOptionId ? choice.label : 'Pay per refill'}</span>
                                            <span className="text-muted-foreground text-sm">
                                                {choice.billingOptionId
                                                    ? `${choice.supplyCount} supplies, including the initial supply · Base price ${fmt(choice.price)}`
                                                    : fmt(ordinaryTotal)}
                                            </span>
                                        </span>
                                    </Label>
                                ),
                            )}
                        </RadioGroup>
                        {billingLoading && <p className="animate-pulse text-sm">Updating your billing quote…</p>}
                        {billingError && <p className="text-sm text-red-600">{billingError}</p>}
                        {billingOptionId && (
                            <Button type="button" variant="outline" disabled={billingLoading} onClick={() => setQuoteRefresh((value) => value + 1)}>
                                Refresh purchase quote
                            </Button>
                        )}
                        {errors.billing && (
                            <p role="alert" className="text-sm text-red-600">
                                {errors.billing}
                            </p>
                        )}
                        {billingOptionId && billingPurchase && !billingLoading && (
                            <div className="bg-muted/40 space-y-3 rounded-lg p-4 text-sm">
                                <p>
                                    {billingPurchase.quote.terms.supply_count} supplies for {fmt(billingPurchase.quote.net_cents / 100)}.{' '}
                                    {billingPurchase.quote.terms.refill_cycle_days
                                        ? `${billingPurchase.quote.terms.supply_count * billingPurchase.quote.terms.refill_cycle_days} days on the current schedule.`
                                        : ''}
                                </p>
                                <p>
                                    {chargeMode === 'save_and_authorize'
                                        ? 'Available store credits can cover the term. Any remaining card amount is authorized now and captured after approval.'
                                        : billingPurchase.quote.terms.save_only_charge_timing === 'after_enrollment_push'
                                          ? 'No payment today. The full term is collected after enrollment is accepted.'
                                          : 'No payment today. The full term is collected after prescription approval.'}
                                </p>
                                <Label className="flex items-start gap-3">
                                    <Checkbox checked={billingAccepted} onCheckedChange={(value) => setBillingAccepted(value === true)} />
                                    <span>
                                        {billingPurchase.quote.terms.renewal_policy === 'auto_renew'
                                            ? `I agree to automatic renewal for another ${billingPurchase.quote.terms.supply_count} supplies at ${fmt(billingPurchase.quote.terms.subtotal_cents / 100)} before any eligible renewal discounts, when the next uncovered supply becomes due. I can stop future renewal.`
                                            : billingPurchase.quote.terms.renewal_policy === 'require_new_purchase'
                                              ? 'I understand that another purchase is required after these supplies are used.'
                                              : 'I understand that enrollment ends after the final covered clinical period.'}
                                    </span>
                                </Label>
                            </div>
                        )}
                        {errors.billing && <p className="text-sm text-red-600">{errors.billing}</p>}
                    </CardContent>
                </Card>
            )}
            {/* ─── Order Summary ─── */}
            {showOrderSummary && emrState && (
                <Card className={cn('overflow-hidden rounded-xl', themeConfig?.card)}>
                    <CardContent className="p-6">
                        <div className="flex w-full items-start gap-4">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${primaryColor}15` }}
                            >
                                <Package className="h-6 w-6" style={{ color: primaryColor }} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className={cn('text-lg font-semibold', themeConfig?.title)}>
                                            {enrollmentModule.plan?.name ?? 'Treatment Plan'}
                                        </h3>
                                        {emrState.scheduleLabel && (
                                            <Badge
                                                className="mt-1 border-0 text-xs"
                                                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                                            >
                                                {emrState.scheduleLabel}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                                            {billingOptionId && !billingReady ? 'Awaiting quote' : fmt(finalTotal)}
                                        </p>
                                        {billingOptionId ? (
                                            billingPurchase && (
                                                <p className="text-muted-foreground text-xs">
                                                    for {billingPurchase.quote.terms.supply_count} supplies
                                                </p>
                                            )
                                        ) : emrState.scheduleLabel ? (
                                            <p className="text-muted-foreground text-xs">/{emrState.scheduleLabel.toLowerCase()}</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Included medications */}
                        {(standaloneDrugs.length > 0 || selectedGroupDrugs.length > 0) && (
                            <div className="mt-3 space-y-2">
                                {standaloneDrugs.map((drug: any) => {
                                    const phaseId = emrState?.drugSelection?.standaloneDrugPhases?.[drug.id] ?? null;
                                    const phaseDisplay = resolvePhaseDisplay(drug, phaseId);
                                    return (
                                        <div key={drug.id} className="flex items-center gap-2.5 text-sm">
                                            <DrugThumb drug={drug} primaryColor={primaryColor} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{phaseDisplay.name}</p>
                                                {phaseDisplay.strength && <p className="text-muted-foreground text-xs">{phaseDisplay.strength}</p>}
                                            </div>
                                            <Check className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                                        </div>
                                    );
                                })}
                                {selectedGroupDrugs.map(({ groupName, drug, phaseId }) => {
                                    const phaseDisplay = resolvePhaseDisplay(drug, phaseId);
                                    return (
                                        <div key={`group-${drug.id}`} className="flex items-center gap-2.5 text-sm">
                                            <DrugThumb drug={drug} primaryColor={primaryColor} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{phaseDisplay.name}</p>
                                                <p className="text-muted-foreground text-xs">{groupName}</p>
                                            </div>
                                            <Check className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Drug selection add-ons (custom pricing) */}
                        {emrState.addOnTotal > 0 && (
                            <div className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: `${primaryColor}10` }}>
                                <div className="flex items-center justify-between text-sm">
                                    <p className="text-muted-foreground">Drug selection add-ons</p>
                                    <span className="text-xs font-semibold" style={{ color: primaryColor }}>
                                        +{fmt(emrState.addOnTotal)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Optional add-ons */}
                        {selectedOptionalDrugs.length > 0 && (
                            <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: `${primaryColor}10` }}>
                                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Add-ons</p>
                                {selectedOptionalDrugs.map((drug: any) => {
                                    const phaseId = emrState?.drugSelection?.optionalDrugPhases?.[drug.id] ?? null;
                                    const phaseDisplay = resolvePhaseDisplay(drug, phaseId);
                                    return (
                                        <div key={drug.id} className="flex items-center gap-2.5 text-sm">
                                            <DrugThumb drug={drug} primaryColor={primaryColor} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{phaseDisplay.name}</p>
                                                {phaseDisplay.strength && <p className="text-muted-foreground text-xs">{phaseDisplay.strength}</p>}
                                            </div>
                                            <span className="shrink-0 text-xs font-semibold" style={{ color: primaryColor }}>
                                                +{fmt(enrollmentModule.getDrugPrice(drug) * checkoutBundleSize)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: `${primaryColor}10` }}>
                            <div className="flex items-center gap-2">
                                <TicketPercent className="text-muted-foreground h-4 w-4" />
                                <p className="text-sm font-medium">Coupon</p>
                            </div>
                            {appliedCoupon || (billingOptionId && billingCouponCode) ? (
                                <div
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                                    style={{ borderColor: `${primaryColor}20`, backgroundColor: `${primaryColor}08` }}
                                >
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                                            {billingOptionId ? billingCouponCode : appliedCoupon?.code}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {billingOptionId && !billingReady
                                                ? billingLoading
                                                    ? 'Checking coupon…'
                                                    : 'Coupon not applied'
                                                : `-${fmt(couponDiscount)} applied`}
                                        </p>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCoupon} disabled={couponControlsDisabled}>
                                        <X className="h-3.5 w-3.5" />
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {loadingCoupons ? (
                                        <div
                                            className="text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                                            style={{ borderColor: `${primaryColor}15` }}
                                        >
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Checking available coupons...
                                        </div>
                                    ) : suggestedCoupons.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-muted-foreground text-xs font-medium">Available coupons</p>
                                            <div className="grid gap-2">
                                                {suggestedCoupons.map((coupon) => (
                                                    <div
                                                        key={coupon.id}
                                                        className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                                        style={{ borderColor: `${primaryColor}15` }}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge
                                                                    className="border-0 font-mono text-[11px]"
                                                                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                                                                >
                                                                    {coupon.code}
                                                                </Badge>
                                                                <span className="text-xs font-semibold text-emerald-700">
                                                                    Save {coupon.formatted_discount}
                                                                </span>
                                                            </div>
                                                            {coupon.description && (
                                                                <p className="text-muted-foreground mt-1 text-xs">{coupon.description}</p>
                                                            )}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleApplyCoupon(coupon.code)}
                                                            disabled={couponControlsDisabled}
                                                        >
                                                            Apply
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="space-y-2">
                                        {suggestedCoupons.length > 0 && (
                                            <Label className="text-muted-foreground text-xs font-medium">Or enter a different coupon code</Label>
                                        )}
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <Input
                                                value={couponCode}
                                                onChange={(event) => {
                                                    setCouponCode(event.target.value.toUpperCase());
                                                    setCouponError('');
                                                }}
                                                placeholder="Enter coupon code"
                                                disabled={couponControlsDisabled}
                                                className={cn(themeConfig?.field?.input)}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => handleApplyCoupon()}
                                                disabled={couponControlsDisabled || !couponCode.trim()}
                                            >
                                                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}
                                                Apply
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                            {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                            <div className="space-y-1 rounded-lg bg-slate-50/70 p-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{billingOptionId && !billingReady ? 'Awaiting quote' : fmt(total)}</span>
                                </div>
                                {couponDiscount > 0 && (
                                    <div className="flex items-center justify-between text-emerald-700">
                                        <span>Coupon discount</span>
                                        <span>-{fmt(couponDiscount)}</span>
                                    </div>
                                )}
                                <div
                                    className="flex items-center justify-between border-t pt-1.5 font-semibold"
                                    style={{ borderColor: `${primaryColor}10` }}
                                >
                                    <span>{billingOptionId ? (chargeMode === 'save_only' ? 'Due now' : 'Authorization hold') : 'Total'}</span>
                                    <span>
                                        {billingOptionId && !billingReady
                                            ? 'Awaiting quote'
                                            : fmt(billingOptionId && chargeMode === 'save_only' ? 0 : finalTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Trust indicators */}
                        <div className="mt-5 flex flex-wrap items-center gap-4 border-t pt-5 sm:gap-6" style={{ borderColor: `${primaryColor}15` }}>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <Shield className="h-4 w-4" style={{ color: primaryColor }} /> HIPAA Compliant
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <Lock className="h-4 w-4" style={{ color: primaryColor }} /> 256-bit Encryption
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <Heart className="h-4 w-4" style={{ color: primaryColor }} /> Licensed Providers
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Contact Information ─── */}
            {showContactInfo && (
                <Card className={cn('overflow-hidden rounded-xl', themeConfig?.card)}>
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                <User className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <div>
                                <CardTitle className={cn('text-lg', themeConfig?.title)}>Your Information</CardTitle>
                                <CardDescription className="text-sm">How we'll contact you about your treatment</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="emr_first_name" className="text-sm font-medium">
                                    First Name
                                </Label>
                                <Input
                                    id="emr_first_name"
                                    value={patientInfo.first_name}
                                    onChange={(e) => setPatientInfo({ ...patientInfo, first_name: e.target.value })}
                                    className={cn(themeConfig?.field?.input, errors.first_name && 'border-red-500')}
                                    placeholder="John"
                                    disabled={isDisabled}
                                />
                                {errors.first_name && (
                                    <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.first_name}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="emr_last_name" className="text-sm font-medium">
                                    Last Name
                                </Label>
                                <Input
                                    id="emr_last_name"
                                    value={patientInfo.last_name}
                                    onChange={(e) => setPatientInfo({ ...patientInfo, last_name: e.target.value })}
                                    className={cn(themeConfig?.field?.input, errors.last_name && 'border-red-500')}
                                    placeholder="Doe"
                                    disabled={isDisabled}
                                />
                                {errors.last_name && (
                                    <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.last_name}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="emr_email" className="flex items-center gap-2 text-sm font-medium">
                                <Mail className="text-muted-foreground h-3.5 w-3.5" />
                                Email Address
                            </Label>
                            <Input
                                id="emr_email"
                                type="email"
                                value={patientInfo.email}
                                onChange={(e) => setPatientInfo({ ...patientInfo, email: e.target.value })}
                                className={cn(themeConfig?.field?.input, errors.email && 'border-red-500')}
                                placeholder="john.doe@example.com"
                                disabled={isDisabled}
                            />
                            {errors.email && (
                                <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.email}
                                </p>
                            )}
                        </div>
                        {collectPhone && (
                            <div className="space-y-2">
                                <Label htmlFor="emr_phone" className="flex items-center gap-2 text-sm font-medium">
                                    <Phone className="text-muted-foreground h-3.5 w-3.5" />
                                    Phone Number <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                                </Label>
                                <Input
                                    id="emr_phone"
                                    type="tel"
                                    value={patientInfo.phone}
                                    onChange={(e) => {
                                        const formatted = enrollmentModule.formatPhoneNumber?.(e.target.value) ?? e.target.value;
                                        setPatientInfo({ ...patientInfo, phone: formatted });
                                    }}
                                    className={cn(themeConfig?.field?.input)}
                                    placeholder="(555) 123-4567"
                                    disabled={isDisabled}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Shipping Address ─── */}
            {showAddress && (
                <Card className={cn('overflow-hidden rounded-xl', themeConfig?.card)}>
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                                <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <div>
                                <CardTitle className={cn('text-lg', themeConfig?.title)}>Shipping Address</CardTitle>
                                <CardDescription className="text-sm">Where should we deliver your medication?</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Saved addresses */}
                        {allowSavedAddresses && existingAddresses.length > 0 && (
                            <RadioGroup
                                value={useExistingAddress ? selectedAddressId : 'new'}
                                onValueChange={(v) => {
                                    if (v === 'new') {
                                        setUseExistingAddress(false);
                                        setSelectedAddressId('');
                                        setAddress(enrollmentModule.createEmptyAddress?.());
                                    } else {
                                        setUseExistingAddress(true);
                                        setSelectedAddressId(v);
                                    }
                                }}
                                className="space-y-2"
                            >
                                {existingAddresses.map((addr: any) => {
                                    const isSelected = useExistingAddress && selectedAddressId === String(addr.id);
                                    return (
                                        <label
                                            key={addr.id}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all',
                                                isSelected ? 'shadow-sm' : 'border-transparent bg-slate-50/50 hover:bg-slate-100/50',
                                            )}
                                            style={{
                                                borderColor: isSelected ? primaryColor : 'transparent',
                                                backgroundColor: isSelected ? `${primaryColor}08` : undefined,
                                            }}
                                        >
                                            <RadioGroupItem value={String(addr.id)} className="sr-only" />
                                            <div
                                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                                                style={{
                                                    borderColor: isSelected ? primaryColor : '#cbd5e1',
                                                    backgroundColor: isSelected ? primaryColor : 'transparent',
                                                }}
                                            >
                                                {isSelected && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium">{addr.line1}</p>
                                                {addr.line2 && <p className="text-muted-foreground text-xs">{addr.line2}</p>}
                                                <p className="text-muted-foreground text-xs">
                                                    {addr.city}, {addr.state} {addr.zip}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                                <label
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-all',
                                        !useExistingAddress ? 'shadow-sm' : 'border-transparent bg-slate-50/50 hover:bg-slate-100/50',
                                    )}
                                    style={{
                                        borderColor: !useExistingAddress ? primaryColor : 'transparent',
                                        backgroundColor: !useExistingAddress ? `${primaryColor}08` : undefined,
                                    }}
                                >
                                    <RadioGroupItem value="new" className="sr-only" />
                                    <div
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                                        style={{
                                            borderColor: !useExistingAddress ? primaryColor : '#cbd5e1',
                                            backgroundColor: !useExistingAddress ? primaryColor : 'transparent',
                                        }}
                                    >
                                        {!useExistingAddress && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-sm font-medium">Use a different address</span>
                                </label>
                            </RadioGroup>
                        )}

                        {/* New address form */}
                        {(!useExistingAddress || existingAddresses.length === 0) && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Street Address</Label>
                                    <Input
                                        value={address.line1}
                                        onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                                        className={cn(themeConfig?.field?.input, errors.line1 && 'border-red-500')}
                                        placeholder="123 Main Street"
                                        disabled={isDisabled}
                                    />
                                    {errors.line1 && (
                                        <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                            <AlertCircle className="h-3 w-3" />
                                            {errors.line1}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Apartment, Suite, etc. <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                                    </Label>
                                    <Input
                                        value={address.line2}
                                        onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                                        className={cn(themeConfig?.field?.input)}
                                        placeholder="Apt 4B"
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">City</Label>
                                        <Input
                                            value={address.city}
                                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                            className={cn(themeConfig?.field?.input, errors.city && 'border-red-500')}
                                            placeholder="New York"
                                            disabled={isDisabled}
                                        />
                                        {errors.city && (
                                            <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                                <AlertCircle className="h-3 w-3" />
                                                {errors.city}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">State</Label>
                                        <Select
                                            value={address.state}
                                            onValueChange={(v) => setAddress({ ...address, state: v })}
                                            disabled={isDisabled}
                                        >
                                            <SelectTrigger className={cn(themeConfig?.field?.select, errors.state && 'border-red-500')}>
                                                <SelectValue placeholder="Select state" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[200px]">
                                                {enrollmentModule?.US_STATES?.map((s: string) => (
                                                    <SelectItem key={s} value={s}>
                                                        {s}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.state && (
                                            <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                                <AlertCircle className="h-3 w-3" />
                                                {errors.state}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">ZIP Code</Label>
                                        <Input
                                            value={address.zip}
                                            onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                                            className={cn(themeConfig?.field?.input, errors.zip && 'border-red-500')}
                                            placeholder="10001"
                                            disabled={isDisabled}
                                        />
                                        {errors.zip && (
                                            <p className={cn('flex items-center gap-1 text-xs', themeConfig?.field?.error || 'text-red-500')}>
                                                <AlertCircle className="h-3 w-3" />
                                                {errors.zip}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Country</Label>
                                        <Select
                                            value={address.country}
                                            onValueChange={(v) => setAddress({ ...address, country: v })}
                                            disabled={isDisabled}
                                        >
                                            <SelectTrigger className={cn(themeConfig?.field?.select)}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(enrollmentModule?.SUPPORTED_COUNTRIES ?? [{ code: 'US', name: 'United States' }]).map((c: any) => (
                                                    <SelectItem key={c.code ?? c} value={c.code ?? c}>
                                                        {c.name ?? c}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Payment ─── */}
            <Card className={cn('overflow-hidden rounded-xl', themeConfig?.card)}>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${primaryColor}15` }}>
                            <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
                        </div>
                        <div>
                            <CardTitle className={cn('text-lg', themeConfig?.title)}>Payment</CardTitle>
                            <CardDescription className="text-sm">Pay with store credits and secure Stripe payments</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {errors.payment && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.payment}</AlertDescription>
                        </Alert>
                    )}
                    {errors.general && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errors.general}</AlertDescription>
                        </Alert>
                    )}

                    {processing && (
                        <div className="flex items-center justify-center gap-3 py-8">
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
                            <span className="text-muted-foreground text-sm">Processing your payment...</span>
                        </div>
                    )}

                    {!processing && hasPurchaseChoice && billingReady && (!billingOptionId || billingAccepted) && finalTotal <= 0 && (
                        <Button
                            type="button"
                            className={themeConfig?.button?.primary || 'w-full bg-green-600 hover:bg-green-700'}
                            onClick={handleNoPaymentCheckout}
                            disabled={isDisabled}
                        >
                            Complete enrollment
                        </Button>
                    )}

                    {!processing && checkoutIsCurrent(values?.[fieldName]) && (
                        <div className="flex items-center justify-center gap-3 py-8">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
                                <Check className="h-5 w-5" style={{ color: primaryColor }} />
                            </div>
                            <span className="text-muted-foreground text-sm">Payment confirmed. Continuing enrollment...</span>
                        </div>
                    )}

                    {!processing &&
                        hasPurchaseChoice &&
                        billingReady &&
                        (!billingOptionId || billingAccepted) &&
                        finalTotal > 0 &&
                        !checkoutIsCurrent(values?.[fieldName]) &&
                        StripeForm &&
                        authToken && (
                            <StripeForm
                                key={billingOptionId ? billingPurchase?.checkout_uuid : couponContextKey}
                                billingCheckoutUuid={billingPurchase?.checkout_uuid}
                                authorizationAssignedPlanId={enrollmentModule.plan?.id}
                                authorizationCouponCode={billingOptionId ? billingCouponCode : appliedCoupon?.code}
                                amount={Math.round(finalTotal * 100)}
                                currency="USD"
                                merchantId={enrollmentModule.merchant?.id}
                                authToken={authToken}
                                chargeMode={chargeMode}
                                authorizationPlanSlug={enrollmentModule.slug}
                                authorizationVariantId={emrState?.variantId ?? null}
                                authorizationDrugSelections={emrState?.drugSelection}
                                onSuccess={handleStripeSuccess}
                                onError={handleStripeError}
                                beforeSubmit={validateForm}
                                paymentElementLayout="tabs"
                                appearance={{
                                    theme: 'stripe' as const,
                                    variables: {
                                        colorPrimary: primaryColor,
                                        colorBackground: themeConfig?.colors?.background || '#ffffff',
                                        colorText: themeConfig?.colors?.text || '#30313d',
                                        colorDanger: themeConfig?.colors?.error || '#df1b41',
                                        fontFamily: themeConfig?.fonts?.primary || 'system-ui, sans-serif',
                                        spacingUnit: '2px',
                                        borderRadius: '4px',
                                    },
                                }}
                                submitButtonAppearance={{
                                    className: themeConfig?.button?.primary || 'w-full bg-green-600 hover:bg-green-700',
                                    text: chargeMode === 'save_only' ? 'Save payment method' : `Authorize ${fmt(finalTotal)}`,
                                    loadingText: 'Processing...',
                                    processingText: 'Please wait...',
                                }}
                            />
                        )}

                    {!processing &&
                        hasPurchaseChoice &&
                        billingReady &&
                        (!billingOptionId || billingAccepted) &&
                        finalTotal > 0 &&
                        !checkoutIsCurrent(values?.[fieldName]) &&
                        (!StripeForm || !authToken) && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {!authToken
                                        ? 'Please complete authentication first to enable payment.'
                                        : 'Payment system is loading. Please wait...'}
                                </AlertDescription>
                            </Alert>
                        )}
                </CardContent>
            </Card>
        </div>
    );
});

EmrCheckoutRenderer.displayName = 'EmrCheckoutRenderer';

// ============================================================
// Block Definition
// ============================================================

export const EmrCheckoutBlock: BlockDefinition = {
    type: 'unifiedCheckout',
    name: 'Unified Checkout',
    description: 'Complete checkout for EMR treatment plans with order summary, contact info, address, and payment',
    icon: <CreditCard className="h-4 w-4" />,
    defaultData: {
        type: 'unifiedCheckout',
        fieldName: 'unifiedCheckout',
        title: 'Complete Your Order',
        showOrderSummary: true,
        showContactInfo: true,
        collectPhone: true,
        showAddress: true,
        allowSavedAddresses: true,
    },
    generateDefaultData: () => ({
        type: 'unifiedCheckout',
        fieldName: 'unifiedCheckout',
        title: 'Complete Your Order',
        showOrderSummary: true,
        showContactInfo: true,
        collectPhone: true,
        showAddress: true,
        allowSavedAddresses: true,
    }),
    renderItem: (props) => <EmrCheckoutBlockItem {...props} />,
    renderFormFields: (props) => <EmrCheckoutBlockForm {...props} />,
    renderPreview: () => <EmrCheckoutBlockPreview />,
    renderBlock: (props) => <EmrCheckoutRenderer {...props} />,
    validate: (data) => {
        if (!data.fieldName) return 'Field name is required';
        return null;
    },
    validateValue: (value) => {
        if (!value) return 'Checkout is required';
        const v = typeof value === 'string' ? JSON.parse(value) : value;
        if (!v.success) return 'Please complete checkout';
        return null;
    },
    outputSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean', description: 'Payment completed successfully' },
            patientInfo: { type: 'object', description: 'Patient contact information' },
            address: { type: 'object', description: 'Shipping address' },
            useExistingAddress: { type: 'boolean', description: 'Whether a saved address was used' },
            paymentMethodId: { type: 'string', description: 'Stripe payment method ID' },
            paymentIntentId: { type: 'string', description: 'Payment authorization identity' },
            billingOptionId: { type: 'number', description: 'Selected local billing option' },
            billingCheckoutUuid: { type: 'string', description: 'Accepted checkout quote identity' },
            billingQuote: { type: 'object', description: 'Server quoted term and renewal terms' },
            billingTermsAccepted: { type: 'boolean', description: 'Explicit acceptance of quoted renewal terms' },
            variantId: { type: 'string', description: 'Selected EMR refill variant ID' },
            total: { type: 'number', description: 'Quoted amount for the selected supplies' },
            timestamp: { type: 'string', description: 'Checkout completion time' },
        },
    },
};

export default EmrCheckoutBlock;
