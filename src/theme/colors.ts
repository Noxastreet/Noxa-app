export const colors = {
  background: '#06060A',
  surfaceBase: '#0C0C10',
  surface: '#111116',
  surfaceSoft: '#18181D',
  surfaceRaised: '#1F1F25',
  surfacePressed: '#26262D',
  divider: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.072)',
  borderStrong: 'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(200,16,46,0.34)',
  primary: '#C8102E',
  primaryHover: '#E01535',
  primaryMuted: 'rgba(200,16,46,0.14)',
  primarySubtle: 'rgba(200,16,46,0.10)',
  text: '#F0F0F4',
  textMuted: '#8E8E98',
  textSubtle: '#4C4C56',
  textDisabled: '#2C2C34',
  textSecondary: '#8E8E98',
  // Visual Architecture V2 neutral ramp — the three steps the contract requires
  // that the ramp above did not already cover. Additive; nothing consumes them
  // yet. Full ramp, lightest to darkest:
  //   #F0F0F4 text · #8E8E98 textMuted · #6E6E78 textTertiary ·
  //   #4C4C56 textSubtle · #3C3C46 neutralStrong · #33333E neutralSoft ·
  //   #2C2C34 textDisabled
  textTertiary: '#6E6E78',
  neutralStrong: '#3C3C46',
  neutralSoft: '#33333E',
  success: '#30D158',
  successMuted: 'rgba(48,209,88,0.14)',
  warning: '#FF9F0A',
  warningMuted: 'rgba(255,159,10,0.14)',
  info: '#0A84FF',
  purple: '#BF5AF2',
  accent: '#C8102E',
  accentDark: '#A80D25',
  black: '#000000',
  white: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.46)',
  scrimSoft: 'rgba(0,0,0,0.24)',
  glow: 'rgba(200,16,46,0.16)',
  glass: 'rgba(12,12,16,0.92)',
} as const;
