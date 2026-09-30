import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { NoxaSurface } from './NoxaSurface';
import { colors, geometry, spacing, typography } from '@/src/theme';

type NoxaSheetProps = {
  children: ReactNode;
  subtitle?: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

export function NoxaSheet({ children, style, subtitle, title }: NoxaSheetProps) {
  return (
    <NoxaSurface
      corners="top"
      cut={geometry.cut.lg}
      level="sheet"
      style={[styles.sheet, style]}>
      <View accessible={false} style={styles.handle} />
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </NoxaSurface>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: geometry.sheet.gap,
    paddingHorizontal: geometry.sheet.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: geometry.sheet.handleWidth,
    height: geometry.sheet.handleHeight,
    alignSelf: 'center',
    backgroundColor: colors.neutralStrong,
  },
  header: { gap: spacing.xs },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.section.fontSize,
    lineHeight: typography.v2.section.lineHeight,
    letterSpacing: typography.v2.section.letterSpacing,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
