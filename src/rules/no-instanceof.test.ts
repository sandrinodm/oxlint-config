import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noInstanceof } from './no-instanceof.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

/**
 * Builds an invalid case expecting one report that names `name`.
 */
const reported = (
  code: string,
  name: string,
  options: RuleTester.InvalidTestCase['options'] = [],
): RuleTester.InvalidTestCase => ({
  code,
  options,
  errors: [{ messageId: 'noInstanceof', data: { name } }],
});

ruleTester.run('no-instanceof', noInstanceof, {
  valid: [
    // Global built-ins
    'const ok = value instanceof Date;',
    'const ok = value instanceof Map || value instanceof Set;',
    'const ok = value instanceof Uint8Array;',
    'const ok = error instanceof Error;',
    'const ok = error instanceof TypeError;',
    'const ok = error instanceof SuppressedError;',
    'const ok = port instanceof MessageChannel;',
    'const ok = node instanceof Comment;',
    'const ok = target instanceof HTMLElement;',
    'const ok = target instanceof HTMLInputElement;',
    'const ok = event instanceof KeyboardEvent;',
    'const ok = format instanceof Intl.DateTimeFormat;',
    'const ok = mod instanceof WebAssembly.Module;',
    // Equivalent spellings of a global built-in
    'const ok = value instanceof globalThis.Date;',
    "const ok = value instanceof globalThis['Date'];",
    'const ok = value instanceof globalThis?.Date;',
    'const ok = value instanceof globalThis.window.Date;',
    'const ok = target instanceof window.HTMLElement;',
    'const ok = value instanceof (Date satisfies DateConstructor);',
    'const ok = value instanceof (Date as DateConstructor);',
    // `allow` matches exact dotted paths
    {
      code: 'const ok = error instanceof LegacyError;',
      options: [{ allow: ['LegacyError'] }],
    },
    {
      code: 'const ok = error instanceof CircuitBreaker.CircuitBreakerError;',
      options: [{ allow: ['CircuitBreaker.CircuitBreakerError'] }],
    },
    {
      code: 'const ok = error instanceof ns.errors.LegacyError;',
      options: [{ allow: ['ns.errors.LegacyError'] }],
    },
  ],
  invalid: [
    // Package and app classes
    reported('const bad = error instanceof HttpRequestError;', 'HttpRequestError'),
    reported('const bad = error instanceof InvalidJobParams;', 'InvalidJobParams'),
    reported(
      'const bad = error instanceof CircuitBreaker.CircuitBreakerError;',
      'CircuitBreaker.CircuitBreakerError',
    ),
    reported('const bad = value instanceof Array;', 'Array'),
    // A `*Event` or `*Element` class from the app is not a DOM class
    reported(
      'class OrderPlacedEvent {}\nconst bad = value instanceof OrderPlacedEvent;',
      'OrderPlacedEvent',
    ),
    reported(
      'class HTMLFancyElement {}\nconst bad = value instanceof HTMLFancyElement;',
      'HTMLFancyElement',
    ),
    // Built-in names that resolve to an import or a local binding
    reported("import { Buffer } from 'buffer';\nconst bad = value instanceof Buffer;", 'Buffer'),
    reported(
      "import { Response } from 'undici';\nconst bad = res instanceof Response;",
      'Response',
    ),
    reported('class Node {}\nconst bad = value instanceof Node;', 'Node'),
    reported(
      'function check(Error: unknown, value: unknown) { return value instanceof Error; }',
      'Error',
    ),
    reported(
      'function check(window: Record<string, unknown>, value: unknown) { return value instanceof window.Date; }',
      'window.Date',
    ),
    // Global objects do not make an app class a built-in
    reported('const bad = error instanceof globalThis.HttpRequestError;', 'HttpRequestError'),
    // Nested paths keep their owner, in the message and for `allow`
    reported('const bad = value instanceof deps.http.Map;', 'deps.http.Map'),
    reported('const bad = error instanceof ns.errors.LegacyError;', 'ns.errors.LegacyError', [
      { allow: ['LegacyError'] },
    ]),
    // Dynamic constructors
    reported('const bad = value instanceof getClass();', 'this value'),
    reported('const bad = value instanceof this.Map;', 'this value'),
    reported('const bad = value instanceof registry[key];', 'this value'),
  ],
});
