import { Platform } from 'react-native';

export const typography = {
  fontFamily: {
    display: Platform.select({
      ios: 'HelveticaNeue-CondensedBold',
      android: 'sans-serif-condensed',
      default: 'Arial Narrow',
    }),
    body: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'system-ui',
    }),
  },
  caption: 12,
  badge: 12,
  body: 16,
  subtitle: 18,
  cardTitle: 18,
  title: 22,
  sectionTitle: 22,
  h2: 28,
  h1: 34,
  hero: 48,
  lineHeight: {
    caption: 16,
    body: 22,
    subtitle: 24,
    title: 28,
    h2: 34,
    h1: 40,
    hero: 54,
  },
  letterSpacing: {
    tight: -0.6,
    title: -0.3,
    body: 0,
    caption: 0.4,
    label: 1.8,
  },
  // Visual Architecture V2 semantic scale (docs/VISUAL_ARCHITECTURE_V2.md §3).
  // Namespaced to avoid colliding with the scale above, which stays canonical
  // for every screen that has not migrated. Nothing consumes `v2` yet.
  //
  // Each role is a spreadable TextStyle fragment. `letterSpacing` is absolute
  // points, converted from the contract's percentage tracking intent
  // (hero -3.5% of 40 = -1.4; value -3% of 30 = -0.9; label +14% of 11 = 1.54).
  //
  // `fontFamily` is deliberately absent: the contract's Archivo display face and
  // JetBrains Mono label face are not integrated, so these roles inherit the
  // current families. `label` carries the mono/metadata intent by size, tracking
  // and casing only. Font integration is a separate reviewed decision because it
  // affects app startup, bundle size and Android/iOS rendering.
  v2: {
    hero: { fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
    value: { fontSize: 30, lineHeight: 32, letterSpacing: -0.9 },
    section: { fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
    row: { fontSize: 17, lineHeight: 22, letterSpacing: 0 },
    body: { fontSize: 16, lineHeight: 24, letterSpacing: 0 },
    label: {
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    },
  },
} as const;
