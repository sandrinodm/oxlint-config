import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { effectFnConventions } from './effect-fn-conventions.ts';

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

ruleTester.run('effect-fn-conventions', effectFnConventions, {
  valid: [
    `${EFFECT}const getUser = Effect.fn('getUser')(function* (id: string) { return id; });`,
    `${EFFECT}const service = { query: Effect.fn('Database.query')(function* () { return 1; }) };`,
    `${EFFECT}class Repo { find = Effect.fn('Repo.find')(function* () { return 1; }); }`,
    `${EFFECT}const run = Effect.fnUntraced(function* () { return 1; });`,
    `${EFFECT}const f = Effect.fn('f')(function* () { return 1; }, Effect.withSpan('x'));`,
    // Piping the result of calling the function is fine
    `${EFFECT}const f = Effect.fn('f')(function* () { return 1; });\nconst g = f().pipe(Effect.orDie);`,
    // Anonymous positions have no binding to compare with
    `${EFFECT}register(Effect.fn('handler')(function* () { return 1; }));`,
    {
      code: `${EFFECT}const getUser = Effect.fn('users.lookup')(function* () { return 1; });`,
      options: [{ matchName: false }],
    },
    // Not Effect's `fn`
    `const Effect = { fn: (f: unknown) => f };\nconst x = Effect.fn(function* () {});`,
  ],
  invalid: [
    {
      code: `${EFFECT}const getUser = Effect.fn(function* (id: string) { return id; });`,
      errors: [{ messageId: 'unnamed' }],
    },
    {
      code: `${EFFECT}const getUser = Effect.fn('loadUser')(function* () { return 1; });`,
      errors: [{ messageId: 'nameMismatch', data: { name: 'loadUser', binding: 'getUser' } }],
    },
    {
      code: `${EFFECT}const service = { query: Effect.fn('Database.run')(function* () { return 1; }) };`,
      errors: [{ messageId: 'nameMismatch', data: { name: 'Database.run', binding: 'query' } }],
    },
    {
      code: `${EFFECT}const f = Effect.fn('f')(function* () { return 1; }).pipe(Effect.orDie);`,
      errors: [{ messageId: 'piped' }],
    },
    {
      code: `${EFFECT}const f = Effect.fnUntraced(function* () { return 1; }).pipe(Effect.orDie);`,
      errors: [{ messageId: 'piped' }],
    },
    {
      code: "import * as E from 'effect/Effect';\nconst f = E.fn(function* () {});",
      errors: [{ messageId: 'unnamed' }],
    },
  ],
});
