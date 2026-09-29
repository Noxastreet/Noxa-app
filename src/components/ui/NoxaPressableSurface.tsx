import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
  onPressIn,
  onPressOut,
  ...pressableProps
}: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    onPressIn?.(event);
    opacity.value = withTiming(
      reduceMotion ? 0.78 : animations.pressOpacity,
      { duration: animations.press },
    );
    scale.value = reduceMotion
      ? 1
      : withSpring(animations.pressedScale, animations.spring.press);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    onPressOut?.(event);
    opacity.value = withTiming(1, { duration: animations.press });
    scale.value = reduceMotion
      ? 1
      : withSpring(1, animations.spring.press);
  };

  return (
    <Pressable
      {...pressableProps}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}>
      <Animated.View style={animatedStyle}>
        <NoxaSurface
          corners={corners}
          cut={cut}
          level={level}
          maskChildren={maskChildren}
          outsideFill={outsideFill}
          style={contentStyle}>
          {children}
        </NoxaSurface>
      </Animated.View>
    </Pressable>
  );
}
