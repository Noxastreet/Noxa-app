import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

type NoxaLoadingStateProps = {
  compact?: boolean;
  label?: string;
};

export function NoxaLoadingState({ compact = false, label = 'Loading…' }: NoxaLoadingStateProps) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={[styles.state, compact && styles.compact]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  compact: { minHeight: 96 },
  label: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.caption,
    fontWeight: '600',
  },
});
