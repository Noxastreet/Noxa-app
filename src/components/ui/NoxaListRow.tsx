import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { NoxaCutBackground } from './NoxaSurface';
import { animations, colors, geometry, spacing, typography } from '@/src/theme';

type NoxaListRowProps = {
  caption?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isLast?: boolean;
  label: string;
  onPress?: () => void;
  value?: string;
};

export function NoxaListRow({
  caption,
  destructive = false,
  disabled = false,
  icon,
  isLast = false,
  label,
  onPress,
  value,
}: NoxaListRowProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled: disabled || !onPress }}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.divider,
        pressed && onPress && (reduceMotion ? styles.pressedReduced : styles.pressed),
        disabled && styles.disabled,
      ]}>
      <View style={styles.icon}>
        <NoxaCutBackground
          borderColor={destructive ? colors.borderAccent : colors.border}
          cut={geometry.cut.sm}
          fill={destructive ? colors.primarySubtle : colors.surfaceSoft}
        />
        <Ionicons name={icon} size={20} color={destructive ? colors.primaryHover : colors.text} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, destructive && styles.labelDestructive]}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  icon: {
    position: 'relative',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  label: {
    color: colors.text,
    fontSize: typography.v2.row.fontSize,
    lineHeight: typography.v2.row.lineHeight,
    fontWeight: '800',
  },
  labelDestructive: { color: colors.primaryHover },
  caption: { marginTop: 2, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  value: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.8, transform: [{ scale: animations.pressedScale }] },
  pressedReduced: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
