import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'backend', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only the two classic hook rules; the plugin's v7 preset adds React Compiler rules we don't use.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Empty catches swallow localStorage failures on purpose (private mode).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // tsc already enforces unused locals/params.
      '@typescript-eslint/no-unused-vars': 'off',
      // The API boundary is typed `any` by design (see data-mappers.ts).
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
