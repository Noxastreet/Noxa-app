import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoxaSurface } from '@/src/components/ui';
import { animations, colors, geometry, spacing } from '@/src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'map', inactive: 'map-outline' },
  crews: { active: 'people', inactive: 'people-outline' },
  events: { active: 'calendar', inactive: 'calendar-outline' },
  garage: { active: 'car-sport', inactive: 'car-sport-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

type MotionTabItemProps = {
  focused: boolean;
  icons: { active: IconName; inactive: IconName };
  label: string;
  onLongPress: () => void;
  onPress: () => void;
};

function MotionTabItem({
  focused,
  icons,
  label,
  onLongPress,
  onPress,
}: MotionTabItemProps) {
  const reduceMotion = useReducedMotion();
  const focus = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(focus);
    cancelAnimation(press);
    press.value = 0;
    focus.value = reduceMotion
      ? focused ? 1 : 0
      : withSpring(focused ? 1 : 0, animations.spring.tab);
    return () => {
      cancelAnimation(focus);
      cancelAnimation(press);
    };
  }, [focus, focused, press, reduceMotion]);

  const iconMotion = useAnimatedStyle(() => {
    const focusScale = interpolate(focus.value, [0, 1], [1, 1.08]);
    const pressScale = interpolate(press.value, [0, 1], [1, animations.iconPressedScale]);
    return {
      opacity: interpolate(focus.value, [0, 1], [0.68, 1]),
      transform: [
        { translateY: reduceMotion ? 0 : interpolate(focus.value, [0, 1], [0, -1.5]) },
        { scale: reduceMotion ? 1 : focusScale * pressScale },
      ],
    };
  });

  const indicatorMotion = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scaleX: reduceMotion ? 1 : Math.max(0.001, focus.value) }],
  }));

  const handlePressIn = () => {
    press.value = reduceMotion
      ? 1
      : withSpring(1, animations.spring.press);
  };

  const handlePressOut = () => {
    press.value = reduceMotion
      ? 0
      : withSpring(0, animations.spring.press);
  };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.item}>
      <Animated.View style={iconMotion}>
        <Ionicons
          color={focused ? colors.text : colors.textMuted}
          name={focused ? icons.active : icons.inactive}
          size={23}
        />
      </Animated.View>
      <Animated.View style={[styles.indicator, indicatorMotion]} />
    </Pressable>
  );
}

export function NoxaBottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const activeRoute = state.routes[state.index];
  const activeOptions = activeRoute ? descriptors[activeRoute.key]?.options : undefined;
  const activeTabBarStyle = StyleSheet.flatten(
    activeOptions?.tabBarStyle as StyleProp<ViewStyle>,
  );

  if (activeTabBarStyle?.display === 'none' || (activeOptions?.tabBarHideOnKeyboard && keyboardVisible)) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.positioner,
        {
          bottom: insets.bottom + spacing.xs,
        },
      ]}>
      <NoxaSurface
        cut={geometry.cut.lg}
        level="overlay"
        style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const icons = TAB_ICONS[route.name] ?? {
            active: 'ellipse',
            inactive: 'ellipse-outline',
          };
          const label =
            options.tabBarAccessibilityLabel ??
            (typeof options.title === 'string' ? options.title : route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              if (Platform.OS === 'ios') {
                void Haptics.selectionAsync().catch(() => undefined);
              }
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <MotionTabItem
              focused={focused}
              icons={icons}
              key={route.key}
              label={label}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              onPress={onPress}
            />
          );
        })}
      </NoxaSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    height: 58,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  indicator: {
    width: 18,
    height: 2,
    backgroundColor: colors.primary,
  },
});
