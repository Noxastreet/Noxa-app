import { ReduceMotion } from 'react-native-reanimated';

export const introDeckMotion = {
  /** Fraction of screen width a card must travel to count as a committed swipe. */
  swipeThresholdFactor: 0.24,
  /** Release velocity (points/second) that commits a swipe even under the distance threshold. */
  velocityThreshold: 800,
  /** How far the outgoing card travels off-screen before the transition completes. */
  exitDistanceFactor: 1.2,
  /**
   * Spring (not timing) so release velocity carries continuously into the exit —
   * a time-based curve restarting from zero velocity is what produced the
   * release-point pause/jank. overshootClamping keeps a fast flick from
   * bouncing back into view once it passes the exit distance. Heavier than a
   * typical UI spring on purpose: a fast flick already reaches full commitment
   * distance quickly, so the spring's job is to make the last stretch read as
   * controlled deceleration rather than continued acceleration.
   */
  exitSpring: {
    damping: 30,
    stiffness: 110,
    mass: 1.15,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  /**
   * Only this fraction of raw release velocity (points/second) carries into the
   * exit spring. A normal flick's raw velocityX can be large enough that feeding
   * it in unscaled makes the release read as an explosive burst rather than a
   * continuation of the drag.
   */
  exitVelocityTransfer: 0.28,
  /** Absolute cap on transferred exit velocity after scaling, in points/second. */
  exitVelocityMax: 700,
  /** Maximum card tilt in degrees, reached only once the card has traveled a full exit distance. */
  rotationMaxDeg: 4,
  /** Caps how far a wrong-direction drag (right) can rubber-band before resisting further. */
  rubberBandMax: 36,
  springBack: {
    damping: 26,
    stiffness: 190,
    mass: 0.9,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  /** Same rationale as exitVelocityTransfer, applied to the weak-swipe return spring. */
  springBackVelocityTransfer: 0.28,
  /** Absolute cap on transferred spring-back velocity after scaling, in points/second. */
  springBackVelocityMax: 500,
  /** Scale of the next card at rest, before it glides in and reaches 1.0. */
  nextCardRestScale: 0.94,
} as const;
