import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function NoxaRootHeader({ title, subtitle, actions }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.hero.fontSize,
    lineHeight: typography.v2.hero.lineHeight,
    letterSpacing: typography.v2.hero.letterSpacing,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: spacing.xxs,
    maxWidth: 300,
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
    fontWeight: '700',
  },
  actions: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
