import test from 'node:test';
import assert from 'node:assert/strict';
import { monthOptions, monthEnd, pacificDate } from '../lib/trail-community.ts';

test('monthly selections follow Pacific time across UTC month boundaries, DST and leap years', () => {
  assert.equal(pacificDate(new Date('2026-11-01T06:59:59Z')), '2026-10-31');
  assert.equal(pacificDate(new Date('2026-11-01T07:00:00Z')), '2026-11-01');
  assert.equal(pacificDate(new Date('2026-03-08T09:00:00Z')), '2026-03-08');
  const months = monthOptions('2026-01-03'); assert.equal(months.length, 12); assert.equal(months[1].value, '2025-12-01'); assert.equal(months.at(-1).value, '2025-02-01');
  assert.equal(monthEnd('2024-02-01','2026-01-03'), '2024-02-29');
  assert.equal(monthEnd('2026-02-01','2026-02-06'), '2026-02-06');
});
