import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MotionPacks, unpackMotionFrames } from '../app/motion-packs.ts';
import { ScrollSequence } from '../app/scroll-sequence.ts';
import { canvasResolution } from '../app/trail-journey.ts';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function pack(start,count=8){
 const parts=Array.from({length:count},(_,i)=>Buffer.from(JSON.stringify({frame:start+i,padding:'motion'})));
 const header=Buffer.alloc(12+count*4);header.write('SMT1');header.writeUInt32LE(start,4);header.writeUInt32LE(count,8);parts.forEach((p,i)=>header.writeUInt32LE(p.length,12+i*4));
 const buffer=Buffer.concat([header,...parts]);return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
}
test('packs preserve the approved WebP bytes, including the climb/reveal boundary',async()=>{
 for(const shape of ['desktop','mobile'])for(const start of [0,336,528]){
  const file=await readFile(new URL(`../public/journey-packs/${shape}/${String(start).padStart(4,'0')}.bin`,import.meta.url));
  const images=unpackMotionFrames(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),start);
  for(const [frame,blob]of images){
   const original=await readFile(new URL(`../public/${frame>340?'ridge-motion':'ascent-motion'}/${shape}/${String(frame).padStart(4,'0')}.webp`,import.meta.url));
   assert.deepEqual(Buffer.from(await blob.arrayBuffer()),original);
  }
 }
 assert.throws(()=>unpackMotionFrames(pack(8),0),/header/);
 assert.throws(()=>unpackMotionFrames(pack(0).slice(0,20),0),/header|frame/);
});
test('motion canvas does far less Retina raster work and restores unchanged still resolution',()=>{
 for(const [w,h,dpr]of [[1440,900,2],[1024,1366,2],[390,844,3],[3840,2160,2]]){
  const motion=canvasResolution(w,h,dpr,true),detail=canvasResolution(w,h,dpr);
  assert.ok(motion.width*motion.height<1405000);
  assert.ok(motion.width*motion.height<=detail.width*detail.height/3.6);
  assert.ok(Math.abs(motion.width/motion.height-w/h)<.005);
 }
 assert.deepEqual(canvasResolution(1440,900,2),{width:2880,height:1800});
});
test('neighbor requests share a transfer; aborting one does not cancel another; cached reversal adds no transfer',async()=>{
 const original=globalThis.fetch;let requests=0,finish;let requestSignal;
 globalThis.fetch=async(url,{signal})=>{requests++;requestSignal=signal;return new Promise(resolve=>{finish=()=>resolve(new Response(pack(16)));});};
 const source=new MotionPacks(String,String);const a=new AbortController(),b=new AbortController();
 try{
  const first=source.load(16,a.signal,'high');const rejected=assert.rejects(first,/Canceled/);
  const second=source.load(17,b.signal,'low');assert.equal(requests,1);a.abort();await rejected;assert.equal(requestSignal.aborted,false);
  finish();assert.equal(JSON.parse(await (await second).text()).frame,17);
  assert.equal(JSON.parse(await(await source.load(16,new AbortController().signal,'high')).text()).frame,16);assert.equal(requests,1);
 }finally{source.dispose();globalThis.fetch=original;}
});
test('missing pack falls back to the exact original frame without changing the camera path',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async url=>{calls.push(url);return url.startsWith('pack/')?new Response('',{status:404}):new Response('original webp');};
 const source=new MotionPacks(n=>`pack/${n}`,n=>`frame/${n}`);
 try{assert.equal(await(await source.load(19,new AbortController().signal,'high')).text(),'original webp');assert.deepEqual(calls,['pack/16','frame/19']);}finally{source.dispose();globalThis.fetch=original;}
});
test('batched motion keeps sequential scrolling ready over a 120ms network without idle playback',async t=>{
 const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;
 let requests=0,live=0,maxLive=0;const painted=[];
 globalThis.fetch=(url,{signal}={})=>new Promise((resolve,reject)=>{
  requests++;const start=Number(url.split('/')[1]);
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Canceled','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve(new Response(pack(start)));},120);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
 globalThis.createImageBitmap=async blob=>{const value=JSON.parse(await blob.text());await wait(8);live++;maxLive=Math.max(maxLive,live);return {...value,width:960,height:540,close(){live--;}};};
 const source=new MotionPacks(n=>`pack/${n}`,n=>`single/${n}`);
 const sequence=new ScrollSequence({count:240,url:String,loadPreview:(...args)=>source.load(...args),maxDecoded:32,onFrame:(_,frame)=>painted.push(frame),onError:()=>assert.fail('unexpected failure')});
 try{
  sequence.seek(0);await wait(300);let immediate=0;
  for(let frame=1;frame<=96;frame++){sequence.seek(frame);if(painted.at(-1)===frame)immediate++;await wait(16);}
  await wait(180);assert.equal(painted.at(-1),96);assert.ok(immediate>=90,`${immediate}/96 immediate frames`);
  const count=painted.length;await wait(150);assert.equal(painted.length,count,'no clock advances the pose');
  sequence.seek(94);assert.equal(painted.at(-1),94);assert.ok(requests<25,`${requests} requests for the full traversal and lookahead`);assert.ok(maxLive<=35);
  t.diagnostic(`${immediate}/96 immediate frames; ${requests} HTTP transfers; ${maxLive} maximum decoded images at 120ms transport + 8ms decoding.`);
 }finally{sequence.dispose();source.dispose();await wait(20);globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;assert.equal(live,0);}
});
