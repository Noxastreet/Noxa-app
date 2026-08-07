import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

type VehiclePickerStageProps = {
  children: ReactNode;
  eyebrow: string;
  onBack?: () => void;
  subtitle: string;
  title: string;
};

export function VehiclePickerStage({
  children,
  eyebrow,
  onBack,
  subtitle,
  title,
}: VehiclePickerStageProps) {
  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : <View style={styles.backSpacer} />}
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: {
    width: 42,
  },
  pressed: {
    opacity: 0.72,
  },
  heading: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: colors.primaryHover,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
});
