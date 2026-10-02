import assert from 'node:assert/strict';
import test from 'node:test';
import { dataTopic, publishNtfy } from '../lib/ntfy.js';

test('a usage publish asks ntfy to cache the message', async () => {
  let seen;
  await publishNtfy({
    server: 'https://ntfy.sh',
    topic: dataTopic('cu-example'),
    title: '5h 16%',
    message: '{"type":"snapshot"}',
    priority: 1,
    tags: ['snapshot'],
    fetch: async (url, options) => {
      seen = { url: String(url), headers: options.headers, body: JSON.parse(options.body) };
      return { ok: true, status: 200, text: async () => '' };
    },
  });
  assert.equal(seen.url, 'https://ntfy.sh');
  assert.equal(seen.headers.Cache, 'yes');
  assert.equal(seen.body.cache, 'yes');
  assert.equal(seen.body.topic, 'cu-example-data');
  assert.equal(seen.body.priority, 1);
});
