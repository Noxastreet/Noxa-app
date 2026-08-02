import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
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
  useEffect(() => {
    console.log(`[AuthField:${label}] mounted`);

    return () => {
      console.log(`[AuthField:${label}] unmounted`);
    };
  }, [label]);

  return (
    <NoxaInput
      {...props}
      error={error}
      label={label}
      onBlur={(event) => {
        console.log(`[AuthField:${label}] blur`);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        console.log(`[AuthField:${label}] focus`);
        onFocus?.(event);
      }}
      placeholderTextColor={colors.textSubtle}
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
