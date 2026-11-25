import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noConditionalSpread } from './no-conditional-spread.ts';

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
 * Expected error for one reported spread.
 */
const error = { messageId: 'conditionalSpread' };

ruleTester.run('no-conditional-spread', noConditionalSpread, {
  valid: [
    'const result = { value };',
    'const result = { ...values };',
    'const result = omitUndefined({ limit: params.limit });',
    // Spreading an existing object with a fallback is not key omission
    'const result = { ...(isRecord(nested) ? nested : {}) };',
    'const result = { ...(options ?? {}) };',
    'const result = { ...(options || {}) };',
    // A conditional whole object is not a spread
    'const query = limit !== undefined ? { limit } : {};',
    // Array spreads are out of scope
    'const items = [...(enabled ? [item] : [])];',
    // Both branches add keys
    "const result = { ...(admin ? { role: 'admin' } : { role: 'user' }) };",
  ],
  invalid: [
    { code: 'const result = { ...(limit !== undefined ? { limit } : {}) };', errors: [error] },
    { code: 'const result = { ...(limit === undefined ? {} : { limit }) };', errors: [error] },
    { code: 'const result = { ...(limit !== undefined && { limit }) };', errors: [error] },
    { code: 'const result = { ...(enabled ? { flag: true } : undefined) };', errors: [error] },
    { code: 'const result = { ...(enabled ? { flag: true } : null) };', errors: [error] },
    { code: 'const result = { ...(enabled ? { flag: true } : false) };', errors: [error] },
    { code: 'const result = { ...(enabled ? { flag: true } : void 0) };', errors: [error] },
    {
      code: 'const result = { ...((enabled ? { flag: true } : {}) as Partial<Flags>) };',
      errors: [error],
    },
    {
      code: 'const result = { a, ...(x && { x }), ...(y ? { y } : {}) };',
      errors: [error, error],
    },
  ],
});
