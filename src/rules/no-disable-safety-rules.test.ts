import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noDisableSafetyRules } from './no-disable-safety-rules.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-disable-safety-rules', noDisableSafetyRules, {
  valid: [
    {
      name: 'allows a directive for a rule outside the protected list',
      code: '// oxlint-disable-next-line no-console\nconsole.log(1);',
    },
  ],
  invalid: [
    {
      name: 'protects non-null assertions from inline disables',
      code: '// oxlint-disable-next-line typescript/no-non-null-assertion\nexport const x = y!;',
      errors: [{ messageId: 'banned', data: { rule: 'no-non-null-assertion' } }],
    },
    {
      name: 'protects TypeScript comment checks from inline disables',
      code: '// oxlint-disable-next-line typescript/ban-ts-comment\n// @ts-ignore\nexport const x = 1;',
      errors: [{ messageId: 'banned', data: { rule: 'ban-ts-comment' } }],
    },
    {
      name: 'protects focused-test checks from inline disables',
      code: '// oxlint-disable-next-line vitest/no-focused-tests\nit.only("works", () => {});',
      errors: [{ messageId: 'banned', data: { rule: 'no-focused-tests' } }],
    },
    {
      name: 'protects skipped-test checks from inline disables',
      code: '// oxlint-disable-next-line vitest/no-disabled-tests\nit.skip("works", () => {});',
      errors: [{ messageId: 'banned', data: { rule: 'no-disabled-tests' } }],
    },
  ],
});
