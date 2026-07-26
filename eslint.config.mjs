import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  globalIgnores(['dist/**', 'node_modules/**', '.astro/**']),
  {
    rules: {
      indent: ['error', 2],
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'object-curly-spacing': ['error', 'always'],
      '@typescript-eslint/ban-ts-comment': 0,
    }
  }
]);

export default eslintConfig;
