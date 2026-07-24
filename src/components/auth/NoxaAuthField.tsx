import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

type NoxaAuthFieldProps = ComponentProps<typeof TextInput> & {
  error?: string;
  label: string;
  onTogglePassword?: () => void;
  passwordVisible?: boolean;
};

export function NoxaAuthField({
  error,
  label,
  onBlur,
  onFocus,
  onTogglePassword,
  passwordVisible = false,
  style,
  ...props
}: NoxaAuthFieldProps) {
  useEffect(() => {
    console.log(`[AuthField:${label}] mounted`);

    return () => {
      console.log(`[AuthField:${label}] unmounted`);
    };
  }, [label]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputError]}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          onBlur={(event) => {
            console.log(`[AuthField:${label}] blur`);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            console.log(`[AuthField:${label}] focus`);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          style={[styles.input, onTogglePassword && styles.inputWithAction, style]}
        />
        {onTogglePassword ? (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={onTogglePassword}
            style={({ pressed }) => [styles.passwordButton, pressed && styles.passwordButtonPressed]}>
            <Ionicons
              color={passwordVisible ? colors.primaryHover : colors.textMuted}
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  inputShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.input,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.borderAccent,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  inputWithAction: {
    paddingRight: spacing.xs,
  },
  passwordButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordButtonPressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.primaryHover,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.lineHeight.caption,
  },
});
