import test from 'node:test';
import assert from 'node:assert/strict';
import { trailJourney, frameForProgress, frameWindow, WALK_END, CLUB_START } from '../app/trail-journey.ts';
import { ScrollSequence } from '../app/scroll-sequence.ts';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('paused scroll is identical after arbitrary forward and backward movement', () => {
  const paused = trailJourney(.36);
  for (const p of [.9,.05,1,.36,.65,0]) { trailJourney(p); assert.deepEqual(trailJourney(.36), paused); }
});
test('reverse scroll retraces exactly the same image frames', () => {
  const forward = Array.from({length:501},(_,i)=>frameForProgress(i/500,241));
  for(let i=500;i>=0;i--){assert.equal(frameForProgress(i/500,241),forward[i]);if(i>0)assert.ok(forward[i]>=forward[i-1]);}
  assert.equal(forward[0],0);assert.equal(forward.at(-1),240);
});
test('the overlook holds while SUMMIT and then the club appear', () => {
  for (const p of [WALK_END,.85,CLUB_START,1,10]) assert.equal(frameForProgress(p,241),240);
  assert.equal(trailJourney(.87).title,1);
  assert.equal(trailJourney(1).title,0);
  assert.equal(trailJourney(1).camp,1);
  assert.equal(trailJourney(CLUB_START).accessible,true);
  assert.equal(trailJourney(.5).accessible,false);
});
test('reduced motion exposes club content without a walking sequence', () => {
  for(const p of [0,.5,1]){const state=trailJourney(p,true);assert.equal(state.walk,1);assert.equal(state.accessible,true);assert.equal(state.camp,1);assert.equal(state.controls,0);}
});
test('scroll overshoot and invalid input remain within the media bounds', () => {
  assert.deepEqual(trailJourney(-1),trailJourney(0));assert.deepEqual(trailJourney(2),trailJourney(1));
  assert.deepEqual(trailJourney(NaN),trailJourney(0));assert.deepEqual(trailJourney(Infinity),trailJourney(0));
  assert.equal(frameForProgress(1,1),0);
});
test('frame priorities reverse with the visitor and stay inside the sequence', () => {
  assert.deepEqual(frameWindow(4,9,1,2),[4,5,3,6,2]);
  assert.deepEqual(frameWindow(4,9,-1,2),[4,3,5,2,6]);
  assert.deepEqual(frameWindow(0,3,1,5),[0,1,2]);
  assert.deepEqual(frameWindow(2,3,-1,5),[2,1,0]);
});
test('sequence seeks forward/backward, bounds decoding, and stops painting when disposed', async () => {
  const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;
  let live=0,maxLive=0,fetches=0;const paints=[];
  globalThis.fetch=async url=>{fetches++;return {ok:true,blob:async()=>new Blob([String(url)])};};
  globalThis.createImageBitmap=async blob=>{live++;maxLive=Math.max(maxLive,live);let closed=false;return {width:960,height:540,index:Number(await blob.text()),close(){assert.equal(closed,false);closed=true;live--;}};};
  const sequence=new ScrollSequence({count:80,url:String,maxDecoded:24,onFrame:(image,index)=>paints.push(index),onError:()=>assert.fail('unexpected load error')});
  try{
    sequence.seek(0);for(let i=0;i<8;i++)await tick();assert.equal(paints.at(-1),0);
    sequence.seek(57);for(let i=0;i<8;i++)await tick();assert.equal(paints.at(-1),57);
    sequence.seek(12);for(let i=0;i<8;i++)await tick();assert.equal(paints.at(-1),12);
    assert.ok(maxLive<=28,`decoded maximum ${maxLive}`);assert.ok(fetches<=80,'compressed frames reused');
    const held=paints.length;await tick();assert.equal(paints.length,held,'no playback timer');
    sequence.dispose();assert.equal(live,0);
    sequence.seek(35);await tick();assert.equal(paints.length,held);
  }finally{sequence.dispose();globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;}
});
test('failed media reports fallback instead of trapping visitors in a loader', async () => {
  const oldFetch=globalThis.fetch;let errors=0;
  globalThis.fetch=async()=>({ok:false,status:404});
  const sequence=new ScrollSequence({count:12,url:String,onFrame:()=>assert.fail('no frames exist'),onError:()=>{errors++;sequence.dispose();}});
  try{sequence.seek(0);for(let i=0;i<5;i++)await tick();assert.equal(errors,1);}finally{sequence.dispose();globalThis.fetch=oldFetch;}
});

test('out-of-order decoding never paints a neighboring frame while scroll is paused', async () => {
  const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;const pending=new Map(),paints=[];
  globalThis.fetch=async url=>({ok:true,blob:async()=>new Blob([String(url)])});
  globalThis.createImageBitmap=async blob=>{const id=Number(await blob.text());return new Promise(resolve=>pending.set(id,()=>resolve({width:10,height:10,close(){}})));};
  const sequence=new ScrollSequence({count:60,url:String,onFrame:(_,index)=>paints.push(index),onError:()=>assert.fail('unexpected failure')});
  try{
    sequence.seek(30);await tick();pending.get(31)();await tick();assert.deepEqual(paints,[]);
    pending.get(30)();await tick();assert.equal(paints.at(-1),30);
    pending.get(29)();await tick();assert.ok(paints.every(frame=>frame===30));
  }finally{sequence.dispose();for(const resolve of pending.values())resolve();await tick();globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;}
});
test('a prefetched failure cannot strand a later seek on an old frame', async () => {
  const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;let errors=0;const paints=[];
  globalThis.fetch=async url=>Number(url)===40?{ok:false,status:503}:{ok:true,blob:async()=>new Blob([String(url)])};
  globalThis.createImageBitmap=async()=>({width:10,height:10,close(){}});
  const sequence=new ScrollSequence({count:60,url:String,onFrame:(_,index)=>paints.push(index),onError:()=>{errors++;sequence.dispose();}});
  try{
    sequence.seek(0);for(let i=0;i<10;i++)await tick();assert.equal(paints.at(-1),0);assert.equal(errors,0);
    sequence.seek(40);await tick();assert.equal(errors,1);
  }finally{sequence.dispose();globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;}
});
