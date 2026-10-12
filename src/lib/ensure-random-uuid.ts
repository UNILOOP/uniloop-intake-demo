/**
 * Keep published custom blocks that call crypto.randomUUID working on local
 * HTTP domains, where browsers expose getRandomValues but omit randomUUID.
 * Preserve native implementations and use cryptographically random bytes.
 */
export function ensureRandomUUID(cryptoApi: Crypto | undefined): void {
    if (!cryptoApi || typeof cryptoApi.randomUUID === 'function' || typeof cryptoApi.getRandomValues !== 'function') {
        return;
    }

    cryptoApi.randomUUID = () => {
        const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
    };
}
