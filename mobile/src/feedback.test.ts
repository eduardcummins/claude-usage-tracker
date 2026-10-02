import assert from 'node:assert/strict';
import test from 'node:test';
import { FEEDBACK_URL } from './feedback.ts';

test('feedback opens an email to the developer', () => {
  assert.equal(FEEDBACK_URL, 'mailto:eduardcummins@gmail.com?subject=Cluse%20feedback');
});
