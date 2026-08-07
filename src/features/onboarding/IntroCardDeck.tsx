import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
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
  /** Animate the active card away using the same transition as a successful swipe. */
  advance: () => void;
  /** Snap directly to an index without a swipe animation (e.g. hardware back). */
  seek: (index: number) => void;
};

type IntroCardDeckProps = {
  pages: readonly IntroCardPage[];
  initialIndex?: number;
  onIndexChange: (index: number) => void;
};

const DEPTH_COUNT = 3;

export const IntroCardDeck = forwardRef<IntroCardDeckHandle, IntroCardDeckProps>(
  function IntroCardDeck({ pages, initialIndex = 0, onIndexChange }, ref) {
    const { width } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const isTransitioningRef = useRef(false);

    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);

    const exitDistance = width * introDeckMotion.exitDistanceFactor;
    const swipeThreshold = width * introDeckMotion.swipeThresholdFactor;

    const progress = useDerivedValue(() => Math.min(Math.abs(dragX.value) / exitDistance, 1));

    const canAdvance = activeIndex < pages.length - 1;

    const commitAdvance = useCallback(() => {
      dragX.value = 0;
      dragY.value = 0;
      isTransitioningRef.current = false;
      setActiveIndex((current) => {
        const next = Math.min(current + 1, pages.length - 1);
        onIndexChange(next);
        return next;
      });
    }, [dragX, dragY, onIndexChange, pages.length]);

    const springBack = useCallback(() => {
      dragX.value = withSpring(0, introDeckMotion.springBack);
      dragY.value = withSpring(0, introDeckMotion.springBack);
    }, [dragX, dragY]);

    const releaseCard = useCallback(
      (direction: number) => {
        isTransitioningRef.current = true;
        dragX.value = withTiming(
          direction * exitDistance,
          { duration: introDeckMotion.exitDurationMs, reduceMotion: ReduceMotion.System },
          (finished) => {
            if (finished) runOnJS(commitAdvance)();
          }
        );
        dragY.value = withTiming(0, {
          duration: introDeckMotion.exitDurationMs,
          reduceMotion: ReduceMotion.System,
        });
      },
      [commitAdvance, dragX, dragY, exitDistance]
    );

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_, gesture) =>
            canAdvance && !isTransitioningRef.current && Math.abs(gesture.dx) > 4,
          onPanResponderMove: (_, gesture) => {
            dragX.value = gesture.dx;
            dragY.value = gesture.dy * 0.35;
          },
          onPanResponderRelease: (_, gesture) => {
            const passedThreshold =
              Math.abs(gesture.dx) > swipeThreshold ||
              Math.abs(gesture.vx) > introDeckMotion.velocityThreshold;
            if (passedThreshold) {
              releaseCard(gesture.dx >= 0 ? 1 : -1);
            } else {
              springBack();
            }
          },
          onPanResponderTerminate: () => {
            springBack();
          },
        }),
      [canAdvance, dragX, dragY, releaseCard, springBack, swipeThreshold]
    );

    useImperativeHandle(
      ref,
      () => ({
        advance: () => {
          if (isTransitioningRef.current || !canAdvance) return;
          releaseCard(1);
        },
        seek: (index: number) => {
          const clamped = Math.max(0, Math.min(index, pages.length - 1));
          isTransitioningRef.current = false;
          dragX.value = 0;
          dragY.value = 0;
          setActiveIndex(clamped);
        },
      }),
      [canAdvance, dragX, dragY, pages.length, releaseCard]
    );

    const topStyle = useAnimatedStyle(() => {
      const rotation = reduceMotion
        ? 0
        : interpolate(
            dragX.value,
            [-exitDistance, exitDistance],
            [-introDeckMotion.rotationMaxDeg, introDeckMotion.rotationMaxDeg],
            Extrapolation.CLAMP
          );
      return {
        transform: [
          { translateX: dragX.value },
          { translateY: dragY.value },
          { rotate: `${rotation}deg` },
        ],
      };
    });

    const depth1Style = useAnimatedStyle(() => ({
      transform: [
        { scale: interpolate(progress.value, [0, 1], [introDeckMotion.depth1.scale, 1]) },
        { translateY: interpolate(progress.value, [0, 1], [introDeckMotion.depth1.translateY, 0]) },
      ],
    }));

    const depth2Style = useAnimatedStyle(() => ({
      opacity: interpolate(progress.value, [0, 1], [introDeckMotion.depth2.opacity, 1]),
      transform: [
        {
          scale: interpolate(
            progress.value,
            [0, 1],
            [introDeckMotion.depth2.scale, introDeckMotion.depth1.scale]
          ),
        },
        {
          translateY: interpolate(
            progress.value,
            [0, 1],
            [introDeckMotion.depth2.translateY, introDeckMotion.depth1.translateY]
          ),
        },
      ],
    }));

    const depthStyles = [topStyle, depth1Style, depth2Style];

    const slots = useMemo(
      () =>
        Array.from({ length: DEPTH_COUNT }, (_, depth) => ({ depth, index: activeIndex + depth }))
          .map((slot) => ({ ...slot, page: pages[slot.index] }))
          .filter((slot): slot is typeof slot & { page: IntroCardPage } => Boolean(slot.page))
          .reverse(),
      [activeIndex, pages]
    );

    return (
      <View style={styles.stage}>
        {slots.map(({ depth, index, page }) => (
          <Animated.View
            key={index}
            accessible={depth === 0}
            accessibilityElementsHidden={depth !== 0}
            accessibilityLabel={depth === 0 ? `${page.title}. ${page.body}` : undefined}
            importantForAccessibility={depth === 0 ? 'yes' : 'no-hide-descendants'}
            pointerEvents={depth === 0 ? 'auto' : 'none'}
            style={[styles.cardSlot, depthStyles[depth]]}
            {...(depth === 0 ? panResponder.panHandlers : null)}>
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
          </Animated.View>
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: spacing.xl,
    right: spacing.xl,
    justifyContent: 'center',
  },
  card: {
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
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
    maxWidth: 440,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
  },
});
