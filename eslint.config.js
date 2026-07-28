import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    // Preserve behavior while the legacy unused animation inputs remain part of the implementation.
    files: ['src/entities/WindChild.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^(animSpeed|energyMult)$' }],
      'no-useless-assignment': 'off',
    },
  },
  {
    // These precomputed direction components are legacy code; lint must not force a semantic style change.
    files: ['src/ui/TacMap.js'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^(dirX|dirY)$' }],
    },
  },
  {
    files: ['src/__tests__/**/*.js', 'e2e/**/*.js', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
