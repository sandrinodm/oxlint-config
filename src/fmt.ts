import type { OxfmtConfig } from 'vite-plus/fmt';

import { GENERATED_PATTERNS } from './ignore-patterns.ts';

/**
 * Shared Oxfmt settings: single quotes, trailing commas, 100-column lines, multiline JSDoc, sorted
 * `package.json` scripts and grouped imports (type imports first, then external, internal and
 * relative). Consumers spread it into `fmt` and add their own ignores, Tailwind stylesheet and
 * internal import patterns.
 */
export default {
  ignorePatterns: [
    ...GENERATED_PATTERNS,
    // Written by the package manager.
    'bun.lock',
  ],
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  printWidth: 100,
  jsdoc: {
    commentLineStrategy: 'multiline',
  },
  sortPackageJson: {
    sortScripts: true,
  },
  sortImports: {
    order: 'asc',
    newlinesBetween: true,
    sortSideEffects: false,
    internalPattern: ['~/*', '@/*'],
    groups: [
      'type-import',
      ['value-builtin', 'value-external'],
      'type-internal',
      'value-internal',
      ['type-parent', 'type-sibling', 'type-index'],
      ['value-parent', 'value-sibling', 'value-index'],
      'unknown',
    ],
  },
  overrides: [
    {
      files: ['**/*.md'],
      options: {
        printWidth: 100,
        proseWrap: 'preserve',
      },
    },
  ],
} satisfies OxfmtConfig;
