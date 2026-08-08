import { Easing, ReduceMotion } from 'react-native-reanimated';

const easeOut = Easing.out(Easing.cubic);

export const introDeckMotion = {
  /** Fraction of screen width a card must travel to count as a committed swipe. */
  swipeThresholdFactor: 0.24,
  /** Release velocity (points/second) that commits a swipe even under the distance threshold. */
  velocityThreshold: 800,
  /** How far the outgoing card travels off-screen before the transition completes. */
  exitDistanceFactor: 1.2,
  exitDurationMs: 240,
  exitEasing: easeOut,
  /** Maximum card tilt in degrees, reached only once the card has traveled a full exit distance. */
  rotationMaxDeg: 4,
  /** Caps how far a wrong-direction drag (right) can rubber-band before resisting further. */
  rubberBandMax: 36,
  springBack: {
    damping: 22,
    stiffness: 260,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
  },
  /** Scale of the next card at rest, before it glides in and reaches 1.0. */
  nextCardRestScale: 0.94,
} as const;
