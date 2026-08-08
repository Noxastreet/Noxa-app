import { ReduceMotion } from 'react-native-reanimated';

export const introDeckMotion = {
  /** Fraction of screen width a card must travel to count as a committed swipe. */
  swipeThresholdFactor: 0.24,
  /** Release velocity (points/second) that commits a swipe even under the distance threshold. */
  velocityThreshold: 800,
  /** How far the outgoing card travels off-screen before the transition completes. */
  exitDistanceFactor: 1.2,
  /**
   * Transfer only a restrained portion of finger velocity into the settle spring.
   * Raw gesture velocity can be several thousand pt/s and made the card shoot away
   * abruptly after an otherwise smooth drag.
   */
  releaseVelocityTransfer: 0.28,
  releaseVelocityMax: 650,
  springBackVelocityTransfer: 0.25,
  springBackVelocityMax: 500,
  /**
   * Slightly heavier/softer than the previous spring so a committed card keeps
   * moving continuously after release but decelerates into a controlled exit.
   */
  exitSpring: {
    damping: 30,
    stiffness: 105,
    mass: 1.15,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  /** Maximum card tilt in degrees, reached only once the card has traveled a full exit distance. */
  rotationMaxDeg: 4,
  /** Caps how far a wrong-direction drag (right) can rubber-band before resisting further. */
  rubberBandMax: 36,
  springBack: {
    damping: 28,
    stiffness: 165,
    mass: 1,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  /** Scale of the next card at rest, before it glides in and reaches 1.0. */
  nextCardRestScale: 0.94,
} as const;
