import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoxaSurface } from '@/src/components/ui';
import { colors, geometry, spacing } from '@/src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'map', inactive: 'map-outline' },
  crews: { active: 'people', inactive: 'people-outline' },
  events: { active: 'calendar', inactive: 'calendar-outline' },
  garage: { active: 'car-sport', inactive: 'car-sport-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

export function NoxaBottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];
  const activeOptions = activeRoute ? descriptors[activeRoute.key]?.options : undefined;
  const activeTabBarStyle = StyleSheet.flatten(
    activeOptions?.tabBarStyle as StyleProp<ViewStyle>,
  );

  if (activeTabBarStyle?.display === 'none') {
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
              navigation.navigate(route.name, route.params);
            }
          };

          const onPressIn = () => {
            if (Platform.OS === 'ios') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          };

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              key={route.key}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              onPress={onPress}
              onPressIn={onPressIn}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Ionicons
                color={focused ? colors.text : colors.textMuted}
                name={focused ? icons.active : icons.inactive}
                size={focused ? 24 : 22}
              />
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
            </Pressable>
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
    width: 16,
    height: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
