import type { ESTree } from 'vite-plus/lint/plugins';

/**
 * Optional schema-member JSDoc rules supported by `slop/require-jsdoc`.
 */
export interface SchemaJsDocOptions {
  /**
   * Whether direct Drizzle table columns require multiline JSDoc.
   */
  readonly requireDrizzleJsDoc?: boolean;

  /**
   * Whether direct Zod object-schema properties require multiline JSDoc.
   */
  readonly requireZodJsDoc?: boolean;

  /**
   * Whether direct Effect Schema struct/class/error fields require multiline JSDoc.
   */
  readonly requireEffectSchemaJsDoc?: boolean;
}

/**
 * Schema-specific declaration kinds emitted for documented schema members.
 */
export type SchemaPropertyKind =
  | 'DrizzleSchemaProperty'
  | 'ZodSchemaProperty'
  | 'EffectSchemaProperty';

/**
 * Local identifiers, per enabled schema library, whose calls take an object of schema fields.
 * Collected once per file from its value imports.
 */
interface SchemaBindings {
  /**
   * Local names of Drizzle `*Table` functions imported by name, e.g. `pgTable`.
   */
  readonly drizzleTableFunctions: Set<string>;

  /**
   * Local names of namespace imports from `drizzle-orm` modules.
   */
  readonly drizzleNamespaces: Set<string>;

  /**
   * Local names of Zod `object`, `strictObject` and `looseObject` imported by name.
   */
  readonly zodObjectFunctions: Set<string>;

  /**
   * Local names that refer to the Zod namespace: default, namespace and `z` imports.
   */
  readonly zodNamespaces: Set<string>;

  /**
   * Local names that refer to the Effect `Schema` module.
   */
  readonly effectSchemaNamespaces: Set<string>;

  /**
   * Local names of Effect constructors whose first argument is the field object, e.g. `Struct`.
   */
  readonly effectDirectArg0Functions: Set<string>;

  /**
   * Local names of Effect constructors whose second argument is the field object, e.g.
   * `TaggedStruct`.
   */
  readonly effectDirectArg1Functions: Set<string>;

  /**
   * Local names of curried Effect class constructors whose inner call takes fields first, e.g.
   * `Class<Self>()({...})`.
   */
  readonly effectCurriedArg0Functions: Set<string>;

  /**
   * Local names of curried Effect class constructors whose inner call takes fields second, e.g.
   * `TaggedClass<Self>()('Tag', {...})`.
   */
  readonly effectCurriedArg1Functions: Set<string>;
}

/**
 * Zod factory names that build an object schema from a shape literal.
 */
const ZOD_OBJECT_FUNCTION_NAMES = new Set(['object', 'strictObject', 'looseObject']);

/**
 * Effect Schema constructors called directly with the field object as their first argument.
 */
const EFFECT_DIRECT_ARG0_NAMES = new Set(['Struct']);

/**
 * Effect Schema constructors called directly with a tag first and the field object second.
 */
const EFFECT_DIRECT_ARG1_NAMES = new Set(['TaggedStruct']);

/**
 * Curried Effect Schema class constructors whose second call takes the field object first.
 */
const EFFECT_CURRIED_ARG0_NAMES = new Set(['Class', 'Error', 'ErrorClass', 'RequestClass']);

/**
 * Curried Effect Schema class constructors whose second call takes a tag first and the field object
 * second.
 */
const EFFECT_CURRIED_ARG1_NAMES = new Set([
  'TaggedClass',
  'TaggedError',
  'TaggedErrorClass',
  'TaggedRequest',
]);

/**
 * Modules whose exports are the Schema API itself, so constructors such as `Struct` may be imported
 * by name. From the `effect` root only the `Schema` namespace counts.
 */
const EFFECT_SCHEMA_DIRECT_MODULES = new Set([
  'effect/Schema',
  'effect/schema',
  '@effect/schema',
  '@effect/schema/Schema',
]);

/**
 * Transparent wrappers (casts, parentheses, non-null assertions) skipped when walking from an
 * object literal up to the call it is passed to.
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
 * Checks whether an import source is `drizzle-orm` or one of its subpaths.
 */
const isDrizzleModuleName = (moduleName: string): boolean =>
  moduleName === 'drizzle-orm' || moduleName.startsWith('drizzle-orm/');

/**
 * Treats any export ending in `Table` (`pgTable`, `sqliteTable`, ...) as a Drizzle table builder.
 */
const isDrizzleTableFunctionName = (name: string): boolean => name.endsWith('Table');

/**
 * Checks whether an import source is `zod` or one of its subpaths.
 */
const isZodModuleName = (moduleName: string): boolean =>
  moduleName === 'zod' || moduleName.startsWith('zod/');

/**
 * Checks whether an import source can provide the Effect Schema API, either via the `effect` root
 * or a direct Schema module.
 */
const isEffectSchemaModuleName = (moduleName: string): boolean =>
  moduleName === 'effect' || EFFECT_SCHEMA_DIRECT_MODULES.has(moduleName);

/**
 * Returns the exported name an import specifier refers to, including string-literal export names.
 */
const getImportedExportName = (specifier: ESTree.ImportSpecifier): string =>
  specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;

/**
 * Records Drizzle namespace imports and named `*Table` imports from one import declaration.
 */
const collectDrizzleBindings = (
  specifiers: ReadonlyArray<ESTree.ImportDeclarationSpecifier>,
  bindings: SchemaBindings,
): void => {
  for (const specifier of specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      bindings.drizzleNamespaces.add(specifier.local.name);
      continue;
    }

    if (specifier.type === 'ImportSpecifier') {
      const importedName = getImportedExportName(specifier);
      if (isDrizzleTableFunctionName(importedName)) {
        bindings.drizzleTableFunctions.add(specifier.local.name);
      }
    }
  }
};

/**
 * Records Zod namespace bindings (default, namespace or `z`) and named object factories from one
 * import declaration.
 */
const collectZodBindings = (
  specifiers: ReadonlyArray<ESTree.ImportDeclarationSpecifier>,
  bindings: SchemaBindings,
): void => {
  for (const specifier of specifiers) {
    if (
      specifier.type === 'ImportDefaultSpecifier' ||
      specifier.type === 'ImportNamespaceSpecifier'
    ) {
      bindings.zodNamespaces.add(specifier.local.name);
      continue;
    }

    const importedName = getImportedExportName(specifier);
    if (importedName === 'z') {
      bindings.zodNamespaces.add(specifier.local.name);
    } else if (ZOD_OBJECT_FUNCTION_NAMES.has(importedName)) {
      bindings.zodObjectFunctions.add(specifier.local.name);
    }
  }
};

/**
 * Files a named Effect Schema constructor import under the binding set matching where its field
 * object goes. Unrelated exports are ignored.
 */
const addEffectDirectBinding = (
  importedName: string,
  localName: string,
  bindings: SchemaBindings,
): void => {
  if (EFFECT_DIRECT_ARG0_NAMES.has(importedName)) {
    bindings.effectDirectArg0Functions.add(localName);
    return;
  }
  if (EFFECT_DIRECT_ARG1_NAMES.has(importedName)) {
    bindings.effectDirectArg1Functions.add(localName);
    return;
  }
  if (EFFECT_CURRIED_ARG0_NAMES.has(importedName)) {
    bindings.effectCurriedArg0Functions.add(localName);
    return;
  }
  if (EFFECT_CURRIED_ARG1_NAMES.has(importedName)) {
    bindings.effectCurriedArg1Functions.add(localName);
  }
};

/**
 * Records Effect Schema bindings from one import declaration. Named constructors only count when
 * imported from a direct Schema module, not the `effect` root.
 */
const collectEffectSchemaBindings = (
  moduleName: string,
  specifiers: ReadonlyArray<ESTree.ImportDeclarationSpecifier>,
  bindings: SchemaBindings,
): void => {
  const allowsDirectExports = EFFECT_SCHEMA_DIRECT_MODULES.has(moduleName);

  for (const specifier of specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      if (allowsDirectExports) {
        bindings.effectSchemaNamespaces.add(specifier.local.name);
      }

      continue;
    }

    if (specifier.type !== 'ImportSpecifier') {
      continue;
    }

    const importedName = getImportedExportName(specifier);
    if (importedName === 'Schema') {
      bindings.effectSchemaNamespaces.add(specifier.local.name);
    } else if (allowsDirectExports) {
      addEffectDirectBinding(importedName, specifier.local.name, bindings);
    }
  }
};

/**
 * Scans a file's value imports and collects bindings for each schema library enabled in `options`.
 * Type-only imports are ignored.
 */
const collectSchemaBindings = (
  program: ESTree.Program,
  options: SchemaJsDocOptions,
): SchemaBindings => {
  const bindings: SchemaBindings = {
    drizzleTableFunctions: new Set(),
    drizzleNamespaces: new Set(),
    zodObjectFunctions: new Set(),
    zodNamespaces: new Set(),
    effectSchemaNamespaces: new Set(),
    effectDirectArg0Functions: new Set(),
    effectDirectArg1Functions: new Set(),
    effectCurriedArg0Functions: new Set(),
    effectCurriedArg1Functions: new Set(),
  };

  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
      continue;
    }

    const moduleName = statement.source.value;
    if (options.requireDrizzleJsDoc === true && isDrizzleModuleName(moduleName)) {
      collectDrizzleBindings(statement.specifiers, bindings);
    }
    if (options.requireZodJsDoc === true && isZodModuleName(moduleName)) {
      collectZodBindings(statement.specifiers, bindings);
    }
    if (options.requireEffectSchemaJsDoc === true && isEffectSchemaModuleName(moduleName)) {
      collectEffectSchemaBindings(moduleName, statement.specifiers, bindings);
    }
  }

  return bindings;
};

/**
 * Walks from an object literal through transparent wrappers to the call it is passed to, returning
 * that call and the argument position, or `null` when it is not a direct call argument.
 */
const findContainingCallArgument = (
  objectLiteral: ESTree.ObjectExpression,
): readonly [ESTree.CallExpression, number] | null => {
  let argument: ESTree.Node = objectLiteral;
  while (argument.parent !== null && EXPRESSION_WRAPPER_TYPES.has(argument.parent.type)) {
    argument = argument.parent;
  }

  if (argument.parent === null || argument.parent.type !== 'CallExpression') {
    return null;
  }

  const callExpression = argument.parent;
  const callArguments: ReadonlyArray<ESTree.Node> = callExpression.arguments;
  const argumentIndex = callArguments.indexOf(argument);
  return argumentIndex === -1 ? null : [callExpression, argumentIndex];
};

/**
 * Checks whether `callee` is a non-computed `namespace.method` access on a known namespace whose
 * method name passes `matchesProperty`.
 */
const isMemberCallOnNamespace = (
  callee: ESTree.Expression,
  namespaces: ReadonlySet<string>,
  matchesProperty: (name: string) => boolean,
): boolean =>
  callee.type === 'MemberExpression' &&
  !callee.computed &&
  callee.object.type === 'Identifier' &&
  namespaces.has(callee.object.name) &&
  callee.property.type === 'Identifier' &&
  matchesProperty(callee.property.name);

/**
 * Checks whether `callee` invokes a Drizzle table builder, either directly or through a namespace.
 */
const isDrizzleTableCall = (callee: ESTree.Expression, bindings: SchemaBindings): boolean => {
  if (callee.type === 'Identifier') {
    return bindings.drizzleTableFunctions.has(callee.name);
  }

  return isMemberCallOnNamespace(callee, bindings.drizzleNamespaces, isDrizzleTableFunctionName);
};

/**
 * Checks whether `callee` invokes a Zod object factory, either directly or through a namespace.
 */
const isZodObjectCall = (callee: ESTree.Expression, bindings: SchemaBindings): boolean => {
  if (callee.type === 'Identifier') {
    return bindings.zodObjectFunctions.has(callee.name);
  }

  return isMemberCallOnNamespace(callee, bindings.zodNamespaces, (name) =>
    ZOD_OBJECT_FUNCTION_NAMES.has(name),
  );
};

/**
 * Checks whether `callee` is one of the given directly imported Effect constructors or a matching
 * method on an Effect Schema namespace.
 */
const matchesEffectTarget = (
  callee: ESTree.Expression,
  directFunctions: ReadonlySet<string>,
  namespaces: ReadonlySet<string>,
  methodNames: ReadonlySet<string>,
): boolean => {
  if (callee.type === 'Identifier') {
    return directFunctions.has(callee.name);
  }

  return isMemberCallOnNamespace(callee, namespaces, (name) => methodNames.has(name));
};

/**
 * Checks whether an object passed at `argumentIndex` to a call with `callee` is an Effect Schema
 * field object, covering direct and curried constructors.
 */
const isEffectSchemaCall = (
  callee: ESTree.Expression,
  argumentIndex: number,
  bindings: SchemaBindings,
): boolean => {
  if (
    argumentIndex === 0 &&
    matchesEffectTarget(
      callee,
      bindings.effectDirectArg0Functions,
      bindings.effectSchemaNamespaces,
      EFFECT_DIRECT_ARG0_NAMES,
    )
  ) {
    return true;
  }
  if (
    argumentIndex === 1 &&
    matchesEffectTarget(
      callee,
      bindings.effectDirectArg1Functions,
      bindings.effectSchemaNamespaces,
      EFFECT_DIRECT_ARG1_NAMES,
    )
  ) {
    return true;
  }

  if (callee.type !== 'CallExpression') {
    return false;
  }

  if (
    argumentIndex === 0 &&
    matchesEffectTarget(
      callee.callee,
      bindings.effectCurriedArg0Functions,
      bindings.effectSchemaNamespaces,
      EFFECT_CURRIED_ARG0_NAMES,
    )
  ) {
    return true;
  }

  return (
    argumentIndex === 1 &&
    matchesEffectTarget(
      callee.callee,
      bindings.effectCurriedArg1Functions,
      bindings.effectSchemaNamespaces,
      EFFECT_CURRIED_ARG1_NAMES,
    )
  );
};

/**
 * Builds a file-scoped classifier that detects schema object properties for enabled libraries.
 */
export const createSchemaPropertyClassifier = (
  program: ESTree.Program,
  options: SchemaJsDocOptions,
): ((node: ESTree.ObjectProperty) => SchemaPropertyKind | null) => {
  const bindings = collectSchemaBindings(program, options);

  return (node) => {
    if (node.kind !== 'init' || node.method || node.parent.type !== 'ObjectExpression') {
      return null;
    }

    const callArgument = findContainingCallArgument(node.parent);
    if (callArgument === null) {
      return null;
    }

    const [callExpression, argumentIndex] = callArgument;
    if (argumentIndex === 1 && isDrizzleTableCall(callExpression.callee, bindings)) {
      return 'DrizzleSchemaProperty';
    }
    if (argumentIndex === 0 && isZodObjectCall(callExpression.callee, bindings)) {
      return 'ZodSchemaProperty';
    }
    if (isEffectSchemaCall(callExpression.callee, argumentIndex, bindings)) {
      return 'EffectSchemaProperty';
    }

    return null;
  };
};
