import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noFixedSleepInTests } from './no-fixed-sleep-in-tests.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-fixed-sleep-in-tests', noFixedSleepInTests, {
  valid: [
    {
      name: 'allows adjusting the Effect test clock',
      code: 'const advance = TestClock.adjust("1 second");',
    },
  ],
  invalid: [
    {
      name: 'reports fixed delays scheduled through setTimeout',
      code: 'setTimeout(resolve, 10);',
      errors: [{ messageId: 'noSleep' }],
    },
    {
      name: 'reports fixed delays scheduled through Bun.sleep',
      code: 'await Bun.sleep(10);',
      errors: [{ messageId: 'noSleep' }],
    },
  ],
});
