import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type Country,
  countryCatalog,
  flagEmojiForCountryCode,
  matchesCountryQuery,
  popularCountryCodes,
} from '@/src/data/countryCatalog';
import { colors, radius, spacing, typography } from '@/src/theme';

type CountryPickerProps = {
  onClose: () => void;
  onSelect: (code: string) => void;
  selectedCode: string | null;
  visible: boolean;
};

const rowHeight = 60;

const popularCountries = popularCountryCodes
  .map((code) => countryCatalog.find((country) => country.code === code))
  .filter((country): country is Country => Boolean(country));

function CountryRow({
  country,
  isLast,
  onPress,
  selected,
}: {
  country: Country;
  isLast: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={selected ? `${country.name}, selected` : country.name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.rowPressed]}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.flag}>
        {flagEmojiForCountryCode(country.code)}
      </Text>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{country.name}</Text>
      </View>
      <Text style={styles.rowCode}>{country.code}</Text>
      {selected ? (
        <Ionicons color={colors.primaryHover} name="checkmark-circle" size={20} style={styles.rowCheck} />
      ) : null}
    </Pressable>
  );
}

type ListRow = { key: string; kind: 'label'; label: string } | { key: string; kind: 'country'; country: Country };

export function CountryPicker({ onClose, onSelect, selectedCode, visible }: CountryPickerProps) {
  const [query, setQuery] = useState('');

  const filteredCountries = useMemo(
    () => countryCatalog.filter((country) => matchesCountryQuery(country, query)),
    [query],
  );

  const hasQuery = query.trim().length > 0;

  const rows = useMemo<ListRow[]>(() => {
    if (hasQuery) {
      return [
        { key: 'label:results', kind: 'label', label: 'SEARCH RESULTS' },
        ...filteredCountries.map((country) => ({ key: country.code, kind: 'country' as const, country })),
      ];
    }

    return [
      { key: 'label:popular', kind: 'label', label: 'POPULAR' },
      ...popularCountries.map((country) => ({ key: `popular:${country.code}`, kind: 'country' as const, country })),
      { key: 'label:all', kind: 'label', label: 'ALL COUNTRIES' },
      ...filteredCountries.map((country) => ({ key: `all:${country.code}`, kind: 'country' as const, country })),
    ];
  }, [filteredCountries, hasQuery]);

  const selectCountry = (code: string) => {
    onSelect(code);
    setQuery('');
    onClose();
  };

  const closePicker = () => {
    setQuery('');
    onClose();
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<ListRow>) => {
    if (item.kind === 'label') {
      return <Text style={styles.sectionLabel}>{item.label}</Text>;
    }

    const nextItem = rows[index + 1];
    const isLast = !nextItem || nextItem.kind === 'label';

    return (
      <CountryRow
        country={item.country}
        isLast={isLast}
        onPress={() => selectCountry(item.country.code)}
        selected={item.country.code === selectedCode}
      />
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={closePicker} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} visible={visible}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Close country picker"
            accessibilityRole="button"
            hitSlop={8}
            onPress={closePicker}
            style={({ pressed }) => [styles.closeButton, pressed && styles.rowPressed]}>
            <Ionicons color={colors.text} name="close" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Country</Text>
            <Text style={styles.subtitle}>Search or pick from popular countries.</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons color={colors.textMuted} name="search" size={18} />
          <TextInput
            accessibilityLabel="Search countries"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search country or code"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setQuery('')}>
              <Ionicons color={colors.textSubtle} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>

        {filteredCountries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No countries match “{query.trim()}”.</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={rows}
            initialNumToRender={20}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.key}
            maxToRenderPerBatch={24}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            windowSize={7}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  headerCopy: { flex: 1 },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  searchWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBase,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  row: {
    minHeight: rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowPressed: { backgroundColor: colors.surfacePressed },
  flag: { fontSize: 24, width: 32, textAlign: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowCode: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  rowCheck: { marginLeft: spacing.xs },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
});
