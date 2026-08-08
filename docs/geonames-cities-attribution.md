# City catalog — data source and attribution

NOXA's offline City Picker (`src/features/city-picker`) is backed by a
generated, repository-owned catalog derived from GeoNames. This file
documents provenance, license, and how to regenerate the catalog.

## Source

- **Dataset:** GeoNames `cities15000` — cities with population > 15,000,
  plus national/administrative capitals of any population.
- **Files used:**
  - `https://download.geonames.org/export/dump/cities15000.zip`
  - `https://download.geonames.org/export/dump/admin1CodesASCII.txt` (resolves
    admin1 codes to region names, used only to disambiguate duplicate city
    names within a country)
  - `https://download.geonames.org/export/dump/countryInfo.txt` (part of the
    documented source bundle; not required as script input)
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  © GeoNames (https://www.geonames.org/), per
  https://www.geonames.org/export/. Attribution is required, which is what
  this document (and the header comment in every generated file) provides.

Raw GeoNames dumps are **not** committed to this repository — only the
generated, compact output under `src/data/cities/` and
`src/data/cityCatalogRegistry.ts` is committed, matching how
`src/data/countryCatalog.ts` and the vehicle catalogs are handled.

## Regenerating the catalog

```sh
mkdir -p /tmp/geonames && cd /tmp/geonames
curl -sSO https://download.geonames.org/export/dump/cities15000.zip
curl -sSO https://download.geonames.org/export/dump/admin1CodesASCII.txt
unzip -o cities15000.zip

cd <repo root>
node scripts/generate-city-catalog.js --source /tmp/geonames --out src/data/cities
```

This regenerates every `src/data/cities/<ISO2>.ts` file and
`src/data/cityCatalogRegistry.ts`. Only country codes present in
`src/data/countryCatalog.ts` are emitted, so Country Picker and City Picker
never drift apart.

## Data shape

Each per-country file exports a compact array of tuples, not objects, to
keep the bundle small:

```ts
export const cities = [
  ["Thessaloníki", "Thessaloniki", 317778],
  ["Néa Ionía", "Nea Ionia", 67134, "Attica"],
] as const;
```

`[name, asciiName, population, region?]`:

- `name` — display name, as published by GeoNames (may include diacritics).
- `asciiName` — ASCII transliteration, used as a secondary search key so
  lookups are diacritic-insensitive even when the runtime's Unicode
  normalization can't fully fold a script (e.g. Greek, Cyrillic).
- `population` — used only to rank the `POPULAR` section at runtime; never
  shown to end users.
- `region` — the resolved admin1 region name (e.g. `"Bavaria"`,
  `"Attica"`), included **only** when the city name collides with another
  city in the same country. This keeps the common case (~97% of rows) at 3
  fields while still disambiguating the small number of duplicate names, per
  the product spec's "cheap, subtle secondary label" requirement. No
  coordinates, geoname IDs, or other identifiers are stored anywhere in the
  catalog.

`src/data/cityCatalogRegistry.ts` is a **static, explicit loader map**
(`{ GR: () => require('./cities/GR').cities, ... }`). Metro cannot resolve a
fully dynamic `require()`, and a top-level `import` per country would parse
and evaluate all ~240 country files at app startup. Wrapping each literal
`require()` in a function defers evaluation until a country's catalog is
actually requested, so only the cities for the country the user picked are
ever loaded into memory.

## Coverage

`cities15000` intentionally excludes small towns below the population/
capital threshold. As of the current generation:

- 241 of NOXA's supported country codes have at least one city.
- 2 (`IO`, `TK`) have none — City Picker falls back entirely to the
  restrained "Use as my city" custom-entry action for those.

For every country, City Picker always offers a custom fallback
(`Use "<query>" as my city`) when a search has no exact match, so users in
towns outside the catalog are never blocked. That fallback stores only the
normalized, trimmed, 60-character-capped text the user typed — the same
`profiles.city` column and limit the free-text field always used.
