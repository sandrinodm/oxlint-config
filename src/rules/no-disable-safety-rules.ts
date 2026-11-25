import { defineRule } from 'vite-plus/lint/plugins';

/**
 * Type-safety and test-integrity rule names (or prefixes such as `no-unsafe-`) that may not be
 * suppressed via inline `oxlint-disable` or `eslint-disable` comments.
 */
const PROTECTED_SAFETY_RULES = [
  'no-explicit-any',
  'no-unsafe-',
  'no-non-null-assertion',
  'no-floating-promises',
  'no-chained-type-assertions',
  'no-disable-safety-rules',
  'no-fixed-sleep-in-tests',
  'no-test-doubles',
];

/**
 * Oxlint problem rule (`slop/no-disable-safety-rules`) inspecting every comment on `Program` and
 * reporting `oxlint-disable*` or `eslint-disable*` directives that mention any rule or prefix in
 * `PROTECTED_SAFETY_RULES`. Provides no autofix.
 */
export const noDisableSafetyRules = defineRule({
  meta: {
    type: 'problem',
    messages: {
      banned:
        'Do not silence "{{rule}}" via inline disable comments. Fix the underlying type, Schema boundary, or Effect Layer instead.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value.trim();
          if (!/^(?:oxlint|eslint)-disable/.test(text)) {
            continue;
          }

          for (const protectedRule of PROTECTED_SAFETY_RULES) {
            if (text.includes(protectedRule)) {
              context.report({
                loc: comment.loc,
                messageId: 'banned',
                data: { rule: protectedRule },
              });
            }
          }
        }
      },
    };
  },
});
