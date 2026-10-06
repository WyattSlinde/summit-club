import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePainter } from '../app/frame-painter.ts';

test('several decode completions paint only the newest pose and do not animate afterward', () => {
  let id=0; const queued=new Map(),painted=[];
  const painter=new FramePainter(value=>painted.push(value),callback=>{queued.set(++id,callback);return id},id=>queued.delete(id));
  painter.queue('old bitmap');painter.queue('new bitmap');painter.queue('new HD pair');
  assert.equal(queued.size,1);assert.deepEqual(painted,[]);
  const [key,callback]=queued.entries().next().value;queued.delete(key);callback(100);
  assert.deepEqual(painted,['new HD pair']);assert.equal(queued.size,0);
  painter.flush();assert.equal(painted.length,1);
  painter.queue('current scroll pose');painter.flush();
  assert.deepEqual(painted,['new HD pair','current scroll pose']);assert.equal(queued.size,0,'scroll paints in its existing rAF without adding a frame of lag');
  painter.queue('obsolete pose');painter.dispose();painter.flush();painter.queue('after disposal');
  assert.equal(queued.size,0);assert.equal(painted.length,2);
});
