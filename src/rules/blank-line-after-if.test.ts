import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { blankLineAfterIf } from './blank-line-after-if.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('blank-line-after-if', blankLineAfterIf, {
  valid: [
    {
      name: 'allows a blank line before a service constructor that assembles its methods',
      code: `const make = Effect.gen(function* () {
  const one = Effect.fn('one')(function* (id: string) {
    return id;
  });
  const two = Effect.fn('two')(function* (id: string) {
    return id;
  });

  return Repo.of({ one, two });
});`,
    },
    {
      name: 'allows a blank line before a returned object of shorthand properties',
      code: `function make() {
  const find = () => 1;

  return { find };
}`,
    },
    {
      name: 'keeps the blank line before import.meta when a local is named meta',
      code: `export function f() {
  const meta = 1;

  const url = import.meta.url;
  return [meta, url];
}`,
    },
    {
      name: 'keeps the blank line before new.target when a local is named target',
      code: `export function F() {
  const target = 1;

  const t = new.target;
  return [t, target];
}`,
    },
    // Already has blank lines after conditions and groups consecutive diffMs checks
    `export const formatRelativeUtc = (
  isoTimestamp: string,
  hydrated: boolean,
  nowMs?: number,
): string => {
  if (!hydrated) {
    return formatDeterministicUtcDate(isoTimestamp);
  }

  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) {
    return isoTimestamp;
  }

  const diffMs = (nowMs ?? Date.now()) - parsedMs;
  if (diffMs < 0) {
    return formatDeterministicUtcDate(isoTimestamp);
  }
  if (diffMs < MS_PER_MINUTE) {
    return 'just now';
  }
  if (diffMs < MS_PER_HOUR) {
    return \`\${Math.floor(diffMs / MS_PER_MINUTE)}m ago\`;
  }
  if (diffMs < MS_PER_DAY) {
    return \`\${Math.floor(diffMs / MS_PER_HOUR)}h ago\`;
  }

  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days < 30) {
    return \`\${days}d ago\`;
  }

  return formatDeterministicUtcDate(isoTimestamp);
};`,
    // Consecutive if statements testing the same constant with method calls
    `const classify = (pathPart: string): number | null => {
  if (pathPart.startsWith('./') || pathPart.startsWith('../')) {
    return 0;
  }
  if (pathPart.startsWith('~/') || pathPart.startsWith('@/')) {
    return 1;
  }
  if (pathPart.startsWith('@acme/')) {
    return 2;
  }

  return null;
};`,
    // Consecutive if statements testing the same constant with regex/set constants
    `const isValid = (segment: string): boolean => {
  if (segment === '' || segment === '.') return true;
  if (GENERATED_RE.test(segment) || DUNDER_RE.test(segment)) return true;

  return false;
};`,
    // Blank line before comment separating if and next statement
    `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }

  // Continue processing
  doWork();
};`,
    // Single if as last statement in block needs no trailing blank line
    `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }
};`,
    // Blank lines between same-subject ifs are also allowed
    `const normalize = (host: string) => {
  if (host === 'youtube.com') {
    return 'yt';
  }

  if (host === 'github.com') {
    return 'gh';
  }

  return host;
};`,
    // Control blocks followed by a blank line are valid
    `const processAll = (items: ReadonlyArray<number>, kind: string) => {
  for (const item of items) {
    work(item);
  }

  for (let i = 0; i < items.length; i += 1) {
    work(items[i]);
  }

  while (hasMore()) {
    step();
  }

  do {
    tick();
  } while (running());

  switch (kind) {
    case 'a': {
      handleA();
      break;
    }
    default: {
      handleDefault();
    }
  }

  try {
    commit();
  } catch (error) {
    recover(error);
  }

  return true;
};`,
    // Module-level constants separated from functions that use them are valid
    `const MAX_RETRIES = 3;

export const retryCount = (): number => MAX_RETRIES;`,
    // Module-level file-header JSDoc or line comment separated from first import is valid
    `/** Module overview. */

import { Effect } from 'effect';

// Helper section note

export const run = (): number => 1;`,
    // Setup declarations where an earlier variable is read by a later declaration allow a blank line before an if
    `const run = (args: ReadonlyArray<string>) => {
  const options = parseArgs(args);
  const files = listFiles(options.targets);

  if (options.write) {
    save(files);
  }
};`,
    // Variable only referenced inside a nested callback allows a blank line
    `const setup = (button: Element) => {
  const handler = () => {
    run();
  };

  button.addEventListener('click', () => {
    handler();
  });
};`,
    // Unrelated local declaration before next statement allows a blank line
    `const setup = () => {
  const a = computeA();

  const b = computeB();
  return [a, b];
};`,
    // Trailing inline comment on previous statement is not treated as a comment gap
    `const setup = () => {
  doFirst(); // ends first step

  doSecond();
};`,
  ],
  invalid: [
    {
      name: 'reports a blank line before a returned object that computes from the binding',
      code: `function make() {
  const total = 1;

  return { total: total + 1 };
}`,
      output: `function make() {
  const total = 1;
  return { total: total + 1 };
}`,
      errors: [{ messageId: 'splitStep' }],
    },
    {
      name: 'moves a trailing next-line directive with its statement',
      code: `function run() {
  if (ready) {} // oxlint-disable-next-line no-console
  console.log('x');
}`,
      output: `function run() {
  if (ready) {}

  // oxlint-disable-next-line no-console
  console.log('x');
}`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Example 1 from specification: formatRelativeUtc
    {
      code: `export const formatRelativeUtc = (
  isoTimestamp: string,
  hydrated: boolean,
  nowMs?: number,
): string => {
  if (!hydrated) {
    return formatDeterministicUtcDate(isoTimestamp);
  }
  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) {
    return isoTimestamp;
  }
  const diffMs = (nowMs ?? Date.now()) - parsedMs;
  if (diffMs < 0) {
    return formatDeterministicUtcDate(isoTimestamp);
  }
  if (diffMs < MS_PER_MINUTE) {
    return 'just now';
  }
  if (diffMs < MS_PER_HOUR) {
    return \`\${Math.floor(diffMs / MS_PER_MINUTE)}m ago\`;
  }
  if (diffMs < MS_PER_DAY) {
    return \`\${Math.floor(diffMs / MS_PER_HOUR)}h ago\`;
  }
  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days < 30) {
    return \`\${days}d ago\`;
  }
  return formatDeterministicUtcDate(isoTimestamp);
};`,
      output: `export const formatRelativeUtc = (
  isoTimestamp: string,
  hydrated: boolean,
  nowMs?: number,
): string => {
  if (!hydrated) {
    return formatDeterministicUtcDate(isoTimestamp);
  }

  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) {
    return isoTimestamp;
  }

  const diffMs = (nowMs ?? Date.now()) - parsedMs;
  if (diffMs < 0) {
    return formatDeterministicUtcDate(isoTimestamp);
  }
  if (diffMs < MS_PER_MINUTE) {
    return 'just now';
  }
  if (diffMs < MS_PER_HOUR) {
    return \`\${Math.floor(diffMs / MS_PER_MINUTE)}m ago\`;
  }
  if (diffMs < MS_PER_DAY) {
    return \`\${Math.floor(diffMs / MS_PER_HOUR)}h ago\`;
  }

  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days < 30) {
    return \`\${days}d ago\`;
  }

  return formatDeterministicUtcDate(isoTimestamp);
};`,
      errors: [
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
      ],
    },
    // Example 2 from specification: parseOptionalIsoDate
    {
      code: `export const parseOptionalIsoDate = (raw: string | undefined): IsoDate | undefined => {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const decoded = Schema.decodeUnknownResult(IsoDate)(raw.trim());
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};`,
      output: `export const parseOptionalIsoDate = (raw: string | undefined): IsoDate | undefined => {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const decoded = Schema.decodeUnknownResult(IsoDate)(raw.trim());
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Example 3 from specification: handleMessage
    {
      code: `const handleMessage = (message: MessageEvent<unknown>): void => {
  if (typeof message.data !== 'string' || message.data.trim().length === 0) {
    return;
  }
  const decoded = decodeAppEvent(message.data);
  if (Result.isFailure(decoded)) {
    return;
  }
  recordSseEvent();
  scheduleInvalidation(EVENT_QUERY_KEYS[decoded.success._tag]);
};`,
      output: `const handleMessage = (message: MessageEvent<unknown>): void => {
  if (typeof message.data !== 'string' || message.data.trim().length === 0) {
    return;
  }

  const decoded = decodeAppEvent(message.data);
  if (Result.isFailure(decoded)) {
    return;
  }

  recordSseEvent();
  scheduleInvalidation(EVENT_QUERY_KEYS[decoded.success._tag]);
};`,
      errors: [{ messageId: 'expectedBlankLine' }, { messageId: 'expectedBlankLine' }],
    },
    // Consecutive ifs about DIFFERENT variables still require a blank line
    {
      code: `const check = (a: number, b: number) => {
  if (a < MAX_LIMIT) {
    return 1;
  }
  if (b < MAX_LIMIT) {
    return 2;
  }
  return 0;
};`,
      output: `const check = (a: number, b: number) => {
  if (a < MAX_LIMIT) {
    return 1;
  }

  if (b < MAX_LIMIT) {
    return 2;
  }

  return 0;
};`,
      errors: [{ messageId: 'expectedBlankLine' }, { messageId: 'expectedBlankLine' }],
    },
    // Consecutive ifs testing different properties of an object require a blank line
    {
      code: `const check = (options: { date?: string; limit?: number }) => {
  if (options.date !== undefined) {
    applyDate(options.date);
  }
  if (options.limit !== undefined) {
    applyLimit(options.limit);
  }
};`,
      output: `const check = (options: { date?: string; limit?: number }) => {
  if (options.date !== undefined) {
    applyDate(options.date);
  }

  if (options.limit !== undefined) {
    applyLimit(options.limit);
  }
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Preserves leading comment attached to next statement
    {
      code: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }
  // Proceed when ok
  doWork();
};`,
      output: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }

  // Proceed when ok
  doWork();
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Preserves trailing same-line comment on closing brace
    {
      code: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  } // bail out
  doWork();
};`,
      output: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  } // bail out

  doWork();
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Single-line if statement followed by another statement
    {
      code: `const trim = (raw: string | null) => {
  if (!raw) return null;
  return raw.trim();
};`,
      output: `const trim = (raw: string | null) => {
  if (!raw) return null;

  return raw.trim();
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // if/else followed by another if requires blank line
    {
      code: `const run = (x: number) => {
  if (x < 0) {
    neg();
  } else {
    pos();
  }
  if (x > 10) {
    big();
  }
};`,
      output: `const run = (x: number) => {
  if (x < 0) {
    neg();
  } else {
    pos();
  }

  if (x > 10) {
    big();
  }
};`,
      errors: [{ messageId: 'expectedBlankLine' }],
    },
    // Blank line required after for, for-of, for-in, while, do-while, switch, and try
    {
      code: `const runLoops = (items: ReadonlyArray<string>, obj: Record<string, number>, kind: string) => {
  for (let i = 0; i < items.length; i += 1) {
    visit(items[i]);
  }
  for (const item of items) {
    visit(item);
  }
  for (const key in obj) {
    visit(key);
  }
  while (hasNext()) {
    step();
  }
  do {
    tick();
  } while (active());
  switch (kind) {
    case 'a': {
      doA();
      break;
    }
  }
  try {
    finish();
  } catch (error) {
    log(error);
  }
  return true;
};`,
      output: `const runLoops = (items: ReadonlyArray<string>, obj: Record<string, number>, kind: string) => {
  for (let i = 0; i < items.length; i += 1) {
    visit(items[i]);
  }

  for (const item of items) {
    visit(item);
  }

  for (const key in obj) {
    visit(key);
  }

  while (hasNext()) {
    step();
  }

  do {
    tick();
  } while (active());

  switch (kind) {
    case 'a': {
      doA();
      break;
    }
  }

  try {
    finish();
  } catch (error) {
    log(error);
  }

  return true;
};`,
      errors: [
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
        { messageId: 'expectedBlankLine' },
      ],
    },
    // split-step: removes blank line between local declaration and if/loop/return/call using it
    {
      code: `const run = (raw: string) => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const items = trimmed.split(',');

  for (const item of items) {
    consume(item);
  }

  const summary = buildSummary(items);

  return summary;
};`,
      output: `const run = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const items = trimmed.split(',');
  for (const item of items) {
    consume(item);
  }

  const summary = buildSummary(items);
  return summary;
};`,
      errors: [{ messageId: 'splitStep' }, { messageId: 'splitStep' }, { messageId: 'splitStep' }],
    },
    // split-step: handles contiguous declaration group feeding an if statement and destructuring
    {
      code: `const format = (ms: number, obj: { readonly count: number }) => {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor(ms / 3_600_000);

  if (days > 0) {
    return \`\${days}d \${hours}h\`;
  }

  const { count } = obj;

  notify(count);
};`,
      output: `const format = (ms: number, obj: { readonly count: number }) => {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor(ms / 3_600_000);
  if (days > 0) {
    return \`\${days}d \${hours}h\`;
  }

  const { count } = obj;
  notify(count);
};`,
      errors: [{ messageId: 'splitStep' }, { messageId: 'splitStep' }],
    },
    // comment-gap: removes blank line between standalone comment and statement inside a block
    {
      code: `const run = (ok: boolean) => {
  // Guard before work

  if (!ok) {
    return;
  }

  /* Execute main step */

  doWork();
};`,
      output: `const run = (ok: boolean) => {
  // Guard before work
  if (!ok) {
    return;
  }

  /* Execute main step */
  doWork();
};`,
      errors: [{ messageId: 'commentGap' }, { messageId: 'commentGap' }],
    },
    // comment-gap: removes blank line between module-level JSDoc and its declaration
    {
      code: `import { Effect } from 'effect';

/** Formats a value for display. */

export const formatValue = (value: number): string => String(value);`,
      output: `import { Effect } from 'effect';

/** Formats a value for display. */
export const formatValue = (value: number): string => String(value);`,
      errors: [{ messageId: 'commentGap' }],
    },
    // Combined: missing blank after block + comment-gap fixes cleanly in one pass
    {
      code: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }
  // Continue after guard

  doWork();
};`,
      output: `const run = (ok: boolean) => {
  if (!ok) {
    return;
  }

  // Continue after guard
  doWork();
};`,
      errors: [{ messageId: 'expectedBlankLine' }, { messageId: 'commentGap' }],
    },
  ],
});
