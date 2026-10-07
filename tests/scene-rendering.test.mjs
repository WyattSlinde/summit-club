import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {framePositionForProgress} from '../app/trail-journey.ts';
// Component lifecycle test with a mocked canvas, not browser automation or an FPS benchmark.
test('the actual scene lowers its moving raster, sharpens the same held pose, and masks only the reveal',async()=>{
 const rootPath=fileURLToPath(new URL('../',import.meta.url));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/#home',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','HTMLElement','HTMLCanvasElement','Node','Element','Event','MouseEvent','CustomEvent','MutationObserver','getComputedStyle','location','history'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.devicePixelRatio=2;globalThis.scrollY=0;
 globalThis.addEventListener=window.addEventListener.bind(window);globalThis.removeEventListener=window.removeEventListener.bind(window);
 globalThis.scrollTo=options=>{globalThis.scrollY=options.top;};
 globalThis.requestAnimationFrame=window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);
 globalThis.cancelAnimationFrame=window.cancelAnimationFrame=clearTimeout;
 globalThis.matchMedia=window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 globalThis.IntersectionObserver=class{observe(){}disconnect(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 Object.defineProperty(HTMLElement.prototype,'clientWidth',{configurable:true,get(){return 1440;}});
 Object.defineProperty(HTMLElement.prototype,'clientHeight',{configurable:true,get(){return 900;}});
 const paints=[];HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return{globalAlpha:1,imageSmoothingEnabled:true,imageSmoothingQuality:'high',drawImage(bitmap){assert.equal(bitmap.closed,false,'do not paint a released bitmap');paints.push({frame:bitmap.frame,width:canvas.width,height:canvas.height});}};};
 const oldFetch=globalThis.fetch,oldBitmap=globalThis.createImageBitmap;
 globalThis.fetch=async url=>{
  const match=String(url).match(/(\d{4})\.(bin|webp)/);const frame=Number(match?.[1]||0);
  if(match?.[2]==='bin'){
   const count=Math.min(8,530-frame),parts=Array.from({length:count},(_,i)=>Buffer.from(JSON.stringify({frame:frame+i,detail:false})));
   const header=Buffer.alloc(12+count*4);header.write('SMT1');header.writeUInt32LE(frame,4);header.writeUInt32LE(count,8);parts.forEach((p,i)=>header.writeUInt32LE(p.length,12+i*4));return new Response(Buffer.concat([header,...parts]));
  }
  return Response.json({frame,detail:true});
 };
 globalThis.createImageBitmap=async blob=>{const source=JSON.parse(await blob.text());return{...source,width:source.detail?2560:960,height:source.detail?1440:540,closed:false,close(){this.closed=true;}};};
 const output=path.join(rootPath,'outputs/scene-component-test.mjs');await mkdir(path.dirname(output),{recursive:true});
 const bundle=await build({entryPoints:[path.join(rootPath,'app/summit-experience.tsx')],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}});await writeFile(output,bundle.outputFiles[0].text);
 const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:Scene}=await import(pathToFileURL(output).href);
 const root=createRoot(document.getElementById('root'));
 async function settle(task=()=>{},ms=25){await act(async()=>{await task();await new Promise(r=>setTimeout(r,ms));});}
 async function scroll(progress){await settle(()=>{globalThis.scrollY=900*11.6*progress;window.dispatchEvent(new Event('scroll'));});}
 try{
  await settle(()=>root.render(createElement(Scene,{onJoin(){}},createElement('section',{id:'basecamp'},'Club'))));
  await settle();
  await scroll(.25);const canvas=document.querySelector('canvas'),shell=document.querySelector('.sx-experience'),backdrop=document.querySelector('.sx-backdrop');
  assert.equal(canvas.width,1440);assert.equal(canvas.height,900);assert.equal(backdrop.dataset.revealing,'false');
  const held=Number(shell.dataset.frame);assert.ok(Math.abs(held-framePositionForProgress(.25,530,340))<.001,`held ${held}, requested ${framePositionForProgress(.25,530,340)}, progress ${shell.dataset.journeyProgress}`);
  await settle(()=>{},210);assert.equal(canvas.width,2880);assert.equal(canvas.height,1800);assert.equal(Number(shell.dataset.frame),held,'resolution can sharpen without advancing the hike');
  await scroll(.96);assert.equal(backdrop.dataset.revealing,'true');
  await scroll(1);assert.equal(shell.dataset.journeyEnded,'true');assert.equal(backdrop.dataset.revealing,'false');
  await scroll(.20);assert.equal(backdrop.dataset.revealing,'false');assert.equal(canvas.width,1440);assert.ok(Number(shell.dataset.frame)<held,'reverse follows scroll');assert.ok(paints.length>0);
 }finally{await act(async()=>root.unmount());globalThis.fetch=oldFetch;globalThis.createImageBitmap=oldBitmap;dom.window.close();}
});
