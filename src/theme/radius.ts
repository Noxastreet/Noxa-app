export const radius = {
  xs: 5,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  card: 16,
  hero: 20,
  input: 12,
  button: 12,
  avatar: 999,
  pill: 999,
  // Visual Architecture V2 L2 contextual sheet, top corners only
  // (docs/VISUAL_ARCHITECTURE_V2.md §2). Additive and deliberately unapplied:
  // migrating NoxaSheet is a later behavioral/component checkpoint.
  sheet: 28,
} as const;
