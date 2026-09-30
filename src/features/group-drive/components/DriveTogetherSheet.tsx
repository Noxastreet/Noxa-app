import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { NoxaSurface } from '@/src/components/ui';
import { animations, colors, geometry, spacing } from '@/src/theme';

export type DriveTogetherSheetSnap = 'collapsed' | 'medium' | 'expanded';

type Props = {
  bottomOffset: number;
  bottomInset: number;
  topOffset: number;
  snap: DriveTogetherSheetSnap;
  onSnapChange: (snap: DriveTogetherSheetSnap) => void;
  children: React.ReactNode;
};

const COLLAPSED_HEIGHT = 108;
const MEDIUM_HEIGHT = 286;
const EXPANDED_MAX_HEIGHT = 480;

export function DriveTogetherSheet({
  bottomOffset,
  bottomInset,
  topOffset,
  snap,
  onSnapChange,
  children,
}: Props) {
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const heights = useMemo(() => {
    const available = Math.max(
      COLLAPSED_HEIGHT + 160,
      windowHeight - topOffset - bottomOffset,
    );
    const expanded = Math.min(EXPANDED_MAX_HEIGHT, available);
    const medium = Math.min(
      MEDIUM_HEIGHT,
      Math.max(COLLAPSED_HEIGHT + 110, expanded - 140),
    );

    return {
      collapsed: COLLAPSED_HEIGHT,
      medium,
      expanded,
    } satisfies Record<DriveTogetherSheetSnap, number>;
  }, [bottomOffset, topOffset, windowHeight]);

  const translateForSnap = useCallback(
    (target: DriveTogetherSheetSnap) => heights.expanded - heights[target],
    [heights],
  );

  const translateY = useRef(
    new Animated.Value(
      translateForSnap(reduceMotion ? snap : 'collapsed'),
    ),
  ).current;
  const startTranslateRef = useRef(
    translateForSnap(reduceMotion ? snap : 'collapsed'),
  );

  const settleTo = useCallback(
    (target: DriveTogetherSheetSnap) => {
      const next = translateForSnap(target);
      startTranslateRef.current = next;
      translateY.stopAnimation();

      if (reduceMotion) {
        translateY.setValue(next);
        return;
      }

      Animated.spring(translateY, {
        toValue: next,
        ...animations.spring.sheet,
        useNativeDriver: true,
      }).start();
    },
    [reduceMotion, translateForSnap, translateY],
  );

  useEffect(() => {
    settleTo(snap);
  }, [settleTo, snap]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          startTranslateRef.current = translateForSnap(snap);
          translateY.stopAnimation((value) => {
            startTranslateRef.current = value;
          });
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
              startTranslateRef.current + gesture.dy + gesture.vy * 64,
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
          settleTo(closest);
          if (closest !== snap) {
            if (Platform.OS === 'ios') {
              void Haptics.selectionAsync().catch(() => undefined);
            }
            onSnapChange(closest);
          }
        },
        onPanResponderTerminate: () => {
          settleTo(snap);
        },
      }),
    [onSnapChange, settleTo, snap, translateForSnap, translateY],
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
      <NoxaSurface corners="top" cut={geometry.cut.lg} level="sheet" style={styles.shell}>
      <View
        accessibilityLabel="Drive Together panel"
        accessibilityRole="adjustable"
        style={styles.handleArea}
        {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>
      <View
        style={[
          styles.content,
          { paddingBottom: Math.max(spacing.md, bottomInset + spacing.sm) },
        ]}>
        {children}
      </View>
      </NoxaSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 55,
    overflow: 'hidden',

  },
  shell: { flex: 1 },
  handleArea: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: geometry.sheet.handleWidth,
    height: geometry.sheet.handleHeight,
    borderRadius: 2,
    backgroundColor: colors.neutralStrong,
  },
  content: {
    flex: 1,
    paddingHorizontal: geometry.sheet.gutter,
  },
});
