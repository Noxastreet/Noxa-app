import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

type NoxaSectionTitleProps = {
  label?: string;
  title: string;
};

export function NoxaSectionTitle({ label, title }: NoxaSectionTitleProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  label: {
    color: colors.textAccent,
    fontSize: typography.v2.label.fontSize,
    lineHeight: typography.v2.label.lineHeight,
    letterSpacing: typography.v2.label.letterSpacing,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.v2.section.fontSize,
    lineHeight: typography.v2.section.lineHeight,
    letterSpacing: typography.v2.section.letterSpacing,
    fontWeight: '900',
  },
});
