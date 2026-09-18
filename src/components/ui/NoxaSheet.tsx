import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadows, spacing, typography } from '@/src/theme';

type NoxaSheetProps = {
  children: ReactNode;
  subtitle?: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function NoxaSheet({
  children,
  onLayout,
  style,
  subtitle,
  title,
}: NoxaSheetProps) {
  return (
    <View onLayout={onLayout} style={[styles.sheet, style]}>
      <View accessible={false} style={styles.handle} />
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceBase,
    ...shadows.control,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  header: { gap: spacing.xs },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '900',
  },
  subtitle: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
});
