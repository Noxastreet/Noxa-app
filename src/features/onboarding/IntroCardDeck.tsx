import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { NoxaCard } from '@/src/components/ui';
import { colors, radius, spacing, typography } from '@/src/theme';

import { introDeckMotion } from './motion';

export type IntroCardPage = {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
};

export type IntroCardDeckHandle = {
  /** Run the active card through the same exit transition a committed swipe uses. */
  advance: () => void;
  /** Snap directly to a card with no transition — used for backward navigation. */
  seek: (index: number) => void;
};

type IntroCardDeckProps = {
  initialIndex?: number;
  onIndexChange: (index: number) => void;
  pages: readonly IntroCardPage[];
};

const SIDE_INSET = spacing.lg;
const CARD_GAP = spacing.sm;
const PEEK_REVEAL = spacing.xl;

function rubberBand(distance: number, max: number) {
  'worklet';
  return max * (1 - 1 / (distance / max + 1));
}

/**
 * Scales a raw gesture velocity down to a fraction of itself and clamps the
 * result to +/-max — keeps a fast flick's release velocity from being fed
 * unbounded into a spring, which is what made release feel explosive.
 */
function transferVelocity(rawVelocity: number, transfer: number, max: number) {
  'worklet';
  const scaled = rawVelocity * transfer;
  return Math.max(-max, Math.min(max, scaled));
}

export const IntroCardDeck = forwardRef<IntroCardDeckHandle, IntroCardDeckProps>(
  function IntroCardDeck({ initialIndex = 0, onIndexChange, pages }, ref) {
    const { width: windowWidth } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [stageWidth, setStageWidth] = useState(windowWidth);
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    const dragX = useSharedValue(0);
    const isAnimating = useSharedValue(false);

    const cardWidth = Math.max(stageWidth - SIDE_INSET - CARD_GAP - PEEK_REVEAL, 0);
    const exitDistance = Math.max(stageWidth * introDeckMotion.exitDistanceFactor, 1);
    const swipeThreshold = stageWidth * introDeckMotion.swipeThresholdFactor;
    const nextCardRestX = cardWidth + CARD_GAP;

    const canAdvance = activeIndex < pages.length - 1;

    const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
      setStageWidth(event.nativeEvent.layout.width);
    }, []);

    const commitAdvance = useCallback(() => {
      const next = Math.min(activeIndex + 1, pages.length - 1);
      if (next === activeIndex) {
        // Safety fallback only (gesture/advance() are already gated by canAdvance) —
        // activeIndex isn't changing here, so the settle effect below won't fire.
        dragX.value = 0;
        isAnimating.value = false;
        return;
      }

      setActiveIndex(next);
      onIndexChange(next);
    }, [activeIndex, dragX, isAnimating, onIndexChange, pages.length]);

    // Reset the drag/animating shared values only after React has committed the
    // new activeIndex. Resetting them eagerly (inside commitAdvance) let the still
    // stale-content top card snap back to center before its text updated —
    // the visible flash/hitch on settle.
    useLayoutEffect(() => {
      dragX.value = 0;
      isAnimating.value = false;
    }, [activeIndex, dragX, isAnimating]);

    const runExit = useCallback(
      (velocityX = 0) => {
        'worklet';
        isAnimating.value = true;
        const transferred = transferVelocity(
          velocityX,
          introDeckMotion.exitVelocityTransfer,
          introDeckMotion.exitVelocityMax
        );
        // Exit always travels left (-exitDistance); a transferred velocity that
        // points right would fight the spring's own direction, so it's clamped
        // to <= 0 rather than trusting the raw gesture sign.
        const exitVelocity = Math.min(transferred, 0);
        dragX.value = withSpring(
          -exitDistance,
          { ...introDeckMotion.exitSpring, velocity: exitVelocity },
          (finished) => {
            if (finished) runOnJS(commitAdvance)();
          }
        );
      },
      [commitAdvance, dragX, exitDistance, isAnimating]
    );

    const springBack = useCallback(
      (velocityX = 0) => {
        'worklet';
        const transferred = transferVelocity(
          velocityX,
          introDeckMotion.springBackVelocityTransfer,
          introDeckMotion.springBackVelocityMax
        );
        dragX.value = withSpring(0, { ...introDeckMotion.springBack, velocity: transferred });
      },
      [dragX]
    );

    useImperativeHandle(
      ref,
      () => ({
        advance: () => {
          if (isAnimating.value || !canAdvance) return;
          runExit();
        },
        seek: (index: number) => {
          const clamped = Math.max(0, Math.min(index, pages.length - 1));
          isAnimating.value = false;
          dragX.value = 0;
          setActiveIndex(clamped);
        },
      }),
      [canAdvance, dragX, isAnimating, pages.length, runExit]
    );

    const pan = Gesture.Pan()
      .enabled(canAdvance)
      .activeOffsetX([-10, 10])
      .failOffsetY([-20, 20])
      .onUpdate((event) => {
        if (isAnimating.value) return;
        dragX.value =
          event.translationX < 0
            ? event.translationX
            : rubberBand(event.translationX, introDeckMotion.rubberBandMax);
      })
      .onEnd((event) => {
        if (isAnimating.value) return;
        const passedDistance = event.translationX <= -swipeThreshold;
        const passedVelocity = event.velocityX <= -introDeckMotion.velocityThreshold;
        // Called directly (no runOnJS): both are worklets, so the settle/exit
        // spring starts on the UI thread in the same frame as release, carrying
        // the release velocity through instead of pausing for a JS thread hop.
        if (passedDistance || passedVelocity) {
          runExit(event.velocityX);
        } else {
          springBack(event.velocityX);
        }
      });

    const topStyle = useAnimatedStyle(() => {
      const rotate = reduceMotion
        ? 0
        : interpolate(
            dragX.value,
            [-exitDistance, exitDistance],
            [-introDeckMotion.rotationMaxDeg, introDeckMotion.rotationMaxDeg],
            Extrapolation.CLAMP
          );
      return {
        transform: [{ translateX: dragX.value }, { rotate: `${rotate}deg` }],
      };
    });

    const nextStyle = useAnimatedStyle(() => {
      const progress = dragX.value >= 0 ? 0 : Math.min(-dragX.value / exitDistance, 1);
      return {
        transform: [
          {
            translateX: interpolate(progress, [0, 1], [nextCardRestX, 0], Extrapolation.CLAMP),
          },
          {
            scale: interpolate(
              progress,
              [0, 1],
              [introDeckMotion.nextCardRestScale, 1],
              Extrapolation.CLAMP
            ),
          },
        ],
      };
    });

    const currentPage = pages[activeIndex];
    const nextPage = canAdvance ? pages[activeIndex + 1] : undefined;
    const cardBox = { left: SIDE_INSET, width: cardWidth };

    return (
      <View onLayout={handleStageLayout} style={styles.stage}>
        {nextPage ? (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[styles.cardSlot, cardBox, nextStyle]}>
            <CardContent index={activeIndex + 1} page={nextPage} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityLabel={`${currentPage.title}. ${currentPage.body}`}
            accessible
            style={[styles.cardSlot, cardBox, topStyle]}>
            <CardContent index={activeIndex} page={currentPage} />
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }
);

function CardContent({ index, page }: { index: number; page: IntroCardPage }) {
  return (
    <NoxaCard style={styles.card}>
      <View style={styles.iconFrame}>
        <Text style={styles.step}>0{index + 1}</Text>
        <Ionicons color={colors.text} name={page.icon} size={36} />
      </View>
      <Text maxFontSizeMultiplier={1.5} style={styles.title}>
        {page.title}
      </Text>
      <Text maxFontSizeMultiplier={1.6} style={styles.body}>
        {page.body}
      </Text>
    </NoxaCard>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  card: {
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconFrame: {
    width: 88,
    height: 88,
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primarySubtle,
    backgroundColor: colors.surfaceRaised,
  },
  step: {
    color: colors.textSubtle,
    fontFamily: typography.fontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: typography.letterSpacing.label,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.h1,
    fontWeight: '900',
    lineHeight: typography.lineHeight.h1,
    letterSpacing: typography.letterSpacing.tight,
  },
  body: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
});
