import type { ESTree } from 'vite-plus/lint/plugins';

/**
 * Rule option schema shared by import-path rules: `workspaceScopes` lists package-scope prefixes
 * (such as `@acme/`) whose subpaths are checked like local files.
 */
export const WORKSPACE_SCOPES_SCHEMA = [
  {
    type: 'object',
    properties: {
      workspaceScopes: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  },
];

/**
 * Reads the `workspaceScopes` string list from raw rule options, returning an empty list when the
 * option is absent or malformed.
 */
export const readWorkspaceScopes = (options: ReadonlyArray<unknown>): ReadonlyArray<string> => {
  const raw = options[0];
  if (typeof raw !== 'object' || raw === null || !('workspaceScopes' in raw)) {
    return [];
  }

  const scopes = raw.workspaceScopes;
  if (!Array.isArray(scopes)) {
    return [];
  }

  return scopes.filter((scope): scope is string => typeof scope === 'string');
};

/**
 * Returns the first path-segment index subject to local filename validation: `0` for relative/root
 * paths (`./`, `../`, `/`), `1` for alias prefixes (`~/`, `@/`, `#/`), `2` for
 * `<workspace-scope><pkg>/<subpath>` subpaths, or `null` for external dependencies and bare
 * `<workspace-scope><pkg>` roots.
 */
export const getCheckedStartIndex = (
  pathPart: string,
  segments: ReadonlyArray<string>,
  workspaceScopes: ReadonlyArray<string>,
): number | null => {
  if (pathPart.startsWith('./') || pathPart.startsWith('../') || pathPart.startsWith('/')) {
    return 0;
  }

  if (pathPart.startsWith('~/') || pathPart.startsWith('@/') || pathPart.startsWith('#/')) {
    return 1;
  }

  if (workspaceScopes.some((scope) => pathPart.startsWith(scope))) {
    return segments.length > 2 ? 2 : null;
  }

  return null;
};

/**
 * ESTree visitor handlers for every node type that can carry a module specifier.
 */
type ImportSpecifierVisitor = {
  /**
   * `import ... from 'x'`.
   */
  readonly ImportDeclaration: (node: ESTree.ImportDeclaration) => void;

  /**
   * `export { ... } from 'x'`.
   */
  readonly ExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => void;

  /**
   * `export * from 'x'`.
   */
  readonly ExportAllDeclaration: (node: ESTree.ExportAllDeclaration) => void;

  /**
   * Dynamic `import('x')` with a string or static template source.
   */
  readonly ImportExpression: (node: ESTree.ImportExpression) => void;

  /**
   * Type-level `import('x').T`.
   */
  readonly TSImportType: (node: ESTree.TSImportType) => void;
};

/**
 * Creates an ESTree visitor invoking `onSpecifier` for every statically resolvable module specifier
 * across `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration`,
 * string/static-template `ImportExpression`, and `TSImportType` nodes.
 */
export const createImportSpecifierVisitor = (
  onSpecifier: (node: ESTree.Node, specifier: string) => void,
): ImportSpecifierVisitor => {
  /**
   * Forwards non-null `StringLiteral` module source nodes to `onSpecifier`.
   */
  const checkSource = (source: ESTree.StringLiteral | null): void => {
    if (source !== null) {
      onSpecifier(source, source.value);
    }
  };

  return {
    ImportDeclaration(node: ESTree.ImportDeclaration) {
      checkSource(node.source);
    },
    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
      checkSource(node.source);
    },
    ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
      checkSource(node.source);
    },
    ImportExpression(node: ESTree.ImportExpression) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
        checkSource(node.source);
        return;
      }
      if (node.source.type === 'TemplateLiteral' && node.source.expressions.length === 0) {
        const cooked = node.source.quasis[0]?.value.cooked;
        if (typeof cooked === 'string') {
          onSpecifier(node.source, cooked);
        }
      }
    },
    TSImportType(node: ESTree.TSImportType) {
      checkSource(node.source);
    },
  };
};
