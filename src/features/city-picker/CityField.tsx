import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

import { CityPicker } from './CityPicker';

type CityFieldProps = {
  countryCode: string | null;
  disabled?: boolean;
  label?: string;
  onChange: (city: string) => void;
  value: string;
};

export function CityField({ countryCode, disabled = false, label = 'City · optional', onChange, value }: CityFieldProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const hasCountry = Boolean(countryCode);
  const trimmedValue = value.trim();
  const isInteractive = !disabled && hasCountry;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityHint={hasCountry ? undefined : 'Choose a country first'}
        accessibilityLabel={trimmedValue ? `City, ${trimmedValue}` : 'Choose your city'}
        accessibilityRole="button"
        disabled={!isInteractive}
        onPress={() => setIsPickerOpen(true)}
        style={({ pressed }) => [
          styles.shell,
          pressed && isInteractive && styles.shellPressed,
          !isInteractive && styles.shellDisabled,
        ]}>
        <Ionicons color={colors.textSubtle} name="location-outline" size={20} style={styles.placeholderIcon} />
        <Text numberOfLines={1} style={[styles.value, !trimmedValue && styles.valuePlaceholder]}>
          {trimmedValue || (hasCountry ? 'Add your city' : 'Choose a country first')}
        </Text>
        {trimmedValue ? (
          <Pressable
            accessibilityLabel="Clear city"
            accessibilityRole="button"
            disabled={!isInteractive}
            hitSlop={8}
            onPress={() => onChange('')}
            style={styles.clearButton}>
            <Ionicons color={colors.textSubtle} name="close-circle" size={18} />
          </Pressable>
        ) : isInteractive ? (
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
        ) : null}
      </Pressable>

      {countryCode ? (
        <CityPicker
          countryCode={countryCode}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(city) => onChange(city)}
          selectedCity={trimmedValue || null}
          visible={isPickerOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shellPressed: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
  shellDisabled: { opacity: 0.5 },
  placeholderIcon: { width: 24, textAlign: 'center' },
  value: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '700' },
  valuePlaceholder: { color: colors.textMuted, fontWeight: '600' },
  clearButton: { padding: spacing.xxs },
});
