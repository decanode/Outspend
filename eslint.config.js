const { defineConfig, globalIgnores } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const babelParser = require('@babel/eslint-parser')

module.exports = defineConfig([
  expoConfig,
  globalIgnores(['node_modules/', 'android/', 'dist/', '.expo/']),
  {
    // WatermelonDB models use legacy decorators, which the default parser cannot read.
    files: ['src/db/models/**/*.js'],
    languageOptions: { parser: babelParser, parserOptions: { requireConfigFile: true } },
  },
  {
    files: ['src/db/index.js'],
    rules: { 'import/namespace': 'off', 'import/no-named-as-default': 'off', 'import/no-named-as-default-member': 'off' },
  },
  {
    files: ['__tests__/**'],
    languageOptions: { globals: { jest: 'readonly', describe: 'readonly', test: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' } },
  },
])
