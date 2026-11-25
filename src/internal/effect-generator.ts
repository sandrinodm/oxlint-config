import type { ESTree } from 'vite-plus/lint/plugins';

/**
 * `Effect` namespace factory method names (`gen`, `fn`, `fnUntraced`) that evaluate a generator
 * function as an Effect workflow.
 */
const EFFECT_GENERATOR_METHODS = new Set(['gen', 'fn', 'fnUntraced']);

/**
 * Function boundary AST node types checked when resolving a node's immediate enclosing function
 * scope.
 */
const FUNCTION_NODE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Returns `true` when `callee` is a non-computed `Effect.<method>` member expression whose property
 * name is in `allowedMethods`.
 */
const isEffectMemberCall = (
  callee: ESTree.Expression,
  allowedMethods: ReadonlySet<string>,
): boolean =>
  callee.type === 'MemberExpression' &&
  !callee.computed &&
  callee.object.type === 'Identifier' &&
  callee.object.name === 'Effect' &&
  callee.property.type === 'Identifier' &&
  allowedMethods.has(callee.property.name);

/**
 * Matches direct (`Effect.gen(...)`, `Effect.fnUntraced(...)`) and curried traced
 * (`Effect.fn('span')(...)`) invocations of an Effect generator builder.
 */
const isEffectGeneratorCall = (call: ESTree.CallExpression): boolean => {
  if (isEffectMemberCall(call.callee, EFFECT_GENERATOR_METHODS)) {
    return true;
  }

  return (
    call.callee.type === 'CallExpression' &&
    isEffectMemberCall(call.callee.callee, EFFECT_GENERATOR_METHODS)
  );
};

/**
 * Returns `true` when `node` is a generator `FunctionExpression` passed directly as an argument to
 * an `Effect.gen` / `Effect.fn` / `Effect.fnUntraced` call.
 */
const isEffectGeneratorFunction = (node: ESTree.Node): boolean => {
  if (node.type !== 'FunctionExpression' || !node.generator) {
    return false;
  }

  const parent = node.parent;
  if (parent.type !== 'CallExpression') {
    return false;
  }

  return parent.arguments.includes(node) && isEffectGeneratorCall(parent);
};

/**
 * Walks up to the nearest enclosing function boundary and returns `true` only when that immediate
 * function is an Effect generator, exempting nested callbacks such as `Effect.try(() => ...)`.
 */
export const isDirectlyInsideEffectGenerator = (node: ESTree.Node): boolean => {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    if (FUNCTION_NODE_TYPES.has(current.type)) {
      return isEffectGeneratorFunction(current);
    }

    current = current.parent;
  }

  return false;
};

/**
 * Walks the entire ancestor chain of `node` and returns `true` if any enclosing scope is an Effect
 * generator function, including through nested arrow functions or callbacks.
 */
export const hasAncestorEffectGenerator = (node: ESTree.Node): boolean => {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    if (isEffectGeneratorFunction(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
};

/**
 * Extracts the invoked method name from a `console.method` or `console['method']` callee, or
 * returns `null` for non-`console` targets and non-string computed properties.
 */
export const getConsoleMethodName = (callee: ESTree.Expression): string | null => {
  if (
    callee.type !== 'MemberExpression' ||
    callee.object.type !== 'Identifier' ||
    callee.object.name !== 'console'
  ) {
    return null;
  }

  if (!callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  if (
    callee.computed &&
    callee.property.type === 'Literal' &&
    typeof callee.property.value === 'string'
  ) {
    return callee.property.value;
  }

  return null;
};
