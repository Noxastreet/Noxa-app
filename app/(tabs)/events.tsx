import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CanonicalEventsScreen from '@/src/features/crews-events/CanonicalEventsScreen';
import { colors, radius, shadows, spacing } from '@/src/theme';

export default function EventsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <CanonicalEventsScreen />
      <Pressable
        accessibilityLabel="Open event history"
        accessibilityRole="button"
        onPress={() => router.push('/event-history')}
        style={({ pressed }) => [
          styles.historyButton,
          { bottom: insets.bottom + 78 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="time-outline" size={16} color={colors.text} />
        <Text style={styles.historyText}>HISTORY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  historyButton: {
    position: 'absolute',
    right: spacing.md,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
  historyText: {
    color: colors.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
