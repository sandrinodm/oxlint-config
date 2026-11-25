import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noThrowInEffectGen } from './no-throw-in-effect-gen.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-throw-in-effect-gen', noThrowInEffectGen, {
  valid: [
    // A local `Effect` that is not imported from `effect` is ignored
    `const Effect = { gen: (f: () => unknown) => f };
const program = Effect.gen(function* () {
  throw new Error('x');
  console.log('x');
});`,
    // Returning typed errors via yield* is valid
    `const program = Effect.gen(function* () {
  const valid = yield* check();
  if (!valid) {
    return yield* new ValidationError({ message: 'invalid' });
  }

  return valid;
});`,
    // Throwing inside a plain function outside Effect.gen is valid
    `const parse = (raw: string): number => {
  if (raw.length === 0) {
    throw new Error('empty');
  }

  return Number(raw);
};`,
    // Throwing inside a nested Effect.try / Effect.tryPromise callback is caught by Effect
    `const program = Effect.gen(function* () {
  return yield* Effect.tryPromise({
    try: async () => {
      const response = await fetch('https://example.com');
      if (!response.ok) {
        throw new Error('bad status');
      }

      return response.text();
    },
    catch: (cause) => new UpstreamError({ cause }),
  });
});`,
    // Regular non-Effect generator function is unaffected
    `function* numbers() {
  throw new Error('boom');
}`,
  ],
  invalid: [
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(function* () {
  if (!ready) {
    throw new Error('not ready');
  }

  return 1;
});`,
      errors: [{ messageId: 'noThrow' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.fn('loadUser')(function* (id: string) {
  if (id.length === 0) {
    throw new Error('missing id');
  }

  return id;
});`,
      errors: [{ messageId: 'noThrow' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.fn(function* (id: string) {
  throw new Error(id);
});`,
      errors: [{ messageId: 'noThrow' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(self, function* () {
  throw new Error('bound self');
});`,
      errors: [{ messageId: 'noThrow' }],
    },
  ],
});
