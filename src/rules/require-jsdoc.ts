import type { Context, ESTree, Ranged, SourceCode } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import type { DocumentableDeclaration } from '../internal/require-jsdoc-declarations.ts';
import type { SchemaJsDocOptions } from '../internal/require-jsdoc-schemas.ts';

import {
  getDocumentableDeclaration,
  getNextSiblingDeclarationNode,
} from '../internal/require-jsdoc-declarations.ts';
import { createSchemaPropertyClassifier } from '../internal/require-jsdoc-schemas.ts';

/**
 * Declaration kinds that sit in a list of siblings and must be separated from the next documented
 * sibling by a blank line.
 */
const SPACED_MEMBER_KINDS = new Set([
  'PropertySignature',
  'MethodSignature',
  'PropertyDeclaration',
  'DrizzleSchemaProperty',
  'ZodSchemaProperty',
  'EffectSchemaProperty',
  'TopLevelConstDeclaration',
  'TopLevelConstPropertyAssignment',
  'TopLevelConstShorthandProperty',
]);

/**
 * Checks whether `comment` is a JSDoc block (opening with exactly two asterisks) that starts its
 * own line. Banner-style blocks with three or more asterisks and comments trailing code on the same
 * line do not count as JSDoc.
 */
const isStandaloneJsDocComment = (sourceCode: SourceCode, comment: ESTree.Comment): boolean => {
  if (
    comment.type !== 'Block' ||
    !comment.value.startsWith('*') ||
    comment.value.startsWith('**')
  ) {
    return false;
  }

  const line = sourceCode.lines[comment.loc.start.line - 1] ?? '';
  return line.slice(0, comment.loc.start.column).trim().length === 0;
};

/**
 * Returns the standalone JSDoc blocks directly preceding `node`.
 */
const getLeadingJsDocComments = (
  sourceCode: SourceCode,
  node: ESTree.Node,
): Array<ESTree.Comment> =>
  sourceCode
    .getCommentsBefore(node)
    .filter((comment) => isStandaloneJsDocComment(sourceCode, comment));

/**
 * Checks whether a comment spans more than one source line.
 */
const isMultilineComment = (comment: ESTree.Comment): boolean =>
  comment.loc.end.line > comment.loc.start.line;

/**
 * Finds where a missing blank line should be inserted after `target`: past a same-line `,` or `;`
 * and any same-line trailing comments. Returns that anchor and the 1-based line it ends on.
 */
const getSpacingInsertionPoint = (sourceCode: SourceCode, target: ESTree.Node) => {
  let anchor: ESTree.Node | ESTree.Token = target;
  let endLine = target.loc.end.line;

  const nextToken = sourceCode.getTokenAfter(target);
  if (
    nextToken !== null &&
    (nextToken.value === ',' || nextToken.value === ';') &&
    nextToken.loc.start.line === endLine
  ) {
    anchor = nextToken;
    endLine = nextToken.loc.end.line;
  }

  let insertAfter: Ranged = anchor;
  for (const comment of sourceCode.getCommentsAfter(anchor)) {
    if (comment.loc.start.line === endLine) {
      insertAfter = comment;
      endLine = comment.loc.end.line;
    } else {
      break;
    }
  }

  return { insertAfter, endLine };
};

/**
 * Reads the rule's optional settings object, treating anything other than a literal `true` as
 * disabled.
 */
const parseRuleOptions = (options: ReadonlyArray<unknown>): SchemaJsDocOptions => {
  const raw = options[0];
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }

  return {
    requireDrizzleJsDoc: 'requireDrizzleJsDoc' in raw && raw.requireDrizzleJsDoc === true,
    requireZodJsDoc: 'requireZodJsDoc' in raw && raw.requireZodJsDoc === true,
    requireEffectSchemaJsDoc:
      'requireEffectSchemaJsDoc' in raw && raw.requireEffectSchemaJsDoc === true,
  };
};

/**
 * Reports a documented member that is not followed by a blank line before the next documented
 * sibling, with a whitespace fix that inserts the missing line.
 */
const checkMemberSpacing = (context: Context, declaration: DocumentableDeclaration): void => {
  if (!SPACED_MEMBER_KINDS.has(declaration.kind)) {
    return;
  }

  const nextSibling = getNextSiblingDeclarationNode(declaration.jsDocTarget);
  if (nextSibling === null) {
    return;
  }

  const { sourceCode } = context;
  const nextJsDocComments = getLeadingJsDocComments(sourceCode, nextSibling);
  const firstNextJsDoc = nextJsDocComments.at(0);
  if (firstNextJsDoc === undefined) {
    return;
  }

  const anchor =
    declaration.kind === 'TopLevelConstDeclaration'
      ? declaration.jsDocTarget
      : declaration.reportTarget;
  const { insertAfter, endLine } = getSpacingInsertionPoint(sourceCode, anchor);
  const nextCommentStartLine = firstNextJsDoc.loc.start.line;
  if (nextCommentStartLine - endLine >= 2) {
    return;
  }

  const lineBreak = sourceCode.text.includes('\r\n') ? '\r\n' : '\n';
  const insertion = nextCommentStartLine === endLine ? `${lineBreak}${lineBreak}` : lineBreak;

  context.report({
    node: declaration.reportTarget,
    messageId: 'missingMemberSpacing',
    data: { kind: declaration.kind, name: declaration.name },
    fix(fixer) {
      return fixer.insertTextAfter(insertAfter, insertion);
    },
  });
};

/**
 * Applies the rule to one visited node: reports missing or single-line JSDoc on documentable
 * declarations and, when the JSDoc is valid, checks member spacing.
 */
const inspectDeclaration = (
  context: Context,
  node: ESTree.Node,
  classifySchemaProperty: (
    prop: ESTree.ObjectProperty,
  ) => ReturnType<ReturnType<typeof createSchemaPropertyClassifier>>,
): void => {
  const { sourceCode } = context;
  const candidate = getDocumentableDeclaration(node, sourceCode, classifySchemaProperty);
  if (candidate === null) {
    return;
  }

  const jsDocComments = getLeadingJsDocComments(sourceCode, candidate.jsDocTarget);
  if (jsDocComments.length === 0) {
    context.report({
      node: candidate.reportTarget,
      messageId: 'missingJsDoc',
      data: { kind: candidate.kind, name: candidate.name },
    });
    return;
  }

  if (!jsDocComments.some(isMultilineComment)) {
    context.report({
      node: candidate.reportTarget,
      messageId: 'singleLineJsDoc',
      data: { kind: candidate.kind, name: candidate.name },
    });
    return;
  }

  checkMemberSpacing(context, candidate);
};

/**
 * Port of `sandrinodm/jsdoc-lint` requiring multiline JSDoc on declarations, members, and schemas.
 */
export const requireJsDoc = defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: {
          requireDrizzleJsDoc: { type: 'boolean' },
          requireZodJsDoc: { type: 'boolean' },
          requireEffectSchemaJsDoc: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingJsDoc:
        'Missing multiline JSDoc comment on {{kind}} "{{name}}". Add a concise multiline `/** ... */` block explaining its intent, constraints, or contract.',
      singleLineJsDoc:
        'JSDoc comment on {{kind}} "{{name}}" must be multiline (`/**\\n * ...\\n */`), not a single-line block.',
      missingMemberSpacing:
        'Add a blank line after documented {{kind}} "{{name}}" before the next documented member.',
    },
  },
  create(context) {
    const options = parseRuleOptions(context.options);
    let classifySchemaProperty = createSchemaPropertyClassifier(context.sourceCode.ast, options);

    /**
     * Shared visitor that inspects each candidate node with the current file's schema classifier.
     */
    const check = (node: ESTree.Node): void => {
      inspectDeclaration(context, node, classifySchemaProperty);
    };
    return {
      Program(node) {
        classifySchemaProperty = createSchemaPropertyClassifier(node, options);
      },
      ClassDeclaration: check,
      TSInterfaceDeclaration: check,
      TSTypeAliasDeclaration: check,
      FunctionDeclaration: check,
      MethodDefinition: check,
      PropertyDefinition: check,
      TSPropertySignature: check,
      TSMethodSignature: check,
      VariableDeclaration: check,
      VariableDeclarator: check,
      Property: check,
    };
  },
});
