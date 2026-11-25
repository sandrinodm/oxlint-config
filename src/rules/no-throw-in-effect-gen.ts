import { defineRule } from 'vite-plus/lint/plugins';

import { isDirectlyInsideEffectGenerator } from '../internal/effect-generator.ts';

/**
 * Oxlint problem rule (`slop/no-throw-in-effect-gen`) reporting `ThrowStatement` nodes whose
 * immediate enclosing function is an `Effect.gen`, `Effect.fn`, or `Effect.fnUntraced` generator so
 * failures remain typed rather than untyped defects. Exempts throws inside nested non-generator
 * callbacks; provides no autofix.
 */
export const noThrowInEffectGen = defineRule({
  meta: {
    type: 'problem',
    messages: {
      noThrow:
        'Do not use `throw` inside `Effect.gen` / `Effect.fn` (throws become untyped defects). Return a typed failure with `return yield* new MyTaggedError(...)` or `return yield* Effect.fail(...)` instead.',
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        if (isDirectlyInsideEffectGenerator(context.sourceCode, node)) {
          context.report({ node, messageId: 'noThrow' });
        }
      },
    };
  },
});
