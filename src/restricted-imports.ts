import type { OxlintOverride } from 'vite-plus/lint';

/**
 * Pattern entry accepted by `no-restricted-imports`.
 */
export type RestrictedImportPattern = {
  /**
   * Gitignore-style module specifier patterns to ban.
   */
  readonly group: Array<string>;

  /**
   * Explanation shown with the diagnostic.
   */
  readonly message?: string;
};

/**
 * Import patterns banned everywhere. Overrides that set `no-restricted-imports` replace the rule's
 * options, so they must repeat these; `restrictedImportsOverride` does that.
 */
export const BASE_RESTRICTED_IMPORT_PATTERNS: ReadonlyArray<RestrictedImportPattern> = [
  {
    group: ['zod', 'zod/*'],
    message: 'Use Effect Schema (`import { Schema } from "effect"`) instead of Zod.',
  },
  {
    group: ['../../../*'],
    message: 'Avoid deep relative imports (`../../../`). Use a workspace or path alias instead.',
  },
];

/**
 * Builds a `no-restricted-imports` override for `files` that bans `extraPatterns` on top of
 * `BASE_RESTRICTED_IMPORT_PATTERNS`.
 */
export const restrictedImportsOverride = (
  files: Array<string>,
  extraPatterns: ReadonlyArray<RestrictedImportPattern>,
): OxlintOverride => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: [...BASE_RESTRICTED_IMPORT_PATTERNS, ...extraPatterns] },
    ],
  },
});
