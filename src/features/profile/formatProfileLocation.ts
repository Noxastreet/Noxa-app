import { flagEmojiForCountryCode, getCountryByCode } from '@/src/data/countryCatalog';

export type ProfileLocation = {
  text: string;
  flag: string | null;
};

// Shared by Own Profile and Public Driver Profile so both stay in sync with the Country catalog.
export function formatProfileLocation(
  countryCode: string | null | undefined,
  city: string | null | undefined,
): ProfileLocation | null {
  const trimmedCity = city?.trim() || null;
  const country = getCountryByCode(countryCode);

  if (country && trimmedCity) {
    return { text: `${country.name} · ${trimmedCity}`, flag: flagEmojiForCountryCode(country.code) };
  }
  if (country) {
    return { text: country.name, flag: flagEmojiForCountryCode(country.code) };
  }
  if (trimmedCity) {
    return { text: trimmedCity, flag: null };
  }
  return null;
}
