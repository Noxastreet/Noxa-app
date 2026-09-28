import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';

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
        pressed && onPress && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View style={styles.icon}>
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  label: { ...typography.roles.body, fontFamily: typography.fontFamily.body, color: colors.text, fontWeight: '500' },
  labelDestructive: { color: colors.primaryHover },
  caption: { ...typography.roles.secondary, marginTop: spacing.xxs, color: colors.textMuted },
  value: { ...typography.roles.secondary, maxWidth: '40%', flexShrink: 1, textAlign: 'right', color: colors.textMuted },
  pressed: { backgroundColor: colors.surfacePressed },
  disabled: { opacity: 0.5 },
});
