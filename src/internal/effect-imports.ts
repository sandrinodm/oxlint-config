import type { ESTree, SourceCode } from 'vite-plus/lint/plugins';

/**
 * Module specifiers that count as Effect: the `effect` package, its subpaths (`effect/Effect`,
 * `effect/unstable/http`) and the `@effect/*` scope.
 */
const EFFECT_SPECIFIER_RE = /^(?:effect(?:\/.+)?|@effect\/.+)$/;

/**
 * Resolves `identifier` to the Effect module it was imported as, so `Effect` in `import { Effect }
 * from 'effect'`, `import * as Effect from 'effect/Effect'` and `import { Effect as E } from
 * 'effect'` (used as `E`) all resolve to `'Effect'`. Returns `null` for globals, local bindings and
 * imports from other packages, which keeps the Effect rules quiet on look-alike names.
 */
export const getEffectModuleName = (
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): string | null => {
  let scope: ReturnType<SourceCode['getScope']> | null = sourceCode.getScope(identifier);
  for (; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (variable === undefined) {
      continue;
    }

    const [definition] = variable.defs;
    if (definition?.type !== 'ImportBinding') {
      return null;
    }

    const declaration = definition.parent;
    if (declaration?.type !== 'ImportDeclaration') {
      return null;
    }

    const specifier = declaration.source.value;
    if (!EFFECT_SPECIFIER_RE.test(specifier)) {
      return null;
    }

    const binding = definition.node;
    if (binding.type === 'ImportSpecifier') {
      return binding.imported.type === 'Identifier'
        ? binding.imported.name
        : binding.imported.value;
    }

    return specifier.split('/').at(-1) ?? null;
  }

  return null;
};

/**
 * Returns `true` when `node` is `<Module>.<member>` (non-computed) where `<Module>` resolves to the
 * Effect module `moduleName` and `<member>` is in `members`.
 */
export const isEffectMember = (
  sourceCode: SourceCode,
  node: ESTree.Node,
  moduleName: string,
  members: ReadonlySet<string>,
): boolean =>
  node.type === 'MemberExpression' &&
  !node.computed &&
  node.object.type === 'Identifier' &&
  node.property.type === 'Identifier' &&
  members.has(node.property.name) &&
  getEffectModuleName(sourceCode, node.object) === moduleName;

/**
 * Returns the member name of `node` when it is `<Module>.<member>` on the Effect module
 * `moduleName`, or `null`.
 */
export const getEffectMemberName = (
  sourceCode: SourceCode,
  node: ESTree.Node,
  moduleName: string,
): string | null => {
  if (
    node.type !== 'MemberExpression' ||
    node.computed ||
    node.object.type !== 'Identifier' ||
    node.property.type !== 'Identifier'
  ) {
    return null;
  }

  return getEffectModuleName(sourceCode, node.object) === moduleName ? node.property.name : null;
};
