import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

const sideSize = Platform.OS === 'android' ? 48 : 44;

type NoxaTopBarProps = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  centered?: boolean;
};

export function NoxaTopBar({ centered = false, left, right, subtitle, title }: NoxaTopBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{left}</View>
      <View style={[styles.copy, centered && styles.copyCentered]}>
        {title ? (
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: Math.max(58, sideSize),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  side: { width: sideSize, minHeight: sideSize, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  copy: { flex: 1, minWidth: 0 },
  copyCentered: { alignItems: 'center' },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    letterSpacing: typography.letterSpacing.title,
    lineHeight: typography.lineHeight.title,
  },
  subtitle: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 17,
  },
});