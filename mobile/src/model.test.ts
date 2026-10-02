import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatRemaining,
  formatWhen,
  isValidTopic,
  latestAlert,
  latestSnapshot,
  OPEN_CLAUDE_CODE_NOTE,
  parseNtfyLines,
  presentPercent,
  presentSnapshot,
  resetCaption,
  topicFromInput,
  type Snapshot,
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

test('a waiting login keeps the last numbers and a passed reset shows 0%', () => {
  const now = Date.parse('2026-10-01T18:00:00.000Z');
  const snapshot: Snapshot = {
    v: 1,
    type: 'snapshot',
    status: 'waiting-login',
    notice: 'waiting for Claude Code login',
    fetchedAt: '2026-10-01T12:50:00.000Z',
    checkedAt: '2026-10-01T16:10:00.000Z',
    plan: 'Max 5x',
    timeZone: 'Europe/London',
    extraUsageLabel: null,
    windows: [
      {
        id: 'session',
        label: '5-hour session',
        shortLabel: '5h',
        usedPercent: 86,
        resetsAt: '2026-10-01T17:00:00.000Z',
        severity: null,
      },
      {
        id: 'weekly',
        label: 'Weekly (all models)',
        shortLabel: 'Week',
        usedPercent: 22,
        resetsAt: '2026-10-05T16:00:00.000Z',
        severity: null,
      },
    ],
    recent: [],
  };
  const earlier = {
    ...snapshot,
    status: undefined,
    checkedAt: undefined,
    fetchedAt: '2026-10-01T12:50:00.000Z',
    windows: snapshot.windows.map((window) => ({ ...window, usedPercent: 10 })),
  };
  const latest = latestSnapshot(parseNtfyLines([
    JSON.stringify({ event: 'message', id: '1', time: 1, message: JSON.stringify(earlier), tags: ['snapshot'] }),
    JSON.stringify({ event: 'message', id: '2', time: 2, message: JSON.stringify(snapshot), tags: ['snapshot'] }),
  ].join('\n')));
  assert.equal(latest?.status, 'waiting-login');
  const view = presentSnapshot(latest!, now);
  assert.equal(view.waitingNote, OPEN_CLAUDE_CODE_NOTE);
  assert.equal(view.windows[0].displayPercent, 0);
  assert.equal(view.windows[0].sinceResetNote, 'since reset');
  assert.equal(view.windows[0].usedPercent, 86);
  assert.equal(view.windows[1].displayPercent, 22);
  assert.equal(view.windows[1].sinceReset, false);
  assert.equal(presentSnapshot({ ...snapshot, status: undefined }, now).waitingNote, null);
  assert.equal(presentPercent(86, '2026-10-01T17:00:00.000Z', now).percent, 0);
  assert.equal(resetCaption('2026-10-01T17:00:00.000Z', now).includes('since reset'), true);
  assert.equal(resetCaption('2026-10-05T16:00:00.000Z', now).includes('since reset'), false);
});
