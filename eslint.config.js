import js from '@eslint/js';
import globals from 'globals';
import n from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.mocha,
        myCustomGlobal: 'readonly',
      },
    },
    plugins: {
      js,
      n,
    },
    extends: ['js/recommended', 'n/recommended', eslintConfigPrettier],
    ignores: ['eslint.config.js'],
  },
]);
