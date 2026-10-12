import type { EmrEnrollmentUtils } from './emr-enrollment-utils';
import { EnrollmentModule } from './enrollment-wrapper';

/**
 * Keep existing customData.enrollmentModule blocks working during EMR migration.
 * Every stateful operation uses the new session; the old prototype supplies only
 * methods absent from the EMR API (for example legacy analytics formatters).
 * Treatment-only methods continue to see enrollment/treatment as null.
 * @param utils The session also exposed as customData.emrEnrollmentUtils.
 * @returns The previous module API backed by the same EMR state, never a second session.
 */
export function createLegacyEmrEnrollmentAdapter(utils: EmrEnrollmentUtils): EnrollmentModule {
    const boundMethods = new Map<PropertyKey, unknown>();
    return new Proxy(utils, {
        get(target, property, receiver) {
            if (boundMethods.has(property)) return boundMethods.get(property);
            let value: unknown;
            if (property === 'applyCoupon') {
                value = (email: string, code: string, _planId?: number, _variationId?: number, _productIds?: number[], subtotal?: number) =>
                    target.applyCoupon(email, code, subtotal);
            } else if (property === 'getCoupons') {
                value = (email: string, _variationId?: number, subtotal?: number) => target.getCoupons(email, subtotal);
            } else if (property === 'providerType') {
                return 'emr';
            } else if (property === 'enrollment' || property === 'treatment') {
                return null;
            } else if (property === 'isTreatment') {
                return false;
            } else {
                value = Reflect.get(target, property, target);
                if (value === undefined) {
                    value = Reflect.get(EnrollmentModule.prototype, property, receiver);
                    if (typeof value === 'function') value = value.bind(receiver);
                } else if (typeof value === 'function') {
                    value = value.bind(target);
                }
            }
            if (typeof value === 'function') boundMethods.set(property, value);
            return value;
        },
    }) as unknown as EnrollmentModule;
}
