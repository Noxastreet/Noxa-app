import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { NoxaCutBackground } from './NoxaSurface';
import { colors, geometry, spacing, typography } from '@/src/theme';

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
      <View style={styles.shell}>
        <NoxaCutBackground
          borderColor={error ? colors.borderAccent : focused ? colors.borderStrong : colors.border}
          cut={geometry.cut.sm}
          fill={focused ? colors.surfaceRaised : colors.surfaceSoft}
        />
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
          accessibilityHint={[props.accessibilityHint, error ?? hint].filter(Boolean).join('. ') || undefined}
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
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    color: colors.textQuiet,
    fontSize: typography.v2.label.fontSize,
    lineHeight: typography.v2.label.lineHeight,
    letterSpacing: typography.v2.label.letterSpacing,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  shell: {
    position: 'relative',
    minHeight: geometry.controlHeight.primary,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minHeight: geometry.controlHeight.primary,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
  error: { color: colors.textCritical, fontSize: typography.caption, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: typography.caption },
});
