import { defineRule } from 'vite-plus/lint/plugins';

import { getInspectableCommentBody } from '../internal/comment-body.ts';

/**
 * Strips leading indentation and the optional leading asterisk prefix from each line of a multiline
 * block comment prior to banner matching.
 */
const DOC_LINE_PREFIX_RE = /^\s*\*\s?/;

/**
 * Matches decorative ASCII or box-drawing divider lines and editor folding directives at the start
 * or end of a normalized comment line.
 */
const BANNER_COMMENT_RE =
  /^\s*(?:[-=*#~_+/]{3,}|[─━═▬■]{2,}|#?region\b|#?endregion\b|.*\s(?:[-=*#~_]{4,}|[─━═]{2,})\s*$)/i;

/**
 * Oxlint suggestion rule (`slop/no-banner-comments`) inspecting every non-exempt comment on
 * `Program` and reporting lines matching `BANNER_COMMENT_RE` (decorative dividers or editor folding
 * markers). Does not provide an autofix.
 */
export const noBannerComments = defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      banner:
        'Avoid banner, separator, or region comments. Split the module into smaller focused files or helper functions instead.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const body = getInspectableCommentBody(context, comment);
          if (body === null) {
            continue;
          }

          const lines = body.split(/\r?\n/).map((line) => line.replace(DOC_LINE_PREFIX_RE, ''));
          if (lines.some((line) => BANNER_COMMENT_RE.test(line))) {
            context.report({ loc: comment.loc, messageId: 'banner' });
          }
        }
      },
    };
  },
});
