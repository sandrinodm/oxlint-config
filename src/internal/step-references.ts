import type { ESTree } from 'vite-plus/lint/plugins';

/**
 * Node types that open a new function scope; references inside them run later, not in the statement
 * head, so the walk stops at them.
 */
const FUNCTION_LIKE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Type-only TypeScript nodes skipped by the walk because identifiers there are type references, not
 * runtime reads of a declared binding.
 */
const SKIPPED_TS_TYPES = new Set([
  'TSTypeAnnotation',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation',
  'TSTypeReference',
  'TSTypeQuery',
  'TSTypeLiteral',
  'TSTypeOperator',
  'TSFunctionType',
  'TSConstructorType',
  'TSIndexedAccessType',
  'TSMappedType',
  'TSConditionalType',
  'TSUnionType',
  'TSIntersectionType',
  'TSTupleType',
  'TSArrayType',
]);

/**
 * Any binding position that can introduce names: identifiers, defaults, rest elements and
 * array/object destructuring patterns.
 */
type BindingNode = ESTree.BindingPattern | ESTree.BindingRestElement;

/**
 * Recursively appends every name bound by `pattern` to `out`, walking defaults, rest elements and
 * nested destructuring.
 */
const collectBindingNames = (pattern: BindingNode, out: Array<string>): void => {
  if (pattern.type === 'Identifier') {
    out.push(pattern.name);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    collectBindingNames(pattern.left, out);
    return;
  }
  if (pattern.type === 'RestElement') {
    collectBindingNames(pattern.argument, out);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element !== null) {
        collectBindingNames(element, out);
      }
    }

    return;
  }

  for (const prop of pattern.properties) {
    if (prop.type === 'RestElement') {
      collectBindingNames(prop.argument, out);
    } else {
      collectBindingNames(prop.value, out);
    }
  }
};

/**
 * Returns the set of all names introduced by a variable declaration, across every declarator.
 */
const getDeclaredNames = (declaration: ESTree.VariableDeclaration): Set<string> => {
  const names: Array<string> = [];
  for (const item of declaration.declarations) {
    collectBindingNames(item.id, names);
  }

  return new Set(names);
};

/**
 * Returns the initializer expressions of a declaration's declarators, skipping uninitialized ones.
 */
const collectVariableInitNodes = (declaration: ESTree.VariableDeclaration): Array<ESTree.Node> => {
  const inits: Array<ESTree.Node> = [];
  for (const item of declaration.declarations) {
    if (item.init !== null) {
      inits.push(item.init);
    }
  }

  return inits;
};

/**
 * Returns the init, test and update expressions of a classic `for` loop; a declaration in `init`
 * contributes only its initializers.
 */
const getForStatementHeadNodes = (statement: ESTree.ForStatement): Array<ESTree.Node> => {
  const nodes: Array<ESTree.Node> = [];
  if (statement.init !== null) {
    if (statement.init.type === 'VariableDeclaration') {
      nodes.push(...collectVariableInitNodes(statement.init));
    } else {
      nodes.push(statement.init);
    }
  }

  if (statement.test !== null) {
    nodes.push(statement.test);
  }

  if (statement.update !== null) {
    nodes.push(statement.update);
  }

  return nodes;
};

/**
 * Returns the expressions evaluated immediately when `statement` runs (its test, discriminant,
 * argument or initializers), excluding nested bodies. Unsupported statements yield none.
 */
const getHeadNodes = (
  statement: ESTree.Statement | ESTree.ModuleDeclaration,
): Array<ESTree.Node> => {
  if (
    statement.type === 'IfStatement' ||
    statement.type === 'WhileStatement' ||
    statement.type === 'DoWhileStatement'
  ) {
    return [statement.test];
  }
  if (statement.type === 'ForOfStatement' || statement.type === 'ForInStatement') {
    return [statement.right];
  }
  if (statement.type === 'SwitchStatement') {
    return [statement.discriminant];
  }
  if (statement.type === 'ForStatement') {
    return getForStatementHeadNodes(statement);
  }
  if (statement.type === 'ReturnStatement') {
    return statement.argument !== null ? [statement.argument] : [];
  }
  if (statement.type === 'ThrowStatement') {
    return [statement.argument];
  }
  if (statement.type === 'ExpressionStatement') {
    return [statement.expression];
  }
  if (statement.type === 'VariableDeclaration') {
    return collectVariableInitNodes(statement);
  }

  return [];
};

/**
 * What an ESTree visitor key may point at: a single child, a list whose holes are `null` (e.g.
 * array-pattern elisions), or no child at all.
 */
type VisitorChild = ESTree.Node | ReadonlyArray<ESTree.Node | null> | null | undefined;

/**
 * Narrows a visitor-key value to an AST node by checking for a string `type` field, so arrays,
 * holes and absent children are skipped.
 */
const isAstNode = (value: VisitorChild): value is ESTree.Node =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';

/**
 * Checks whether `node` is a static property name (member access, object key or class member key)
 * rather than a variable reference.
 */
const isNonComputedPropertyKey = (node: ESTree.Node, parent: ESTree.Node): boolean => {
  if (parent.type === 'MemberExpression') {
    return !parent.computed && parent.property === node;
  }
  if (parent.type === 'Property') {
    return !parent.computed && !parent.shorthand && parent.key === node;
  }
  if (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') {
    return !parent.computed && parent.key === node;
  }

  return false;
};

/**
 * Checks whether an identifier under `parent` names something other than a variable read: a
 * property key, JSX attribute name, declarator target or statement label.
 */
const isNonReferenceIdentifier = (node: ESTree.Node, parent: ESTree.Node | null): boolean => {
  if (parent === null) {
    return false;
  }

  if (isNonComputedPropertyKey(node, parent)) {
    return true;
  }

  if (parent.type === 'JSXAttribute' && parent.name === node) {
    return true;
  }
  if (parent.type === 'VariableDeclarator' && parent.id === node) {
    return true;
  }

  return (
    (parent.type === 'LabeledStatement' ||
      parent.type === 'BreakStatement' ||
      parent.type === 'ContinueStatement') &&
    parent.label === node
  );
};

/**
 * Searches a single visitor-key value, which may be a node, an array of optional nodes or nothing,
 * for the first reference to one of `names`.
 */
const findReferenceInValue = (
  value: VisitorChild,
  parent: ESTree.Node,
  names: ReadonlySet<string>,
  visitorKeys: Readonly<Record<string, ReadonlyArray<string>>>,
): string | null => {
  if (isAstNode(value)) {
    return findFirstReference(value, parent, names, visitorKeys);
  }

  if (value === null || value === undefined) {
    return null;
  }

  for (const item of value) {
    if (!isAstNode(item)) {
      continue;
    }

    const found = findFirstReference(item, parent, names, visitorKeys);
    if (found !== null) {
      return found;
    }
  }

  return null;
};

/**
 * Narrows `node` so the property named by visitor key `key` can be read directly. Per the ESTree
 * visitor-key contract, that property holds a child node, a list of optional children, or nothing.
 */
const hasVisitorKey = <K extends string>(
  node: ESTree.Node,
  key: K,
): node is ESTree.Node & Readonly<Record<K, VisitorChild>> => key in node;

/**
 * Reads the child stored under a visitor key, or `undefined` when the node does not carry it.
 */
const readChildValue = (node: ESTree.Node, key: string): VisitorChild =>
  hasVisitorKey(node, key) ? node[key] : undefined;

/**
 * Depth-first search for the first identifier in `node` that reads one of `names`, in source order.
 * Does not descend into functions, meta properties, or type-only nodes.
 */
const findFirstReference = (
  node: ESTree.Node,
  parent: ESTree.Node | null,
  names: ReadonlySet<string>,
  visitorKeys: Readonly<Record<string, ReadonlyArray<string>>>,
): string | null => {
  if (node.type === 'Identifier') {
    return !isNonReferenceIdentifier(node, parent) && names.has(node.name) ? node.name : null;
  }

  if (
    node.type === 'MetaProperty' ||
    FUNCTION_LIKE_TYPES.has(node.type) ||
    SKIPPED_TS_TYPES.has(node.type)
  ) {
    return null;
  }

  const keys = visitorKeys[node.type];
  if (keys === undefined) {
    return null;
  }

  for (const key of keys) {
    const found = findReferenceInValue(readChildValue(node, key), node, names, visitorKeys);
    if (found !== null) {
      return found;
    }
  }

  return null;
};

/**
 * Returns the first name declared by `declaration` that is read in the head of `statement`, or
 * `null` when none is. Used to flag a blank line that splits a declaration from the statement
 * consuming it.
 */
export const findUsedDeclaredName = (
  declaration: ESTree.VariableDeclaration,
  statement: ESTree.Statement | ESTree.ModuleDeclaration,
  visitorKeys: Readonly<Record<string, ReadonlyArray<string>>>,
): string | null => {
  const names = getDeclaredNames(declaration);
  if (names.size === 0) {
    return null;
  }

  for (const headNode of getHeadNodes(statement)) {
    const found = findFirstReference(headNode, statement, names, visitorKeys);
    if (found !== null) {
      return found;
    }
  }

  return null;
};

/**
 * Checks whether any later declaration's initializers read a name declared by `declaration`.
 */
export const isReadByLaterDeclarations = (
  declaration: ESTree.VariableDeclaration,
  later: ReadonlyArray<ESTree.VariableDeclaration>,
  visitorKeys: Readonly<Record<string, ReadonlyArray<string>>>,
): boolean => {
  for (const laterDecl of later) {
    if (findUsedDeclaredName(declaration, laterDecl, visitorKeys) !== null) {
      return true;
    }
  }

  return false;
};
