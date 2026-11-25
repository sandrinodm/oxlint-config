import { definePlugin } from 'vite-plus/lint/plugins';

import { blankLineAfterIf } from './rules/blank-line-after-if.ts';
import { kebabCaseImports } from './rules/kebab-case-imports.ts';
import { noBannerComments } from './rules/no-banner-comments.ts';
import { noChainedTypeAssertions } from './rules/no-chained-type-assertions.ts';
import { noConsoleInEffectGen } from './rules/no-console-in-effect-gen.ts';
import { noDisableSafetyRules } from './rules/no-disable-safety-rules.ts';
import { noFixedSleepInTests } from './rules/no-fixed-sleep-in-tests.ts';
import { noHistoryComments } from './rules/no-history-comments.ts';
import { noInstanceof } from './rules/no-instanceof.ts';
import { noRawJsonParse } from './rules/no-raw-json-parse.ts';
import { noTestsDirectory } from './rules/no-tests-directory.ts';
import { noThrowInEffectGen } from './rules/no-throw-in-effect-gen.ts';
import { requireJsDoc } from './rules/require-jsdoc.ts';

/**
 * Custom Oxlint plugin (`slop`) registering type-safety, Effect, layout, comment-hygiene, naming,
 * and JSDoc enforcement rules.
 */
export default definePlugin({
  meta: { name: 'slop' },
  rules: {
    'no-chained-type-assertions': noChainedTypeAssertions,
    'no-disable-safety-rules': noDisableSafetyRules,
    'no-raw-json-parse': noRawJsonParse,
    'no-instanceof': noInstanceof,
    'no-fixed-sleep-in-tests': noFixedSleepInTests,
    'kebab-case-imports': kebabCaseImports,
    'no-tests-directory': noTestsDirectory,
    'blank-line-after-if': blankLineAfterIf,
    'no-throw-in-effect-gen': noThrowInEffectGen,
    'no-console-in-effect-gen': noConsoleInEffectGen,
    'no-banner-comments': noBannerComments,
    'no-history-comments': noHistoryComments,
    'require-jsdoc': requireJsDoc,
  },
});
