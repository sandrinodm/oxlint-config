import { defineRule } from 'vite-plus/lint/plugins';

/**
 * Oxlint problem rule (`slop/no-fixed-sleep-in-tests`) reporting `setTimeout(...)` and
 * `Bun.sleep(...)` `CallExpression` nodes so tests use Effect `TestClock` or event-driven
 * synchronization instead of wall-clock sleeps. Provides no autofix.
 */
export const noFixedSleepInTests = defineRule({
  meta: {
    type: 'problem',
    messages: {
      noSleep:
        'Avoid fixed real-time sleeps (`setTimeout` / `Bun.sleep`) in tests. Use Effect `TestClock.adjust` or event-driven assertions instead.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const isSetTimeout = node.callee.type === 'Identifier' && node.callee.name === 'setTimeout';
        const isBunSleep =
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Bun' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'sleep';
        if (isSetTimeout || isBunSleep) {
          context.report({ node, messageId: 'noSleep' });
        }
      },
    };
  },
});
