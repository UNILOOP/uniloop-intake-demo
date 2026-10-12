/**
 * Layout Style Helper
 *
 * Utilities for handling styles in dynamically-loaded custom layouts
 * where Tailwind's JIT compiler cannot see the classes at build time.
 */

/**
 * Convert arbitrary Tailwind color classes to inline styles
 *
 * Example:
 *   styleHelper('bg-[#193f3a] text-white')
 *   => { backgroundColor: '#193f3a', color: 'white' }
 */
export function parseLayoutStyles(classNames: string): React.CSSProperties {
  const styles: React.CSSProperties = {};

  // Extract arbitrary color values
  const bgMatch = classNames.match(/bg-\[([^\]]+)\]/);
  if (bgMatch) {
    styles.backgroundColor = bgMatch[1];
  }

  const textMatch = classNames.match(/text-\[([^\]]+)\]/);
  if (textMatch) {
    styles.color = textMatch[1];
  }

  const borderMatch = classNames.match(/border-\[([^\]]+)\]/);
  if (borderMatch) {
    styles.borderColor = borderMatch[1];
  }

  return styles;
}

/**
 * Get a className string with arbitrary values removed
 * (since they won't work in dynamic layouts)
 */
export function getStaticClasses(classNames: string): string {
  return classNames
    .replace(/bg-\[[^\]]+\]/g, '')
    .replace(/text-\[[^\]]+\]/g, '')
    .replace(/border-\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Combined helper that returns both inline styles and safe classNames
 *
 * Example:
 *   const { style, className } = splitLayoutStyles('bg-[#193f3a] text-white p-4')
 *   <div style={style} className={className}>...</div>
 */
export function splitLayoutStyles(classNames: string): {
  style: React.CSSProperties;
  className: string;
} {
  return {
    style: parseLayoutStyles(classNames),
    className: getStaticClasses(classNames),
  };
}

/**
 * Recommended color palette for custom layouts
 * These can be used as CSS custom properties
 */
export const layoutColors = {
  // Refills theme
  'refills-dark': '#193f3a',
  'refills-teal': '#2A6A71',
  'refills-bg': '#F5F3ED',

  // Add more custom color schemes here as needed
} as const;

/**
 * Get a color value from the layout color palette
 */
export function getLayoutColor(colorKey: keyof typeof layoutColors): string {
  return layoutColors[colorKey];
}
