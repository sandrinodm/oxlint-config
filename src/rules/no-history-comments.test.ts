import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noHistoryComments } from './no-history-comments.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-history-comments', noHistoryComments, {
  valid: [
    `// Encodes payloads as UTF-8 and timestamps as ISO-8601.
export const ENCODING = 'utf-8';`,
    `// Computes SHA-256 digests per RFC-7231 and IEEE-754 rules.
export const ALGO = 'sha256';`,
    `/** @deprecated Phase 1 legacy helper, kept for backwards compatibility with PROJ-123. */
export const oldFn = (): void => undefined;`,
    `// oxlint-disable-next-line no-console -- Phase 2 temporary
export const x = 1;`,
    `// Expects UTC dates formatted as YYYY-MM-DD (e.g. 2026-01-15).
export const format = 'YYYY-MM-DD';`,
  ],
  invalid: [
    {
      code: `// Phase 2 adds comment tree ingestion.
export const sync = (): void => undefined;`,
      errors: [{ messageId: 'history' }],
    },
    {
      code: `// Per the plan, limit batches to 100 items.
export const BATCH_SIZE = 100;`,
      errors: [{ messageId: 'history' }],
    },
    {
      code: `// This endpoint no longer requires authentication.
export const isPublic = true;`,
      errors: [{ messageId: 'history' }],
    },
    {
      code: `// Worker now uses Postgres advisory locks.
export const lock = true;`,
      errors: [{ messageId: 'history' }],
    },
    {
      code: `// Workaround for ABC-123 timeout issue.
export const TIMEOUT_MS = 5000;`,
      errors: [{ messageId: 'history' }],
    },
    {
      code: `/* Step 3 of the migration keeps rows normalized as discussed. */
export const normalized = true;`,
      errors: [{ messageId: 'history' }],
    },
  ],
});
