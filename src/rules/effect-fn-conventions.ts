import type { ESTree } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import { getEffectMemberName } from '../internal/effect-imports.ts';

/**
 * Returns `true` for the function literal a generator builder takes as its body.
 */
const isFunctionLiteral = (node: ESTree.Node | undefined): boolean =>
  node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression';

/**
 * Reads the span name from `Effect.fn('name')`, or `null` when the first argument is not a string
 * literal.
 */
const getSpanName = (call: ESTree.CallExpression): string | null => {
  const [first] = call.arguments;
  return first?.type === 'Literal' && typeof first.value === 'string' ? first.value : null;
};

/**
 * Returns the name a function value is bound to: the variable in `const name = …`, or the key in `{
 * name: … }` and class fields. Returns `null` for anonymous positions such as call arguments.
 */
const getBindingName = (value: ESTree.Node): string | null => {
  const { parent } = value;
  if (parent === null) {
    return null;
  }

  if (parent.type === 'VariableDeclarator') {
    return parent.init === value && parent.id.type === 'Identifier' ? parent.id.name : null;
  }

  if (parent.type === 'Property') {
    return parent.value === value && !parent.computed && parent.key.type === 'Identifier'
      ? parent.key.name
      : null;
  }

  if (parent.type === 'PropertyDefinition') {
    return parent.value === value && !parent.computed && parent.key.type === 'Identifier'
      ? parent.key.name
      : null;
  }

  return null;
};

/**
 * Returns `true` when `value` is the object of a `.pipe` member access, as in `fn.pipe(...)`.
 */
const isPiped = (value: ESTree.Node): boolean => {
  const { parent } = value;
  return (
    parent !== null &&
    parent.type === 'MemberExpression' &&
    parent.object === value &&
    !parent.computed &&
    parent.property.type === 'Identifier' &&
    parent.property.name === 'pipe'
  );
};

/**
 * Reads the `matchName` option (default `true`) from raw rule options.
 */
const readMatchName = (options: ReadonlyArray<unknown>): boolean => {
  const raw = options[0];
  if (typeof raw !== 'object' || raw === null || !('matchName' in raw)) {
    return true;
  }

  return raw.matchName !== false;
};

/**
 * Oxlint problem rule (`slop/effect-fn-conventions`) enforcing the `Effect.fn` conventions from
 * Effect's own agent guide: `Effect.fn` takes a span name (use `Effect.fnUntraced` for untraced
 * functions), the name matches the binding (`const query = Effect.fn('query')` or
 * `Effect.fn('Database.query')`), and extra behaviour is passed as further arguments instead of
 * piping the function (`Effect.fn('f')(body, Effect.catch(...))`). Set `matchName: false` to allow
 * span names that differ from the binding. Provides no autofix.
 */
export const effectFnConventions = defineRule({
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          matchName: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unnamed:
        'Give `Effect.fn` a span name: `Effect.fn("name")(function* () { … })`. Use `Effect.fnUntraced` when the function should not create a span.',
      nameMismatch:
        'Span name "{{name}}" does not match "{{binding}}". Use "{{binding}}" or a qualified name such as "Service.{{binding}}" so traces point at the right function.',
      piped:
        'Do not pipe an `Effect.fn` function. Pass the combinators as extra arguments: `Effect.fn("name")(function* () { … }, Effect.catch(…))`.',
    },
  },
  create(context) {
    const matchName = readMatchName(context.options);

    /**
     * Applies the binding and `.pipe` checks to a finished `Effect.fn` / `Effect.fnUntraced`
     * function value.
     */
    const checkFunctionValue = (value: ESTree.CallExpression, spanName: string | null): void => {
      if (isPiped(value)) {
        context.report({ node: value, messageId: 'piped' });
      }

      const binding = getBindingName(value);
      if (
        matchName &&
        spanName !== null &&
        binding !== null &&
        spanName !== binding &&
        !spanName.endsWith(`.${binding}`)
      ) {
        context.report({
          node: value,
          messageId: 'nameMismatch',
          data: { name: spanName, binding },
        });
      }
    };

    return {
      CallExpression(node) {
        const member = getEffectMemberName(context.sourceCode, node.callee, 'Effect');
        if (member === 'fnUntraced') {
          checkFunctionValue(node, null);
          return;
        }

        if (member !== 'fn') {
          return;
        }

        if (isFunctionLiteral(node.arguments[0])) {
          context.report({ node, messageId: 'unnamed' });
          checkFunctionValue(node, null);
          return;
        }

        const { parent } = node;
        if (parent.type === 'CallExpression' && parent.callee === node) {
          checkFunctionValue(parent, getSpanName(node));
        }
      },
    };
  },
});
