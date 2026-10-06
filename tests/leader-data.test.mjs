import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, rosterCSV } from '../lib/leader-data.ts';

test('CSV exports quote student input and neutralize spreadsheet formulas', () => {
  for (const value of ['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)', '  =1', '\tHello']) {
    assert.ok(csvCell(value).startsWith('"\''));
  }
  assert.equal(csvCell('Taylor "T"'), '"Taylor ""T"""');
  const csv = rosterCSV([{name:'A, B',grade:'10',interest:'Serve',created_at:'2026-10-05T20:00:00Z',choices:'ridge,coast'}], id => ({ridge:'Hike',coast:'Cleanup'})[id]);
  assert.ok(csv.includes('"A, B","10","Serve","Hike; Cleanup","2026-10-05"'));
  assert.ok(!csv.includes('user_id'));
});
