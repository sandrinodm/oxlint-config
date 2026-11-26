import { defineRule } from 'vite-plus/lint/plugins';

import { getInspectableCommentBody } from '../internal/comment-body.ts';

/**
 * Strips leading indentation and the optional leading asterisk prefix from each line of a multiline
 * block comment prior to banner matching.
 */
const DOC_LINE_PREFIX_RE = /^\s*\*\s?/;

/**
 * Matches decorative ASCII or box-drawing dividers at the start or end of a comment line.
 */
const BANNER_COMMENT_RE =
  /^\s*(?:(?!\*\*\/)[-=*#~_+/]{3,}|[─━═▬■]{2,}|.*\s(?:[-=*#~_]{4,}|[─━═]{2,})\s*$)/i;

/**
 * Matches lowercase editor folding markers, with or without a leading hash.
 */
const FOLDING_MARKER_RE = /^\s*#?(?:end)?region\b(?!-)/;

/**
 * Oxlint suggestion rule (`slop/no-banner-comments`) inspecting every non-exempt comment on
 * `Program` and reporting decorative dividers or editor folding markers. Provides no autofix.
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

          const lines = body.split(/\r?\n/);
          const hasBanner = lines.some((line) => {
            const content = comment.type === 'Block' ? line.replace(DOC_LINE_PREFIX_RE, '') : line;
            return BANNER_COMMENT_RE.test(content) || FOLDING_MARKER_RE.test(content);
          });
          if (hasBanner) {
            context.report({ loc: comment.loc, messageId: 'banner' });
          }
        }
      },
    };
  },
});
