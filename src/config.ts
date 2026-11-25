import type { OxlintConfig } from 'vite-plus/lint';

import cloudflare from '@cloudflare/oxlint-config/vite-plus';

import { GENERATED_PATTERNS } from './ignore-patterns.ts';
import { BASE_RESTRICTED_IMPORT_PATTERNS } from './restricted-imports.ts';

/**
 * File extension of this module: `.ts` when run from source, `.js` once built into `dist/`.
 */
const MODULE_EXTENSION = import.meta.url.slice(import.meta.url.lastIndexOf('.'));

/**
 * Absolute `file://` URL of the `slop` plugin next to this module, so the specifier resolves no
 * matter which config file imports this preset.
 */
const SLOP_PLUGIN_SPECIFIER = new URL(`./plugin${MODULE_EXTENSION}`, import.meta.url).href;

/**
 * Strict Oxlint preset: Cloudflare's rules, error-only built-in categories, type-aware checks and
 * the `slop/*` rules. Layout-specific overrides (paths, package boundaries) belong to the consuming
 * config, which spreads `rules` and `overrides` to extend them.
 */
export default {
  extends: [cloudflare],
  env: cloudflare.env,
  ignorePatterns: [...cloudflare.ignorePatterns, ...GENERATED_PATTERNS],
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'jsdoc'],
  jsPlugins: [{ name: 'slop', specifier: SLOP_PLUGIN_SPECIFIER }],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
    pedantic: 'off',
    style: 'off',
    restriction: 'off',
    nursery: 'off',
  },
  options: {
    typeAware: true,
    typeCheck: true,
    reportUnusedDisableDirectives: 'error',
  },
  rules: {
    // Replaced by `slop/no-instanceof`: the upstream rule bans built-ins such as `Date` and
    // `HTMLElement` but exempts any bare identifier ending in `Error` or `Exception`, which lets
    // Effect tagged errors such as `HttpRequestError` through.
    '@nkzw/no-instanceof': 'off',
    // Replaced by `slop/no-conditional-spread`, which also reports the `cond && { key }` form the
    // upstream rule misses, and leaves `cond ? existingObject : {}` fallbacks alone.
    'quality/no-conditional-empty-object-spread': 'off',
    // Effect code uses local modules as namespaces (`Body.cancelResponseBody`, `Policy.validate…`),
    // the same style as Effect's own modules; the call site then names where a function lives.
    'import/no-namespace': 'off',
    // The rule counts arguments on any `.then`/`.catch`/`.finally` call without type information,
    // so it reports Effect's data-first form `Effect.catch(effect, handler)`. TypeScript already
    // rejects wrong argument counts on real Promise methods.
    'promise/valid-params': 'off',
    // In Effect, `error` is the typed failure and `cause` is the full `Cause` (defects,
    // interruptions); both names carry meaning, so both are accepted.
    'unicorn/catch-error-name': ['error', { name: 'error', ignore: ['^cause$'] }],
    'typescript/no-explicit-any': 'error',
    'typescript/no-unsafe-assignment': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
    'typescript/no-unsafe-argument': 'error',
    'typescript/no-unsafe-type-assertion': 'error',
    'typescript/no-unsafe-function-type': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-deprecated': 'error',
    'typescript/method-signature-style': ['error', 'property'],
    'typescript/explicit-module-boundary-types': 'error',
    'typescript/ban-ts-comment': [
      'error',
      {
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-expect-error': 'allow-with-description',
        minimumDescriptionLength: 15,
      },
    ],
    'typescript/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/only-throw-error': 'error',
    'typescript/switch-exhaustiveness-check': 'error',
    'eslint/curly': ['error', 'all'],
    'eslint/prefer-const': 'error',
    'eslint/no-var': 'error',
    'eslint/no-else-return': 'error',
    'eslint/no-nested-ternary': 'error',
    'eslint/no-empty': ['error', { allowEmptyCatch: false }],
    'eslint/eqeqeq': ['error', 'always'],
    'eslint/no-underscore-dangle': ['error', { allow: ['_tag', '_tags'] }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-restricted-imports': ['error', { patterns: [...BASE_RESTRICTED_IMPORT_PATTERNS] }],
    'unicorn/no-abusive-eslint-disable': 'error',
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    'oxc/no-accumulating-spread': 'error',
    'oxc/no-barrel-file': 'error',
    'import/no-cycle': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-access': 'error',
    'jsdoc/check-property-names': 'error',
    'jsdoc/no-blank-blocks': 'error',
    'eslint/complexity': ['error', { max: 14 }],
    'eslint/max-depth': ['error', { max: 4 }],
    'eslint/max-params': ['error', { max: 4 }],
    'eslint/max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
    'eslint/max-lines-per-function': [
      'error',
      { max: 100, skipBlankLines: true, skipComments: true },
    ],
    'slop/no-chained-type-assertions': 'error',
    'slop/no-instanceof': 'error',
    'slop/no-conditional-spread': 'error',
    'slop/no-disable-safety-rules': 'error',
    'slop/no-raw-json-parse': 'error',
    'slop/kebab-case-imports': 'error',
    'slop/no-tests-directory': 'error',
    'slop/blank-line-after-if': 'error',
    'slop/no-throw-in-effect-gen': 'error',
    'slop/no-console-in-effect-gen': 'error',
    'slop/no-banner-comments': 'error',
    'slop/no-history-comments': 'error',
    'slop/require-jsdoc': [
      'error',
      {
        requireZodJsDoc: true,
        requireEffectSchemaJsDoc: true,
      },
    ],
  },
  overrides: [
    {
      files: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.fixture.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
        '**/*.d.ts',
        '**/vite.config.ts',
      ],
      rules: {
        'slop/require-jsdoc': 'off',
      },
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      plugins: ['vitest'],
      rules: {
        'eslint/max-lines': 'off',
        'eslint/max-lines-per-function': 'off',
        'slop/no-fixed-sleep-in-tests': 'error',
        'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
        'vitest/no-disabled-tests': 'error',
        'vitest/no-focused-tests': 'error',
        'vitest/padding-around-test-blocks': 'error',
        'vitest/prefer-lowercase-title': ['error', { ignoreTopLevelDescribe: true }],
      },
    },
  ],
} satisfies OxlintConfig;
