// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Generated lazy-loader registry: require() here is the deliberate
    // per-country code-splitting mechanism (see scripts/generate-city-catalog.js),
    // not an accidental CommonJS import.
    files: ['src/data/cityCatalogRegistry.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
