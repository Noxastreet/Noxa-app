import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { animations } from '@/src/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const DETAIL_REVEAL = FadeIn
  .duration(animations.micro)
  .reduceMotion(ReduceMotion.System);

export function NoxaDetailReveal({ children, style }: Props) {
  return (
    <Animated.View entering={DETAIL_REVEAL} style={style}>
      {children}
    </Animated.View>
  );
}
