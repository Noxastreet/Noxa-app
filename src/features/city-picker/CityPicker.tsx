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
  type City,
  getCitiesForCountry,
  getPopularCitiesForCountry,
  isExactCityMatch,
  matchesCityQuery,
  normalizeCityDisplayName,
} from '@/src/data/cityCatalog';
import { getCountryByCode } from '@/src/data/countryCatalog';
import { colors, radius, spacing, typography } from '@/src/theme';

type CityPickerProps = {
  countryCode: string;
  onClose: () => void;
  onSelect: (city: string) => void;
  selectedCity: string | null;
  visible: boolean;
};

const rowHeight = 60;
const cityDisplayMaxLength = 60;

function cityKey(city: City) {
  return `${city.name}·${city.region ?? ''}`;
}

function CityRow({
  city,
  isLast,
  onPress,
  selected,
}: {
  city: City;
  isLast: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={selected ? `${city.name}, selected` : city.name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.rowPressed]}>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowLabel}>
          {city.name}
        </Text>
        {city.region ? (
          <Text numberOfLines={1} style={styles.rowRegion}>
            {city.region}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons color={colors.primaryHover} name="checkmark-circle" size={20} style={styles.rowCheck} />
      ) : null}
    </Pressable>
  );
}

function FallbackRow({ onPress, query }: { onPress: () => void; query: string }) {
  return (
    <Pressable
      accessibilityLabel={`Use "${query}" as my city`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fallbackRow, pressed && styles.rowPressed]}>
      <Ionicons color={colors.textSubtle} name="add-circle-outline" size={20} />
      <Text numberOfLines={1} style={styles.fallbackText}>
        Use “{query}” as my city
      </Text>
    </Pressable>
  );
}

type ListRow =
  | { key: string; kind: 'label'; label: string }
  | { key: string; kind: 'city'; city: City }
  | { key: string; kind: 'fallback'; query: string };

export function CityPicker({ countryCode, onClose, onSelect, selectedCity, visible }: CityPickerProps) {
  const [query, setQuery] = useState('');

  const country = getCountryByCode(countryCode);
  const allCities = useMemo(() => getCitiesForCountry(countryCode), [countryCode]);
  const popularCities = useMemo(() => getPopularCitiesForCountry(countryCode), [countryCode]);

  const hasQuery = query.trim().length > 0;

  const filteredCities = useMemo(
    () => (hasQuery ? allCities.filter((city) => matchesCityQuery(city, query)) : allCities),
    [allCities, hasQuery, query],
  );

  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(
    () => filteredCities.some((city) => isExactCityMatch(city, trimmedQuery)),
    [filteredCities, trimmedQuery],
  );
  const showFallback = hasQuery && trimmedQuery.length >= 2 && !hasExactMatch;

  const rows = useMemo<ListRow[]>(() => {
    if (hasQuery) {
      const results: ListRow[] = [
        { key: 'label:results', kind: 'label', label: 'SEARCH RESULTS' },
        ...filteredCities.map((city) => ({ key: `results:${cityKey(city)}`, kind: 'city' as const, city })),
      ];
      if (showFallback) results.push({ key: 'fallback', kind: 'fallback', query: trimmedQuery });
      return results;
    }

    const sections: ListRow[] = [];
    if (popularCities.length > 0) {
      sections.push({ key: 'label:popular', kind: 'label', label: 'POPULAR' });
      sections.push(
        ...popularCities.map((city) => ({ key: `popular:${cityKey(city)}`, kind: 'city' as const, city })),
      );
    }
    if (filteredCities.length > 0) {
      sections.push({ key: 'label:all', kind: 'label', label: 'ALL CITIES' });
      sections.push(...filteredCities.map((city) => ({ key: `all:${cityKey(city)}`, kind: 'city' as const, city })));
    }
    return sections;
  }, [filteredCities, hasQuery, popularCities, showFallback, trimmedQuery]);

  const selectCity = (name: string) => {
    onSelect(normalizeCityDisplayName(name).slice(0, cityDisplayMaxLength));
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

    if (item.kind === 'fallback') {
      return <FallbackRow onPress={() => selectCity(item.query)} query={item.query} />;
    }

    const nextItem = rows[index + 1];
    const isLast = !nextItem || nextItem.kind !== 'city';

    return (
      <CityRow
        city={item.city}
        isLast={isLast}
        onPress={() => selectCity(item.city.name)}
        selected={Boolean(selectedCity) && item.city.name.toLocaleLowerCase() === selectedCity?.toLocaleLowerCase()}
      />
    );
  };

  const isEmpty = hasQuery ? filteredCities.length === 0 && !showFallback : rows.length === 0;

  return (
    <Modal animationType="slide" onRequestClose={closePicker} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} visible={visible}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Close city picker"
            accessibilityRole="button"
            hitSlop={8}
            onPress={closePicker}
            style={({ pressed }) => [styles.closeButton, pressed && styles.rowPressed]}>
            <Ionicons color={colors.text} name="close" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{country ? `Cities in ${country.name}` : 'City'}</Text>
            <Text style={styles.subtitle}>Search or pick from popular cities.</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons color={colors.textMuted} name="search" size={18} />
          <TextInput
            accessibilityLabel="Search cities"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            onChangeText={setQuery}
            placeholder="Search city"
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

        {isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {hasQuery
                ? `No cities match “${trimmedQuery}”.`
                : `We don't have a city list for ${country?.name ?? 'this country'} yet. Search to add your city.`}
            </Text>
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
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowRegion: { marginTop: 1, color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  rowCheck: { marginLeft: spacing.xs },
  fallbackRow: {
    minHeight: rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  fallbackText: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
});
