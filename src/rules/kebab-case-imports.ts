import { defineRule } from 'vite-plus/lint/plugins';

import {
  IMPORT_SUFFIX_RE,
  WORKSPACE_SCOPES_SCHEMA,
  createImportSpecifierVisitor,
  getCheckedStartIndex,
  readWorkspaceScopes,
} from '../internal/import-specifiers.ts';

/**
 * Matches a single dot-delimited filename component containing only lowercase ASCII alphanumeric
 * runs separated by single hyphens.
 */
const KEBAB_PART_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Matches double-underscore convention segments (such as `__root.tsx` or `__fixtures__`) exempted
 * from strict kebab-case validation.
 */
const DUNDER_SEGMENT_RE = /^__[a-z0-9]+(?:-[a-z0-9]+)*(?:__)?(?:\.[a-z0-9]+)*$/;

/**
 * Matches TanStack Router's generated `routeTree.gen` filename (with optional JS/TS extension),
 * exempted from kebab-case enforcement.
 */
const GENERATED_ROUTE_TREE_RE = /^routeTree\.gen(?:\.[cm]?[jt]sx?)?$/;

/**
 * Matches a leading dot on a directory name without matching relative path markers.
 */
const DOT_DIRECTORY_RE = /^\.[^.]/;

/**
 * Converts a dot-delimited filename part from camelCase, PascalCase, acronym runs, underscores, or
 * whitespace into normalized lowercase kebab-case.
 */
const toKebabPart = (part: string): string =>
  part
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll(/[_\s]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();

/**
 * Returns `true` when a path segment is empty, `.`, `..`, a generated `routeTree.gen` file, a
 * double-underscore convention segment, or consists solely of dot-delimited parts matching
 * `KEBAB_PART_RE`.
 */
const isValidSegment = (segment: string): boolean => {
  if (segment === '' || segment === '.' || segment === '..') {
    return true;
  }
  if (GENERATED_ROUTE_TREE_RE.test(segment) || DUNDER_SEGMENT_RE.test(segment)) {
    return true;
  }

  return segment.split('.').every((part) => KEBAB_PART_RE.test(part));
};

/**
 * Converts a non-compliant path segment to kebab-case across each dot-separated component while
 * returning already-valid segments unchanged.
 */
const toKebabSegment = (segment: string): string => {
  if (isValidSegment(segment)) {
    return segment;
  }

  return segment
    .split('.')
    .map((part) => (KEBAB_PART_RE.test(part) ? part : toKebabPart(part)))
    .filter((part) => part.length > 0)
    .join('.');
};

/**
 * Validates inspectable path segments of `rawSpecifier` (excluding any `?query` or `#hash` suffix)
 * and returns a suggested kebab-case replacement preserving the suffix, or `null` when compliant or
 * non-local.
 */
const getSuggestedKebabSpecifier = (
  rawSpecifier: string,
  workspaceScopes: ReadonlyArray<string>,
): string | null => {
  const queryIndex = rawSpecifier.search(IMPORT_SUFFIX_RE);
  const pathPart = queryIndex === -1 ? rawSpecifier : rawSpecifier.slice(0, queryIndex);
  const suffix = queryIndex === -1 ? '' : rawSpecifier.slice(queryIndex);

  const segments = pathPart.split('/');
  const startIndex = getCheckedStartIndex(pathPart, segments, workspaceScopes);
  if (startIndex === null) {
    return null;
  }

  const checkedSegments = segments.slice(startIndex).map((segment, index) => {
    const isDotDirectory =
      startIndex + index < segments.length - 1 && DOT_DIRECTORY_RE.test(segment);
    const prefix = isDotDirectory ? '.' : '';
    return { prefix, name: segment.slice(prefix.length) };
  });
  if (checkedSegments.every(({ name }) => isValidSegment(name))) {
    return null;
  }

  const expectedSegments = [
    ...segments.slice(0, startIndex),
    ...checkedSegments.map(({ prefix, name }) => prefix + toKebabSegment(name)),
  ];
  return `${expectedSegments.join('/')}${suffix}`;
};

/**
 * Oxlint problem rule (`slop/kebab-case-imports`) checking relative, alias, and workspace-scope
 * subpath module specifiers for lowercase kebab-case segments (exempting `routeTree.gen` and
 * double-underscore convention segments). Suggests a normalized path in diagnostics; provides no
 * autofix.
 */
export const kebabCaseImports = defineRule({
  meta: {
    type: 'problem',
    schema: WORKSPACE_SCOPES_SCHEMA,
    messages: {
      mustBeKebabCase:
        'Import path "{{actual}}" must use kebab-case filenames (e.g., "{{expected}}"). Rename the file and import specifier to kebab-case.',
    },
  },
  create(context) {
    const workspaceScopes = readWorkspaceScopes(context.options);
    return createImportSpecifierVisitor((node, specifier) => {
      const expected = getSuggestedKebabSpecifier(specifier, workspaceScopes);
      if (expected !== null) {
        context.report({
          node,
          messageId: 'mustBeKebabCase',
          data: { actual: specifier, expected },
        });
      }
    });
  },
});
