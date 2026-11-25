import type { ESTree, SourceCode } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import {
  BUILT_IN_CLASSES,
  BUILT_IN_NAMESPACES,
  DOM_ELEMENT_RE,
  GLOBAL_OBJECTS,
} from '../internal/built-in-classes.ts';

/**
 * Statically known constructor reference on the right-hand side of `instanceof`: its dotted path
 * (`['CircuitBreaker', 'CircuitBreakerError']`) and the identifier the path starts from.
 */
type ConstructorPath = {
  /**
   * Path segments from the root identifier to the class, without computed or dynamic parts.
   */
  readonly segments: ReadonlyArray<string>;

  /**
   * Identifier the path starts from, used to check whether it resolves to a global binding.
   */
  readonly root: ESTree.IdentifierReference;
};

/**
 * Strips wrappers that do not change the runtime value: parentheses, optional chains and TypeScript
 * `as`, `satisfies`, `<T>` and `!` expressions.
 */
const unwrap = (node: ESTree.Expression): ESTree.Expression => {
  if (
    node.type === 'ParenthesizedExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return unwrap(node.expression);
  }

  if (node.type === 'ChainExpression' && node.expression.type === 'MemberExpression') {
    return node.expression;
  }

  return node;
};

/**
 * Reads the property name of a member expression when it is static: `a.b`, `a['b']` or `` a[`b`]
 * ``. Returns `null` for computed keys that depend on runtime values.
 */
const getStaticPropertyName = (node: ESTree.MemberExpression): string | null => {
  if (!node.computed) {
    return node.property.type === 'Identifier' ? node.property.name : null;
  }

  const key = node.property;
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }

  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? null;
  }

  return null;
};

/**
 * Resolves the right-hand side of `instanceof` to a static dotted path, or `null` when any part of
 * it is computed at runtime (a call, `this`, a dynamic key).
 */
const getConstructorPath = (node: ESTree.Expression): ConstructorPath | null => {
  const target = unwrap(node);
  if (target.type === 'Identifier') {
    return { segments: [target.name], root: target };
  }

  if (target.type !== 'MemberExpression') {
    return null;
  }

  const property = getStaticPropertyName(target);
  const owner = getConstructorPath(target.object);
  if (property === null || owner === null) {
    return null;
  }

  return { segments: [...owner.segments, property], root: owner.root };
};

/**
 * Drops leading global-object segments (`globalThis.window.Date` becomes `Date`), keeping at least
 * one segment.
 */
const stripGlobalObjects = (segments: ReadonlyArray<string>): ReadonlyArray<string> => {
  const [first, ...rest] = segments;
  if (first !== undefined && rest.length > 0 && GLOBAL_OBJECTS.has(first)) {
    return stripGlobalObjects(rest);
  }

  return segments;
};

/**
 * Returns `true` when a global-rooted path names a runtime class: a listed built-in, a DOM element
 * class, or a member of a built-in namespace such as `Intl`.
 */
const isBuiltInPath = (segments: ReadonlyArray<string>): boolean => {
  const [first, second, ...rest] = segments;
  if (first === undefined || rest.length > 0) {
    return false;
  }

  if (second === undefined) {
    return BUILT_IN_CLASSES.has(first) || DOM_ELEMENT_RE.test(first);
  }

  return BUILT_IN_NAMESPACES.has(first);
};

/**
 * Returns `true` when `identifier` is not bound by any declaration or import in the file, so it
 * refers to the runtime global. Walks the scope chain instead of relying on configured globals,
 * which differ between `env` settings.
 */
const isUnboundName = (sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean => {
  let scope: ReturnType<SourceCode['getScope']> | null = sourceCode.getScope(identifier);
  for (; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined && variable.defs.length > 0) {
      return false;
    }
  }

  return true;
};

/**
 * Reads the `allow` list of extra constructor paths from raw rule options.
 */
const readAllowList = (options: ReadonlyArray<unknown>): ReadonlySet<string> => {
  const raw = options[0];
  if (typeof raw !== 'object' || raw === null || !('allow' in raw) || !Array.isArray(raw.allow)) {
    return new Set();
  }

  return new Set(raw.allow.filter((name): name is string => typeof name === 'string'));
};

/**
 * Oxlint problem rule (`slop/no-instanceof`) reporting `instanceof` against classes that come from
 * packages or the codebase, such as Effect tagged errors, because class identity breaks when a
 * package is installed or bundled twice. Runtime built-ins (`Date`, `Map`, `Error`, DOM elements
 * and events, `Intl.*`) stay allowed, but only when no declaration or import in the file binds the
 * name: an imported `Buffer` or a local `class Node` is reported. The `allow` option exempts exact
 * dotted paths such as `CircuitBreaker.CircuitBreakerError`. Provides no autofix.
 */
export const noInstanceof = defineRule({
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noInstanceof:
        'Avoid `instanceof {{name}}`: class identity breaks when a package is installed or bundled twice. For Effect tagged errors your own code produced, use `Schema.is(ErrorClass)(value)` or `Predicate.isTagged(value, "Tag")`; both are structural checks, so decode untrusted input with `Schema.decodeUnknown` instead. For other classes, use a discriminant or a type guard.',
    },
  },
  create(context) {
    const allowed = readAllowList(context.options);

    return {
      BinaryExpression(node) {
        if (node.operator !== 'instanceof') {
          return;
        }

        const path = getConstructorPath(node.right);
        if (path === null) {
          context.report({ node, messageId: 'noInstanceof', data: { name: 'this value' } });
          return;
        }

        const isGlobal = isUnboundName(context.sourceCode, path.root);
        const segments = isGlobal ? stripGlobalObjects(path.segments) : path.segments;
        const name = segments.join('.');
        if ((isGlobal && isBuiltInPath(segments)) || allowed.has(name)) {
          return;
        }

        context.report({ node, messageId: 'noInstanceof', data: { name } });
      },
    };
  },
});
