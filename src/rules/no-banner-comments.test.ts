import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noBannerComments } from './no-banner-comments.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-banner-comments', noBannerComments, {
  valid: [
    `// Normal explanation of why retries are capped at 3.
export const MAX_RETRIES = 3;`,
    `/**
 * Parses a date in YYYY-MM-DD format.
 * Returns undefined when the input is blank.
 */
export const parseDate = (raw: string): string => raw;`,
    `// See https://example.com/docs for protocol details.
export const URL = 'https://example.com';`,
    `// --no-save flag skips persistence.
export const skipSave = true;`,
    `// @ts-expect-error -- testing deliberate type mismatch
export const x = 1;`,
    `// oxlint-disable-next-line import/no-unassigned-import
import './side-effect.ts';`,
  ],
  invalid: [
    {
      code: `// ── Helpers ──
export const helper = (): number => 1;`,
      errors: [{ messageId: 'banner' }],
    },
    {
      code: `// ============================
export const x = 1;`,
      errors: [{ messageId: 'banner' }],
    },
    {
      code: `// --- Section ---
export const x = 1;`,
      errors: [{ messageId: 'banner' }],
    },
    {
      code: `// #region Helpers
export const x = 1;
// #endregion`,
      errors: [{ messageId: 'banner' }, { messageId: 'banner' }],
    },
    {
      code: `/*
 * ──────────
 * Section
 * ──────────
 */
export const x = 1;`,
      errors: [{ messageId: 'banner' }],
    },
  ],
});
