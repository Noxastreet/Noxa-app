// Shared diacritic- and case-insensitive text matching for local catalog search
// (countries, cities). Pure and dependency-free so it is safe to use from data modules.

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase();
}
