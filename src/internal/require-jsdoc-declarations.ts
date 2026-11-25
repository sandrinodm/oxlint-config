import type { ESTree, SourceCode } from 'vite-plus/lint/plugins';

import type { SchemaPropertyKind } from './require-jsdoc-schemas.ts';

/**
 * Normalized descriptor for an AST declaration that must carry multiline JSDoc.
 */
export interface DocumentableDeclaration {
  /**
   * Classification label matching `jsdoc-lint` diagnostic kinds.
   */
  readonly kind: string;

  /**
   * Human-readable declaration name used in diagnostics.
   */
  readonly name: string;

  /**
   * Node that owns the leading JSDoc block (including export wrappers when present).
   */
  readonly jsDocTarget: ESTree.Node;

  /**
   * Node where the diagnostic is reported.
   */
  readonly reportTarget: ESTree.Node;
}

/**
 * Transparent expression wrapper AST node types traversed when checking whether an object literal
 * directly initializes a top-level `const` binding.
 */
const EXPRESSION_WRAPPER_TYPES = new Set([
  'TSAsExpression',
  'ParenthesizedExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSNonNullExpression',
  'TSInstantiationExpression',
]);

/**
 * Callback classifying an object literal property into an enabled schema field kind
 * (`DrizzleSchemaProperty`, `ZodSchemaProperty`, `EffectSchemaProperty`), or `null` when it is not
 * a recognized schema member.
 */
type SchemaClassifier = (prop: ESTree.ObjectProperty) => SchemaPropertyKind | null;

/**
 * Builds a `DocumentableDeclaration` pairing diagnostic kind and display name with the separate
 * JSDoc-owner and report-target AST nodes.
 */
const createDescriptor = (
  kind: string,
  name: string,
  jsDocTarget: ESTree.Node,
  reportTarget: ESTree.Node,
): DocumentableDeclaration => ({
  kind,
  name,
  jsDocTarget,
  reportTarget,
});

/**
 * Returns the enclosing `ExportNamedDeclaration` or `ExportDefaultDeclaration` when `node` is its
 * direct declaration, or `node` itself otherwise, so JSDoc placed above an `export` keyword
 * resolves to the declaration.
 */
const getExportOrSelf = (node: ESTree.Node): ESTree.Node => {
  if (
    node.parent !== null &&
    (node.parent.type === 'ExportNamedDeclaration' ||
      node.parent.type === 'ExportDefaultDeclaration') &&
    node.parent.declaration === node
  ) {
    return node.parent;
  }

  return node;
};

/**
 * Returns `true` when `init` is an `ArrowFunctionExpression` or `FunctionExpression` (classified as
 * a function declarator rather than a plain top-level constant).
 */
const isFunctionLikeInit = (init: ESTree.Expression | null): boolean =>
  init !== null && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression');

/**
 * Returns `true` when `node` is a single-declarator `const` declaration placed directly in the
 * module `Program` body (exported or unexported).
 */
const isTopLevelConstDeclaration = (node: ESTree.VariableDeclaration): boolean => {
  if (node.kind !== 'const' || node.declarations.length !== 1) {
    return false;
  }

  const outer = getExportOrSelf(node);
  return outer.parent !== null && outer.parent.type === 'Program';
};

/**
 * Unwraps transparent expression wrappers around `objectLiteral` and returns `true` when it
 * directly initializes a top-level single-declarator `const`.
 */
const isTopLevelConstObjectLiteral = (objectLiteral: ESTree.ObjectExpression): boolean => {
  let current: ESTree.Node = objectLiteral;
  while (current.parent !== null && EXPRESSION_WRAPPER_TYPES.has(current.parent.type)) {
    current = current.parent;
  }

  if (current.parent === null || current.parent.type !== 'VariableDeclarator') {
    return false;
  }

  const varDecl = current.parent.parent;
  return varDecl.type === 'VariableDeclaration' && isTopLevelConstDeclaration(varDecl);
};

/**
 * Walks upward through callee chains (`CallExpression` and `TSInstantiationExpression`) to check
 * whether `start` forms the `superClass` heritage expression of a `ClassDeclaration`.
 */
const reachesClassSuperClass = (start: ESTree.Node): boolean => {
  let expr: ESTree.Node = start;
  while (expr.parent !== null) {
    const parent: ESTree.Node = expr.parent;
    if (parent.type === 'ClassDeclaration' && parent.superClass === expr) {
      return true;
    }
    if (parent.type === 'CallExpression' && parent.callee === expr) {
      expr = parent;
      continue;
    }
    if (parent.type === 'TSInstantiationExpression' && parent.expression === expr) {
      expr = parent;
      continue;
    }

    return false;
  }

  return false;
};

/**
 * Returns `true` when `typeLiteral` is a generic type argument supplied to a `ClassDeclaration`'s
 * `extends` clause (directly on `superTypeArguments` or on a curried/instantiated superclass
 * factory such as `Data.TaggedError`).
 */
const isClassExtendsTypeArgument = (typeLiteral: ESTree.TSTypeLiteral): boolean => {
  if (typeLiteral.parent.type !== 'TSTypeParameterInstantiation') {
    return false;
  }

  const instantiation = typeLiteral.parent;
  const owner = instantiation.parent;
  if (owner.type === 'ClassDeclaration' && owner.superTypeArguments === instantiation) {
    return true;
  }
  if (
    (owner.type === 'CallExpression' || owner.type === 'TSInstantiationExpression') &&
    owner.typeArguments === instantiation
  ) {
    return reachesClassSuperClass(owner);
  }

  return false;
};

/**
 * Returns `true` when a property or method signature belongs to an interface body, a top-level type
 * alias literal, or a class `extends` type-literal argument (exempting inline parameter and
 * return-type object literals).
 */
const isDocumentableTypeMember = (parent: ESTree.Node): boolean => {
  if (parent.type === 'TSInterfaceBody') {
    return true;
  }
  if (parent.type !== 'TSTypeLiteral') {
    return false;
  }

  return parent.parent.type === 'TSTypeAliasDeclaration' || isClassExtendsTypeArgument(parent);
};

/**
 * Returns the exact source text of `node` for diagnostic declaration names.
 */
const getNodeText = (sourceCode: SourceCode, node: ESTree.Node): string => sourceCode.getText(node);

/**
 * Classifies `ClassBody` methods and accessors into `MethodDeclaration`, `GetAccessor`, or
 * `SetAccessor`, exempting `constructor` definitions and non-class parents.
 */
const classifyMethodDefinition = (
  node: ESTree.MethodDefinition,
  sourceCode: SourceCode,
): DocumentableDeclaration | null => {
  if (node.kind === 'constructor' || node.parent.type !== 'ClassBody') {
    return null;
  }

  let kind = 'MethodDeclaration';
  if (node.kind === 'get') {
    kind = 'GetAccessor';
  } else if (node.kind === 'set') {
    kind = 'SetAccessor';
  }

  return createDescriptor(kind, getNodeText(sourceCode, node.key), node, node);
};

/**
 * Classifies `ClassBody` field definitions as `ArrowFunctionProperty`,
 * `FunctionExpressionProperty`, or `PropertyDeclaration` based on whether their initializer is
 * function-like.
 */
const classifyPropertyDefinition = (
  node: ESTree.PropertyDefinition,
  sourceCode: SourceCode,
): DocumentableDeclaration | null => {
  if (node.parent.type !== 'ClassBody') {
    return null;
  }

  const name = getNodeText(sourceCode, node.key);
  if (node.value !== null && isFunctionLikeInit(node.value)) {
    const kind =
      node.value.type === 'ArrowFunctionExpression'
        ? 'ArrowFunctionProperty'
        : 'FunctionExpressionProperty';
    return createDescriptor(kind, name, node, node);
  }

  return createDescriptor('PropertyDeclaration', name, node, node);
};

/**
 * Determines the diagnostic declaration kind for a property inside a top-level `const` object
 * literal, distinguishing accessors, methods, shorthand properties, function-valued properties, and
 * value assignments.
 */
const classifyTopLevelObjectPropertyKind = (node: ESTree.ObjectProperty): string => {
  if (node.kind === 'get') {
    return 'GetAccessor';
  }
  if (node.kind === 'set') {
    return 'SetAccessor';
  }

  if (node.method) {
    return 'MethodDeclaration';
  }

  if (node.shorthand) {
    return 'TopLevelConstShorthandProperty';
  }

  if (node.value.type === 'ArrowFunctionExpression') {
    return 'ArrowFunctionProperty';
  }
  if (node.value.type === 'FunctionExpression') {
    return 'FunctionExpressionProperty';
  }

  return 'TopLevelConstPropertyAssignment';
};

/**
 * Classifies an `ObjectExpression` property when it resides inside a top-level `const` object
 * literal or matches an enabled schema builder via `classifySchemaProperty`; returns `null` for
 * ordinary object literals.
 */
const classifyObjectProperty = (
  node: ESTree.ObjectProperty,
  sourceCode: SourceCode,
  classifySchemaProperty: SchemaClassifier,
): DocumentableDeclaration | null => {
  if (node.parent.type !== 'ObjectExpression') {
    return null;
  }

  const name = getNodeText(sourceCode, node.key);
  if (isTopLevelConstObjectLiteral(node.parent)) {
    return createDescriptor(classifyTopLevelObjectPropertyKind(node), name, node, node);
  }

  const schemaKind = classifySchemaProperty(node);
  return schemaKind !== null ? createDescriptor(schemaKind, name, node, node) : null;
};

/**
 * Classifies any `VariableDeclarator` initialized with an `ArrowFunctionExpression` or
 * `FunctionExpression` at any scope, anchoring leading JSDoc to the enclosing single-declarator
 * `VariableDeclaration` (or its export wrapper) while reporting on the declarator node.
 */
const classifyVariableDeclarator = (
  node: ESTree.VariableDeclarator,
  sourceCode: SourceCode,
): DocumentableDeclaration | null => {
  if (node.init === null || !isFunctionLikeInit(node.init)) {
    return null;
  }

  const kind =
    node.init.type === 'ArrowFunctionExpression' ? 'ArrowFunction' : 'FunctionExpression';
  const varDecl = node.parent;
  const jsDocTarget =
    varDecl.type === 'VariableDeclaration' && varDecl.declarations.length === 1
      ? getExportOrSelf(varDecl)
      : node;
  return createDescriptor(kind, getNodeText(sourceCode, node.id), jsDocTarget, node);
};

/**
 * Classifies class, interface, type alias, function, and non-function top-level single-declarator
 * `const` declarations; returns `null` for function-valued `const` bindings (delegated to
 * `classifyVariableDeclarator`) and other nodes.
 */
const classifyTopLevelDeclaration = (
  node: ESTree.Node,
  sourceCode: SourceCode,
): DocumentableDeclaration | null => {
  if (node.type === 'ClassDeclaration') {
    return createDescriptor(
      'ClassDeclaration',
      node.id?.name ?? '<anonymous>',
      getExportOrSelf(node),
      node,
    );
  }
  if (node.type === 'TSInterfaceDeclaration') {
    return createDescriptor('InterfaceDeclaration', node.id.name, getExportOrSelf(node), node);
  }
  if (node.type === 'TSTypeAliasDeclaration') {
    return createDescriptor('TypeAliasDeclaration', node.id.name, getExportOrSelf(node), node);
  }
  if (node.type === 'FunctionDeclaration') {
    return createDescriptor(
      'FunctionDeclaration',
      node.id?.name ?? '<anonymous>',
      getExportOrSelf(node),
      node,
    );
  }
  if (node.type === 'VariableDeclaration' && isTopLevelConstDeclaration(node)) {
    const declarator = node.declarations[0];
    if (declarator === undefined || isFunctionLikeInit(declarator.init)) {
      return null;
    }

    return createDescriptor(
      'TopLevelConstDeclaration',
      getNodeText(sourceCode, declarator.id),
      getExportOrSelf(node),
      declarator,
    );
  }

  return null;
};

/**
 * Type guard narrowing an AST `Property` node to an `ObjectProperty` owned by an `ObjectExpression`
 * (excluding destructuring `ObjectPattern` properties).
 */
const isObjectProperty = (node: ESTree.Node): node is ESTree.ObjectProperty =>
  node.type === 'Property' && node.parent.type === 'ObjectExpression';

/**
 * Classifies an AST node into a documentable declaration descriptor, or `null` when exempt.
 */
export const getDocumentableDeclaration = (
  node: ESTree.Node,
  sourceCode: SourceCode,
  classifySchemaProperty: SchemaClassifier,
): DocumentableDeclaration | null => {
  const topLevel = classifyTopLevelDeclaration(node, sourceCode);
  if (topLevel !== null) {
    return topLevel;
  }

  if (node.type === 'MethodDefinition') {
    return classifyMethodDefinition(node, sourceCode);
  }
  if (node.type === 'PropertyDefinition') {
    return classifyPropertyDefinition(node, sourceCode);
  }
  if (node.type === 'TSPropertySignature' && isDocumentableTypeMember(node.parent)) {
    return createDescriptor('PropertySignature', getNodeText(sourceCode, node.key), node, node);
  }
  if (node.type === 'TSMethodSignature' && isDocumentableTypeMember(node.parent)) {
    return createDescriptor('MethodSignature', getNodeText(sourceCode, node.key), node, node);
  }
  if (node.type === 'VariableDeclarator') {
    return classifyVariableDeclarator(node, sourceCode);
  }

  if (isObjectProperty(node)) {
    return classifyObjectProperty(node, sourceCode, classifySchemaProperty);
  }

  return null;
};

/**
 * Finds the next sibling node inside the container that holds `jsDocTarget`.
 */
export const getNextSiblingDeclarationNode = (jsDocTarget: ESTree.Node): ESTree.Node | null => {
  const parent = jsDocTarget.parent;
  if (parent === null) {
    return null;
  }

  let siblings: ReadonlyArray<ESTree.Node>;
  if (
    parent.type === 'TSInterfaceBody' ||
    parent.type === 'ClassBody' ||
    parent.type === 'Program'
  ) {
    siblings = parent.body;
  } else if (parent.type === 'TSTypeLiteral') {
    siblings = parent.members;
  } else if (parent.type === 'ObjectExpression') {
    siblings = parent.properties;
  } else {
    return null;
  }

  const index = siblings.indexOf(jsDocTarget);
  return index >= 0 && index + 1 < siblings.length ? (siblings[index + 1] ?? null) : null;
};
