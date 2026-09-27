import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';

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

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.positioner,
        {
          bottom: insets.bottom + 6,
        },
      ]}>
      <View style={styles.bar}>
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

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : {}}
              key={route.key}
              onLongPress={onLongPress}
              onPress={onPress}
              onPressIn={onPressIn}
              style={styles.item}>
              <View style={[styles.segment, focused && styles.segmentActive]}>
                <Ionicons
                  color={focused ? colors.white : colors.text}
                  name={focused ? icons.active : icons.inactive}
                  size={focused ? 24 : 23}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 52,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    backgroundColor: 'rgba(24,24,28,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 26,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 0,
  },
  item: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    width: '92%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
