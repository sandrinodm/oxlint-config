# @yieldkit/oxlint-config

[![npm](https://img.shields.io/npm/v/@yieldkit/oxlint-config)](https://www.npmjs.com/package/@yieldkit/oxlint-config)
[![CI](https://github.com/yieldkit/oxlint-config/actions/workflows/ci.yml/badge.svg)](https://github.com/yieldkit/oxlint-config/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@yieldkit/oxlint-config)](./LICENSE)

A strict Oxlint and Oxfmt preset for [Vite+](https://viteplus.dev). It is aimed at TypeScript and Effect codebases where a lot of the code is written by AI agents.

The preset:

- extends [`@cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config)
- turns the `correctness`, `suspicious` and `perf` categories on as errors
- enables type-aware linting with `typeCheck`
- adds eighteen `slop/*` rules for patterns built-in rules don't catch: chained type assertions, raw `JSON.parse`, `throw` inside `Effect.gen`, unbounded retries, comments about plans and tickets, missing JSDoc, and more
- optionally turns on Effect's own type-aware rules from [`@effect/tsgo`](https://github.com/Effect-TS/tsgo) through the `/effect` export, which catches floating Effects, leaked requirements and other mistakes that need type information (see [Effect](#effect))

## Install

```sh
pnpm add -D @yieldkit/oxlint-config
```

Requires `vite-plus` 1.7.0 or later. Node.js 22.18+, 24.11+ or 26+, the same range as Vite+.

## Use

Spread the presets into the root `vite.config.ts`:

```ts
import oxlintConfig, { fmtConfig } from '@yieldkit/oxlint-config';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: fmtConfig,
  lint: oxlintConfig,
});
```

Run `vp lint`, `vp fmt` or `vp check` locally and in CI.

Spread the preset into `lint` rather than listing it under `extends`, so `options` (`typeAware`, `typeCheck`) and `ignorePatterns` carry over too.

### Extend it

The preset knows nothing about your repository. Paths, package boundaries and workspace scopes belong in your own config:

```ts
import oxlintConfig, { fmtConfig, restrictedImportsOverride } from '@yieldkit/oxlint-config';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ...fmtConfig,
    ignorePatterns: [...fmtConfig.ignorePatterns, 'docs/**'],
    sortImports: {
      ...fmtConfig.sortImports,
      internalPattern: ['@acme/*', ...fmtConfig.sortImports.internalPattern],
    },
  },
  lint: {
    ...oxlintConfig,
    rules: {
      ...oxlintConfig.rules,
      'slop/kebab-case-imports': ['error', { workspaceScopes: ['@acme/'] }],
      'slop/no-tests-directory': ['error', { workspaceScopes: ['@acme/'] }],
    },
    overrides: [
      ...oxlintConfig.overrides,
      restrictedImportsOverride(['packages/domain/src/**/*.ts'], [{ group: ['node:*', 'bun'] }]),
    ],
  },
});
```

`restrictedImportsOverride(files, patterns)` adds import bans for some files and keeps the preset's base bans (`zod` and `../../../`). An override that sets `no-restricted-imports` by hand would replace them.

## Effect

The `/effect` export is the full preset plus Effect's own lint rules, maintained by the Effect team in [`@effect/tsgo`](https://github.com/Effect-TS/tsgo). Those rules use type information, so they catch what a syntactic rule cannot:

- an Effect that is created but never yielded or run (`floating-effect`)
- `yield` without `*`, and a failure yielded without `return yield*`
- returning an Effect from a generator, which nests it as `Effect<Effect<…>>`
- service methods that leak their dependencies into the requirements channel
- catching on an Effect that cannot fail, and global `Error` or `unknown` in the error channel
- `try`/`catch`, `Effect.run*`, `Promise.all`, `Date`, `Math.random`, `process.env`, `fetch`, timers, `console` and `JSON` inside Effect code
- chained `Effect.provide` calls, providing layers outside entrypoints, and v3 APIs that v4 removed or renamed

It enables Effect's `recommended` set, the rest of its correctness and anti-pattern categories, and the in-Effect platform rules (114 rules), all as errors. The platform rules apply inside Effect code only, so plain helpers can still use `Date` or `console`. Tests and entrypoints may provide layers directly.

### Set up

```sh
pnpm add -D @yieldkit/oxlint-config @effect/tsgo
```

```ts
// vite.config.ts
import { fmtConfig } from '@yieldkit/oxlint-config';
import effectConfig from '@yieldkit/oxlint-config/effect';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: fmtConfig,
  lint: effectConfig,
});
```

Run lint through Effect's wrapper, which loads the patched Oxlint binding that provides the `effecttsgo` plugin:

```json
{
  "scripts": {
    "check": "effect-tsgo vp check",
    "lint": "effect-tsgo vp lint"
  }
}
```

Plain `vp lint` fails with `Unknown plugin: 'effecttsgo'`, so run CI and any `staged` task through the wrapper too, for example `staged: { '*': 'effect-tsgo vp check --fix' }`.

Things to know:

- `@effect/tsgo` pins exact Oxlint, tsrs and TypeScript versions. After upgrading `vite-plus` or `typescript`, wait for a matching `@effect/tsgo` release. Its `peerDependency` range here is `^0.73.4`.
- It ships native builds for Linux, macOS and Windows (x64 and arm64), but not for Linux musl (Alpine).
- `typescript/explicit-module-boundary-types` is off: Effect code relies on inferred `Effect<A, E, R>` types, and the `effecttsgo/*` rules check the error and requirement channels instead.
- For editor diagnostics, follow the [`@effect/tsgo` setup](https://github.com/Effect-TS/tsgo#readme) and set `"diagnostics": false` in its tsconfig plugin entry so Effect diagnostics aren't reported twice.

To change a rule, override it like any other:

```ts
lint: {
  ...effectConfig,
  rules: { ...effectConfig.rules, 'effecttsgo/missing-concurrency-option': 'off' },
},
```

Rule reference: [Effect-TS/tsgo/docs/rules](https://github.com/Effect-TS/tsgo/tree/main/docs/rules).

## What the preset sets

**Lint** (`default` export):

- Cloudflare's rule set, plus the `typescript`, `unicorn`, `oxc`, `import` and `jsdoc` plugins.
- Strict TypeScript rules: no `any`, the `no-unsafe-*` family, `no-non-null-assertion`, `no-floating-promises`, `switch-exhaustiveness-check`, and `consistent-type-imports` with separate `import type` statements.
- Size limits: complexity 14, depth 4, 4 parameters, 350 lines per file, 100 lines per function.
- Kebab-case file names, no barrel files, and no import cycles.
- A `no-restricted-imports` rule banning Zod (use Effect Schema) and `../../../` imports.
- Effect conventions from the `slop/*` rules: named `Effect.fn` spans, `Effect.run*` only in entrypoints, no catch-all handlers that swallow failures, no retry policies that never stop. They only apply to names imported from `effect`, `effect/*` or `@effect/*`.
- Effect idioms that Cloudflare's rules would report stay allowed: `Effect.gen` without `yield` (`eslint/require-yield` is off), namespace imports of local modules (`import * as Body from './body.ts'`), data-first calls such as `Effect.catch(effect, handler)`, and `cause` as well as `error` for rejection handler parameters.
- `slop/require-jsdoc` doesn't ask for JSDoc on brand markers (`readonly brand: unique symbol`), and `slop/blank-line-after-if` allows a blank line before a `return` that only collects earlier bindings (`return Repo.of({ find, save })`).
- In `*.test.*` and `*.spec.*` files: the vitest plugin, no size limits, and no fixed sleeps. Tests, stories, fixtures, `.d.ts` files and `vite.config.ts` don't need JSDoc.
- Cloudflare disables `no-explicit-any`, `no-non-null-assertion`, `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-member-access`, `only-throw-error`, and `unbound-method` for TypeScript files with a `.test`, `.spec`, `.integration`, or `.e2e` suffix before the extension and for TypeScript files under `__tests__/`.

**Format** (`fmtConfig`):

- Single quotes, semicolons, trailing commas, 100 columns, and multiline JSDoc.
- Sorted `package.json` scripts.
- Grouped imports: type imports first, then external, internal and relative.
- Line wrapping in Markdown prose is kept as written.
- Build output, `routeTree.gen.ts` and `bun.lock` are ignored.

## Rules

| Rule                               | Reports                                                                                                                    | Options                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `slop/no-chained-type-assertions`  | `x as unknown as T`                                                                                                        |                                          |
| `slop/no-disable-safety-rules`     | inline disables of type-safety and test-integrity rules                                                                    |                                          |
| `slop/no-raw-json-parse`           | `JSON.parse` instead of Effect Schema decoding                                                                             |                                          |
| `slop/no-instanceof`               | `instanceof` against package or app classes (allows global built-ins)                                                      | `allow`                                  |
| `slop/no-conditional-spread`       | spreads that add or omit keys based on a condition (`? : {}`, `&&`)                                                        |                                          |
| `slop/no-fixed-sleep-in-tests`     | `setTimeout` / `Bun.sleep` in tests                                                                                        |                                          |
| `slop/kebab-case-imports`          | non-kebab-case local import paths                                                                                          | `workspaceScopes`                        |
| `slop/no-tests-directory`          | `__tests__` directories, and imports through them                                                                          | `workspaceScopes`                        |
| `slop/blank-line-after-if`         | a missing blank line after a control block, or a blank line between a value and the statement that uses it                 |                                          |
| `slop/no-throw-in-effect-gen`      | `throw` inside `Effect.gen` / `Effect.fn`                                                                                  |                                          |
| `slop/no-console-in-effect-gen`    | `console.*` inside Effect generators                                                                                       |                                          |
| `slop/effect-fn-conventions`       | `Effect.fn` without a span name, a span name that doesn't match its binding, `.pipe` on an `Effect.fn` function            | `matchName`                              |
| `slop/no-effect-run-outside-entry` | `Effect.run*` and `ManagedRuntime.make` outside entrypoints (`main.*`, `bin/`, `scripts/`)                                 |                                          |
| `slop/no-silent-catch`             | `Effect.catch`, `catchCause` or `catchDefect` with a handler that returns a constant (`Effect.void`, `Effect.succeed([])`) |                                          |
| `slop/no-unbounded-retry`          | `Effect.retry` with a policy that never stops (`Schedule.forever`, a bare `Schedule.exponential`)                          |                                          |
| `slop/no-banner-comments`          | divider and `#region` comments                                                                                             |                                          |
| `slop/no-history-comments`         | comments about plans, tickets or past changes                                                                              |                                          |
| `slop/require-jsdoc`               | missing multiline JSDoc on declarations, members, schemas                                                                  | `require{Zod,EffectSchema,Drizzle}JsDoc` |

`slop/no-instanceof` replaces Cloudflare's `@nkzw/no-instanceof`. That rule bans built-ins such as `Date` and `HTMLElement`, but exempts any bare identifier ending in `Error` or `Exception`, so `instanceof HttpRequestError` passes. This rule turns that around:

- Runtime classes are allowed: errors, `Date`, `Map`, `Uint8Array`, `URL`, `Response`, DOM elements and events, and members of `Intl`, `WebAssembly` and `Temporal`. That covers spellings like `globalThis.Date`, `globalThis['Date']` and `(Date as DateConstructor)`.
- A built-in name only counts when nothing in the file declares or imports it. `import { Response } from 'undici'` or a local `class Node` is reported.
- Classes from packages or your code are reported, for example Effect tagged errors or a `class OrderPlacedEvent`. For values your own code produced, narrow them with `Schema.is(HttpRequestError)(error)` or `Predicate.isTagged(error, 'HttpRequestError')`. Both are structural checks that a plain object can satisfy, so decode untrusted input with `Schema.decodeUnknown` instead.
- `allow` exempts exact dotted paths, such as `'LegacyError'` or `'CircuitBreaker.CircuitBreakerError'`.
- Runtime classes are still bound to one realm (a `vm` context, an iframe, jsdom). Where that matters, use `Error.isError` or `ArrayBuffer.isView`.

`slop/no-conditional-spread` replaces Cloudflare's `quality/no-conditional-empty-object-spread`. Both report spreads that add or leave out keys depending on a condition. The upstream rule only catches `...(x ? { x } : {})`; this one also catches `...(x && { x })` and `...(x ? { x } : undefined)`. Spreading an existing object with a fallback, such as `...(isRecord(value) ? value : {})` or `...(options ?? {})`, is not reported.

List the keys in the object literal instead, and drop `undefined` values with a small helper:

```ts
// before
const query = {
  ...(params.limit !== undefined ? { limit: params.limit } : {}),
  ...(params.cursor !== undefined && { cursor: params.cursor }),
};

// after: `omitUndefined` returns a copy without the keys whose value is `undefined`
const query = omitUndefined({ limit: params.limit, cursor: params.cursor });
```

The preset doesn't ship `omitUndefined`, because a lint config shouldn't be a runtime dependency. A version that type-checks under `exactOptionalPropertyTypes` without casts:

```ts
/**
 * Copies an object's own enumerable properties with defined values, including symbol keys.
 */
export function omitUndefined<T extends object>(value: T): Partial<T> {
  const result: Partial<T> = { ...value };
  for (const key of Reflect.ownKeys(result)) {
    if (Reflect.get(result, key) === undefined) {
      Reflect.deleteProperty(result, key);
    }
  }

  return result;
}
```

The four Effect rules follow Effect's own guidance (the `AGENTS.md` shipped in the `effect` package, and the v4 docs):

- `Effect.fn("name")` creates a tracing span, so it needs a name, and the name should match the function: `const query = Effect.fn("query")` or `Effect.fn("Database.query")`. Use `Effect.fnUntraced` for functions that shouldn't create a span. Pass combinators as extra arguments instead of piping: `Effect.fn("f")(function* () { … }, Effect.catch(…))`.
- Run effects once at the program's edge: `NodeRuntime.runMain` / `BunRuntime.runMain` in entrypoints, `ManagedRuntime` in framework adapters, `it.effect` from `@effect/vitest` in tests. Turn the rule off for adapter files with an override.
- Recover from specific errors with `catchTag`, log before recovering, or make the intent explicit with `Effect.orElseSucceed` (fallback value) or `Effect.ignore` (discard).
- Bound retries with `Schedule.recurs`, `Schedule.during` or `Schedule.upTo`, or pass `{ schedule, times }`. `Effect.repeat` forever is allowed; that's a normal daemon loop.

`workspaceScopes` lists package-scope prefixes, such as `['@acme/']`. Subpaths under those scopes are checked like local files; other scoped packages count as external.

## Credits

The preset builds on [`@cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config), which builds on [`@nkzw/oxlint-config`](https://github.com/nkzw-tech/oxlint-config). Several `slop/*` rules follow ideas from Dillon Mulroy's [anti-slop](https://github.com/dmmulroy/anti-slop) rules, reimplemented on `vite-plus/lint/plugins`.

## License

[MIT](./LICENSE)
