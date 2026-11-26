import type { Context, ESTree } from 'vite-plus/lint/plugins';

/**
 * Strips leading line or block comment openers and trailing block closers from raw comment text
 * before content inspection.
 */
const COMMENT_DELIMITERS_RE = /^\/\/+|^\/\*+|\*+\/$/g;

/**
 * Matches TypeScript compiler pragmas and linter or formatter suppression directives so
 * tool-control comments are exempt from comment-hygiene checks.
 */
const TOOL_DIRECTIVE_RE =
  /^(?:(?:\/\/+|\/\*+)\s*(?:@ts-\w+|(?:eslint|oxlint)-(?:disable(?:-next-line|-line)?|enable|env)|(?:prettier|biome)-ignore)|\/\*+\s*(?:eslint|oxlint)(?=\s|\*\/))\b/;

/**
 * Matches a deprecation tag at the start of a JSDoc line.
 */
const DEPRECATED_TAG_RE = /^(?:\/\*\*|\s*\*)[ \t]*@deprecated\b/m;

/**
 * Extracts the delimiter-stripped body of `comment`, returning `null` for shebangs, `@deprecated`
 * annotations, and directives matching `TOOL_DIRECTIVE_RE`.
 */
export const getInspectableCommentBody = (
  context: Context,
  comment: ESTree.Comment,
): string | null => {
  if (comment.type === 'Shebang') {
    return null;
  }

  const raw = context.sourceCode.getText(comment);
  if (TOOL_DIRECTIVE_RE.test(raw) || (raw.startsWith('/**') && DEPRECATED_TAG_RE.test(raw))) {
    return null;
  }

  return raw.replaceAll(COMMENT_DELIMITERS_RE, '');
};
