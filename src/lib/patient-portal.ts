import type { LoginBrand } from '@/components/patient/login/login-designs';
import type { MerchantBusinessWithAddress } from '@/types';
import { usePage } from '@inertiajs/react';

export interface PortalPatient {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string | null;
}
export interface PortalMerchant {
    business: MerchantBusinessWithAddress;
    id: number;
    slug: string;
    name: string;
    provider_type?: string;
    portal_design?: string;
    portal_brand?: LoginBrand;
    portal_brand_display?: string;
    portal_logo_mode?: string;
    theme?: { primary_color?: string; secondary_color?: string };
}
export interface UpcomingCare {
    uuid: string;
    plan_name: string;
    status: string;
    next_refill_date: number | null;
    refills_completed: number;
    refill_cycle_days: number | null;
    in_progress: boolean;
    can_request_refill: boolean;
    latest_status: string | null;
}
export interface CareUpdate {
    id: string;
    title: string;
    detail: string;
    date: number;
    enrollment_uuid: string | null;
}
export function usePatientPortal() {
    const { merchant, isCustomDomain } = usePage().props as unknown as { merchant: PortalMerchant; isCustomDomain: boolean };
    const href = (name: string, params: Record<string, string | number> = {}) =>
        route(`patient.${isCustomDomain ? 'domain.' : ''}${name}`, isCustomDomain ? params : { merchantSlug: merchant.slug, ...params });
    return { merchant, href };
}
export function portalMoney(cents: number, currency = 'USD') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

/** Keeps legacy routes intact while resolving shared UniEMR pages on custom domains. */
export function useScopedPatientRoute() {
    const { merchant, isCustomDomain } = usePage().props as unknown as { merchant: PortalMerchant; isCustomDomain: boolean };
    return (name: string, params?: string | number | Array<string | number> | Record<string, string | number>): string => {
        if (merchant.provider_type !== 'uniemr' || !isCustomDomain || name.startsWith('patient.domain.')) {
            if (typeof params === 'string' || typeof params === 'number') return route(name, params);
            return route(name, params);
        }
        let scoped: Record<string, string | number> | Array<string | number> = {};
        if (Array.isArray(params)) scoped = params.slice(1);
        else if (params && typeof params === 'object') scoped = Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'merchantSlug'));
        return route(name.replace('patient.', 'patient.domain.'), scoped);
    };
}
