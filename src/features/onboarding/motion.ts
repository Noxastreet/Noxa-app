import { ReduceMotion } from 'react-native-reanimated';

export const introDeckMotion = {
  swipeThresholdFactor: 0.24,
  velocityThreshold: 0.45,
  exitDistanceFactor: 1.15,
  exitDurationMs: 260,
  rotationMaxDeg: 8,
  springBack: {
    damping: 22,
    stiffness: 260,
    reduceMotion: ReduceMotion.System,
  },
  depth1: { scale: 0.94, translateY: 14 },
  depth2: { scale: 0.88, translateY: 26, opacity: 0.55 },
} as const;
