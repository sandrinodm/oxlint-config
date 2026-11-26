import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import effect from './effect.ts';

const TEST_FILES = ['sample.test.mts', 'sample.spec.js'];
const FUNCTION_LINES = 105;
const TEST_SOURCE = `export const helper = 1;
it.only('waits', () => {
  setTimeout(run, 10);
${'  run();\n'.repeat(FUNCTION_LINES)}});
`;
const SIZE_SOURCE = `export function run(a, b, c, d, e) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            return true;
          }
        }
      }
    }
  }

  return a || b || c || d || e || a || b || c || d || e || a;
}
`;

describe('test overrides', () => {
  let diagnostics: Array<string> = [];
  const testFileReports = new Map<string, string>();

  beforeAll(() => {
    const fixture = mkdtempSync(join(tmpdir(), 'oxlint-config-'));
    try {
      const config = new URL('./config.ts', import.meta.url).href;
      const vp = fileURLToPath(import.meta.resolve('vite-plus/bin'));
      writeFileSync(join(fixture, 'package.json'), '{"name":"lint-fixture","type":"module"}');
      writeFileSync(
        join(fixture, 'vite.config.ts'),
        `import base from '${config}';
export default { lint: { ...base, options: { ...base.options, typeAware: false, typeCheck: false } } };
`,
      );
      for (const filename of TEST_FILES) {
        writeFileSync(join(fixture, filename), TEST_SOURCE);
      }

      writeFileSync(join(fixture, 'size.js'), SIZE_SOURCE);
      writeFileSync(join(fixture, 'size.test.js'), SIZE_SOURCE);
      const result = spawnSync(
        process.execPath,
        [vp, 'lint', '--format', 'unix', ...TEST_FILES, 'size.js', 'size.test.js'],
        { cwd: fixture, encoding: 'utf8' },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 1, result.stderr);
      diagnostics = result.stdout.split('\n');
      for (const filename of TEST_FILES) {
        const reports = diagnostics.filter((line) => line.startsWith(`${filename}:`)).join('\n');
        testFileReports.set(filename, reports);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  for (const filename of TEST_FILES) {
    it(`reports fixed sleeps in ${filename}`, () => {
      expect(testFileReports.get(filename)).toContain('slop(no-fixed-sleep-in-tests)');
    });

    it(`allows undocumented declarations in ${filename}`, () => {
      expect(testFileReports.get(filename)).not.toContain('slop(require-jsdoc)');
    });

    it(`allows long functions in ${filename}`, () => {
      expect(testFileReports.get(filename)).not.toContain('eslint(max-lines-per-function)');
    });

    it(`allows direct Effect provisioning in ${filename}`, () => {
      const override = effect.overrides.at(-1);
      expect(override?.files.some((pattern) => matchesGlob(`src/${filename}`, pattern))).toBe(true);
      expect(override?.rules).toHaveProperty('effecttsgo/strict-effect-provide', 'off');
    });
  }

  for (const rule of ['max-params', 'max-depth', 'complexity']) {
    it(`keeps ${rule} enabled only for the production fixture`, () => {
      const reports = diagnostics.filter((line) => line.includes(`eslint(${rule})`));
      expect(reports.some((line) => line.startsWith('size.js:'))).toBe(true);
      expect(reports.some((line) => line.startsWith('size.test.js:'))).toBe(false);
    });
  }
});
