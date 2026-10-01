import assert from 'node:assert/strict';
import test from 'node:test';
import { describeWindow, formatRemaining, formatWhen, tokenStillValid } from '../lib/time.js';

const now = Date.parse('2026-10-01T16:00:00.000Z');

test('London is one hour ahead of UTC in early October', () => {
  const formatted = formatWhen('2026-10-01T17:00:00.000Z', 'Europe/London');
  assert.match(formatted, /18:00/);
  assert.doesNotMatch(formatted, /17:00/);
});

test('remaining time is rounded to minutes', () => {
  assert.equal(formatRemaining('2026-10-01T17:14:00.000Z', now), 'resets in 1h 14m');
  assert.equal(formatRemaining('2026-10-01T15:00:00.000Z', now), 'reset 1h ago');
});

test('describeWindow includes the percent and the UK clock time', () => {
  const text = describeWindow(
    {
      label: '5-hour session',
      usedPercent: 86,
      resetsAt: '2026-10-01T17:00:00.000Z',
    },
    now,
    'Europe/London',
  );
  assert.match(text, /86%/);
  assert.match(text, /resets in 1h/);
  assert.match(text, /18:00/);
});

test('a token expiring inside two minutes is treated as due for refresh', () => {
  assert.equal(tokenStillValid(now + 60 * 1000, now), false);
  assert.equal(tokenStillValid(now + 10 * 60 * 1000, now), true);
  assert.equal(tokenStillValid(Math.floor((now + 10 * 60 * 1000) / 1000), now), true);
});
