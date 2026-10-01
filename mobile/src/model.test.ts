import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatRemaining,
  formatWhen,
  isValidTopic,
  latestAlert,
  latestSnapshot,
  parseNtfyLines,
  topicFromInput,
} from './model.ts';

test('a pasted ntfy URL becomes the topic', () => {
  assert.equal(topicFromInput('https://ntfy.sh/cu-abc123'), 'cu-abc123');
  assert.equal(topicFromInput('cu-abc123-data'), 'cu-abc123');
  assert.equal(isValidTopic(topicFromInput('https://ntfy.sh/cu-abc123')), true);
  assert.equal(isValidTopic('has space'), false);
});

test('usage JSON is taken from the newest snapshot message', () => {
  const text = [
    JSON.stringify({ event: 'message', id: '1', time: 1, message: 'hello', tags: [] }),
    JSON.stringify({
      event: 'message',
      id: '2',
      time: 2,
      message: JSON.stringify({
        v: 1,
        type: 'snapshot',
        fetchedAt: '2026-10-01T16:00:00.000Z',
        plan: 'Max 5x',
        timeZone: 'Europe/London',
        windows: [],
        extraUsageLabel: null,
        recent: [],
      }),
      tags: ['snapshot'],
    }),
  ].join('\n');
  const snapshot = latestSnapshot(parseNtfyLines(text));
  assert.equal(snapshot?.plan, 'Max 5x');
});

test('reset and test messages are alerts, and UK time is used', () => {
  const messages = parseNtfyLines(
    JSON.stringify({
      event: 'message',
      id: '9',
      time: 50,
      title: '5-hour session reset',
      message: 'reset',
      tags: ['reset'],
    }),
  );
  assert.equal(latestAlert(messages)?.id, '9');
  assert.match(formatWhen('2026-10-01T17:00:00.000Z'), /18:00/);
  assert.equal(formatRemaining('2026-10-01T17:14:00.000Z', Date.parse('2026-10-01T16:00:00.000Z')), 'resets in 1h 14m');
});
