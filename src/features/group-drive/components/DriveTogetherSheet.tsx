import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

export type DriveTogetherSheetSnap = 'collapsed' | 'medium' | 'expanded';

type Props = {
  bottomOffset: number;
  topOffset: number;
  snap: DriveTogetherSheetSnap;
  onSnapChange: (snap: DriveTogetherSheetSnap) => void;
  children: React.ReactNode;
};

const COLLAPSED_HEIGHT = 116;

export function DriveTogetherSheet({
  bottomOffset,
  topOffset,
  snap,
  onSnapChange,
  children,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const heights = useMemo(() => {
    const available = Math.max(
      COLLAPSED_HEIGHT + 180,
      windowHeight - topOffset - bottomOffset - spacing.sm,
    );
    const expanded = Math.min(620, available);
    const medium = Math.min(
      308,
      Math.max(238, expanded - 220),
    );
    return {
      collapsed: COLLAPSED_HEIGHT,
      medium,
      expanded,
    } satisfies Record<DriveTogetherSheetSnap, number>;
  }, [bottomOffset, topOffset, windowHeight]);

  const translateForSnap = useCallbackLike((target: DriveTogetherSheetSnap) =>
    heights.expanded - heights[target],
  );

  const translateY = useRef(
    new Animated.Value(translateForSnap(snap)),
  ).current;
  const startTranslateRef = useRef(translateForSnap(snap));

  useEffect(() => {
    const next = translateForSnap(snap);
    startTranslateRef.current = next;
    Animated.spring(translateY, {
      toValue: next,
      damping: 26,
      stiffness: 280,
      mass: 0.86,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [snap, translateForSnap, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          startTranslateRef.current = translateForSnap(snap);
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(
            0,
            Math.min(
              translateForSnap('collapsed'),
              startTranslateRef.current + gesture.dy,
            ),
          );
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const projected = Math.max(
            0,
            Math.min(
              translateForSnap('collapsed'),
              startTranslateRef.current + gesture.dy + gesture.vy * 72,
            ),
          );
          const candidates: DriveTogetherSheetSnap[] = [
            'expanded',
            'medium',
            'collapsed',
          ];
          const closest = candidates.reduce((best, candidate) => {
            const bestDistance = Math.abs(projected - translateForSnap(best));
            const candidateDistance = Math.abs(
              projected - translateForSnap(candidate),
            );
            return candidateDistance < bestDistance ? candidate : best;
          }, 'medium' as DriveTogetherSheetSnap);
          onSnapChange(closest);
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: translateForSnap(snap),
            damping: 26,
            stiffness: 280,
            mass: 0.86,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onSnapChange, snap, translateForSnap, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          bottom: bottomOffset,
          height: heights.expanded,
          transform: [{ translateY }],
        },
      ]}>
      <View
        accessibilityLabel="Drive Together panel"
        accessibilityRole="adjustable"
        style={styles.handleArea}
        {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

function useCallbackLike<T extends (...args: any[]) => any>(callback: T): T {
  return callback;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 55,
    overflow: 'hidden',
    borderRadius: radius.xl ?? radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(8,8,12,0.985)',
    ...shadows.card,
  },
  handleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
