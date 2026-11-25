import { defineRule } from 'vite-plus/lint/plugins';

/**
 * Oxlint problem rule (`slop/no-chained-type-assertions`) reporting `TSAsExpression` nodes whose
 * inner expression is another `TSAsExpression` or `TSTypeAssertion` (such as `x as unknown as T`).
 * Exempts outer `as const` assertions; provides no autofix.
 */
export const noChainedTypeAssertions = defineRule({
  meta: {
    type: 'problem',
    messages: {
      chained:
        'Chained type assertion (`as ... as ...`) fabricates type evidence. Decode untrusted data with Effect `Schema.decodeUnknown` or narrow with a real type guard instead.',
    },
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (
          node.typeAnnotation.type === 'TSTypeReference' &&
          node.typeAnnotation.typeName.type === 'Identifier' &&
          node.typeAnnotation.typeName.name === 'const'
        ) {
          return;
        }

        if (
          node.expression.type === 'TSAsExpression' ||
          node.expression.type === 'TSTypeAssertion'
        ) {
          context.report({ node, messageId: 'chained' });
        }
      },
    };
  },
});
