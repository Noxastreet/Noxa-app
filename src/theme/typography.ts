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
} as const;
