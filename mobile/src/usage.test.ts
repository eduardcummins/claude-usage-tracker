import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { detectResetWindows, parseUsageResponse, planAlarms } from './usage.ts';

const now = Date.parse('2026-10-01T12:00:00Z');

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../helper/fixtures/${name}`, import.meta.url), 'utf8'));
}

test('the current usage payload becomes the 5-hour and weekly windows', () => {
  const parsed = parseUsageResponse(fixture('usage-fable.json'));
  assert.deepEqual(
    parsed.windows.map((window) => [window.id, window.usedPercent, window.resetsAt]),
    [
      ['session', 12, '2026-10-01T17:00:00.000Z'],
      ['weekly', 9, '2026-10-05T16:00:00.000Z'],
      ['weekly:Fable', 41, '2026-10-05T16:00:00.000Z'],
    ],
  );
});

test('the older named usage fields still parse', () => {
  const parsed = parseUsageResponse(fixture('usage-legacy.json'));
  assert.equal(parsed.windows[0].id, 'session');
  assert.equal(parsed.windows[1].id, 'weekly');
});

test('a later reset time is a new window', () => {
  const previous = [{ id: 'session', label: '5-hour session', shortLabel: '5h', usedPercent: 90, resetsAt: '2026-10-01T13:00:00.000Z', severity: null }];
  const next = [{ ...previous[0], usedPercent: 4, resetsAt: '2026-10-01T18:00:00.000Z' }];
  assert.equal(detectResetWindows(previous, next).length, 1);
  assert.equal(detectResetWindows(null, next).length, 0);
  assert.equal(detectResetWindows(previous, previous).length, 0);
});

test('a reset notifies only when this phone had not already set an alarm', () => {
  const previous = [{ id: 'session', label: '5-hour session', shortLabel: '5h', usedPercent: 90, resetsAt: '2026-10-01T13:00:00.000Z', severity: null }];
  const next = [{ ...previous[0], usedPercent: 4, resetsAt: '2026-10-01T18:00:00.000Z' }];
  const missed = planAlarms({ previous, next, scheduled: {}, now });
  assert.equal(missed.notify.length, 1);
  assert.equal(missed.scheduled.session, next[0].resetsAt);
  const already = planAlarms({ previous, next, scheduled: { session: previous[0].resetsAt }, now });
  assert.equal(already.notify.length, 0);
});
