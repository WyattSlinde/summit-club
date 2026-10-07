import test from 'node:test';
import assert from 'node:assert/strict';
import { monthOptions, monthEnd, pacificDate, trailCatalog } from '../lib/trail-community.ts';
import { readFile } from 'node:fs/promises';

test('monthly selections follow Pacific time across UTC month boundaries, DST and leap years', () => {
  assert.equal(pacificDate(new Date('2026-11-01T06:59:59Z')), '2026-10-31');
  assert.equal(pacificDate(new Date('2026-11-01T07:00:00Z')), '2026-11-01');
  assert.equal(pacificDate(new Date('2026-03-08T09:00:00Z')), '2026-03-08');
  const months = monthOptions('2026-01-03'); assert.equal(months.length, 12); assert.equal(months[1].value, '2025-12-01'); assert.equal(months.at(-1).value, '2025-02-01');
  assert.equal(monthEnd('2024-02-01','2026-01-03'), '2024-02-29');
  assert.equal(monthEnd('2026-02-01','2026-02-06'), '2026-02-06');
});
test('the visible catalog matches the database seed and uses official source links', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261007005528_hike_ratings_and_gallery.sql', import.meta.url), 'utf8');
  for (const hike of trailCatalog) { assert.ok(sql.includes(`'${hike.id}'`)); assert.ok(sql.includes(`'${hike.name}'`)); assert.ok(sql.includes(hike.official_url)); assert.match(hike.official_url,/^https:\/\/www\.(parks\.ca\.gov|sandiego\.gov)\//); }
});
