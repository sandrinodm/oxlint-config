import { defineConfig } from 'vite-plus';

import oxlintConfig, { fmtConfig } from './src/index.ts';

/**
 * Paths neither the formatter nor the linter touches: build output, packed tarballs and coverage.
 */
const ignoredPatterns = ['coverage/**', '*.tgz', 'pnpm-lock.yaml'];

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/plugin.ts', 'src/effect.ts'],
    platform: 'node',
    format: ['esm'],
    dts: true,
    unbundle: true,
    fixedExtension: false,
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ...fmtConfig,
    ignorePatterns: [...fmtConfig.ignorePatterns, ...ignoredPatterns],
  },
  lint: {
    ...oxlintConfig,
    ignorePatterns: [...oxlintConfig.ignorePatterns, ...ignoredPatterns],
    overrides: [
      ...oxlintConfig.overrides,
      {
        // Rules walk loosely typed ESTree nodes and are long visitor objects by nature.
        files: ['src/**/*.ts'],
        rules: {
          'eslint/max-lines-per-function': 'off',
          'typescript/no-unsafe-assignment': 'off',
          'typescript/no-unsafe-call': 'off',
          'typescript/no-unsafe-member-access': 'off',
        },
      },
      {
        files: ['src/index.ts'],
        rules: {
          'oxc/no-barrel-file': 'off',
        },
      },
      {
        files: ['scripts/**/*.mjs'],
        rules: {
          'no-console': 'off',
          // Plain Node scripts without Effect: JSON comes from files this repository controls.
          'slop/no-raw-json-parse': 'off',
        },
      },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  run: {
    cache: { scripts: false, tasks: true },
  },
});
