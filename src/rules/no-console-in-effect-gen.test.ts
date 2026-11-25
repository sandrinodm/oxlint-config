import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noConsoleInEffectGen } from './no-console-in-effect-gen.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-console-in-effect-gen', noConsoleInEffectGen, {
  valid: [
    // A local `Effect` that is not imported from `effect` is ignored
    `const Effect = { gen: (f: () => unknown) => f };
const program = Effect.gen(function* () {
  throw new Error('x');
  console.log('x');
});`,
    // Effect.log* and Effect Console.log are valid
    `const program = Effect.gen(function* () {
  yield* Effect.logInfo('starting');
  yield* Console.log('cli output');
});`,
    // console calls outside Effect.gen are unaffected by this rule
    `const report = (message: string) => {
  console.warn(message);
  console.error(message);
};`,
    // Non-Effect generator is unaffected
    `function* debugStream() {
  console.log('tick');
  yield 1;
}`,
  ],
  invalid: [
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(function* () {
  console.log('hello');
});`,
      errors: [{ messageId: 'noConsole' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(function* () {
  console.warn('warning');
  console.error('failure');
});`,
      errors: [{ messageId: 'noConsole' }, { messageId: 'noConsole' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.fn('sync')(function* () {
  console.info('syncing');
});`,
      errors: [{ messageId: 'noConsole' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(function* () {
  yield* runWithCallback({
    onProgress: (line) => {
      console.log(line);
    },
  });
});`,
      errors: [{ messageId: 'noConsole' }],
    },
    {
      code: `import { Effect } from 'effect';
const program = Effect.gen(function* () {
  console['debug']('computed');
});`,
      errors: [{ messageId: 'noConsole' }],
    },
  ],
});
