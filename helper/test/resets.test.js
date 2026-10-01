import assert from 'node:assert/strict';
import test from 'node:test';
import { alertCopy, detectResetWindows, previousWindows, unseenResets } from '../lib/resets.js';

const session = (resetsAt, usedPercent = 10) => ({
  id: 'session',
  label: '5-hour session',
  shortLabel: '5h',
  usedPercent,
  resetsAt,
});

test('a later reset time is a new window', () => {
  const found = detectResetWindows(
    [session('2026-10-01T17:00:00.000Z', 86)],
    [session('2026-10-01T22:00:00.000Z', 4)],
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].usedPercent, 4);
});

test('the same reset time is not an alert', () => {
  const stamp = '2026-10-01T17:00:00.000Z';
  assert.deepEqual(detectResetWindows([session(stamp)], [session(stamp, 90)]), []);
});

test('a one-second timestamp rewrite is not an alert', () => {
  assert.deepEqual(
    detectResetWindows(
      [session('2026-10-01T17:00:00.000Z')],
      [session('2026-10-01T17:00:30.000Z')],
    ),
    [],
  );
});

test('the first snapshot has no previous window to compare', () => {
  assert.equal(previousWindows({ mode: null, lastSnapshot: null }, 'live'), null);
  assert.equal(
    previousWindows(
      { mode: 'mock', lastSnapshot: { windows: [session('2026-10-01T17:00:00.000Z')] } },
      'live',
    ),
    null,
  );
});

test('a reset already sent is not sent again', () => {
  const next = [session('2026-10-01T22:00:00.000Z', 4)];
  assert.deepEqual(unseenResets(next, { session: '2026-10-01T22:00:00.000Z' }), []);
});

test('alert text uses UK time, not UTC', () => {
  const copy = alertCopy([session('2026-10-01T22:00:00.000Z', 4)], 'Europe/London');
  assert.match(copy.message, /23:00/);
  assert.doesNotMatch(copy.message, /22:00/);
  assert.match(copy.message, /UK time/);
  assert.equal(copy.title, '5-hour session reset');
});
