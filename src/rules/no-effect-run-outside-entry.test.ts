import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noEffectRunOutsideEntry } from './no-effect-run-outside-entry.ts';

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

ruleTester.run('no-effect-run-outside-entry', noEffectRunOutsideEntry, {
  valid: [
    `${EFFECT}const program = Effect.gen(function* () { return yield* Effect.succeed(1); });`,
    "import { NodeRuntime } from '@effect/platform-node';\nNodeRuntime.runMain(program);",
    // A different `Effect`
    'const Effect = { runPromise: (x: unknown) => x };\nEffect.runPromise(1);',
  ],
  invalid: [
    ...[
      'runPromiseWith',
      'runPromiseExitWith',
      'runSyncWith',
      'runSyncExitWith',
      'runForkWith',
      'runCallbackWith',
    ].map((name) => ({
      name: `reports Effect.${name} outside an entrypoint`,
      code: `${EFFECT}const value = Effect.${name}(context)(program);`,
      errors: [{ messageId: 'run', data: { name } }],
    })),
    {
      code: `${EFFECT}export const load = () => Effect.runPromise(program);`,
      errors: [{ messageId: 'run', data: { name: 'runPromise' } }],
    },
    {
      code: `${EFFECT}const value = Effect.runSync(Effect.succeed(1));`,
      errors: [{ messageId: 'run', data: { name: 'runSync' } }],
    },
    {
      code: `${EFFECT}promises.map(Effect.runPromise);`,
      errors: [{ messageId: 'run', data: { name: 'runPromise' } }],
    },
    {
      code: `${EFFECT}const runtime = ManagedRuntime.make(AppLayer);`,
      errors: [{ messageId: 'runtime' }],
    },
  ],
});
