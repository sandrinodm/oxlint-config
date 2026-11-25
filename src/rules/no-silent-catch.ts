import type { ESTree, SourceCode } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import { getEffectMemberName } from '../internal/effect-imports.ts';

/**
 * `Effect` operators that recover from every failure of a kind, where a constant handler throws the
 * failure away. Selective operators (`catchTag`, `catchTags`, `catchIf`, `catchReason`) are left
 * out: recovering from one named error with a fallback is deliberate.
 */
const CATCH_ALL_OPERATORS: ReadonlySet<string> = new Set([
  'catch',
  'catchCause',
  'catchDefect',
  'catchAll',
  'catchAllCause',
  'catchAllDefect',
]);

/**
 * Returns the expression a handler evaluates to: the body of an expression arrow, or the argument
 * of a block whose only statement is `return …`. Returns `null` for anything longer, which signals
 * the handler does more than produce a value.
 */
const getHandlerResult = (handler: ESTree.Node): ESTree.Node | null => {
  if (handler.type !== 'ArrowFunctionExpression' && handler.type !== 'FunctionExpression') {
    return null;
  }

  const { body } = handler;
  if (body === null) {
    return null;
  }

  if (body.type !== 'BlockStatement') {
    return body;
  }

  const [statement, ...rest] = body.body;
  if (statement?.type !== 'ReturnStatement' || rest.length > 0) {
    return null;
  }

  return statement.argument;
};

/**
 * Returns `true` for values that carry no information about the failure: literals, `undefined`, and
 * empty or literal-only arrays and objects.
 */
const isConstantValue = (node: ESTree.Node): boolean => {
  if (node.type === 'Literal') {
    return true;
  }

  if (node.type === 'Identifier') {
    return node.name === 'undefined';
  }

  if (node.type === 'ArrayExpression') {
    return node.elements.length === 0;
  }

  return node.type === 'ObjectExpression' && node.properties.length === 0;
};

/**
 * Returns `true` when a handler result discards the failure: `Effect.void`, `Effect.succeedNone`,
 * or `Effect.succeed` with no argument or a constant one.
 */
const isSilentResult = (sourceCode: SourceCode, result: ESTree.Node): boolean => {
  const member = getEffectMemberName(sourceCode, result, 'Effect');
  if (member === 'void' || member === 'succeedNone') {
    return true;
  }

  if (result.type !== 'CallExpression') {
    return false;
  }

  if (getEffectMemberName(sourceCode, result.callee, 'Effect') !== 'succeed') {
    return false;
  }

  const [value] = result.arguments;
  return value === undefined || isConstantValue(value);
};

/**
 * Oxlint problem rule (`slop/no-silent-catch`) reporting catch-all recovery whose handler returns a
 * constant without looking at the failure, such as `Effect.catch(() => Effect.void)` or
 * `Effect.catchCause(() => Effect.succeed([]))`. The failure disappears without a log, metric or
 * typed fallback. Recover from specific errors with `catchTag`, log before recovering, or use
 * `Effect.ignore` to make discarding explicit. Provides no autofix.
 */
export const noSilentCatch = defineRule({
  meta: {
    type: 'problem',
    messages: {
      silent:
        '`Effect.{{name}}` with a constant handler discards every failure without a trace. Recover from specific errors with `catchTag`, log the failure before recovering, or use `Effect.ignore` if discarding is intended.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = getEffectMemberName(context.sourceCode, node.callee, 'Effect');
        if (name === null || !CATCH_ALL_OPERATORS.has(name)) {
          return;
        }

        const handler = node.arguments.at(-1);
        const result = handler === undefined ? null : getHandlerResult(handler);
        if (result !== null && isSilentResult(context.sourceCode, result)) {
          context.report({ node, messageId: 'silent', data: { name } });
        }
      },
    };
  },
});
