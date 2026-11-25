# Contributing

Thanks for helping improve `@yieldkit/oxlint-config`.

## Setup

Use Node.js 22.18+, 24.11+ or 26+ and the pnpm version declared in `package.json` (`devEngines`).

```bash
pnpm install
pnpm check
pnpm test
```

The repository lints and formats itself with the preset straight from `src/`, so a rule change applies to this codebase immediately.

## Layout

- `src/config.ts`: the lint preset (default export).
- `src/fmt.ts`: the Oxfmt preset (`fmtConfig`).
- `src/plugin.ts`: registers every `slop/*` rule.
- `src/rules/<rule-id>.ts`: one rule per file, with `<rule-id>.test.ts` next to it.
- `src/internal/`: AST helpers shared by more than one rule.

## Adding or changing a rule

1. Add `src/rules/<rule-id>.ts` and export the rule from it with `defineRule` from `vite-plus/lint/plugins`.
2. Register it in `src/plugin.ts` and enable it in `src/config.ts`.
3. Cover valid and invalid code in `src/rules/<rule-id>.test.ts` with `RuleTester` from `vite-plus/lint/plugins-dev`.
4. Add it to the rules table in `README.md`.

Messages should say what to do instead, not only what is wrong.

## Before opening a pull request

```bash
pnpm check
pnpm test
pnpm pack --out /tmp/oxlint-config.tgz
pnpm test:package /tmp/oxlint-config.tgz
```

`test:package` installs the packed tarball into a temporary project and checks that the `slop` plugin loads from `dist/` and type-aware linting runs.

## Commits and releases

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`).

To release, bump `version` in `package.json` on `main`, wait for CI to pass, then publish a GitHub release tagged `v<version>`. The publish workflow checks the tag matches `package.json` and CI passed for that commit, then publishes to npm with trusted publishing and provenance.
