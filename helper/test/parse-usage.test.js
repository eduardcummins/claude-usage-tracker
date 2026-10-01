import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatPlan, normalizeTime, parseUsageResponse } from '../lib/parse-usage.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));
}

test('limits array wins over the older named fields', () => {
  const parsed = parseUsageResponse(fixture('usage-before.json'));
  assert.deepEqual(
    parsed.windows.map((window) => [window.id, window.usedPercent, window.shortLabel]),
    [
      ['session', 86, '5h'],
      ['weekly', 22, 'Week'],
    ],
  );
  assert.deepEqual(parsed.extraUsage, { usedUsd: 2.5, limitUsd: 1000 });
});

test('session reset moves forward in the after fixture', () => {
  const parsed = parseUsageResponse(fixture('usage-after.json'));
  assert.equal(parsed.windows[0].resetsAt, '2026-10-01T22:00:00.000Z');
  assert.equal(parsed.windows[0].usedPercent, 4);
});

test('model-scoped weekly limits use the display name', () => {
  const parsed = parseUsageResponse(fixture('usage-fable.json'));
  const fable = parsed.windows.find((window) => window.id === 'weekly:Fable');
  assert.ok(fable);
  assert.equal(fable.label, 'Weekly (Fable)');
  assert.equal(fable.usedPercent, 41);
});

test('legacy five_hour and seven_day fields still parse', () => {
  const parsed = parseUsageResponse(fixture('usage-legacy.json'));
  assert.deepEqual(
    parsed.windows.map((window) => window.id),
    ['session', 'weekly', 'weekly:Sonnet'],
  );
  assert.equal(parsed.windows[0].usedPercent, 35);
  assert.equal(parsed.windows[0].resetsAt, '2026-02-06T22:00:00.000Z');
});

test('timestamps without a timezone are read as UTC', () => {
  assert.equal(normalizeTime('2026-06-25T11:59:59'), '2026-06-25T11:59:59.000Z');
});

test('plan names come from the subscription and tier', () => {
  assert.equal(formatPlan('max', 'default_claude_max_5x'), 'Max 5x');
  assert.equal(formatPlan('max', 'default_claude_max_20x'), 'Max 20x');
  assert.equal(formatPlan('pro', ''), 'Pro');
});
