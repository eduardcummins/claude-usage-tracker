import assert from 'node:assert/strict';
import test from 'node:test';
import { barColor, barSegments, markerCenter, widgetMetrics, widgetPalettes } from './widget-layout.ts';

test('the marker stays fully on the bar', () => {
  assert.equal(markerCenter(288, 0, 14), 7);
  assert.equal(markerCenter(288, 100, 14), 281);
  assert.equal(markerCenter(288, 16, 14), 46.08);
  assert.equal(markerCenter(10, 40, 14), 5);
});

test('fill and track meet at the marker', () => {
  const mid = barSegments(288, 16, 14);
  assert.equal(mid.showMarker, true);
  assert.ok(Math.abs(mid.left + 14 + mid.right - 288) < 0.001);
  assert.ok(Math.abs(mid.left + 7 - mid.center) < 0.001);

  const start = barSegments(288, 0, 14);
  assert.equal(start.left, 0);
  assert.equal(start.showMarker, true);
  assert.equal(start.right, 274);

  const full = barSegments(288, 100, 14);
  assert.equal(full.right, 0);
  assert.equal(full.left, 274);

  const empty = barSegments(288, null, 14);
  assert.deepEqual(empty, { center: 0, left: 0, right: 288, showMarker: false });
});

test('ninety percent and above uses the danger color', () => {
  assert.equal(barColor(89, widgetPalettes.light), widgetPalettes.light.accent);
  assert.equal(barColor(90, widgetPalettes.light), widgetPalettes.light.danger);
  assert.equal(barColor(100, widgetPalettes.dark), widgetPalettes.dark.danger);
  assert.equal(barColor(null, widgetPalettes.dark), widgetPalettes.dark.accent);
});

test('common widget sizes keep readable padding', () => {
  const tight = widgetMetrics(250, 140);
  const fourByTwo = widgetMetrics(320, 140);
  const wide = widgetMetrics(420, 180);
  assert.equal(tight.padX, 14);
  assert.equal(tight.padY, 10);
  assert.equal(fourByTwo.padX, 18);
  assert.equal(fourByTwo.padY, 10);
  assert.equal(wide.padX, 18);
  assert.equal(wide.padY, 16);
  assert.ok(wide.label > tight.label);
  assert.ok(wide.bar >= tight.bar);
  assert.ok(320 - fourByTwo.padX * 2 > 200);
  assert.ok(250 - tight.padX * 2 > 180);
});
