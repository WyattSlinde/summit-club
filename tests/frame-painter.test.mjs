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

test('default scheduling preserves the browser Window receiver', () => {
  const originals={window:globalThis.window,request:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};
  const callbacks=new Map();let nextId=0;const painted=[];
  const browserWindow={
    requestAnimationFrame(callback){assert.equal(this,browserWindow,'native requestAnimationFrame requires Window as its receiver');callbacks.set(++nextId,callback);return nextId;},
    cancelAnimationFrame(id){assert.equal(this,browserWindow,'native cancelAnimationFrame requires Window as its receiver');callbacks.delete(id);},
  };
  globalThis.window=browserWindow;globalThis.requestAnimationFrame=browserWindow.requestAnimationFrame;globalThis.cancelAnimationFrame=browserWindow.cancelAnimationFrame;
  try{
    const painter=new FramePainter(value=>painted.push(value));
    painter.queue('higgsfield frame');painter.flush();
    assert.deepEqual(painted,['higgsfield frame']);assert.equal(callbacks.size,0);
    painter.queue('next pose');painter.dispose();assert.equal(callbacks.size,0);
  }finally{
    if(originals.window===undefined)delete globalThis.window;else globalThis.window=originals.window;
    if(originals.request===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=originals.request;
    if(originals.cancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=originals.cancel;
  }
});

test('the real sequence reaches the peak and reverses without falling back through the default painter', async () => {
  const { ScrollSequence } = await import('../app/scroll-sequence.ts');
  const { framePositionForProgress, trailJourney } = await import('../app/trail-journey.ts');
  const originals={window:globalThis.window,fetch:globalThis.fetch,bitmap:globalThis.createImageBitmap};
  const queued=new Map(),painted=[];let nextId=0,errors=0;
  const browserWindow={
    requestAnimationFrame(callback){assert.equal(this,browserWindow);queued.set(++nextId,callback);return nextId;},
    cancelAnimationFrame(id){assert.equal(this,browserWindow);queued.delete(id);},
  };
  globalThis.window=browserWindow;
  globalThis.fetch=async url=>({ok:true,blob:async()=>new Blob([url])});
  globalThis.createImageBitmap=async blob=>({source:await blob.text(),width:960,height:540,close(){}});
  const painter=new FramePainter(({frame,mix})=>painted.push(frame+(mix??0)));
  const sequence=new ScrollSequence({count:433,url:String,onFrame:(image,frame,next,mix)=>painter.queue({image,frame,next,mix}),onError:()=>errors++});
  const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));for(const [id,callback] of [...queued]){queued.delete(id);callback(0);}};
  try{
    for(const progress of [0,.25,.60,.85,.25]){
      sequence.seek(framePositionForProgress(progress,433,340));painter.flush();await settle();
      assert.ok(Math.abs(painted.at(-1)-framePositionForProgress(progress,433,340))<.00001);
    }
    assert.equal(errors,0,'render scheduling must not be mistaken for a failed Higgsfield frame');
    assert.equal(trailJourney(.60).phase,'summit');assert.ok(trailJourney(.60).titleY>0);assert.equal(trailJourney(.65).titleY,0,'the logo rises while the camera holds at the summit');
    const count=painted.length;await settle();assert.equal(painted.length,count,'motion still stops with the visitor');
  }finally{
    painter.dispose();sequence.dispose();globalThis.fetch=originals.fetch;globalThis.createImageBitmap=originals.bitmap;
    if(originals.window===undefined)delete globalThis.window;else globalThis.window=originals.window;
  }
});
