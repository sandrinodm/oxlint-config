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
    {
      name: 'allows a fallback object that includes the failure',
      code: `${EFFECT}Effect.catch(load, (error) => Effect.succeed({ ok: false, error }));`,
    },
    {
      name: 'allows an explicit constant fallback',
      code: `${EFFECT}Effect.orElseSucceed(load, () => []);`,
    },
    `${EFFECT}const p = load.pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)));`,
    `${EFFECT}const p = load.pipe(Effect.catch((error) => Effect.logWarning('load failed', error)));`,
    `${EFFECT}const p = load.pipe(Effect.catch((error) => Effect.succeed(fallbackFor(error))));`,
    `${EFFECT}const p = load.pipe(Effect.catch(() => { log(); return Effect.void; }));`,
    `${EFFECT}const p = load.pipe(Effect.ignore);`,
    'const Effect = { catch: (f: unknown) => f, void: 0 };\nconst p = Effect.catch(() => Effect.void);',
  ],
  invalid: [
    {
      name: 'reports a constant catchAll recovery',
      code: `${EFFECT}Effect.catchAll(load, () => Effect.void);`,
      errors: [{ messageId: 'silent', data: { name: 'catchAll' } }],
    },
    {
      name: 'reports a constant catchAllCause recovery',
      code: `${EFFECT}load.pipe(Effect.catchAllCause(() => Effect.succeed(undefined)));`,
      errors: [{ messageId: 'silent', data: { name: 'catchAllCause' } }],
    },
    {
      name: 'reports a constant catchAllDefect recovery',
      code: `${EFFECT}load.pipe(Effect.catchAllDefect(() => Effect.succeedNone));`,
      errors: [{ messageId: 'silent', data: { name: 'catchAllDefect' } }],
    },
    {
      name: 'reports a literal-only fallback object',
      code: `${EFFECT}Effect.catch(load, () => Effect.succeed({ ok: false }));`,
      errors: [{ messageId: 'silent', data: { name: 'catch' } }],
    },
    {
      name: 'reports a literal-only fallback array',
      code: `${EFFECT}Effect.catch(load, () => Effect.succeed([1]));`,
      errors: [{ messageId: 'silent', data: { name: 'catch' } }],
    },
    {
      name: 'reports a constant eager recovery',
      code: `${EFFECT}Effect.catchEager(load, () => Effect.void);`,
      errors: [{ messageId: 'silent', data: { name: 'catchEager' } }],
    },
    {
      name: 'reports a piped constant eager recovery',
      code: `${EFFECT}load.pipe(Effect.catchEager(() => Effect.void));`,
      errors: [{ messageId: 'silent', data: { name: 'catchEager' } }],
    },
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
