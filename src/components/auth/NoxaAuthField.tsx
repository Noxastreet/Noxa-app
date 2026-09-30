import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { NoxaInput } from '@/src/components/ui';
import { colors } from '@/src/theme';

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
  return (
    <NoxaInput
      {...props}
      error={error}
      label={label}
      onBlur={(event) => {
        onBlur?.(event);
      }}
      onFocus={(event) => {
        onFocus?.(event);
      }}
      placeholderTextColor={colors.textQuiet}
      style={style}
      trailing={
        onTogglePassword ? (
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
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  passwordButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordButtonPressed: {
    opacity: 0.7,
  },
});
