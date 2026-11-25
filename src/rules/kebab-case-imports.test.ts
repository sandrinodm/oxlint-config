import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { kebabCaseImports } from './kebab-case-imports.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('kebab-case-imports', kebabCaseImports, {
  valid: [
    "import { FooBar } from './foo-bar.tsx';",
    "import { FooBar } from './foo-bar';",
    "import type { FooBar } from './foo-bar.tsx';",
    "import { FooBar } from '../components/foo-bar.test.tsx';",
    "import { client } from '~/lib/sse-client.client';",
    "import appCss from '~/styles/app.css?url';",
    "import { routeTree } from '~/routeTree.gen';",
    "import { helper } from '../__fixtures__/test-helper.ts';",
    "import { root } from './routes/__root.tsx';",
    "import 'effect/schema/SchemaJITCompiler/enable';",
    "import { ItemId } from '@acme/domain';",
    {
      code: "import { item } from '@acme/domain/item-schema.ts';",
      options: [{ workspaceScopes: ['@acme/'] }],
    },
    // Without a configured workspace scope, scoped subpaths are treated as external packages
    "import { foo } from '@acme/domain/FooBar.ts';",
    "import { readFile } from 'node:fs/promises';",
    "export { foo } from './foo-bar.ts';",
    "export * from './foo-bar.ts';",
    "const mod = import('./foo-bar.tsx');",
    'const mod = import(`./foo-bar.tsx`);',
    "type Foo = import('./foo-bar.tsx').Foo;",
  ],
  invalid: [
    {
      code: "import { FooBar } from './FooBar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import type { FooBar } from './FooBar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import { ArticleCard } from '~/features/feed/ArticleCard';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: {
            actual: '~/features/feed/ArticleCard',
            expected: '~/features/feed/article-card',
          },
        },
      ],
    },
    {
      code: "import { useDeckShortcuts } from '~/features/deck/useDeckShortcuts';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: {
            actual: '~/features/deck/useDeckShortcuts',
            expected: '~/features/deck/use-deck-shortcuts',
          },
        },
      ],
    },
    {
      code: "import { HNCard } from './HNCard.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './HNCard.tsx', expected: './hn-card.tsx' },
        },
      ],
    },
    {
      code: "import { foo } from './foo_bar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './foo_bar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import { foo } from './foo--bar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './foo--bar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import { foo } from './foo-bar.TSX';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './foo-bar.TSX', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import { foo } from './MyComponents/foo-bar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './MyComponents/foo-bar.tsx', expected: './my-components/foo-bar.tsx' },
        },
      ],
    },
    {
      code: "import { helper } from '../__fixtures__/TestHelper.ts';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: {
            actual: '../__fixtures__/TestHelper.ts',
            expected: '../__fixtures__/test-helper.ts',
          },
        },
      ],
    },
    {
      code: "import css from '~/styles/AppStyles.css?url';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: '~/styles/AppStyles.css?url', expected: '~/styles/app-styles.css?url' },
        },
      ],
    },
    {
      code: "import { foo } from '@acme/domain/FooBar.ts';",
      options: [{ workspaceScopes: ['@acme/'] }],
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: {
            actual: '@acme/domain/FooBar.ts',
            expected: '@acme/domain/foo-bar.ts',
          },
        },
      ],
    },
    {
      code: "export { FooBar } from './FooBar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "export * from './FooBar.tsx';",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "const mod = import('./FooBar.tsx');",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: 'const mod = import(`./FooBar.tsx`);',
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
    {
      code: "type Foo = import('./FooBar.tsx').Foo;",
      errors: [
        {
          messageId: 'mustBeKebabCase',
          data: { actual: './FooBar.tsx', expected: './foo-bar.tsx' },
        },
      ],
    },
  ],
});
