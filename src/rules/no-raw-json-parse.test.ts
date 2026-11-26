import { RuleTester } from 'vite-plus/lint/plugins-dev';
import { describe, it } from 'vite-plus/test';

import { noRawJsonParse } from './no-raw-json-parse.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

ruleTester.run('no-raw-json-parse', noRawJsonParse, {
  valid: [
    {
      name: 'allows validating JSON through an Effect schema',
      code: 'Schema.decodeUnknownSync(Schema.fromJsonString(MySchema))(input);',
    },
  ],
  invalid: [
    {
      name: 'reports a raw JSON parse',
      code: 'JSON.parse(input);',
      errors: [{ messageId: 'useSchema' }],
    },
  ],
});
