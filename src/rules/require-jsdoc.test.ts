import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { requireJsDoc } from './require-jsdoc.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('require-jsdoc', requireJsDoc, {
  valid: [
    // Documented class, interface, type alias, functions, top-level consts, and object properties
    `/**
 * Widget container.
 */
export class Widget {
  /**
   * First value.
   */
  first: string;

  /**
   * Second value.
   */
  second: string;

  /**
   * Runs the widget action.
   */
  action(): void {}

  /**
   * Formats label.
   */
  get label(): string {
    return this.first;
  }

  /**
   * Updates label.
   */
  set label(value: string) {
    this.first = value;
  }

  /**
   * Arrow handler.
   */
  fieldArrow = (): void => {};

  /**
   * Function handler.
   */
  fieldFunction = function (): void {};
}

/**
 * User contract.
 */
export interface User {
  /**
   * Unique identifier.
   */
  id: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Finds a user by ID.
   */
  find(id: string): User;

  /**
   * Updates a user by ID.
   */
  update(id: string): User;
}

/**
 * Feature toggle alias.
 */
export type Alias = {
  /**
   * Whether the feature is active.
   */
  enabled: boolean;
};

/**
 * Base count.
 */
const count = 1;

/**
 * Runtime config object.
 */
const config = {
  /**
   * Target host.
   */
  host: 'localhost',

  /**
   * Count shorthand.
   */
  count,

  /**
   * Resets internal state.
   */
  reset(): void {},

  /**
   * Nested helper arrow.
   */
  nestedArrow: (): void => {},

  /**
   * Nested configuration tree (nested inner keys are exempt).
   */
  nested: {
    value: 1,
    arrow: () => {},
  },
};

/**
 * Computes a value.
 */
const compute = (): number => 1;`,
    // Ignores inline parameter object types and non-class-heritage generic call type arguments
    `/**
 * Accepts inline input.
 */
export function accept(input: {
  value: string;
  run(): void;
}): unknown {
  return input;
}

/**
 * Uses a nested generic call as a runtime argument.
 */
export class WrappedService extends outer(inner<{
  ignored: string;
}>()) {}

/**
 * Builds an unrelated generic value.
 */
export const value = factory<{
  alsoIgnored: string;
}>();`,
    // Ignores function-valued properties inside nested runtime objects
    `/**
 * Acquires the HTTP application.
 */
export function acquireHttpApp(): unknown {
  return Effect.acquireRelease(
    Effect.try({
      try: () => {
        const app = Fastify({
          genReqId: () => randomUUID(),
          requestIdHeader: false,
        });
        return app;
      },
      catch: (cause) => new HttpAppInitializationError({ cause }),
      onReady() {},
      get status() {
        return 'ready';
      },
      set status(_value: string) {},
    }),
  );
}`,
    // Documented Data.TaggedError and Context.Service class heritage type arguments
    `/**
 * Preserves the Effect Config failure when startup settings are invalid.
 */
export class RuntimeConfigError extends Data.TaggedError('RuntimeConfigError')<{
  /**
   * Original failure.
   */
  readonly cause: unknown;

  /**
   * Safe failure message.
   */
  readonly message: string;
}> {}

/**
 * Host-owned inputs for database acquisition.
 */
export class DatabaseOptions extends Context.Service<
  DatabaseOptions,
  {
    /**
     * Runtime database connection settings.
     */
    readonly database: DatabaseRuntimeConfig;

    /**
     * Callback invoked on pool errors.
     */
    readonly onPoolError: (error: Error) => void;
  }
>()('@acme/api/DatabaseOptions') {}`,
    // Drizzle, Zod, and Effect Schema properties are ignored when their options are disabled
    `import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { Schema } from 'effect';

/**
 * Workspace table.
 */
export const workspaces = pgTable('workspaces', {
  id: uuid(),
});

/**
 * Workspace Zod input.
 */
export const workspaceZod = z.object({
  id: z.string(),
});

/**
 * Workspace Effect schema.
 */
export const workspaceEffect = Schema.Struct({
  id: Schema.String,
});`,
    // Documented Drizzle, Zod, and Effect Schema members pass when enabled
    {
      options: [
        {
          requireDrizzleJsDoc: true,
          requireZodJsDoc: true,
          requireEffectSchemaJsDoc: true,
        },
      ],
      code: `import { pgTable as defineTable, uuid } from 'drizzle-orm/pg-core';
import * as zodSchema from 'zod';
import { Schema } from 'effect';

/**
 * Workspace table.
 */
export const workspaces = defineTable('workspaces', {
  /**
   * Workspace identifier.
   */
  id: uuid(),
});

/**
 * Workspace Zod input.
 */
export const workspaceInput = zodSchema.strictObject({
  /**
   * Workspace display name.
   */
  displayName: zodSchema.string(),
});

/**
 * Workspace Effect struct schema.
 */
export const WorkspaceStruct = Schema.Struct({
  /**
   * Workspace identifier.
   */
  id: Schema.String,

  /**
   * Nested profile fields.
   */
  profile: Schema.Struct({
    /**
     * Public display name.
     */
    displayName: Schema.String,
  }),
});

/**
 * Workspace tagged error.
 */
export class WorkspaceNotFoundError extends Schema.TaggedError<WorkspaceNotFoundError>()(
  'WorkspaceNotFoundError',
  {
    /**
     * Missing workspace ID.
     */
    workspaceId: Schema.String,
  },
) {}

/**
 * Workspace domain class.
 */
export class WorkspaceRecord extends Schema.Class<WorkspaceRecord>('WorkspaceRecord')({
  /**
   * Unique workspace ID.
   */
  id: Schema.String,
}) {}`,
    },
    // Rejects unsupported schema imports, call targets, factories, and argument positions
    {
      options: [
        {
          requireDrizzleJsDoc: true,
          requireZodJsDoc: true,
          requireEffectSchemaJsDoc: true,
        },
      ],
      code: `import * as drizzle from 'drizzle-orm/pg-core';
import * as zod from 'zod';
import { pgTable } from 'not-drizzle';
import { Struct } from 'not-effect';

/**
 * Ignored calls.
 */
export function run(): void {
  drizzle['pgTable']('a', { ignored: 1 });
  pgTable('b', { ignored: 1 });
  zod['object']({ ignored: 1 });
  zod.string({ ignored: 1 });
  zod.object('wrongPos', { ignored: 1 });
  Struct({ ignored: 1 });
}`,
    },
  ],
  invalid: [
    // Reports every supported documentable declaration kind when undocumented
    {
      code: `export class Widget {
  value: string;
  initialized = 1;
  method() {}
  get label() { return this.value; }
  set label(value: string) { this.value = value; }
  fieldArrow = () => {};
  fieldFunction = function () {};
}
export interface Store {
  all(...params: unknown[]): unknown[];
}
export default class {}
export type Shape = {
  area: number;
  get(...params: unknown[]): unknown;
};
export default function() {}
export function makeWidget() {}
const answer = 42;
const arrow = () => {};
const expression = function () {};
const two = 2;
const values = {
  one: 1,
  two,
  skip() {},
  nestedArrow: () => {},
  nestedFunction: function () {},
  nested: {
    value: 1,
    arrow: () => {},
    fn: function () {},
  },
};
const pair = 1, other = 2;
let ignored = 1;
const wrapped = ({
  wrappedValue: 1,
} satisfies Record<string, number>);
const nonNullWrapped = ({
  nonNullValue: 1,
} as Record<string, number>)!;
for (const loopArrow = () => {}; false;) {}`,
      errors: [
        { messageId: 'missingJsDoc', data: { kind: 'ClassDeclaration', name: 'Widget' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertyDeclaration', name: 'value' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertyDeclaration', name: 'initialized' } },
        { messageId: 'missingJsDoc', data: { kind: 'MethodDeclaration', name: 'method' } },
        { messageId: 'missingJsDoc', data: { kind: 'GetAccessor', name: 'label' } },
        { messageId: 'missingJsDoc', data: { kind: 'SetAccessor', name: 'label' } },
        { messageId: 'missingJsDoc', data: { kind: 'ArrowFunctionProperty', name: 'fieldArrow' } },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'FunctionExpressionProperty', name: 'fieldFunction' },
        },
        { messageId: 'missingJsDoc', data: { kind: 'InterfaceDeclaration', name: 'Store' } },
        { messageId: 'missingJsDoc', data: { kind: 'MethodSignature', name: 'all' } },
        { messageId: 'missingJsDoc', data: { kind: 'ClassDeclaration', name: '<anonymous>' } },
        { messageId: 'missingJsDoc', data: { kind: 'TypeAliasDeclaration', name: 'Shape' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertySignature', name: 'area' } },
        { messageId: 'missingJsDoc', data: { kind: 'MethodSignature', name: 'get' } },
        { messageId: 'missingJsDoc', data: { kind: 'FunctionDeclaration', name: '<anonymous>' } },
        { messageId: 'missingJsDoc', data: { kind: 'FunctionDeclaration', name: 'makeWidget' } },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstDeclaration', name: 'answer' },
        },
        { messageId: 'missingJsDoc', data: { kind: 'ArrowFunction', name: 'arrow' } },
        { messageId: 'missingJsDoc', data: { kind: 'FunctionExpression', name: 'expression' } },
        { messageId: 'missingJsDoc', data: { kind: 'TopLevelConstDeclaration', name: 'two' } },
        { messageId: 'missingJsDoc', data: { kind: 'TopLevelConstDeclaration', name: 'values' } },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstPropertyAssignment', name: 'one' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstShorthandProperty', name: 'two' },
        },
        { messageId: 'missingJsDoc', data: { kind: 'MethodDeclaration', name: 'skip' } },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'ArrowFunctionProperty', name: 'nestedArrow' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'FunctionExpressionProperty', name: 'nestedFunction' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstPropertyAssignment', name: 'nested' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstDeclaration', name: 'wrapped' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstPropertyAssignment', name: 'wrappedValue' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstDeclaration', name: 'nonNullWrapped' },
        },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'TopLevelConstPropertyAssignment', name: 'nonNullValue' },
        },
        { messageId: 'missingJsDoc', data: { kind: 'ArrowFunction', name: 'loopArrow' } },
      ],
    },
    // Reports single-line JSDoc comments as invalid
    {
      code: `/** Single line. */
export const COUNT = 1;`,
      errors: [
        {
          messageId: 'singleLineJsDoc',
          data: { kind: 'TopLevelConstDeclaration', name: 'COUNT' },
        },
      ],
    },
    // Reports and autofixes missing blank lines between consecutive documented members and top-level consts
    {
      code: `/**
 * Widget.
 */
export class Widget {
  /**
   * First.
   */
  first: string;
  /**
   * Second.
   */
  second: string;
}

/**
 * Config.
 */
export const CONFIG = {
  /**
   * Host.
   */
  host: 'localhost',
  /**
   * Port.
   */
  port: 3000,
};
/**
 * Next constant.
 */
export const NEXT = 2;`,
      output: `/**
 * Widget.
 */
export class Widget {
  /**
   * First.
   */
  first: string;

  /**
   * Second.
   */
  second: string;
}

/**
 * Config.
 */
export const CONFIG = {
  /**
   * Host.
   */
  host: 'localhost',

  /**
   * Port.
   */
  port: 3000,
};

/**
 * Next constant.
 */
export const NEXT = 2;`,
      errors: [
        {
          messageId: 'missingMemberSpacing',
          data: { kind: 'PropertyDeclaration', name: 'first' },
        },
        {
          messageId: 'missingMemberSpacing',
          data: { kind: 'TopLevelConstDeclaration', name: 'CONFIG' },
        },
        {
          messageId: 'missingMemberSpacing',
          data: { kind: 'TopLevelConstPropertyAssignment', name: 'host' },
        },
      ],
    },
    // Reports undocumented inline class heritage type arguments (Data.TaggedError & Context.Service)
    {
      code: `/**
 * Startup error.
 */
export class RuntimeConfigError extends Data.TaggedError('RuntimeConfigError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

/**
 * Host options.
 */
export class DatabaseOptions extends Context.Service<
  DatabaseOptions,
  {
    readonly database: string;
    readonly onPoolError: (error: Error) => void;
  }
>()('@acme/api/DatabaseOptions') {}`,
      errors: [
        { messageId: 'missingJsDoc', data: { kind: 'PropertySignature', name: 'cause' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertySignature', name: 'message' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertySignature', name: 'database' } },
        { messageId: 'missingJsDoc', data: { kind: 'PropertySignature', name: 'onPoolError' } },
      ],
    },
    // Reports undocumented Drizzle table columns when requireDrizzleJsDoc is enabled
    {
      options: [{ requireDrizzleJsDoc: true }],
      code: `import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Workspaces table.
 */
export const workspaces = pgTable('workspaces', {
  id: uuid(),
  displayName: varchar('display_name', { length: 120 }),
});`,
      errors: [
        { messageId: 'missingJsDoc', data: { kind: 'DrizzleSchemaProperty', name: 'id' } },
        {
          messageId: 'missingJsDoc',
          data: { kind: 'DrizzleSchemaProperty', name: 'displayName' },
        },
      ],
    },
    // Reports undocumented Zod object members (including nested objects and aliased imports)
    {
      options: [{ requireZodJsDoc: true }],
      code: `import { z } from 'zod';
import { object as defineObject } from 'zod/v4';

/**
 * Workspace schema.
 */
export const workspaceSchema = z.object({
  id: z.string(),
  profile: defineObject({
    displayName: z.string(),
  }),
});`,
      errors: [
        { messageId: 'missingJsDoc', data: { kind: 'ZodSchemaProperty', name: 'id' } },
        { messageId: 'missingJsDoc', data: { kind: 'ZodSchemaProperty', name: 'profile' } },
        { messageId: 'missingJsDoc', data: { kind: 'ZodSchemaProperty', name: 'displayName' } },
      ],
    },
    // Reports undocumented Effect Schema struct, tagged struct, class, and tagged error fields
    {
      options: [{ requireEffectSchemaJsDoc: true }],
      code: `import { Schema } from 'effect';
import * as S from 'effect/Schema';

/**
 * Item payload schema.
 */
export const ItemSchema = Schema.Struct({
  id: Schema.String,
  meta: S.Struct({
    source: S.String,
  }),
});

/**
 * Tagged event schema.
 */
export const SyncEvent = Schema.TaggedStruct('SyncEvent', {
  count: Schema.Int,
});

/**
 * Item not found error.
 */
export class ItemNotFoundError extends Schema.TaggedError<ItemNotFoundError>()(
  'ItemNotFoundError',
  {
    itemId: Schema.String,
  },
) {}

/**
 * Link metadata model.
 */
export class LinkMetadata extends Schema.Class<LinkMetadata>('LinkMetadata')({
  title: Schema.String,
}) {}`,
      errors: [
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'id' } },
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'meta' } },
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'source' } },
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'count' } },
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'itemId' } },
        { messageId: 'missingJsDoc', data: { kind: 'EffectSchemaProperty', name: 'title' } },
      ],
    },
    // Autofixes missing blank line between documented Effect Schema fields
    {
      options: [{ requireEffectSchemaJsDoc: true }],
      code: `import { Schema } from 'effect';

/**
 * Item state patch.
 */
export const ItemStatePatch = Schema.Struct({
  /**
   * Read flag.
   */
  isRead: Schema.Boolean,
  /**
   * Bookmark flag.
   */
  isBookmarked: Schema.Boolean,
});`,
      output: `import { Schema } from 'effect';

/**
 * Item state patch.
 */
export const ItemStatePatch = Schema.Struct({
  /**
   * Read flag.
   */
  isRead: Schema.Boolean,

  /**
   * Bookmark flag.
   */
  isBookmarked: Schema.Boolean,
});`,
      errors: [
        {
          messageId: 'missingMemberSpacing',
          data: { kind: 'EffectSchemaProperty', name: 'isRead' },
        },
      ],
    },
  ],
});
