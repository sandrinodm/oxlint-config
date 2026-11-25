import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noSilentCatch } from './no-silent-catch.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

/**
 * Import line shared by fixtures that use Effect.
 */
const EFFECT = "import { Effect, ManagedRuntime, Schedule } from 'effect';\n";

ruleTester.run('no-silent-catch', noSilentCatch, {
  valid: [
    `${EFFECT}const p = load.pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)));`,
    `${EFFECT}const p = load.pipe(Effect.catch((error) => Effect.logWarning('load failed', error)));`,
    `${EFFECT}const p = load.pipe(Effect.catch((error) => Effect.succeed(fallbackFor(error))));`,
    `${EFFECT}const p = load.pipe(Effect.catch(() => { log(); return Effect.void; }));`,
    `${EFFECT}const p = load.pipe(Effect.ignore);`,
    'const Effect = { catch: (f: unknown) => f, void: 0 };\nconst p = Effect.catch(() => Effect.void);',
  ],
  invalid: [
    {
      code: `${EFFECT}const p = load.pipe(Effect.catch(() => Effect.void));`,
      errors: [{ messageId: 'silent', data: { name: 'catch' } }],
    },
    {
      code: `${EFFECT}const p = Effect.catch(load, () => Effect.succeed([]));`,
      errors: [{ messageId: 'silent', data: { name: 'catch' } }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.catchCause(() => { return Effect.succeed(undefined); }));`,
      errors: [{ messageId: 'silent', data: { name: 'catchCause' } }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.catchDefect(() => Effect.succeedNone));`,
      errors: [{ messageId: 'silent', data: { name: 'catchDefect' } }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.catch(() => Effect.succeed()));`,
      errors: [{ messageId: 'silent', data: { name: 'catch' } }],
    },
  ],
});
