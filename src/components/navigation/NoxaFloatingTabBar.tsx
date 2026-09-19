import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors } from '@/src/theme/colors';
import { radius } from '@/src/theme/radius';
import { spacing } from '@/src/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  crews: { active: 'people', inactive: 'people-outline' },
  events: { active: 'calendar', inactive: 'calendar-outline' },
  index: { active: 'map', inactive: 'map-outline' },
  garage: { active: 'car-sport', inactive: 'car-sport-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

export function NoxaFloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: state.index,
      useNativeDriver: true,
      stiffness: 280,
      damping: 24,
      mass: 0.8,
    }).start();
  }, [position, state.index]);

  const routeCount = state.routes.length;
  const slotWidth = barWidth > 0 && routeCount > 0 ? barWidth / routeCount : 0;
  const translateX = useMemo(() => {
    if (!slotWidth || routeCount < 2) return position;
    return position.interpolate({
      inputRange: state.routes.map((_, index) => index),
      outputRange: state.routes.map((_, index) => index * slotWidth),
    });
  }, [position, routeCount, slotWidth, state.routes]);

  const onLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingBottom: Math.max(insets.bottom, spacing.xs),
        },
      ]}>
      <View onLayout={onLayout} style={styles.bar}>
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeSlot,
              {
                width: slotWidth,
                transform: [{ translateX }],
              },
            ]}>
            <View style={styles.activePill} />
          </Animated.View>
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const iconSet = ICONS[route.name] ?? {
            active: 'ellipse',
            inactive: 'ellipse-outline',
          };
          const accessibilityLabel =
            options.tabBarAccessibilityLabel ??
            (typeof options.title === 'string' ? options.title : route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const onPressIn = () => {
            if (process.env.EXPO_OS === 'ios') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              hitSlop={4}
              onLongPress={onLongPress}
              onPress={onPress}
              onPressIn={onPressIn}
              style={styles.tab}
              testID={options.tabBarButtonTestID}>
              <Ionicons
                color={focused ? colors.text : colors.textMuted}
                name={focused ? iconSet.active : iconSet.inactive}
                size={focused ? 24 : 23}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
  },
  bar: {
    position: 'relative',
    height: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    shadowColor: colors.black,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  activeSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    width: 52,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  tab: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
