import test from 'node:test';
import assert from 'node:assert/strict';
import { trailJourney, frameForProgress, framePositionForProgress, frameWindow, WALK_END, DESCENT_START, CLUB_START, reflowScroll, canvasResolution, frameFocalX } from '../app/trail-journey.ts';
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
test('the camera holds at the peak while SUMMIT rises, then travels beyond it', () => {
  for (const p of [WALK_END,.57,.63,.68,DESCENT_START]) assert.equal(frameForProgress(p,321,192),192);
  assert.equal(trailJourney(.5).title,0);
  assert.ok(trailJourney(.54).titleY > trailJourney(.60).titleY);
  assert.equal(trailJourney(.65).titleY,0);
  assert.equal(trailJourney(.65).title,1);
  assert.ok(frameForProgress(.8,321,192)>192);
  assert.equal(frameForProgress(.9,321,192),320);
  assert.equal(trailJourney(1).title,0);
  assert.equal(trailJourney(1).camp,1);
  assert.equal(trailJourney(CLUB_START).accessible,true);
  assert.ok(trailJourney(CLUB_START).cover + 14 <= 0, 'club controls activate after the scene has cleared');
  assert.equal(trailJourney(.5).accessible,false);
});
test('the descent uncovers the club only after the summit hold', () => {
  assert.equal(trailJourney(.65).approach,0);
  assert.equal(trailJourney(.65).camp,0);
  let last=0;
  for(let i=69;i<=100;i++){
    const state=trailJourney(i/100);
    assert.ok(state.approach>=last);last=state.approach;
    assert.ok(state.cover>=-18 && state.cover<=112);
  }
  assert.equal(trailJourney(1).approach,1);
  assert.equal(trailJourney(1).cover,-18);
  assert.equal(trailJourney(.75).phase,'descending');
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

test('resize and fallback preserve club reading offset instead of jumping to the footer', () => {
  assert.equal(reflowScroll(4080,0,3780,0,900,900,false,true),1200);
  assert.equal(reflowScroll(4080,0,3780,4200,900,1000,false,false),4500);
  assert.equal(reflowScroll(1890,0,3780,4200,900,1000,false,false),2100);
  assert.equal(reflowScroll(1200,0,0,3780,900,900,true,false),4080);
  assert.equal(reflowScroll(1890,0,3780,0,900,900,false,true),900);
});

test('high density screens receive sharp backing pixels with a fixed allocation ceiling', () => {
  assert.deepEqual(canvasResolution(1440,900,2),{width:2880,height:1800});
  assert.deepEqual(canvasResolution(390,844,3),{width:780,height:1688});
  const large=canvasResolution(3840,2160,3);
  assert.ok(large.width*large.height<8510000);
});
test('the first scroll moves the camera and only a short braking ramp precedes a hold', () => {
  assert.equal(frameForProgress(.002,433,340),1, 'about eight scroll pixels already move the opening frame');
  const step=.001, near=framePositionForProgress(WALK_END,10001,8000)-framePositionForProgress(WALK_END-step,10001,8000);
  const middle=framePositionForProgress(.27,10001,8000)-framePositionForProgress(.27-step,10001,8000);
  assert.ok(near<middle/10, 'the camera still settles gently at the summit');
  assert.ok(frameForProgress(DESCENT_START+.004,433,340)>340, 'continued scrolling immediately leaves the peak');
  const opening=framePositionForProgress(.04,433,340)-framePositionForProgress(.02,433,340);
  const climbing=framePositionForProgress(.30,433,340)-framePositionForProgress(.28,433,340);
  assert.ok(Math.abs(opening-climbing)<.00001, 'scroll has a consistent travel speed across the climb');
});
test('portrait framing starts with the wildlife and returns to a centered summit', () => {
  assert.equal(frameFocalX(0,24),0);
  assert.ok(frameFocalX(24,24)>0 && frameFocalX(24,24)<.5);
  for (const frame of [72,100,340]) assert.equal(frameFocalX(frame,24),.5);
  const paused=frameFocalX(35,24);
  frameFocalX(400,24);assert.equal(frameFocalX(35,24),paused);
});
test('HD prefetch stays near the visitor and a small cache settles without decode churn', async () => {
  const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;
  let fetches=0,decodes=0,live=0,maxLive=0;
  globalThis.fetch=async url=>{fetches++;return {ok:true,blob:async()=>new Blob([String(url)])};};
  globalThis.createImageBitmap=async()=>{decodes++;live++;maxLive=Math.max(maxLive,live);return {width:2560,height:1440,close(){live--;}};};
  const sequence=new ScrollSequence({count:500,url:String,maxDecoded:8,onFrame:()=>{},onError:()=>assert.fail('unexpected error')});
  try{
    sequence.seek(200);for(let i=0;i<15;i++)await tick();
    const held=decodes;assert.ok(fetches<=65,'does not preload the entire trail');
    for(let i=0;i<10;i++)await tick();assert.equal(decodes,held,'small cache does not endlessly redecode');
    sequence.seek(300);for(let i=0;i<15;i++)await tick();assert.ok(maxLive<=12);
  }finally{sequence.dispose();assert.equal(live,0);globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;}
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** A real delayed transport/decode pipeline, including AbortSignal behavior. */
function delayedMedia({ latency = 70, detailLatency = 300, decodeTime = 8 } = {}) {
  const originalFetch = globalThis.fetch, originalBitmap = globalThis.createImageBitmap;
  const requests = [];
  let live = 0, maxLive = 0, decodes = 0;
  globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => {
    const [layer, number] = String(url).split('/');
    const request = { layer, frame: Number(number), priority: options.priority, started: performance.now(), aborted: false, completed: false };
    requests.push(request);
    const abort = () => {
      clearTimeout(timer);
      request.aborted = true;
      reject(new DOMException('Canceled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      options.signal?.removeEventListener('abort', abort);
      request.completed = true;
      resolve({ ok: true, blob: async () => new Blob([JSON.stringify({ layer, frame: Number(number) })]) });
    }, layer === 'hd' ? detailLatency : latency);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
  });
  globalThis.createImageBitmap = async blob => {
    const source = JSON.parse(await blob.text());
    await wait(decodeTime);
    decodes++; live++; maxLive = Math.max(maxLive, live);
    let closed = false;
    return { ...source, width: source.layer === 'hd' ? 2560 : 960, height: source.layer === 'hd' ? 1440 : 540,
      close() { assert.equal(closed, false, 'bitmaps are released once'); closed = true; live--; } };
  };
  return {
    requests,
    get stats() { return { live, maxLive, decodes }; },
    async restore() { await wait(decodeTime + 10); globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalBitmap; },
  };
}

test('a new target starts immediately even when all speculative fetch slots are occupied', async () => {
  const originalFetch = globalThis.fetch, originalBitmap = globalThis.createImageBitmap;
  const requests = [], paints = [];
  globalThis.fetch = (url, { signal, priority }) => new Promise(resolve => requests.push({ frame: Number(url), signal, priority,
    finish: () => resolve({ ok: true, blob: async () => new Blob([String(url)]) }) }));
  globalThis.createImageBitmap = async () => ({ width: 960, height: 540, close() {} });
  const sequence = new ScrollSequence({ count: 300, url: String, onFrame: (_, frame) => paints.push(frame), onError: () => assert.fail('aborts are not media failures') });
  try {
    sequence.seek(40);
    assert.deepEqual(requests.map(request => request.frame), [40, 41, 39, 42]);
    sequence.seek(44);
    assert.equal(requests.at(-1).frame, 44, 'current input takes a slot synchronously');
    assert.equal(requests.at(-1).priority, 'high');
    assert.ok(requests.find(request => request.frame === 39).signal.aborted, 'a low-priority neighbor is canceled');
    sequence.seek(220);
    const current = requests.find(request => request.frame === 220);
    assert.ok(current, 'a distant seek does not wait for stale network work');
    assert.ok(requests.filter(request => request.frame < 100).every(request => request.signal.aborted));
    for (const request of requests.filter(request => request.frame < 100)) request.finish();
    await tick(); assert.deepEqual(paints, [], 'late responses from canceled requests never paint');
    current.finish(); await tick(); assert.deepEqual(paints, [220]);
  } finally {
    sequence.dispose();
    for (const request of requests) request.finish();
    await tick(); globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalBitmap;
  }
});

test('obsolete decodes release their bitmaps and the latest target gets the next decoder', async () => {
  const originalFetch = globalThis.fetch, originalBitmap = globalThis.createImageBitmap;
  const pending = new Map(), paints = [], closed = [];
  globalThis.fetch = async url => ({ ok: true, blob: async () => new Blob([String(url)]) });
  globalThis.createImageBitmap = async blob => {
    const frame = Number(await blob.text());
    return new Promise(resolve => pending.set(frame, () => resolve({ width: 960, height: 540, close() { closed.push(frame); } })));
  };
  const sequence = new ScrollSequence({ count: 300, url: String, onFrame: (_, frame) => paints.push(frame), onError: () => assert.fail('unexpected failure') });
  try {
    sequence.seek(10); await tick();
    assert.deepEqual([...pending.keys()], [10, 11]);
    sequence.seek(200); await tick();
    pending.get(10)(); await tick();
    assert.ok(closed.includes(10)); assert.deepEqual(paints, []);
    assert.ok(pending.has(200), 'the current target precedes every speculative decode');
    pending.get(200)(); await tick();
    assert.deepEqual(paints, [200]);
    pending.get(11)(); await tick();
    assert.deepEqual(paints, [200], 'finishing an older camera pose cannot rewind the scene');
  } finally {
    sequence.dispose(); for (const finish of pending.values()) finish();
    await tick(); globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalBitmap;
  }
});

test('the motion layer stays responsive through 70ms fetch latency and 8ms image decoding', async t => {
  const media = delayedMedia(), paints = [];
  const sequence = new ScrollSequence({ count: 433, previewUrl: frame => `motion/${frame}`, url: frame => `hd/${frame}`,
    maxPreviewDecoded: 32, maxDecoded: 2, onFrame: (image, frame) => paints.push({ frame, layer: image.layer }), onError: () => assert.fail('unexpected failure') });
  try {
    sequence.seek(0); await wait(200);
    assert.equal(paints.at(-1)?.frame, 0);
    let immediate = 0;
    for (let frame = 1; frame <= 32; frame++) {
      sequence.seek(frame);
      if (paints.at(-1)?.frame === frame) immediate++;
      await wait(16);
    }
    await wait(90);
    assert.equal(paints.at(-1)?.frame, 32, 'one late exact correction completes the latest request');
    assert.ok(immediate >= 28, `${immediate}/32 seeks displayed immediately from the motion cache`);
    assert.ok(paints.every((paint, index) => index === 0 || paint.frame >= paints[index - 1].frame), 'network completion never moves backward');
    assert.ok(media.requests.some(request => request.layer === 'hd' && request.aborted), 'scrolling cancels an idle HD refinement');
    assert.ok(media.stats.maxLive <= 36, `live decoded image bound: ${media.stats.maxLive}`);
    t.diagnostic(`${immediate}/32 immediate scroll frames with 70ms transport + 8ms decode; maximum ${media.stats.maxLive} live bitmaps`);
  } finally { sequence.dispose(); await media.restore(); assert.equal(media.stats.live, 0); }
});

test('HD sharpens only the paused target and settling the cache causes no idle repaint', async () => {
  const media = delayedMedia({ latency: 3, detailLatency: 35, decodeTime: 2 }), paints = [];
  const sequence = new ScrollSequence({ count: 433, previewUrl: frame => `motion/${frame}`, url: frame => `hd/${frame}`,
    maxPreviewDecoded: 8, maxDecoded: 2, onFrame: (image, frame) => paints.push({ frame, layer: image.layer }), onError: () => assert.fail('unexpected failure') });
  try {
    sequence.seek(100); await wait(70);
    assert.deepEqual(paints, [{ frame: 100, layer: 'motion' }]);
    assert.equal(media.requests.filter(request => request.layer === 'hd').length, 0, 'no HD transfer while input is recent');
    await wait(100);
    assert.deepEqual(paints, [{ frame: 100, layer: 'motion' }, { frame: 100, layer: 'hd' }]);
    const held = paints.length, decoded = media.stats.decodes, fetched = media.requests.length;
    for (let i = 0; i < 5; i++) sequence.seek(100);
    await wait(150);
    assert.equal(paints.length, held, 'same-frame seeks and neighbor completions do not draw again');
    assert.equal(media.stats.decodes, decoded, 'idle caches do not repeatedly decode evicted neighbors');
    assert.equal(media.requests.length, fetched);
    sequence.seek(102); sequence.seek(101); sequence.seek(100);
    assert.deepEqual(paints.slice(-3).map(paint => paint.frame), [102, 101, 100], 'cached reverse travel follows input immediately');
    assert.equal(paints.at(-1).layer, 'hd', 'an available detailed pose is not replaced with its preview');
    sequence.seek(200); await wait(170);
    sequence.seek(300); await wait(170);
    assert.deepEqual(paints.at(-1), { frame: 300, layer: 'hd' });
    assert.ok(media.stats.maxLive <= 12, 'visiting new HD poses evicts old detail without growing decoded memory');
  } finally { sequence.dispose(); await media.restore(); assert.equal(media.stats.live, 0); }
});

test('failed optional detail preserves motion and a missing preview can use the exact HD pose', async () => {
  const originalFetch = globalThis.fetch, originalBitmap = globalThis.createImageBitmap;
  const paints = [];
  globalThis.fetch = async url => {
    const missing = url === 'motion/10' || url === 'hd/20';
    return missing ? { ok: false, status: 404 } : { ok: true, blob: async () => new Blob([url]) };
  };
  globalThis.createImageBitmap = async blob => ({ source: await blob.text(), width: 960, height: 540, close() {} });
  const sequence = new ScrollSequence({ count: 100, previewUrl: frame => `motion/${frame}`, url: frame => `hd/${frame}`,
    maxPreviewDecoded: 8, maxDecoded: 2, onFrame: (image, frame) => paints.push({ frame, source: image.source }), onError: () => assert.fail('an available pose should not trigger page fallback') });
  try {
    sequence.seek(10); await wait(20);
    assert.deepEqual(paints.at(-1), { frame: 10, source: 'hd/10' });
    sequence.seek(20); await wait(150);
    assert.deepEqual(paints.at(-1), { frame: 20, source: 'motion/20' });
  } finally { sequence.dispose(); globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalBitmap; }
});
