# Security policy

## Supported versions

Security fixes go into the latest published version of `@yieldkit/oxlint-config`. Upgrade to the newest release before reporting an issue that may already be fixed.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use [GitHub private vulnerability reporting](https://github.com/yieldkit/oxlint-config/security/advisories/new) to share the details with the maintainer.

Include the affected version, the `vite-plus` version, reproduction steps and the expected impact. Do not include secrets or personal data in the report.

## Scope

The preset runs inside `vp lint` with the permissions of the developer or CI job. Reports are most useful for rules that crash or hang on crafted input (for example catastrophic regular-expression backtracking), and for anything that makes the plugin read or execute files outside the linted project.
