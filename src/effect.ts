import type { OxlintConfig } from 'vite-plus/lint';

import { antipattern, correctness, effectNative, recommended } from '@effect/tsgo/oxlint-presets';

import base from './config.ts';

/**
 * Effect-native rules that only apply inside Effect code (`global-date-in-effect`,
 * `process-env-in-effect`, …). Their "anywhere" twins stay off, so plain helpers outside Effect can
 * still use `Date`, `console` or `process.env`.
 */
const IN_EFFECT_RULE_RE = /-in-effect$/;

/**
 * Every `effecttsgo/*` rule the preset enables: Effect's `recommended` set, the rest of its
 * correctness and anti-pattern categories, and the in-Effect platform rules.
 */
const EFFECT_RULE_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(recommended.rules ?? {}),
  ...Object.keys(correctness.rules ?? {}),
  ...Object.keys(antipattern.rules ?? {}),
  ...Object.keys(effectNative.rules ?? {}).filter((name) => IN_EFFECT_RULE_RE.test(name)),
]);

/**
 * The base preset plus Effect's own type-aware rules from `@effect/tsgo`, all as errors. It needs
 * `@effect/tsgo` installed and lint run through its wrapper (`effect-tsgo vp check`), which loads
 * the patched Oxlint binding that provides the `effecttsgo` plugin. Tests and entrypoints may
 * provide layers directly, so `strict-effect-provide` is off there.
 */
export default {
  ...base,
  // Taken from Effect's preset so the `effecttsgo` plugin name stays typed.
  plugins: [...base.plugins, ...(recommended.plugins ?? [])],
  rules: {
    ...base.rules,
    ...Object.fromEntries([...EFFECT_RULE_NAMES].map((name) => [name, 'error' as const])),
    // Covered by `effecttsgo/global-console-in-effect`, which resolves `console` through types.
    'slop/no-console-in-effect-gen': 'off',
  },
  overrides: [
    ...base.overrides,
    {
      files: [
        '**/*.{test,spec}.{ts,tsx,mts}',
        '**/main.{ts,tsx,mts,js,mjs}',
        '**/bin/**',
        '**/scripts/**',
      ],
      rules: {
        'effecttsgo/strict-effect-provide': 'off',
      },
    },
  ],
} satisfies OxlintConfig;
