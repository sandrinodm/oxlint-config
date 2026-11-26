import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noTestsDirectory } from './no-tests-directory.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-tests-directory', noTestsDirectory, {
  valid: [
    {
      filename: 'apps/app/src/lib/format.test.ts',
      code: "import { extractHost } from './format.ts';",
    },
    {
      filename: 'packages/core/src/client.test.ts',
      code: "import { GitHubClient } from './client.ts';",
    },
    {
      filename: 'apps/app/src/routes/__root.tsx',
      code: "import { AppShell } from '~/features/layout/app-shell';",
    },
    {
      filename: 'apps/app/src/lib/format.ts',
      code: "import { describe } from 'vitest';",
    },
  ],
  invalid: [
    {
      name: 'reports a tests directory in a hash alias import',
      filename: 'apps/app/src/lib/format.test.ts',
      code: "import { fixture } from '#/__tests__/fixture';",
      errors: [{ messageId: 'colocateTests', data: { dir: '__tests__' } }],
    },
    {
      filename: 'apps/app/src/__tests__/format.test.ts',
      code: "import { extractHost } from '~/lib/format';",
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__tests__' },
        },
      ],
    },
    {
      filename: 'packages/domain/src/__tests__/helpers/fixture.ts',
      code: 'export const sample = 1;',
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__tests__' },
        },
      ],
    },
    {
      filename: 'packages/domain/src/__test__/domain.test.ts',
      code: 'export const sample = 1;',
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__test__' },
        },
      ],
    },
    {
      filename: 'apps/app/src/lib/format.test.ts',
      code: "import { fixture } from '../__tests__/fixture.ts';",
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__tests__' },
        },
      ],
    },
    {
      filename: 'apps/app/src/lib/format.test.ts',
      code: "import { fixture } from '~/__tests__/fixture';",
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__tests__' },
        },
      ],
    },
    {
      filename: 'apps/app/src/lib/format.test.ts',
      code: "const mod = import('./__tests__/fixture.ts');",
      errors: [
        {
          messageId: 'colocateTests',
          data: { dir: '__tests__' },
        },
      ],
    },
  ],
});
