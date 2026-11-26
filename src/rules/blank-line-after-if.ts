import type { Context, ESTree, SourceCode } from 'vite-plus/lint/plugins';

import { defineRule } from 'vite-plus/lint/plugins';

import { hasSharedConditionSubject } from '../internal/condition-subjects.ts';
import { findUsedDeclaredName, isReadByLaterDeclarations } from '../internal/step-references.ts';

/**
 * Control-flow statement AST node types that require a separating blank line before a subsequent
 * statement, unless exempted as consecutive `if` guards sharing a condition subject.
 */
const CONTROL_BLOCK_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
]);

/**
 * Matches line directives whose effect depends on the line immediately after them.
 */
const NEXT_LINE_DIRECTIVE_RE =
  /^\s*(?:oxlint-disable-next-line|eslint-disable-next-line|@ts-expect-error|@ts-ignore)\b/;

/**
 * Returns `true` when `comment` is not a shebang and only whitespace precedes its starting column
 * on its first line.
 */
const isStandaloneComment = (sourceCode: SourceCode, comment: ESTree.Comment): boolean => {
  if (comment.type === 'Shebang') {
    return false;
  }

  const line = sourceCode.lines[comment.loc.start.line - 1] ?? '';
  return line.slice(0, comment.loc.start.column).trim().length === 0;
};

/**
 * Collects leading comments attached before `node` that begin on their own lines, excluding
 * shebangs and same-line trailing comments from earlier lines.
 */
const getStandaloneCommentsBefore = (
  sourceCode: SourceCode,
  node: ESTree.Node,
): Array<ESTree.Comment> =>
  sourceCode.getCommentsBefore(node).filter((comment) => isStandaloneComment(sourceCode, comment));

/**
 * Advances across trailing comments on `node`'s ending line and returns the final ranged node or
 * comment alongside its 1-based ending line number.
 */
const getTrailingCommentInfo = (sourceCode: SourceCode, node: ESTree.Node) => {
  let target: ESTree.Node | ESTree.Comment = node;
  let endLine = node.loc.end.line;

  for (const comment of sourceCode.getCommentsAfter(node)) {
    if (comment.loc.start.line === node.loc.end.line) {
      target = comment;
      endLine = comment.loc.end.line;
    } else {
      break;
    }
  }

  return { target, endLine };
};

/**
 * Checks whether at least one whitespace-only line exists strictly between 1-based `endLine` and
 * 1-based `nextStartLine`.
 */
const hasBlankLineBetween = (
  lines: ReadonlyArray<string>,
  endLine: number,
  nextStartLine: number,
): boolean => {
  for (let idx = endLine; idx <= nextStartLine - 2; idx += 1) {
    if ((lines[idx] ?? '').trim().length === 0) {
      return true;
    }
  }

  return false;
};

/**
 * Computes the half-open `[startOffset, endOffset)` character range covering blank lines strictly
 * between 1-based `afterLine` and `beforeLine`, or `null` when no blank line exists or any
 * intervening line contains non-whitespace.
 */
const getBlankLineRemovalRange = (
  sourceCode: SourceCode,
  afterLine: number,
  beforeLine: number,
): [number, number] | null => {
  if (beforeLine <= afterLine + 1) {
    return null;
  }

  for (let idx = afterLine; idx <= beforeLine - 2; idx += 1) {
    if ((sourceCode.lines[idx] ?? '').trim().length !== 0) {
      return null;
    }
  }

  const startOffset = sourceCode.lineStartIndices.at(afterLine);
  const endOffset = sourceCode.lineStartIndices.at(beforeLine - 1);
  if (startOffset === undefined || endOffset === undefined || startOffset >= endOffset) {
    return null;
  }

  return [startOffset, endOffset];
};

/**
 * Walks backwards from `endIndex` through contiguous `VariableDeclaration` statements with no blank
 * lines between them, returning the group in source order or an empty array if
 * `statements[endIndex]` is not a variable declaration.
 */
const collectDeclarationGroup = (
  sourceCode: SourceCode,
  statements: ReadonlyArray<ESTree.Statement | ESTree.ModuleDeclaration>,
  endIndex: number,
): Array<ESTree.VariableDeclaration> => {
  const last = statements[endIndex];
  if (last?.type !== 'VariableDeclaration') {
    return [];
  }

  const group: Array<ESTree.VariableDeclaration> = [last];

  for (let idx = endIndex - 1; idx >= 0; idx -= 1) {
    const candidate = statements[idx];
    if (candidate?.type !== 'VariableDeclaration') {
      break;
    }

    const { endLine } = getTrailingCommentInfo(sourceCode, candidate);
    if (hasBlankLineBetween(sourceCode.lines, endLine, (group[0] ?? last).loc.start.line)) {
      break;
    }

    group.unshift(candidate);
  }

  return group;
};

/**
 * Reports and autofixes blank lines separating the last standalone leading comment from
 * `statement`. At module scope, only detached JSDoc blocks after the first statement are flagged so
 * file-header comments remain exempt.
 */
const checkCommentGap = (
  context: Context,
  statement: ESTree.Statement | ESTree.ModuleDeclaration,
  standaloneComments: ReadonlyArray<ESTree.Comment>,
  options: { readonly isModule: boolean; readonly index: number },
): void => {
  const lastComment = standaloneComments.at(-1);
  if (lastComment === undefined) {
    return;
  }

  const isDetachedModuleDoc =
    options.index > 0 && lastComment.type === 'Block' && lastComment.value.startsWith('*');
  if (options.isModule && !isDetachedModuleDoc) {
    return;
  }

  const removalRange = getBlankLineRemovalRange(
    context.sourceCode,
    lastComment.loc.end.line,
    statement.loc.start.line,
  );
  if (removalRange === null) {
    return;
  }

  context.report({
    loc: lastComment.loc,
    messageId: 'commentGap',
    fix(fixer) {
      return fixer.removeRange(removalRange);
    },
  });
};

/**
 * Returns the object literal a `return` assembles from earlier bindings: `return { a, b }`, or one
 * wrapped in a single call such as `return Service.of({ a, b })`. Returns `null` otherwise.
 */
const getReturnedObject = (statement: ESTree.Node): ESTree.ObjectExpression | null => {
  if (statement.type !== 'ReturnStatement' || statement.argument === null) {
    return null;
  }

  const { argument } = statement;
  if (argument.type === 'ObjectExpression') {
    return argument;
  }
  if (argument.type !== 'CallExpression') {
    return null;
  }

  const objects = argument.arguments.filter((arg) => arg.type === 'ObjectExpression');
  return objects.length === 1 ? (objects[0] ?? null) : null;
};

/**
 * Returns `true` when `statement` only collects earlier bindings into an object of shorthand
 * properties, the closing step of a layer or service constructor (`return Repo.of({ find, save
 * })`). It gathers the steps above it rather than continuing the last one, so a blank line may
 * separate them.
 */
const isShorthandAssembly = (statement: ESTree.Node): boolean => {
  const object = getReturnedObject(statement);
  return (
    object !== null &&
    object.properties.length > 0 &&
    object.properties.every((property) => property.type === 'Property' && property.shorthand)
  );
};

/**
 * Reports and autofixes blank lines splitting a contiguous declaration group from the following
 * `statement` when `statement`'s head expression references a declared binding. For a following
 * `IfStatement`, every leaf declaration in `group` not read by a later declaration is checked;
 * otherwise only the last. A `return` that only assembles shorthand properties is exempt.
 */
const checkSplitStep = (
  context: Context,
  group: ReadonlyArray<ESTree.VariableDeclaration>,
  statement: ESTree.Statement | ESTree.ModuleDeclaration,
  firstNextLine: number,
): void => {
  const lastDecl = group.at(-1);
  if (lastDecl === undefined || isShorthandAssembly(statement)) {
    return;
  }

  const { endLine } = getTrailingCommentInfo(context.sourceCode, lastDecl);
  const removalRange = getBlankLineRemovalRange(context.sourceCode, endLine, firstNextLine);
  if (removalRange === null) {
    return;
  }

  const { visitorKeys } = context.sourceCode;
  const candidates =
    statement.type === 'IfStatement'
      ? group.filter(
          (decl, idx) => !isReadByLaterDeclarations(decl, group.slice(idx + 1), visitorKeys),
        )
      : [lastDecl];
  for (const decl of candidates) {
    const usedName = findUsedDeclaredName(decl, statement, visitorKeys);
    if (usedName !== null) {
      context.report({
        node: statement,
        messageId: 'splitStep',
        data: { name: usedName },
        fix(fixer) {
          return fixer.removeRange(removalRange);
        },
      });
      return;
    }
  }
};

/**
 * Reports and autofixes a missing blank line after a control-flow statement in
 * `CONTROL_BLOCK_TYPES` before `next` (or its leading standalone comments). Consecutive `if`
 * statements sharing a condition subject are exempt; autofix preserves CRLF/LF endings and inserts
 * after trailing comments. Next-line directives move with the statement they apply to.
 */
const checkBlankAfterBlock = (
  context: Context,
  curr: ESTree.Statement | ESTree.ModuleDeclaration,
  next: ESTree.Statement | ESTree.ModuleDeclaration,
  firstNextLine: number,
): void => {
  if (!CONTROL_BLOCK_TYPES.has(curr.type)) {
    return;
  }
  if (
    curr.type === 'IfStatement' &&
    next.type === 'IfStatement' &&
    hasSharedConditionSubject(curr, next)
  ) {
    return;
  }

  const { sourceCode } = context;
  const { target, endLine } = getTrailingCommentInfo(sourceCode, curr);
  if (hasBlankLineBetween(sourceCode.lines, endLine, firstNextLine)) {
    return;
  }

  const lineBreak = sourceCode.text.includes('\r\n') ? '\r\n' : '\n';
  const insertion = firstNextLine === endLine ? `${lineBreak}${lineBreak}` : lineBreak;

  context.report({
    node: curr,
    messageId: 'expectedBlankLine',
    fix(fixer) {
      if (target.type === 'Line' && NEXT_LINE_DIRECTIVE_RE.test(target.value)) {
        const { column, line } = target.loc.start;
        const prefix = (sourceCode.lines[line - 1] ?? '').slice(0, column);
        const start = target.range[0] - (prefix.length - prefix.trimEnd().length);
        const nextLine = sourceCode.lines[firstNextLine - 1] ?? '';
        const indent = nextLine.slice(0, nextLine.length - nextLine.trimStart().length);
        return fixer.replaceTextRange([start, target.range[0]], lineBreak.repeat(2) + indent);
      }

      return fixer.insertTextAfter(target, insertion);
    },
  });
};

/**
 * Validates vertical spacing across an ordered statement list, running comment attachment checks on
 * all statements, split-step checks on non-module lists, and post-control-block spacing checks on
 * consecutive statement pairs.
 */
const checkStatementList = (
  context: Context,
  statements: ReadonlyArray<ESTree.Statement | ESTree.ModuleDeclaration>,
  isModule: boolean,
): void => {
  const { sourceCode } = context;

  for (const [i, statement] of statements.entries()) {
    const standaloneComments = getStandaloneCommentsBefore(sourceCode, statement);
    const firstNextLine = standaloneComments[0]?.loc.start.line ?? statement.loc.start.line;

    checkCommentGap(context, statement, standaloneComments, { isModule, index: i });

    const previous = statements[i - 1];
    if (previous === undefined) {
      continue;
    }

    if (!isModule && previous.type === 'VariableDeclaration') {
      const group = collectDeclarationGroup(sourceCode, statements, i - 1);
      checkSplitStep(context, group, statement, firstNextLine);
    }

    checkBlankAfterBlock(context, previous, statement, firstNextLine);
  }
};

/**
 * Oxlint layout rule (`slop/blank-line-after-if`) inspecting `Program`, `BlockStatement`,
 * `SwitchCase`, `StaticBlock`, and `TSModuleBlock` lists. Requires a blank line after control
 * blocks (exempting consecutive `if` statements that test a shared subject), collapses blank lines
 * separating a variable declaration from its immediate head-expression use, and collapses blank
 * lines detaching comments from their following statement via whitespace autofixes.
 */
export const blankLineAfterIf = defineRule({
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    messages: {
      expectedBlankLine:
        'Add a blank line after this control block before the next statement (consecutive `if` statements checking the same value may stay grouped).',
      splitStep:
        'Remove the blank line between `{{name}}` and the statement directly below that uses it; keep a value and its immediate use together as one step.',
      commentGap:
        'Remove the blank line between this comment and the statement directly below it so the comment stays attached to its code.',
    },
  },
  create(context) {
    return {
      Program(node) {
        checkStatementList(context, node.body, true);
      },
      BlockStatement(node) {
        checkStatementList(context, node.body, false);
      },
      SwitchCase(node) {
        checkStatementList(context, node.consequent, false);
      },
      StaticBlock(node) {
        checkStatementList(context, node.body, false);
      },
      TSModuleBlock(node) {
        checkStatementList(context, node.body, false);
      },
    };
  },
});
