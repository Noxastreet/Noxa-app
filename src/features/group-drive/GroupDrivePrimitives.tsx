import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NoxaIconButton, NoxaTopBar } from '@/src/components/ui';
import { colors, radius, spacing, typography } from '@/src/theme';

import { driveStatusLabel } from './format';
import type { DriveSessionStatus } from './types';

export function GroupDriveHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <NoxaTopBar
      title={title}
      subtitle={subtitle}
      left={
        <NoxaIconButton
          accessibilityLabel="Go back"
          icon="chevron-back"
          onPress={onBack ?? (() => router.back())}
          variant="ghost"
        />
      }
      right={right}
    />
  );
}

export function GroupDriveStep({ current, label }: { current: number; label: string }) {
  return (
    <View accessibilityLabel={`Step ${current} of 5, ${label}`} style={styles.step}>
      <Text style={styles.stepIndex}>0{current} / 05</Text>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

export function DriveStatus({ status }: { status: DriveSessionStatus }) {
  return (
    <View style={[styles.status, status === 'active' && styles.statusActive]}>
      <View style={[styles.statusDot, status === 'active' && styles.statusDotActive]} />
      <Text style={styles.statusText}>{driveStatusLabel(status)}</Text>
    </View>
  );
}

export function GroupDriveFact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepIndex: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.label,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  status: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  statusActive: { borderColor: colors.borderAccent, backgroundColor: colors.primaryMuted },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  statusDotActive: { backgroundColor: colors.primaryHover },
  statusText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  fact: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  factValue: { marginTop: 3, color: colors.text, fontSize: 15, fontWeight: '700' },
});
