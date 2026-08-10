export const animations = {
  press: 110,
  micro: 180,
  sheet: 280,
  fast: 120,
  base: 220,
  slow: 380,
  entrance: 380,
  entranceDistance: 12,
  pressedScale: 0.98,
  iconPressedScale: 0.96,
  // Visual Architecture V2 semantic durations, in milliseconds
  // (docs/VISUAL_ARCHITECTURE_V2.md §7). Additive: the timings above keep their
  // current values and every existing call site is untouched. `sheetRise` is
  // distinct from `sheet` (280) rather than a replacement for it.
  step: 240,
  sheetRise: 320,
  minimise: 260,
  participantInterpolation: 1200,
} as const;
