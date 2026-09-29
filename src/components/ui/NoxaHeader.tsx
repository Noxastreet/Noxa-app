import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

type NoxaHeaderProps = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function NoxaHeader({ title, subtitle, left, right }: NoxaHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  side: {
    minWidth: 44,
  },
  right: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.section.fontSize,
    lineHeight: typography.v2.section.lineHeight,
    letterSpacing: typography.v2.section.letterSpacing,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 17,
  },
});
