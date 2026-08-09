import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { flagEmojiForCountryCode, getCountryByCode } from '@/src/data/countryCatalog';
import { colors, radius, spacing, typography } from '@/src/theme';

import { CountryPicker } from './CountryPicker';

type CountryFieldProps = {
  disabled?: boolean;
  label?: string;
  onChange: (code: string | null) => void;
  value: string | null;
};

export function CountryField({ disabled = false, label = 'Country · optional', onChange, value }: CountryFieldProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const country = getCountryByCode(value);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityLabel={country ? `Country, ${country.name}` : 'Choose your country'}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsPickerOpen(true)}
        style={({ pressed }) => [styles.shell, pressed && !disabled && styles.shellPressed]}>
        {country ? (
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.flag}>
            {flagEmojiForCountryCode(country.code)}
          </Text>
        ) : (
          <Ionicons color={colors.textSubtle} name="earth-outline" size={20} style={styles.placeholderIcon} />
        )}
        <Text numberOfLines={1} style={[styles.value, !country && styles.valuePlaceholder]}>
          {country ? country.name : 'Add your country'}
        </Text>
        {country ? (
          <Pressable
            accessibilityLabel="Clear country"
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={8}
            onPress={() => onChange(null)}
            style={styles.clearButton}>
            <Ionicons color={colors.textSubtle} name="close-circle" size={18} />
          </Pressable>
        ) : (
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
        )}
      </Pressable>

      <CountryPicker
        onClose={() => setIsPickerOpen(false)}
        onSelect={(code) => onChange(code)}
        selectedCode={value}
        visible={isPickerOpen}
      />
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
  flag: { fontSize: 20, width: 24, textAlign: 'center' },
  placeholderIcon: { width: 24, textAlign: 'center' },
  value: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '700' },
  valuePlaceholder: { color: colors.textMuted, fontWeight: '600' },
  clearButton: { padding: spacing.xxs },
});
