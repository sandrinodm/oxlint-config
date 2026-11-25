import { defineRule } from 'vite-plus/lint/plugins';

import { getConsoleMethodName, hasAncestorEffectGenerator } from '../internal/effect-generator.ts';

/**
 * Oxlint problem rule (`slop/no-console-in-effect-gen`) reporting any `console.*()`
 * `CallExpression` nested anywhere inside an `Effect.gen`, `Effect.fn`, or `Effect.fnUntraced`
 * generator (including nested closures) to require structured `Effect.log*` or Effect `Console.*`.
 * Provides no autofix.
 */
export const noConsoleInEffectGen = defineRule({
  meta: {
    type: 'problem',
    messages: {
      noConsole:
        'Do not call `console.{{method}}()` inside `Effect.gen` / `Effect.fn`. Use `Effect.log*` for structured logging, or Effect `Console.{{method}}` for CLI stdout.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const method = getConsoleMethodName(node.callee);
        if (method !== null && hasAncestorEffectGenerator(node)) {
          context.report({
            node,
            messageId: 'noConsole',
            data: { method },
          });
        }
      },
    };
  },
});
