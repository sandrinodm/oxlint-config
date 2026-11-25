import type { ESTree } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

/**
 * Strips wrappers that do not change the spread value: parentheses and TypeScript `as`,
 * `satisfies`, `<T>` and `!` expressions.
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

  return node;
};

/**
 * Returns `true` for spread values that add nothing to an object: `{}`, `null`, `undefined`, `void
 * 0` and `false`.
 */
const isEmptySpreadValue = (node: ESTree.Expression): boolean => {
  const value = unwrap(node);
  if (value.type === 'ObjectExpression') {
    return value.properties.length === 0;
  }

  if (value.type === 'Literal') {
    return value.value === null || value.value === false;
  }

  if (value.type === 'Identifier') {
    return value.name === 'undefined';
  }

  return value.type === 'UnaryExpression' && value.operator === 'void';
};

/**
 * Returns `true` when `node` is an object literal with at least one property, the part of a
 * conditional spread that adds keys.
 */
const isObjectLiteral = (node: ESTree.Expression): boolean => {
  const value = unwrap(node);
  return value.type === 'ObjectExpression' && value.properties.length > 0;
};

/**
 * Returns `true` when a spread argument adds or omits keys depending on a condition: `cond ? { key
 * } : {}` (either order) or `cond && { key }`. Spreading an existing object with a fallback, such
 * as `cond ? existing : {}`, is not key omission and returns `false`.
 */
const isConditionalKeySpread = (node: ESTree.Expression): boolean => {
  const value = unwrap(node);
  if (value.type === 'ConditionalExpression') {
    return (
      (isObjectLiteral(value.consequent) && isEmptySpreadValue(value.alternate)) ||
      (isObjectLiteral(value.alternate) && isEmptySpreadValue(value.consequent))
    );
  }

  return (
    value.type === 'LogicalExpression' && value.operator === '&&' && isObjectLiteral(value.right)
  );
};

/**
 * Oxlint suggestion rule (`slop/no-conditional-spread`) reporting object spreads that add or omit
 * keys based on a condition, in both the `cond ? { key } : {}` and the `cond && { key }` form.
 * Which keys an object has should be visible in its literal. Pass optional values through a helper
 * that drops `undefined` keys, or build the object explicitly. Provides no autofix, because
 * omitting a key is not the same as setting it to `undefined`.
 */
export const noConditionalSpread = defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      conditionalSpread:
        'Conditional spreads hide which keys an object has. List the keys in the literal and drop `undefined` values with a helper (for example `omitUndefined({ key: value })`), or build the object with explicit statements.',
    },
  },
  create(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type === 'ObjectExpression' && isConditionalKeySpread(node.argument)) {
          context.report({ node, messageId: 'conditionalSpread' });
        }
      },
    };
  },
});
