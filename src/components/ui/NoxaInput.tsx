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
    ...typography.roles.secondary,
    fontFamily: typography.fontFamily.body,
    color: colors.textMuted,
    fontWeight: '500',
  },
  shell: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.input,
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
    fontFamily: typography.fontFamily.body,
  },
  error: { ...typography.roles.secondary, color: colors.text, fontWeight: '500' },
  hint: { ...typography.roles.secondary, color: colors.textMuted },
});
