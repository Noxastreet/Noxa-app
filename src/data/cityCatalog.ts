// NOXA city catalog. Local, offline, generated from GeoNames — no network dependency.
// Data shape and provenance: docs/data-sources/geonames-cities.md
// Generator: scripts/generate-city-catalog.js

import { normalizeForSearch } from '@/src/utils/textSearch';

import { hasCityCatalog, loadCityCatalogRaw, type CityRecord } from './cityCatalogRegistry';

export type { CityRecord };

export type City = {
  name: string;
  asciiName: string;
  population: number;
  region: string | null;
};

const popularCityLimit = 8;
const catalogCache = new Map<string, readonly City[]>();
const popularCache = new Map<string, readonly City[]>();

function toCity([name, asciiName, population, region]: CityRecord): City {
  return { name, asciiName, population, region: region ?? null };
}

function getCatalog(countryCode: string): readonly City[] {
  const cached = catalogCache.get(countryCode);
  if (cached) return cached;

  const cities = loadCityCatalogRaw(countryCode).map(toCity);
  catalogCache.set(countryCode, cities);
  return cities;
}

export function hasCityCatalogForCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return hasCityCatalog(countryCode.toUpperCase());
}

export function getCitiesForCountry(countryCode: string | null | undefined): readonly City[] {
  if (!countryCode) return [];
  return getCatalog(countryCode.toUpperCase());
}

export function getPopularCitiesForCountry(countryCode: string | null | undefined): readonly City[] {
  if (!countryCode) return [];
  const code = countryCode.toUpperCase();
  const cached = popularCache.get(code);
  if (cached) return cached;

  const popular = [...getCatalog(code)].sort((a, b) => b.population - a.population).slice(0, popularCityLimit);
  popularCache.set(code, popular);
  return popular;
}

export function matchesCityQuery(city: City, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return true;
  return (
    normalizeForSearch(city.name).includes(normalizedQuery) || normalizeForSearch(city.asciiName).includes(normalizedQuery)
  );
}

export function isExactCityMatch(city: City, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return false;
  return normalizeForSearch(city.name) === normalizedQuery || normalizeForSearch(city.asciiName) === normalizedQuery;
}

export function normalizeCityDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
