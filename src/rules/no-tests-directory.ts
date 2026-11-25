import { defineRule } from 'vite-plus/lint/plugins';

import {
  WORKSPACE_SCOPES_SCHEMA,
  createImportSpecifierVisitor,
  getCheckedStartIndex,
  readWorkspaceScopes,
} from '../internal/import-specifiers.ts';

/**
 * Matches `__test__` and `__tests__` directory segments prohibited in favor of colocated test
 * files.
 */
const DISALLOWED_TEST_DIR_RE = /^__tests?__$/;

/**
 * Scans parent directory segments of `filePath` (excluding the filename) and returns the first
 * segment matching `DISALLOWED_TEST_DIR_RE`, or `null`.
 */
const findDisallowedTestDir = (filePath: string): string | null => {
  for (const segment of filePath.split(/[\\/]/).slice(0, -1)) {
    if (DISALLOWED_TEST_DIR_RE.test(segment)) {
      return segment;
    }
  }

  return null;
};

/**
 * Scans inspectable segments of a local or workspace import specifier (excluding query/hash
 * suffixes) and returns the first segment matching `DISALLOWED_TEST_DIR_RE`, or `null`.
 */
const findDisallowedTestDirInSpecifier = (
  rawSpecifier: string,
  workspaceScopes: ReadonlyArray<string>,
): string | null => {
  const queryIndex = rawSpecifier.search(/[?#]/);
  const pathPart = queryIndex === -1 ? rawSpecifier : rawSpecifier.slice(0, queryIndex);
  const segments = pathPart.split('/');
  const startIndex = getCheckedStartIndex(pathPart, segments, workspaceScopes);
  if (startIndex === null) {
    return null;
  }

  for (const segment of segments.slice(startIndex)) {
    if (DISALLOWED_TEST_DIR_RE.test(segment)) {
      return segment;
    }
  }

  return null;
};

/**
 * Oxlint problem rule (`slop/no-tests-directory`) reporting files inside `__test__` / `__tests__`
 * directories (via `Program`) and local or workspace import specifiers traversing them so tests
 * stay colocated next to source files. Provides no autofix.
 */
export const noTestsDirectory = defineRule({
  meta: {
    type: 'problem',
    schema: WORKSPACE_SCOPES_SCHEMA,
    messages: {
      colocateTests:
        'Do not use a "{{dir}}" directory. Colocate test files next to the source files they test (e.g., `foo-bar.test.ts` alongside `foo-bar.ts`).',
    },
  },
  create(context) {
    const workspaceScopes = readWorkspaceScopes(context.options);
    return {
      Program(node) {
        const dir = findDisallowedTestDir(context.filename);
        if (dir !== null) {
          context.report({
            node,
            messageId: 'colocateTests',
            data: { dir },
          });
        }
      },
      ...createImportSpecifierVisitor((node, specifier) => {
        const dir = findDisallowedTestDirInSpecifier(specifier, workspaceScopes);
        if (dir !== null) {
          context.report({
            node,
            messageId: 'colocateTests',
            data: { dir },
          });
        }
      }),
    };
  },
});
