import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

type PickerCardFrameProps = {
  accessibilityLabel: string;
  children: ReactNode;
  compact?: boolean;
  motionKey: string;
  onPress: () => void;
  selected?: boolean;
};

/**
 * Private visual primitive only.
 * Semantic vehicle picker cards stay separate so each can own future motion.
 */
export function PickerCardFrame({
  accessibilityLabel,
  children,
  compact = false,
  motionKey,
  onPress,
  selected = false,
}: PickerCardFrameProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      nativeID={motionKey}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.regular,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      <View pointerEvents="none" style={styles.content}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  regular: {
    minHeight: 92,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  compact: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selected: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySubtle,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  content: {
    flex: 1,
  },
});
