import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { NoxaSurface, type NoxaCutCorners, type NoxaSurfaceLevel } from './NoxaSurface';
import { animations, geometry } from '@/src/theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  corners?: NoxaCutCorners;
  cut?: number;
  level?: NoxaSurfaceLevel;
  maskChildren?: boolean;
  outsideFill?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function NoxaPressableSurface({
  children,
  corners = 'signature',
  cut = geometry.cut.md,
  level = 'content',
  maskChildren = false,
  outsideFill,
  style,
  contentStyle,
  ...pressableProps
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [
        style,
        pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
      ]}>
      <NoxaSurface
        corners={corners}
        cut={cut}
        level={level}
        maskChildren={maskChildren}
        outsideFill={outsideFill}
        style={contentStyle}>
        {children}
      </NoxaSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.86,
    transform: [{ scale: animations.pressedScale }],
  },
  pressedReduced: {
    opacity: 0.74,
  },
});
