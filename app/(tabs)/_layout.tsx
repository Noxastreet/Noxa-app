import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, emphasized = false }: { name: IconName; color: string; emphasized?: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={emphasized ? 24 : 22} color={color} />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 64 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="crews"
        options={{
          title: 'Crews',
          tabBarLabel: ({ focused }) => <TabLabel label="Crews" focused={focused} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarLabel: ({ focused }) => <TabLabel label="Events" focused={focused} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarLabel: ({ focused }) => <TabLabel label="Map" focused={focused} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'map' : 'map-outline'} color={color} emphasized />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'Garage',
          tabBarLabel: ({ focused }) => <TabLabel label="Garage" focused={focused} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'car-sport' : 'car-sport-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    backgroundColor: colors.glass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    elevation: 0,
  },
  tabItem: {
    paddingVertical: 0,
  },
  label: {
    marginTop: 2,
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  iconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
