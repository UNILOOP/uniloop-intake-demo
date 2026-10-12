/**
 * Server-to-server Conversions-API vendor registry (frontend mirror).
 *
 * Unlike the browser-pixel registry in `pixelVendors.ts`, these vendors never
 * run code in the browser — delivery happens server-side via
 * App\Services\Analytics\Providers\ConversionsApiProvider and the per-vendor
 * adapters. This module only describes the config-form shape: which vendors
 * exist, how to label them, and which id field(s) each one requires besides the
 * (encrypted) access token.
 *
 * The vendor keys MUST mirror App\Enums\ConversionsApiVendor (tiktok, snapchat,
 * pinterest, reddit, twitter) in declaration order, and the per-vendor
 * `requiredFields` MUST match ConversionsApiVendor::requiredConfigKeys(). The
 * PHP drift-guard test (PixelVendorFrontendSyncTest) parses the
 * CONVERSIONS_API_VENDOR_KEYS tuple below and fails if it diverges from the
 * enum, so add/remove vendors here in lockstep with the backend.
 */

/**
 * The canonical conversions-API vendor keys, mirroring
 * App\Enums\ConversionsApiVendor::values() in declaration order.
 */
export const CONVERSIONS_API_VENDOR_KEYS = ['tiktok', 'snapchat', 'pinterest', 'reddit', 'twitter'] as const;

export type ConversionsApiVendorKey = (typeof CONVERSIONS_API_VENDOR_KEYS)[number];

/**
 * Human labels for each vendor, mirroring ConversionsApiVendor::label().
 */
export const CONVERSIONS_API_VENDOR_LABELS: Record<ConversionsApiVendorKey, string> = {
    tiktok: 'TikTok Events API',
    snapchat: 'Snapchat Conversions API',
    pinterest: 'Pinterest Conversions API',
    reddit: 'Reddit Conversions API',
    twitter: 'X (Twitter) Conversions API',
};

/**
 * A single required id config field for a vendor: the config `key` the merchant
 * must fill, plus a human `label`/`placeholder` for the form input.
 */
export interface ConversionsApiVendorField {
    key: string;
    label: string;
    placeholder: string;
}

/**
 * Per-vendor required id field(s) BESIDES access_token. The `key` values MUST
 * match ConversionsApiVendor::requiredConfigKeys() exactly — those are the
 * config keys the backend validates and persists.
 */
export const CONVERSIONS_API_VENDOR_FIELDS: Record<ConversionsApiVendorKey, ConversionsApiVendorField[]> = {
    tiktok: [{ key: 'event_source_id', label: 'Event Source ID', placeholder: 'e.g., 1234567890123456789' }],
    snapchat: [{ key: 'pixel_id', label: 'Pixel ID', placeholder: 'e.g., 00000000-0000-0000-0000-000000000000' }],
    pinterest: [{ key: 'ad_account_id', label: 'Ad Account ID', placeholder: 'e.g., 549000000000000000' }],
    reddit: [{ key: 'account_id', label: 'Account ID', placeholder: 'e.g., a2_abcdef123456' }],
    twitter: [{ key: 'pixel_id', label: 'Pixel/Tag ID', placeholder: 'e.g., o1abc' }],
};

/**
 * Type guard: whether a string is one of the known conversions-API vendor keys.
 */
export function isConversionsApiVendorKey(value: string | null | undefined): value is ConversionsApiVendorKey {
    return value !== null && value !== undefined && (CONVERSIONS_API_VENDOR_KEYS as readonly string[]).includes(value);
}
