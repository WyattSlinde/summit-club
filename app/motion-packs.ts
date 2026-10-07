export const MOTION_PACK_SIZE = 8;
const MAX_PACK_BYTES = 4 * 1024 * 1024;
/** Individual WebPs keep their original bytes, so decoding needs no atlas copies. */
export function unpackMotionFrames(buffer:ArrayBuffer,expectedStart:number){
 if(buffer.byteLength<16||buffer.byteLength>MAX_PACK_BYTES)throw new Error('Invalid motion pack.');
 const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,4));
 const start=view.getUint32(4,true),count=view.getUint32(8,true),header=12+count*4;
 if(magic!=='SMT1'||start!==expectedStart||count<1||count>MOTION_PACK_SIZE||header>buffer.byteLength)throw new Error('Invalid motion pack header.');
 let offset=header;const images=new Map<number,Blob>();
 for(let i=0;i<count;i++){
  const size=view.getUint32(12+i*4,true);
  if(size<12||size>MAX_PACK_BYTES||offset+size>buffer.byteLength)throw new Error('Invalid motion pack frame.');
  images.set(start+i,new Blob([new Uint8Array(buffer,offset,size)],{type:'image/webp'}));offset+=size;
 }
 if(offset!==buffer.byteLength)throw new Error('Invalid motion pack length.');
 return images;
}
type Job={controller:AbortController;users:number;promise:Promise<Map<number,Blob>>};
/** Share one HTTP transfer across neighboring poses; abort only when nobody needs it. */
export class MotionPacks {
 private cache=new Map<number,Map<number,Blob>>();
 private pending=new Map<number,Job>();
 private stopped=false;
 private url:(start:number)=>string;
 private fallback:(frame:number)=>string;
 constructor(url:(start:number)=>string,fallback:(frame:number)=>string){this.url=url;this.fallback=fallback;}
 async load(frame:number,signal:AbortSignal,priority:'high'|'low'){
  if(this.stopped||signal.aborted)throw new DOMException('Canceled','AbortError');
  const start=Math.floor(frame/MOTION_PACK_SIZE)*MOTION_PACK_SIZE;
  const cached=this.cache.get(start);
  if(cached?.has(frame)){this.cache.delete(start);this.cache.set(start,cached);return cached.get(frame)!;}
  let job=this.pending.get(start);
  if(!job){
   const controller=new AbortController();
   job={controller,users:0,promise:Promise.resolve(new Map())};const created=job;
   created.promise=(async()=>{
    const response=await fetch(this.url(start),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),cache:'force-cache',priority} as RequestInit);
    if(!response.ok)throw new Error('Motion pack unavailable.');
    const frames=unpackMotionFrames(await response.arrayBuffer(),start);
    if(!this.stopped&&!controller.signal.aborted){this.cache.set(start,frames);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value!);}
    return frames;
   })().finally(()=>{if(this.pending.get(start)===created)this.pending.delete(start);});
   this.pending.set(start,created);
  }
  const active=job;active.users++;
  let abort:()=>void=()=>{};
  const canceled=new Promise<never>((_,reject)=>{abort=()=>reject(new DOMException('Canceled','AbortError'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
  try{
   const frames=await Promise.race([active.promise,canceled]);
   const blob=frames.get(frame);if(!blob)throw new Error('Motion frame unavailable.');return blob;
  }catch(error){
   if(signal.aborted||this.stopped)throw error;
   // Keep the original individual frame as a recovery path for old CDN caches.
   const response=await fetch(this.fallback(frame),{signal,cache:'force-cache',priority} as RequestInit);
   if(!response.ok)throw new Error('Motion frame unavailable.');return response.blob();
  }finally{
   signal.removeEventListener('abort',abort);active.users--;
   if(active.users===0&&this.pending.get(start)===active){this.pending.delete(start);active.controller.abort();}
  }
 }
 dispose(){this.stopped=true;for(const job of this.pending.values())job.controller.abort();this.pending.clear();this.cache.clear();}
}
