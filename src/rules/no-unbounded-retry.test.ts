import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noUnboundedRetry } from './no-unbounded-retry.ts';

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

ruleTester.run('no-unbounded-retry', noUnboundedRetry, {
  valid: [
    {
      name: 'leaves retry bounds supplied by an options spread unchecked',
      code: `${EFFECT}Effect.retry(load, { ...retryOptions });`,
    },
    `${EFFECT}const p = load.pipe(Effect.retry({ times: 3 }));`,
    `${EFFECT}const p = load.pipe(Effect.retry({ schedule: Schedule.exponential('100 millis'), times: 5 }));`,
    `${EFFECT}const p = load.pipe(Effect.retry(Schedule.recurs(3)));`,
    `${EFFECT}const p = load.pipe(Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.upTo('30 seconds'))));`,
    `${EFFECT}const p = Effect.retry(load, Schedule.spaced('1 second').pipe(Schedule.during('1 minute')));`,
    {
      name: 'allows a maximum schedule with a bounded branch in a pipe',
      code: `${EFFECT}Effect.retry(
  load,
  Schedule.exponential('1 second').pipe((s) => Schedule.max([s, Schedule.recurs(3)])),
);`,
    },
    // Policies in variables are not judged
    `${EFFECT}const p = load.pipe(Effect.retry(retryPolicy));`,
    // Repeating forever is a legitimate daemon pattern
    `${EFFECT}const p = tick.pipe(Effect.repeat(Schedule.forever));`,
    'const Effect = { retry: (x: unknown) => x };\nconst Schedule = { forever: 1 };\nEffect.retry(Schedule.forever);',
  ],
  invalid: [
    {
      name: 'reports an empty retry options object',
      code: `${EFFECT}Effect.retry(load, {});`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      name: 'reports a minimum schedule with an unbounded branch',
      code: `${EFFECT}Effect.retry(load, Schedule.min([Schedule.forever, Schedule.recurs(1)]));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      name: 'reports a minimum schedule with unbounded exponential backoff',
      code: `${EFFECT}Effect.retry(load, Schedule.min([Schedule.exponential('100 millis'), Schedule.recurs(3)]));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      name: 'reports a concatenation followed by an unbounded schedule',
      code: `${EFFECT}load.pipe(Effect.retry(Schedule.concat(Schedule.recurs(3), Schedule.spaced('1 minute'))));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.retry(Schedule.forever));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.retry(Schedule.exponential('100 millis')));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      code: `${EFFECT}const p = Effect.retry(load, Schedule.spaced('1 second'));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.retry({ schedule: Schedule.fixed('1 second') }));`,
      errors: [{ messageId: 'unbounded' }],
    },
    {
      code: `${EFFECT}const p = load.pipe(Effect.retry(Schedule.exponential('10 millis').pipe(Schedule.jittered)));`,
      errors: [{ messageId: 'unbounded' }],
    },
  ],
});
