import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * How long `npm install` of the tarball may take: it downloads every dependency on a cold cache.
 */
const INSTALL_TIMEOUT_MS = 300_000;

/**
 * How long one lint or type-check run in the consumer may take.
 */
const COMMAND_TIMEOUT_MS = 120_000;

/**
 * TypeScript sources other than declarations, which must not ship: consumers load the built modules
 * from `node_modules`, where Node does not strip types.
 */
const TYPESCRIPT_SOURCE_PATTERN = /(?<!\.d)\.(ts|tsx)$/;

/**
 * The repository the tarball was packed from.
 */
const root = resolve(import.meta.dirname, '..');

/**
 * The tarball supplied by CI or a local `pnpm pack` command.
 */
const tarball = process.argv[2];
assert.ok(tarball, 'Usage: pnpm test:package /absolute/path/to/oxlint-config.tgz');

/**
 * The manifest of the checkout, which the packed tarball must match.
 */
const sourceManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/**
 * Reads the version of a dependency installed in this checkout, so the consumer runs the same
 * toolchain CI tested against.
 */
const installedVersion = (name) =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;

/**
 * An isolated consumer project outside the checkout and its development dependencies, removed when
 * the script exits.
 */
const consumer = mkdtempSync(join(tmpdir(), 'oxlint-config-package-'));
process.on('exit', () => rmSync(consumer, { recursive: true, force: true }));

writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2),
);

execFileSync(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    resolve(tarball),
    `vite-plus@${installedVersion('vite-plus')}`,
    `typescript@${installedVersion('typescript')}`,
    `@types/node@${installedVersion('@types/node')}`,
  ],
  { cwd: consumer, stdio: 'inherit', timeout: INSTALL_TIMEOUT_MS },
);

/**
 * Where npm installed the package under test inside the consumer.
 */
const installed = join(consumer, 'node_modules', sourceManifest.name);

/**
 * The manifest npm installed from the tarball.
 */
const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
assert.equal(manifest.version, sourceManifest.version);

for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  for (const version of Object.values(manifest[section] ?? {})) {
    assert.ok(
      !version.startsWith('catalog:') && !version.startsWith('workspace:'),
      'pnpm must resolve catalog and workspace versions before publishing',
    );
  }
}

/**
 * Every path inside the installed package.
 */
const shipped = readdirSync(installed, { recursive: true }).map(String);

/**
 * Shipped TypeScript sources, which must be empty.
 */
const sources = shipped.filter((name) => TYPESCRIPT_SOURCE_PATTERN.test(name));
assert.deepEqual(sources, [], 'The package must not ship TypeScript sources');
assert.ok(!shipped.some((name) => name.includes('.test.')), 'The package must not ship tests');

writeFileSync(
  join(consumer, 'vite.config.ts'),
  `import oxlintConfig, { fmtConfig, restrictedImportsOverride } from '${sourceManifest.name}';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ...fmtConfig,
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
    },
    overrides: [
      ...oxlintConfig.overrides,
      restrictedImportsOverride(['src/domain/**/*.ts'], [{ group: ['node:*'] }]),
    ],
  },
});
`,
);

writeFileSync(
  join(consumer, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'ES2025',
        types: ['node'],
        module: 'nodenext',
        moduleResolution: 'nodenext',
        skipLibCheck: true,
      },
      include: ['src', 'vite.config.ts'],
    },
    null,
    2,
  ),
);

mkdirSync(join(consumer, 'src'));
writeFileSync(
  join(consumer, 'src', 'sample.ts'),
  `/**
 * Parsed fixture.
 */
export const parsed: unknown = JSON.parse('{}');

/**
 * Deliberate type error.
 */
export const count: number = 'one';
`,
);

/**
 * Process options shared by the consumer's type-check and lint runs.
 */
const options = {
  /**
   * Run inside the consumer project.
   */
  cwd: consumer,

  /**
   * Return output as strings.
   */
  encoding: 'utf8',

  /**
   * Fail instead of hanging on a stuck process.
   */
  timeout: COMMAND_TIMEOUT_MS,
};

// Type-check only the consumer config: `src/sample.ts` holds a deliberate type error for lint.
execFileSync(
  join(consumer, 'node_modules/.bin/tsc'),
  [
    '--ignoreConfig',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ES2025',
    '--module',
    'nodenext',
    '--moduleResolution',
    'nodenext',
    '--types',
    'node',
    'vite.config.ts',
  ],
  { ...options, stdio: 'inherit' },
);

/**
 * The consumer's `vp lint` run over the fixture, which is expected to fail.
 */
const lint = spawnSync(join(consumer, 'node_modules/.bin/vp'), ['lint', 'src'], options);

/**
 * Combined lint output searched for the expected diagnostics.
 */
const output = `${lint.stdout}${lint.stderr}`;
assert.notEqual(lint.status, 0, 'The fixture must fail lint');
assert.match(output, /slop\(no-raw-json-parse\)/, `The slop plugin did not load:\n${output}`);
assert.match(output, /TS2322/, `Type-aware checking did not run:\n${output}`);

console.log(`Package smoke test passed for ${manifest.name}@${manifest.version}.`);
