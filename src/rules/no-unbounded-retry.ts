import type { ESTree, SourceCode } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import { getEffectMemberName } from '../internal/effect-imports.ts';

/**
 * `Schedule` constructors that recur forever on their own.
 */
const UNBOUNDED_SCHEDULES: ReadonlySet<string> = new Set([
  'forever',
  'exponential',
  'spaced',
  'fixed',
  'fibonacci',
  'windowed',
  'cron',
]);

/**
 * `Schedule` functions that put an upper bound on the number of recurrences or the elapsed time.
 */
const BOUNDING_SCHEDULES: ReadonlySet<string> = new Set(['recurs', 'during', 'upTo', 'once']);

/**
 * Schedule combinators that can recur as long as one of their branches does.
 */
const BRANCHING_SCHEDULES: ReadonlySet<string> = new Set([
  'min',
  'union',
  'concat',
  'concatResult',
]);

/**
 * Retry option keys that stop retrying on their own.
 */
const BOUNDING_OPTIONS: ReadonlySet<string> = new Set(['times', 'until', 'while']);

/**
 * Collects the `Schedule.<name>` members referenced anywhere inside `node`.
 */
const collectScheduleMembers = (sourceCode: SourceCode, node: ESTree.Node): Set<string> => {
  const found = new Set<string>();
  const pending: Array<ESTree.Node> = [node];
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    const member = getEffectMemberName(sourceCode, current, 'Schedule');
    if (member !== null) {
      found.add(member);
    }

    if (
      current.type === 'CallExpression' &&
      BRANCHING_SCHEDULES.has(getEffectMemberName(sourceCode, current.callee, 'Schedule') ?? '')
    ) {
      const branches = current.arguments.flatMap((arg) =>
        arg.type === 'ArrayExpression' ? arg.elements : [arg],
      );
      if (branches.some((branch) => branch !== null && isUnboundedPolicy(sourceCode, branch))) {
        found.add('forever');
      }

      continue;
    }

    for (const key of sourceCode.visitorKeys[current.type] ?? []) {
      const child: unknown = Object.getOwnPropertyDescriptor(current, key)?.value;
      pending.push(...(Array.isArray(child) ? child : [child]).filter(isNode));
    }
  }

  return found;
};

/**
 * Narrows an AST child value to a node.
 */
const isNode = (value: unknown): value is ESTree.Node =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';

/**
 * Returns the static key name of an object property, or `null` for computed and spread entries.
 */
const getPropertyName = (property: ESTree.Node): string | null => {
  if (property.type !== 'Property' || property.computed) {
    return null;
  }

  return property.key.type === 'Identifier' ? property.key.name : null;
};

/**
 * Returns `true` when a retry policy is known to recur forever: it references an unbounded
 * `Schedule` constructor and no bounding function, or it is an options object without `times`,
 * `until` or `while` whose `schedule` is unbounded or omitted. Policies held in variables are not
 * judged.
 */
const isUnboundedPolicy = (sourceCode: SourceCode, policy: ESTree.Node): boolean => {
  if (policy.type === 'ObjectExpression') {
    const keys = policy.properties.map((property) => getPropertyName(property));
    if (keys.some((key) => key !== null && BOUNDING_OPTIONS.has(key))) {
      return false;
    }

    const schedule = policy.properties.find((property) => getPropertyName(property) === 'schedule');
    if (schedule === undefined) {
      // Effect defaults to an unbounded schedule when the options have no policy of their own.
      return keys.every((key) => key !== null);
    }

    return schedule.type === 'Property' && isUnboundedPolicy(sourceCode, schedule.value);
  }

  const members = collectScheduleMembers(sourceCode, policy);
  const unbounded = [...members].some((member) => UNBOUNDED_SCHEDULES.has(member));
  const bounded = [...members].some((member) => BOUNDING_SCHEDULES.has(member));
  return unbounded && !bounded;
};

/**
 * Oxlint problem rule (`slop/no-unbounded-retry`) reporting `Effect.retry` with a policy that never
 * stops, such as `Schedule.exponential('100 millis')` or `Schedule.forever` without
 * `Schedule.recurs`, `Schedule.during` or `Schedule.upTo`, or an options object without `times`,
 * `until` or `while`. A failure that never clears then retries forever and the caller never sees
 * it. Policies stored in variables are not checked. Provides no autofix.
 */
export const noUnboundedRetry = defineRule({
  meta: {
    type: 'problem',
    messages: {
      unbounded:
        'This retry policy never stops, so a persistent failure retries forever and never reaches the caller. Bound it with `Schedule.recurs`, `Schedule.during` or `Schedule.upTo`, or pass options such as `{ schedule: Schedule.exponential("100 millis"), times: 5 }`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (getEffectMemberName(context.sourceCode, node.callee, 'Effect') !== 'retry') {
          return;
        }

        const policy = node.arguments[1] ?? node.arguments[0];
        if (policy !== undefined && isUnboundedPolicy(context.sourceCode, policy)) {
          context.report({ node, messageId: 'unbounded' });
        }
      },
    };
  },
});
