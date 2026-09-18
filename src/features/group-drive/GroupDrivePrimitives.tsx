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
      <Text style={styles.stepIndex}>{current} of 5</Text>
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
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  status: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
  },
  statusActive: {},
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  statusDotActive: { backgroundColor: colors.primaryHover },
  statusText: { color: colors.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  fact: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  factValue: { marginTop: 2, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
