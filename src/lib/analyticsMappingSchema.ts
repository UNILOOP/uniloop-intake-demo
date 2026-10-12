/**
 * Canonical event catalog, channel keys, and condition operators shared
 * between the Event Mapping UI and the import validator. Keep this list
 * aligned with app/Enums/AnalyticsEventType.php + app/Enums/AnalyticsChannel.php.
 */

import {
    FIELD_VALUE_TYPES,
    formatsForType,
    isFieldValueType,
    isValidFieldFormat,
    isValidOutputPath,
    type ExtraFieldValue,
    type FieldMapValue,
} from '@/lib/analyticsFieldFormats';

export type { FieldMapEntry, FieldMapLevel, FieldMapValue, FieldValueType } from '@/lib/analyticsFieldFormats';

export const CANONICAL_EVENTS = [
    'page_view',
    'user_landed',
    'survey_start',
    'survey_complete',
    'survey_abandon',
    'survey_resume',
    'checkout_view',
    'checkout_started',
    'checkout_completed',
    'checkout_abandon',
    'checkout_resume',
    'payment_authorized',
    'payment_failed',
    'enrollment_complete',
    'order_placed',
    'first_time_order',
    'user_authenticated',
    'sign_in',
    'sign_up',
    'new_user',
    'email_submitted',
    'patient_field_updated',
    'field_complete',
    'tab_switch',
    'timing',
    'set_properties',
    'bmi_set',
    'address_added',
    'address_selected',
    'coupon_applied',
    'coupon_removed',
    'variation_selected',
    'pricing_option_selected',
    'emr_variant_selected',
    'emr_drug_selected',
    'emr_drug_phase_selected',
    'emr_enrollment_created',
    'emr_enrollment_activated',
    'emr_enrollment_paused',
    'emr_enrollment_resumed',
    'emr_enrollment_discontinued',
    'emr_enrollment_cancelled',
    'emr_enrollment_completed',
    'emr_enrollment_push_failed',
    'emr_refill_created',
    'emr_refill_approved',
    'emr_refill_rejected',
    'emr_refill_revision_requested',
    'emr_refill_completed',
    'emr_refill_cancelled',
    'emr_refill_upcoming',
    'emr_refill_refunded',
    'emr_billing_term_paid',
    'emr_billing_renewal_due',
    'emr_billing_renewal_failed',
    'emr_billing_renewal_cancelled',
    'emr_coverage_adjusted',
    'emr_charge_created',
    'emr_charge_completed',
    'emr_charge_failed',
    'emr_charge_refunded',
    'emr_charge_disputed',
    'emr_encounter_created',
    'emr_encounter_signed',
    'emr_encounter_closed',
    'emr_encounter_cancelled',
    'emr_shipment_preparing',
    'emr_shipment_shipped',
    'emr_shipment_tracking_updated',
    'emr_shipment_delivered',
    'emr_shipment_delivery_exception',
    'emr_shipment_cancelled',
    'emr_shipment_recovered',
    'emr_prescription_created',
    'emr_prescription_updated',
    'emr_prescription_on_hold',
    'emr_prescription_discontinued',
    'emr_prescription_cancelled',
    'emr_form_submission_completed',
    'emr_form_submission_signed',
    'emr_form_submission_voided',
] as const;

export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

export const CHANNEL_KEYS = ['meta', 'google_analytics', 'google_tag_manager', 'customer_io', 'everflow'] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/**
 * Dynamic per-instance channel key resolved from a MerchantChannel row.
 * `channel:{id}` targets a custom webhook (mirrors CustomWebhookProvider::channelKey()),
 * `pixel:{id}` is reserved for Phase 2 custom pixels. Validated, not enumerated,
 * because the set is merchant-specific.
 */
export type DynamicChannelKey = `channel:${number}` | `pixel:${number}`;

/**
 * Any channel key accepted by the mapping schema: a fixed static key or a
 * dynamic per-instance key.
 */
export type AnyChannelKey = ChannelKey | DynamicChannelKey;

const DYNAMIC_CHANNEL_KEY = /^(channel|pixel):\d+$/;

/**
 * True when the key is a fixed static channel OR a well-formed dynamic
 * per-instance key. Keep this aligned with
 * App\Http\Requests\Support\AnalyticsMappingRules::isValidChannelKey().
 */
export function isValidChannelKey(channel: string): channel is AnyChannelKey {
    return CHANNEL_SET.has(channel) || DYNAMIC_CHANNEL_KEY.test(channel);
}

export const CONDITION_OPS = ['equals', 'not_equals', 'in', 'not_in'] as const;

export type ConditionOp = (typeof CONDITION_OPS)[number];

export const CUSTOMER_IO_DELIVERY_MODES = ['automatic', 'identify', 'track', 'both'] as const;
export type CustomerIoDeliveryMode = (typeof CUSTOMER_IO_DELIVERY_MODES)[number];

export interface ChannelMapping {
    enabled?: boolean;
    name?: string;
    customer_io_delivery?: CustomerIoDeliveryMode | null;
    /**
     * Canonical source key/path to output. Source keys may be first-level
     * payload keys (`patient_email`) or dot paths into nested payload objects
     * (`properties.email`). The value is either the output key (shorthand) or
     * an entry object `{ to, level, type, format }` that also sets the
     * data-layer level (0 = top level, 1 = nested) and a standard value format.
     */
    field_map?: Record<string, FieldMapValue>;
    /**
     * Canonical source keys/paths to remove before mapping. Dot paths are
     * supported for nested auth traits such as `properties.email`.
     */
    drop_keys?: string[];
    /**
     * Canonical source keys/paths whose outgoing values should be SHA-256
     * hashed. When a key is also renamed by field_map, the renamed output key
     * is hashed.
     */
    hash_keys?: string[];
    /**
     * Outgoing static key → literal value. A value may also be an entry object
     * `{ value, level }` so static keys can use the same data-layer levels as
     * field_map outputs. Legacy literals default to level 1.
     */
    extra_fields?: Record<string, ExtraFieldValue>;
}

export interface ConditionClause {
    path?: string;
    op?: ConditionOp;
    value?: string | string[] | number | number[];
}

/**
 * A filter condition on a custom event. Supports two shapes:
 *  - single clause: { path, op, value }
 *  - AND compound:  { all: [{ path, op, value }, ...] }
 */
export type Condition = ConditionClause & {
    all?: ConditionClause[];
};

export interface CustomEvent {
    key: string;
    trigger_event: CanonicalEvent | '';
    condition?: Condition | null;
    channels: Partial<Record<AnyChannelKey, ChannelMapping>>;
}

export interface EventMappings {
    version?: number;
    global_drop_keys?: Partial<Record<AnyChannelKey, string[]>>;
    global_hash_keys?: Partial<Record<AnyChannelKey, string[]>>;
    events?: Partial<Record<CanonicalEvent, Partial<Record<AnyChannelKey, ChannelMapping>>>>;
    custom_events?: CustomEvent[];
}

const CANONICAL_SET = new Set<string>(CANONICAL_EVENTS);
const CHANNEL_SET = new Set<string>(CHANNEL_KEYS);
const OP_SET = new Set<string>(CONDITION_OPS);

export type ValidationResult = { ok: true; value: EventMappings } | { ok: false; errors: string[] };

/**
 * Validate a parsed JSON blob against the event-mapping schema.
 * Produces a flat list of human-readable errors keyed by JSON path —
 * returned list order matches file order so toasts read top-to-bottom.
 */
export function validateEventMappings(raw: unknown): ValidationResult {
    const errors: string[] = [];

    if (!isObject(raw)) {
        return { ok: false, errors: ['Root must be a JSON object.'] };
    }

    if ('version' in raw && raw.version !== undefined) {
        if (!Number.isInteger(raw.version) || (raw.version as number) < 1) {
            errors.push('version must be a positive integer.');
        }
    }

    if ('global_drop_keys' in raw && raw.global_drop_keys !== undefined && raw.global_drop_keys !== null) {
        if (!isObjectOrEmptyArray(raw.global_drop_keys)) {
            errors.push('global_drop_keys must be an object keyed by channel.');
        } else if (isObject(raw.global_drop_keys)) {
            for (const [channel, list] of Object.entries(raw.global_drop_keys)) {
                if (!isValidChannelKey(channel)) {
                    errors.push(`global_drop_keys.${channel} is not a known channel.`);
                    continue;
                }
                if (list !== undefined && list !== null && !isStringArray(list)) {
                    errors.push(`global_drop_keys.${channel} must be an array of strings.`);
                }
            }
        }
    }

    if ('global_hash_keys' in raw && raw.global_hash_keys !== undefined && raw.global_hash_keys !== null) {
        if (!isObjectOrEmptyArray(raw.global_hash_keys)) {
            errors.push('global_hash_keys must be an object keyed by channel.');
        } else if (isObject(raw.global_hash_keys)) {
            for (const [channel, list] of Object.entries(raw.global_hash_keys)) {
                if (!isValidChannelKey(channel)) {
                    errors.push(`global_hash_keys.${channel} is not a known channel.`);
                    continue;
                }
                if (list !== undefined && list !== null && !isStringArray(list)) {
                    errors.push(`global_hash_keys.${channel} must be an array of strings.`);
                }
            }
        }
    }

    if ('events' in raw && raw.events !== undefined && raw.events !== null) {
        if (!isObject(raw.events)) {
            errors.push('events must be an object.');
        } else {
            for (const [action, channels] of Object.entries(raw.events)) {
                if (!CANONICAL_SET.has(action)) {
                    errors.push(`events.${action} is not a known canonical event.`);
                    continue;
                }
                if (!isObject(channels)) {
                    errors.push(`events.${action} must be an object keyed by channel.`);
                    continue;
                }
                for (const [channel, mapping] of Object.entries(channels)) {
                    if (!isValidChannelKey(channel)) {
                        errors.push(`events.${action}.${channel} is not a known channel.`);
                        continue;
                    }
                    errors.push(...validateChannelMapping(`events.${action}.${channel}`, mapping));
                }
            }
        }
    }

    if ('custom_events' in raw && raw.custom_events !== undefined && raw.custom_events !== null) {
        if (!Array.isArray(raw.custom_events)) {
            errors.push('custom_events must be an array.');
        } else {
            raw.custom_events.forEach((entry, idx) => {
                errors.push(...validateCustomEvent(`custom_events[${idx}]`, entry));
            });
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    return { ok: true, value: raw as EventMappings };
}

function validateConditionClause(path: string, clause: unknown): string[] {
    if (!isObject(clause)) {
        return [`${path} must be an object.`];
    }
    const errors: string[] = [];
    const op = clause.op;
    if (op !== undefined && (typeof op !== 'string' || !OP_SET.has(op))) {
        errors.push(`${path}.op '${String(op)}' is not supported (equals, not_equals, in, not_in).`);
    }
    if ('path' in clause && clause.path !== undefined && typeof clause.path !== 'string') {
        errors.push(`${path}.path must be a string.`);
    }
    if ((op === 'in' || op === 'not_in') && clause.value !== undefined && !Array.isArray(clause.value)) {
        errors.push(`${path}.value must be an array when op is '${op}'.`);
    }
    return errors;
}

function validateChannelMapping(path: string, mapping: unknown): string[] {
    if (!isObject(mapping)) {
        return [`${path} must be an object.`];
    }
    const errors: string[] = [];
    if ('enabled' in mapping && typeof mapping.enabled !== 'boolean') {
        errors.push(`${path}.enabled must be a boolean.`);
    }
    if ('name' in mapping && mapping.name !== undefined && typeof mapping.name !== 'string') {
        errors.push(`${path}.name must be a string.`);
    }
    if (mapping.customer_io_delivery != null && !CUSTOMER_IO_DELIVERY_MODES.includes(mapping.customer_io_delivery as CustomerIoDeliveryMode)) {
        errors.push(`${path}.customer_io_delivery must be automatic, identify, track, or both.`);
    }
    if ('field_map' in mapping && mapping.field_map !== undefined && mapping.field_map !== null) {
        errors.push(...validateFieldMap(`${path}.field_map`, mapping.field_map));
    }
    if ('drop_keys' in mapping && mapping.drop_keys !== undefined && !isStringArray(mapping.drop_keys)) {
        errors.push(`${path}.drop_keys must be an array of strings.`);
    }
    if ('hash_keys' in mapping && mapping.hash_keys !== undefined && !isStringArray(mapping.hash_keys)) {
        errors.push(`${path}.hash_keys must be an array of strings.`);
    }
    if ('extra_fields' in mapping && mapping.extra_fields !== undefined && mapping.extra_fields !== null) {
        errors.push(...validateExtraFields(`${path}.extra_fields`, mapping.extra_fields));
    }
    return errors;
}

/**
 * A field_map value is either the legacy output-key string or an entry object
 * `{ to, level?, type?, format? }`. Keep aligned with
 * App\Http\Requests\Support\AnalyticsMappingRules::fieldMapRule().
 */
function validateFieldMap(path: string, fieldMap: unknown): string[] {
    if (!isObjectOrEmptyArray(fieldMap)) {
        return [`${path} must be an object keyed by canonical key.`];
    }
    if (!isObject(fieldMap)) {
        return [];
    }

    const errors: string[] = [];
    for (const [sourceKey, entry] of Object.entries(fieldMap)) {
        const label = `${path}.${sourceKey}`;
        // A blank output key round-trips as null through the server, so both
        // blank forms are accepted here and skipped at runtime.
        if (entry === null || typeof entry === 'string') {
            if (typeof entry === 'string' && entry && !isValidOutputPath(entry)) errors.push(`${label} must be a valid destination dot path.`);
            continue;
        }
        if (!isObject(entry)) {
            errors.push(`${label} must be an output key string or an entry object ({ to, level, type, format }).`);
            continue;
        }
        if (typeof entry.to !== 'string') {
            errors.push(`${label}.to must be a string.`);
        }
        if (typeof entry.to === 'string' && entry.to !== '' && !isValidOutputPath(entry.to)) {
            errors.push(`${label}.to must be a valid destination dot path.`);
        }
        if (!isValidLevel(entry.level)) {
            errors.push(`${label}.level must be 0 (top level) or 1 (nested).`);
        }

        const hasType = entry.type !== undefined && entry.type !== null && entry.type !== '';
        const hasFormat = entry.format !== undefined && entry.format !== null && entry.format !== '';
        if (!hasType) {
            if (hasFormat) errors.push(`${label}.format requires a type.`);
            continue;
        }
        if (!isFieldValueType(entry.type)) {
            errors.push(`${label}.type '${String(entry.type)}' is not supported (${FIELD_VALUE_TYPES.join(', ')}).`);
        } else if (!isValidFieldFormat(entry.type, entry.format)) {
            const allowed = formatsForType(entry.type)
                .map((option) => option.id)
                .join(', ');
            errors.push(`${label}.format '${String(entry.format)}' is not a ${entry.type} format (${allowed}).`);
        }
    }
    return errors;
}

/**
 * An extra_fields value is either a legacy literal, or an entry object
 * `{ value, level? }` when the merchant wants to choose the data-layer level.
 * Keep aligned with App\Http\Requests\Support\AnalyticsMappingRules::extraFieldsRule().
 */
function validateExtraFields(path: string, extraFields: unknown): string[] {
    if (!isObjectOrEmptyArray(extraFields)) {
        return [`${path} must be an object keyed by output key.`];
    }
    if (!isObject(extraFields)) {
        return [];
    }

    const errors: string[] = [];
    for (const [key, entry] of Object.entries(extraFields)) {
        const label = `${path}.${key}`;
        if (!isValidOutputPath(key)) errors.push(`${label} must be a valid destination dot path.`);
        if (!isObject(entry)) continue;

        const hasValue = Object.prototype.hasOwnProperty.call(entry, 'value');
        const hasLevel = Object.prototype.hasOwnProperty.call(entry, 'level');
        if (!hasValue && !hasLevel) continue;

        if (!hasValue) {
            errors.push(`${label}.value is required when using an entry object.`);
        }
        if (!isValidLevel(entry.level)) {
            errors.push(`${label}.level must be 0 (top level) or 1 (nested).`);
        }
    }

    return errors;
}

function isValidLevel(level: unknown): boolean {
    return level === undefined || level === null || level === 0 || level === 1 || level === '0' || level === '1';
}

function validateCustomEvent(path: string, entry: unknown): string[] {
    if (!isObject(entry)) {
        return [`${path} must be an object.`];
    }
    const errors: string[] = [];

    if (typeof entry.key !== 'string' || entry.key.length === 0) {
        errors.push(`${path}.key must be a non-empty string.`);
    }
    if (typeof entry.trigger_event !== 'string' || !CANONICAL_SET.has(entry.trigger_event)) {
        errors.push(`${path}.trigger_event '${entry.trigger_event}' is not a known canonical event.`);
    }

    if ('condition' in entry && entry.condition !== null && entry.condition !== undefined) {
        if (!isObject(entry.condition)) {
            errors.push(`${path}.condition must be an object or null.`);
        } else if (Array.isArray((entry.condition as Record<string, unknown>).all)) {
            const clauses = (entry.condition as Record<string, unknown>).all as unknown[];
            clauses.forEach((clause, idx) => {
                errors.push(...validateConditionClause(`${path}.condition.all[${idx}]`, clause));
            });
        } else {
            errors.push(...validateConditionClause(`${path}.condition`, entry.condition));
        }
    }

    if (!isObject(entry.channels) || Object.keys(entry.channels).length === 0) {
        errors.push(`${path}.channels must be an object with at least one channel.`);
    } else {
        for (const [channel, mapping] of Object.entries(entry.channels)) {
            if (!isValidChannelKey(channel)) {
                errors.push(`${path}.channels.${channel} is not a known channel.`);
                continue;
            }
            errors.push(...validateChannelMapping(`${path}.channels.${channel}`, mapping));
        }
    }

    return errors;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Some producers (notably PHP's json_encode of an empty array) serialize
// an empty object as `[]`. Treat that as a valid empty object everywhere
// we expect a map.
function isObjectOrEmptyArray(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    return isObject(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
