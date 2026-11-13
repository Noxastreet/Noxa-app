export const geometry = {
  cut: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  controlHeight: {
    compact: 44,
    standard: 48,
    primary: 56,
  },
  sheet: {
    gutter: 20,
    gap: 16,
    handleWidth: 38,
    handleHeight: 3,
  },
  rowHeight: 56,
  gutter: {
    min: 16,
    preferred: 24,
  },
} as const;

/** Shared by navigation and map overlays so scaled labels never cover controls. */
export function bottomNavigationHeight(fontScale = 1): number {
  return fontScale <= 1.2 ? 72 : Math.ceil(52 + 32 * fontScale);
}
