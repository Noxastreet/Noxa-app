import { type ReactNode, useMemo } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, radius, shadows } from "@/src/theme";

type Props = {
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  onHeightChange?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;
const SHEET_LAYOUT = LinearTransition.springify()
  .damping(24)
  .stiffness(240);

export function MapContextSheet({
  children,
  dismissible = true,
  onDismiss,
  onHeightChange,
  style,
}: Props) {
  const translateY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(onDismiss) && dismissible)
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.translationY > DISMISS_DISTANCE ||
            event.velocityY > DISMISS_VELOCITY;

          if (shouldDismiss && onDismiss) {
            translateY.value = withTiming(260, { duration: 150 }, (finished) => {
              if (finished) runOnJS(onDismiss)();
            });
            return;
          }

          translateY.value = withSpring(0, {
            damping: 24,
            mass: 0.8,
            stiffness: 260,
          });
        }),
    [dismissible, onDismiss, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    onHeightChange?.(event.nativeEvent.layout.height);
  };

  return (
    <Animated.View
      accessibilityViewIsModal={false}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(150)}
      layout={SHEET_LAYOUT}
      onLayout={handleLayout}
      style={[styles.sheet, animatedStyle, style]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityLabel={dismissible ? "Drag sheet down to go back" : undefined}
          accessible={dismissible}
          style={styles.handleTouch}
        >
          <View accessible={false} style={styles.handle} />
        </Animated.View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(10,12,16,0.97)",
    ...shadows.card,
  },
  handleTouch: {
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
});
