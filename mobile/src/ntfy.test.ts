import assert from 'node:assert/strict';
import test from 'node:test';
import type { Snapshot } from './model.ts';
import { pollUrl, settingsFromInput } from './ntfy.ts';
import { widgetFromSnapshot } from './widget-data.ts';

const snapshot: Snapshot = {
  v: 1,
  type: 'snapshot',
  fetchedAt: '2026-10-01T16:00:00.000Z',
  plan: 'Pro',
  timeZone: 'Europe/London',
  extraUsageLabel: null,
  windows: [
    {
      id: 'session',
      label: '5-hour session',
      shortLabel: '5h',
      usedPercent: 16,
      resetsAt: '2026-10-01T17:00:00.000Z',
      severity: null,
    },
    {
      id: 'weekly',
      label: 'Weekly (all models)',
      shortLabel: 'Week',
      usedPercent: 13,
      resetsAt: '2026-10-05T16:00:00.000Z',
      severity: null,
    },
  ],
  recent: [],
};

test('the phone polls the data topic for the whole cache window', () => {
  assert.equal(pollUrl('https://ntfy.sh', 'cu-example'), 'https://ntfy.sh/cu-example-data/json?poll=1&since=12h');
  assert.equal(pollUrl('https://ntfy.sh/', 'cu-example', '2h').includes('/cu-example/json'), false);
});

test('a pasted topic, URL, or data-topic name all become the phone topic', () => {
  assert.deepEqual(settingsFromInput('cu-example'), { topic: 'cu-example', server: 'https://ntfy.sh' });
  assert.deepEqual(settingsFromInput('https://ntfy.sh/cu-example'), {
    topic: 'cu-example',
    server: 'https://ntfy.sh',
  });
  assert.deepEqual(settingsFromInput('https://ntfy.sh/cu-example-data'), {
    topic: 'cu-example',
    server: 'https://ntfy.sh',
  });
  assert.deepEqual(settingsFromInput('cu-example-data'), { topic: 'cu-example', server: 'https://ntfy.sh' });
});

test('widget meters use the session and weekly windows from a snapshot', () => {
  const widget = widgetFromSnapshot(snapshot, true);
  assert.equal(widget.signedIn, true);
  assert.equal(widget.plan, 'Pro');
  assert.equal(widget.sessionPercent, 16);
  assert.equal(widget.weeklyPercent, 13);
  assert.equal(widget.sessionReset, '2026-10-01T17:00:00.000Z');
  assert.equal(widget.weeklyReset, '2026-10-05T16:00:00.000Z');
  assert.equal(widgetFromSnapshot(null, false).signedIn, false);
});
