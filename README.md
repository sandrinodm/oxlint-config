# @sandrinodm/oxlint-config

[![npm](https://img.shields.io/npm/v/@sandrinodm/oxlint-config)](https://www.npmjs.com/package/@sandrinodm/oxlint-config)
[![CI](https://github.com/sandrinodm/oxlint-config/actions/workflows/ci.yml/badge.svg)](https://github.com/sandrinodm/oxlint-config/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@sandrinodm/oxlint-config)](./LICENSE)

A strict Oxlint and Oxfmt preset for [Vite+](https://viteplus.dev). It is aimed at TypeScript and Effect codebases where a lot of the code is written by AI agents.

The preset:

- extends [`@cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config)
- turns the `correctness`, `suspicious` and `perf` categories on as errors
- enables type-aware linting with `typeCheck`
- adds fourteen `slop/*` rules for patterns built-in rules don't catch: chained type assertions, raw `JSON.parse`, `throw` inside `Effect.gen`, comments about plans and tickets, missing JSDoc, and more

## Install

```sh
pnpm add -D @sandrinodm/oxlint-config
```

Requires `vite-plus` 1.7.0 or later. Node.js 22.18+, 24.11+ or 26+, the same range as Vite+.

## Use

Spread the presets into the root `vite.config.ts`:

```ts
import oxlintConfig, { fmtConfig } from '@sandrinodm/oxlint-config';
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
import oxlintConfig, { fmtConfig, restrictedImportsOverride } from '@sandrinodm/oxlint-config';
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

## What the preset sets

**Lint** (`default` export):

- Cloudflare's rule set, plus the `typescript`, `unicorn`, `oxc`, `import` and `jsdoc` plugins.
- Strict TypeScript rules: no `any`, the `no-unsafe-*` family, `no-non-null-assertion`, `no-floating-promises`, `switch-exhaustiveness-check`, and `consistent-type-imports` with separate `import type` statements.
- Size limits: complexity 14, depth 4, 4 parameters, 350 lines per file, 100 lines per function.
- Kebab-case file names, no barrel files, and no import cycles.
- A `no-restricted-imports` rule banning Zod (use Effect Schema) and `../../../` imports.
- Effect idioms that Cloudflare's rules would report stay allowed: namespace imports of local modules (`import * as Body from './body.ts'`), data-first calls such as `Effect.catch(effect, handler)`, and `cause` as well as `error` for rejection handler parameters.
- In `*.test.*` and `*.spec.*` files: the vitest plugin, no size limits, and no fixed sleeps. Tests, stories, fixtures, `.d.ts` files and `vite.config.ts` don't need JSDoc.

**Format** (`fmtConfig`):

- Single quotes, semicolons, trailing commas, 100 columns, and multiline JSDoc.
- Sorted `package.json` scripts.
- Grouped imports: type imports first, then external, internal and relative.
- Line wrapping in Markdown prose is kept as written.
- Build output, `routeTree.gen.ts` and `bun.lock` are ignored.

## Rules

| Rule                              | Reports                                                               | Options                                  |
| --------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `slop/no-chained-type-assertions` | `x as unknown as T`                                                   |                                          |
| `slop/no-disable-safety-rules`    | inline disables of type-safety and test-integrity rules               |                                          |
| `slop/no-raw-json-parse`          | `JSON.parse` instead of Effect Schema decoding                        |                                          |
| `slop/no-instanceof`              | `instanceof` against package or app classes (allows global built-ins) | `allow`                                  |
| `slop/no-conditional-spread`      | spreads that add or omit keys based on a condition (`? : {}`, `&&`)   |                                          |
| `slop/no-fixed-sleep-in-tests`    | `setTimeout` / `Bun.sleep` in tests                                   |                                          |
| `slop/kebab-case-imports`         | non-kebab-case local import paths                                     | `workspaceScopes`                        |
| `slop/no-tests-directory`         | `__tests__` directories, and imports through them                     | `workspaceScopes`                        |
| `slop/blank-line-after-if`        | a missing blank line after a control block                            |                                          |
| `slop/no-throw-in-effect-gen`     | `throw` inside `Effect.gen` / `Effect.fn`                             |                                          |
| `slop/no-console-in-effect-gen`   | `console.*` inside Effect generators                                  |                                          |
| `slop/no-banner-comments`         | divider and `#region` comments                                        |                                          |
| `slop/no-history-comments`        | comments about plans, tickets or past changes                         |                                          |
| `slop/require-jsdoc`              | missing multiline JSDoc on declarations, members, schemas             | `require{Zod,EffectSchema,Drizzle}JsDoc` |

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
export type OmitUndefined<T> = {
  readonly [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  readonly [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends object>(value: T): OmitUndefined<T>;
export function omitUndefined<T extends object>(value: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in value) {
    if (Object.hasOwn(value, key) && value[key] !== undefined) {
      result[key] = value[key];
    }
  }

  return result;
}
```

`workspaceScopes` lists package-scope prefixes, such as `['@acme/']`. Subpaths under those scopes are checked like local files; other scoped packages count as external.

## Credits

The preset builds on [`@cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config), which builds on [`@nkzw/oxlint-config`](https://github.com/nkzw-tech/oxlint-config). Several `slop/*` rules follow ideas from Dillon Mulroy's [anti-slop](https://github.com/dmmulroy/anti-slop) rules, reimplemented on `vite-plus/lint/plugins`.

## License

[MIT](./LICENSE)
