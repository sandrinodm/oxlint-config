import { defineRule } from 'vite-plus/lint/plugins';

import { getEffectMemberName } from '../internal/effect-imports.ts';

/**
 * `Effect` functions that execute an effect and leave the Effect world.
 */
const RUN_FUNCTIONS: ReadonlySet<string> = new Set([
  'runPromise',
  'runPromiseExit',
  'runSync',
  'runSyncExit',
  'runFork',
  'runCallback',
]);

/**
 * Oxlint problem rule (`slop/no-effect-run-outside-entry`) reporting `Effect.run*` and
 * `ManagedRuntime.make` anywhere they appear, called or passed as a value. Effects should be
 * composed with `yield*` and run once at the program's edge, with `NodeRuntime.runMain` or
 * `BunRuntime.runMain` in entrypoints, `ManagedRuntime` in framework adapters and `it.effect` from
 * `@effect/vitest` in tests. The preset turns the rule off for common entrypoint paths (`main.*`,
 * `bin/`, `scripts/`); add an override for framework adapters. Provides no autofix.
 */
export const noEffectRunOutsideEntry = defineRule({
  meta: {
    type: 'problem',
    messages: {
      run: 'Do not run effects with `Effect.{{name}}` here. Compose with `yield*` and run once at the edge: `NodeRuntime.runMain`/`BunRuntime.runMain` in entrypoints, `it.effect` in tests. If this file is an entrypoint or framework adapter, turn the rule off for it in your config.',
      runtime:
        'Create a `ManagedRuntime` only where Effect meets a framework (an adapter module), not in domain code. If this file is such an adapter, turn the rule off for it in your config.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const runName = getEffectMemberName(context.sourceCode, node, 'Effect');
        if (runName !== null && RUN_FUNCTIONS.has(runName)) {
          context.report({ node, messageId: 'run', data: { name: runName } });
          return;
        }

        if (getEffectMemberName(context.sourceCode, node, 'ManagedRuntime') === 'make') {
          context.report({ node, messageId: 'runtime' });
        }
      },
    };
  },
});
