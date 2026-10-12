/**
 * Patient Portal Layout Configuration
 *
 * This file manages the layout system for the patient portal.
 * Layouts can be switched via the VITE_PATIENT_LAYOUT environment variable.
 */

export type LayoutType = 'classic' | 'modern';

/**
 * Get the current layout type from environment variables
 * Defaults to 'classic' if not specified
 */
export function getPatientLayout(): LayoutType {
    const layout = import.meta.env.VITE_PATIENT_LAYOUT as LayoutType | undefined;

    // Validate the layout type
    if (layout && (layout === 'classic' || layout === 'modern')) {
        return layout;
    }

    // Default to classic layout
    return 'classic';
}

/**
 * Check if a specific layout is active
 */
export function isLayoutActive(layoutType: LayoutType): boolean {
    return getPatientLayout() === layoutType;
}
