import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

type NoxaInputProps = TextInputProps & {
  error?: string;
  hint?: string;
  label?: string;
  trailing?: ReactNode;
};

export function NoxaInput({
  error,
  hint,
  label,
  onBlur,
  onFocus,
  placeholderTextColor = colors.textMuted,
  style,
  trailing,
  ...props
}: NoxaInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.shell, focused && styles.shellFocused, error && styles.shellError]}>
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={placeholderTextColor}
          selectionColor={colors.primary}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  shell: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shellFocused: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
  shellError: { borderColor: colors.borderAccent },
  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
  error: { color: colors.primaryHover, fontSize: typography.caption, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: typography.caption },
});
