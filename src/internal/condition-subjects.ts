import type { ESTree } from 'vite-plus/lint/plugins';

/**
 * Global sentinel identifiers excluded from condition-subject extraction so comparisons against
 * `undefined`, `NaN`, or `Infinity` do not falsely link unrelated `if` statements.
 */
const NON_SUBJECT_IDENTIFIERS = new Set(['undefined', 'NaN', 'Infinity']);

/**
 * Matches uppercase-initial identifiers (types, namespaces, constructors, and constant tables) that
 * are excluded as standalone condition subjects.
 */
const NON_SUBJECT_NAME_RE = /^[A-Z]/;

/**
 * Trailing collection-cardinality property names stripped during member-path normalization so
 * `list.length` and `list` map to the same subject.
 */
const COLLECTION_SIZE_PROPS = new Set(['length', 'size']);

/**
 * Returns `true` when `name` represents a candidate domain value rather than a sentinel in
 * `NON_SUBJECT_IDENTIFIERS` or an uppercase-initial symbol.
 */
const isSubjectIdentifier = (name: string): boolean =>
  !NON_SUBJECT_IDENTIFIERS.has(name) && !NON_SUBJECT_NAME_RE.test(name);

/**
 * Recursively strips optional-chaining, parenthesized, and TypeScript assertion/instantiation
 * wrapper nodes to expose the inner expression.
 */
const unwrapExpression = (expr: ESTree.Expression): ESTree.Expression => {
  if (
    expr.type === 'ChainExpression' ||
    expr.type === 'ParenthesizedExpression' ||
    expr.type === 'TSAsExpression' ||
    expr.type === 'TSSatisfiesExpression' ||
    expr.type === 'TSTypeAssertion' ||
    expr.type === 'TSNonNullExpression' ||
    expr.type === 'TSInstantiationExpression'
  ) {
    return unwrapExpression(expr.expression);
  }

  return expr;
};

/**
 * Extracts a canonical path segment for a `MemberExpression` property (identifier name or
 * `[literal]` for string/number computed literals), or returns `null` for dynamic computed keys and
 * private identifiers.
 */
const getStaticPropertyKey = (node: ESTree.MemberExpression): string | null => {
  if (!node.computed) {
    return node.property.type === 'Identifier' ? node.property.name : null;
  }

  if (
    node.property.type === 'Literal' &&
    (typeof node.property.value === 'string' || typeof node.property.value === 'number')
  ) {
    return `[${String(node.property.value)}]`;
  }

  return null;
};

/**
 * Walks down a member-expression chain to its root object and returns `true` when that root is a
 * non-subject identifier (such as `Array` or `Object`), signaling that call arguments rather than
 * the receiver carry the subject.
 */
const isNonSubjectCalleeObject = (expr: ESTree.Expression): boolean => {
  let current = unwrapExpression(expr);
  while (current.type === 'MemberExpression') {
    current = unwrapExpression(current.object);
  }

  return current.type === 'Identifier' && !isSubjectIdentifier(current.name);
};

/**
 * Normalizes a static member-access chain rooted at a subject identifier or `this` into a dotted
 * subject key (dropping trailing `length`/`size` segments) and inserts it into `out`. Falls back to
 * recursive extraction for dynamic keys or non-identifier roots, and ignores chains rooted at
 * non-subject names.
 */
const collectMemberSubjects = (node: ESTree.MemberExpression, out: Set<string>): void => {
  const parts: Array<string> = [];
  let current: ESTree.Expression = node;
  while (current.type === 'MemberExpression') {
    const propKey = getStaticPropertyKey(current);
    if (propKey === null) {
      collectExpressionSubjects(current.object, out);
      if (current.computed) {
        collectExpressionSubjects(current.property, out);
      }

      return;
    }

    parts.push(propKey);
    current = unwrapExpression(current.object);
  }

  if (current.type === 'Identifier') {
    if (!isSubjectIdentifier(current.name)) {
      return;
    }

    parts.push(current.name);
  } else if (current.type === 'ThisExpression') {
    parts.push('this');
  } else {
    collectExpressionSubjects(current, out);
    return;
  }

  parts.reverse();
  const lastPart = parts.at(-1);
  const normalizedParts =
    parts.length > 1 && lastPart !== undefined && COLLECTION_SIZE_PROPS.has(lastPart)
      ? parts.slice(0, -1)
      : parts;
  out.add(normalizedParts.join('.'));
};

/**
 * Extracts condition subjects from a `CallExpression` into `out`: records the receiver for instance
 * method calls on subject values, or records every call argument (unwrapping spread elements) for
 * free functions and static helpers.
 */
const collectCallSubjects = (node: ESTree.CallExpression, out: Set<string>): void => {
  const callee = unwrapExpression(node.callee);
  if (callee.type === 'MemberExpression' && !isNonSubjectCalleeObject(callee.object)) {
    collectExpressionSubjects(callee.object, out);
    return;
  }

  for (const arg of node.arguments) {
    if (arg.type === 'SpreadElement') {
      collectExpressionSubjects(arg.argument, out);
    } else {
      collectExpressionSubjects(arg, out);
    }
  }
};

/**
 * Recursively traverses a condition expression and inserts normalized subject keys into `out`
 * across identifiers, unary/await, logical, binary (skipping `PrivateIdentifier` operands),
 * conditional, member, and call expressions.
 */
const collectExpressionSubjects = (expr: ESTree.Expression, out: Set<string>): void => {
  const node = unwrapExpression(expr);
  if (node.type === 'Identifier') {
    if (isSubjectIdentifier(node.name)) {
      out.add(node.name);
    }

    return;
  }
  if (node.type === 'UnaryExpression' || node.type === 'AwaitExpression') {
    collectExpressionSubjects(node.argument, out);
    return;
  }
  if (node.type === 'LogicalExpression') {
    collectExpressionSubjects(node.left, out);
    collectExpressionSubjects(node.right, out);
    return;
  }
  if (node.type === 'BinaryExpression') {
    if (node.left.type !== 'PrivateIdentifier') {
      collectExpressionSubjects(node.left, out);
    }

    collectExpressionSubjects(node.right, out);
    return;
  }
  if (node.type === 'ConditionalExpression') {
    collectExpressionSubjects(node.test, out);
    collectExpressionSubjects(node.consequent, out);
    collectExpressionSubjects(node.alternate, out);
    return;
  }
  if (node.type === 'MemberExpression') {
    collectMemberSubjects(node, out);
    return;
  }
  if (node.type === 'CallExpression') {
    collectCallSubjects(node, out);
  }
};

/**
 * Returns `true` when two consecutive `IfStatement` nodes test at least one common normalized
 * subject and `first` has no `else`/`else if` alternate, allowing `slop/blank-line-after-if` to
 * keep related guards grouped.
 */
export const hasSharedConditionSubject = (
  first: ESTree.IfStatement,
  second: ESTree.IfStatement,
): boolean => {
  if (first.alternate !== null) {
    return false;
  }

  const firstSubjects = new Set<string>();
  const secondSubjects = new Set<string>();
  collectExpressionSubjects(first.test, firstSubjects);
  collectExpressionSubjects(second.test, secondSubjects);

  for (const subject of firstSubjects) {
    if (secondSubjects.has(subject)) {
      return true;
    }
  }

  return false;
};
