import { defineRule } from 'vite-plus/lint/plugins';

import { getInspectableCommentBody } from '../internal/comment-body.ts';

/**
 * Regex source fragments matching temporal, roadmap, review, or change-log phrasing that describes
 * past edits rather than current behavior.
 */
const HISTORY_PHRASES = [
  String.raw`\b(?:phase|milestone)\s+\d+\b`,
  String.raw`\bstep\s+\d+\s+of\b`,
  String.raw`\bno longer\b`,
  String.raw`\bnow (?:uses|returns|we|calls)\b`,
  String.raw`\bthis (?:pr|refactor|commit)\b`,
  String.raw`\b(?:per|in|from|following) (?:the|our) plan\b`,
  String.raw`\bplan (?:step|item|phase)\b`,
  String.raw`\bas discussed\b`,
];

/**
 * Compiled case-insensitive alternation of `HISTORY_PHRASES` used to detect change-history and
 * planning prose inside comments.
 */
const HISTORY_COMMENT_RE = new RegExp(HISTORY_PHRASES.join('|'), 'i');

/**
 * Standard, protocol, encoding, and cryptographic prefixes exempted from hyphenated issue-key
 * matching so specification references remain allowed.
 */
const STANDARD_PREFIXES = [
  'UTF',
  'ISO',
  'SHA',
  'AES',
  'RFC',
  'HTTP',
  'TLS',
  'ES',
  'ECMA',
  'CVE',
  'RSA',
  'HS',
  'RS',
  'PS',
  'EC',
  'PEM',
  'DER',
  'IEEE',
  'ANSI',
  'UTC',
  'GMT',
];

/**
 * Matches uppercase hyphenated issue-tracker keys (2 to 10 uppercase alphanumeric characters
 * followed by a hyphen and 2+ digits) while excluding technical standard prefixes listed in
 * `STANDARD_PREFIXES`.
 */
const TICKET_ID_RE = new RegExp(
  String.raw`\b(?!(?:${STANDARD_PREFIXES.join('|')})-)[A-Z][A-Z0-9]{1,9}-\d{2,}\b`,
);

/**
 * Oxlint suggestion rule (`slop/no-history-comments`) inspecting every non-exempt comment on
 * `Program` and reporting temporal planning phrasing (`HISTORY_COMMENT_RE`) or issue-tracker keys
 * (`TICKET_ID_RE`). Exempts shebangs, `@deprecated` tags, tool directives, and `STANDARD_PREFIXES`;
 * does not provide an autofix.
 */
export const noHistoryComments = defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      history:
        'Avoid comments referencing plans, tickets, or code history ("{{match}}"). Describe what the code currently does and why instead.',
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

          const match = HISTORY_COMMENT_RE.exec(body) ?? TICKET_ID_RE.exec(body);
          if (match !== null) {
            context.report({
              loc: comment.loc,
              messageId: 'history',
              data: { match: match[0] },
            });
          }
        }
      },
    };
  },
});
