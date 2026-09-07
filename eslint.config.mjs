import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import astro from 'eslint-plugin-astro';

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  globalIgnores(['dist/**', 'node_modules/**', '.astro/**']),
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/max-len': ['error', 120],
      '@typescript-eslint/ban-ts-comment': 0,
    }
  },
  {
    // Tailwind class lists routinely run past any column limit worth setting.
    files: ['**/*.astro'],
    rules: {
      '@stylistic/max-len': 0,
    }
  }
]);

export default eslintConfig;
