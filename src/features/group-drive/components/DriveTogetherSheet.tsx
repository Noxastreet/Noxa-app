import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

import { colors, radius, shadows, spacing } from '@/src/theme';

export type DriveTogetherSheetSnap = 'collapsed' | 'medium' | 'expanded';

type Props = {
  bottomOffset: number;
  snap: DriveTogetherSheetSnap;
  onSnapChange: (snap: DriveTogetherSheetSnap) => void;
  children: React.ReactNode;
};

const windowHeight = Dimensions.get('window').height;
const EXPANDED_HEIGHT = Math.min(620, Math.max(500, windowHeight * 0.68));
const MEDIUM_HEIGHT = Math.min(340, EXPANDED_HEIGHT - 120);
const COLLAPSED_HEIGHT = 132;

function heightForSnap(snap: DriveTogetherSheetSnap) {
  if (snap === 'expanded') return EXPANDED_HEIGHT;
  if (snap === 'medium') return MEDIUM_HEIGHT;
  return COLLAPSED_HEIGHT;
}

function translateForSnap(snap: DriveTogetherSheetSnap) {
  return EXPANDED_HEIGHT - heightForSnap(snap);
}

function closestSnap(translateY: number): DriveTogetherSheetSnap {
  const snaps: DriveTogetherSheetSnap[] = ['expanded', 'medium', 'collapsed'];
  return snaps.reduce((best, candidate) => {
    const bestDistance = Math.abs(translateY - translateForSnap(best));
    const nextDistance = Math.abs(translateY - translateForSnap(candidate));
    return nextDistance < bestDistance ? candidate : best;
  }, 'medium' as DriveTogetherSheetSnap);
}

export function DriveTogetherSheet({
  bottomOffset,
  snap,
  onSnapChange,
  children,
}: Props) {
  const translateY = useRef(new Animated.Value(translateForSnap(snap))).current;
  const startTranslateRef = useRef(translateForSnap(snap));

  useEffect(() => {
    startTranslateRef.current = translateForSnap(snap);
    Animated.spring(translateY, {
      toValue: startTranslateRef.current,
      damping: 24,
      stiffness: 260,
      mass: 0.9,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [snap, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
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
              startTranslateRef.current + gesture.dy + gesture.vy * 80,
            ),
          );
          onSnapChange(closestSnap(projected));
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: translateForSnap(snap),
            damping: 24,
            stiffness: 260,
            mass: 0.9,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onSnapChange, snap, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          bottom: bottomOffset,
          height: EXPANDED_HEIGHT,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        accessibilityLabel="Drive Together panel"
        accessibilityRole="adjustable"
        style={styles.handleArea}
        {...panResponder.panHandlers}
      >
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
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
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(10,10,14,0.975)',
    ...shadows.card,
  },
  handleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
