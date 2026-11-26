import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noChainedTypeAssertions } from './no-chained-type-assertions.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'ts',
    },
  },
});

ruleTester.run('no-chained-type-assertions', noChainedTypeAssertions, {
  valid: [
    {
      name: 'allows a single type assertion',
      code: 'const value = input as Output;',
    },
  ],
  invalid: [
    {
      name: 'reports consecutive as assertions',
      code: 'const value = input as unknown as Output;',
      errors: [{ messageId: 'chained' }],
    },
    {
      name: 'reports an as assertion on an angle-bracket assertion',
      code: 'const value = (<unknown>input) as Output;',
      errors: [{ messageId: 'chained' }],
    },
  ],
});
