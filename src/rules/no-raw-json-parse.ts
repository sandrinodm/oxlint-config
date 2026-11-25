import { defineRule } from 'vite-plus/lint/plugins';

/**
 * Oxlint problem rule (`slop/no-raw-json-parse`) reporting direct `JSON.parse(...)`
 * `CallExpression` nodes so untrusted JSON is decoded through Effect `Schema.fromJsonString`.
 * Provides no autofix.
 */
export const noRawJsonParse = defineRule({
  meta: {
    type: 'problem',
    messages: {
      useSchema:
        'Avoid raw `JSON.parse()` (returns `any`). Parse and validate with `Schema.decodeUnknown*(Schema.fromJsonString(MySchema))`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'JSON' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'parse'
        ) {
          context.report({ node, messageId: 'useSchema' });
        }
      },
    };
  },
});
