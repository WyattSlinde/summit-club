import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

test('leadership dashboard routes every section and action, preserves navigation, and clears private data on signout',async()=>{
 const rootPath=fileURLToPath(new URL('../',import.meta.url));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/summit-club/leadership/#events',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','HTMLAnchorElement','Node','Element','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','getComputedStyle','FormData'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.location=dom.window.location;globalThis.history=dom.window.history;
 globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
 globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;}observe(){queueMicrotask(()=>this.fn([{isIntersecting:true}]));}disconnect(){}};
 globalThis.matchMedia=window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let exported; URL.createObjectURL=blob=>{if(blob.type.includes('text/csv'))exported=blob;return 'blob:fixture';};URL.revokeObjectURL=()=>{};
 const anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)return anchorClick.call(this);};
 const fixture=path.join(rootPath,'tests/fixtures/leader-cloud.mjs'),output=path.join(rootPath,'outputs/leader-ui-test.mjs');
 await mkdir(path.dirname(output),{recursive:true});
 const bundle=await build({entryPoints:[path.join(rootPath,'app/leadership/cloud-portal.tsx')],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/summit-club/"'},plugins:[{name:'leader-test',setup(builder){builder.onResolve({filter:/(?:@\/lib\/cloud-client|\.\/cloud-client)$/},()=>({path:fixture,external:true}));builder.onResolve({filter:/^next\/link$/},()=>({path:path.join(rootPath,'preview/link.tsx')}));}}]});
 await writeFile(output,bundle.outputFiles[0].text);
 const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
 const {default:Portal}=await import(pathToFileURL(output).href),api=await import(pathToFileURL(fixture).href);
 const root=createRoot(document.getElementById('root'));
 async function settle(fn=()=>{}){await act(async()=>{await fn();await new Promise(r=>setTimeout(r,35));});}
 const buttons=()=>[...document.querySelectorAll('button')];
 async function click(text){const b=buttons().find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===text);assert.ok(b,`button: ${text}`);await settle(()=>b.click());}
 async function tab(text){const b=[...document.querySelectorAll('[role=tab]')].find(b=>b.textContent.trim()===text);assert.ok(b,text);await settle(()=>{b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();});assert.equal(b.getAttribute('aria-selected'),'true');const panel=document.getElementById(b.getAttribute('aria-controls'));assert.ok(panel);assert.equal(panel.hidden,false);return panel;}
 async function input(el,value){assert.ok(el);await settle(()=>{const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
 const activePanel=()=>document.querySelector('[role=tabpanel][data-state=active]');
 try{
  await settle(()=>root.render(createElement(Portal)));
  for(let i=0;i<12&&!activePanel();i++)await settle();
  assert.ok(activePanel(),'Leadership sections finish loading.');
  assert.equal(document.querySelector('[role=dialog]'),null,'The main leadership route is a page, not an obstructing modal.');
  assert.match(activePanel().textContent,/Make it a plan/,'Direct #events links open the intended section.');
  assert.equal(document.querySelector('.member-header>a:last-child').getAttribute('href'),'/summit-club/members/');
  assert.equal(document.querySelector('.leadership-account a').getAttribute('href'),'/summit-club/profile/');
  await click('View registered members');assert.match(activePanel().textContent,/People make the club/);assert.equal(location.hash,'#members');
  await input(document.querySelector('[aria-label="Search members by name or grade"]'),'Robin');assert.equal(document.querySelectorAll('.desk-roster article').length,1);
  await click('Export shown members');const csv=await exported.text();assert.match(csv,/Robin Test/);assert.doesNotMatch(csv,/Taylor Test/);
  assert.equal(document.querySelector('.desk-member-details a').getAttribute('href'),'mailto:robin@example.test');
  await input(document.querySelector('[aria-label="Search members by name or grade"]'),'');await input(document.querySelector('[aria-label="Filter members by interest"]'),'Explore');assert.match(document.querySelector('.desk-roster').textContent,/Taylor Test/);assert.doesNotMatch(document.querySelector('.desk-roster').textContent,/Robin Test/);
  await click('View student ideas');assert.equal(location.hash,'#ideas');assert.match(activePanel().textContent,/A student suggestion/);assert.match(activePanel().textContent,/2 votes/);
  await click('View upcoming events');assert.match(activePanel().textContent,/Confirmed test outing/);assert.match(document.querySelector('.desk-attendees').textContent,/Robin Test/);
  document.querySelector('.desk-create').open=true;
  for(const [name,value]of Object.entries({title:'New fixture outing',date:'2099-02-01T10:00',location:'Fixture meeting point',details:'These are confirmed test details.'}))await input(document.querySelector(`[name=${name}]`),value);
  await settle(()=>api.changeRole('leader'));assert.equal(document.querySelector('[name=title]').value,'New fixture outing','Same-account sign-in refresh must not discard the event draft.');
  api.failNextSave();await click('Publish event');assert.match(document.querySelector('[role=alert]').textContent,/Could not save/);assert.equal(document.querySelector('[name=title]').value,'New fixture outing','Failed save preserves the draft.');
  const failedId=api.calls.findLast(c=>c.payload.verb==='event').payload.id;
  await click('Publish event');assert.equal(api.calls.findLast(c=>c.payload.verb==='event').payload.id,failedId,'Retry uses the same event identity.');assert.match(activePanel().textContent,/New fixture outing/);assert.match(document.querySelector('[role=status]').textContent,/Event published/);
  await click('Cancel event');assert.equal(document.activeElement.textContent,'Keep event');assert.equal(api.calls.some(c=>c.payload.verb==='cancel'),false);await click('Keep event');assert.equal(document.activeElement.textContent,'Cancel event');assert.equal(api.calls.some(c=>c.payload.verb==='cancel'),false);
  await click('Cancel event');await click('Confirm cancellation');assert.equal(api.calls.findLast(c=>c.payload.verb==='cancel').payload.id,'event-test');assert.match(document.activeElement.textContent,/Event cancelled/);
  await tab('Hikes & photos');assert.equal(location.hash,'#community');assert.match(activePanel().textContent,/No trails listed yet/);
  for(const [name,value]of Object.entries({name:'Leader chosen trail',area:'A test park',official_url:'https://example.test/trail'}))await input(document.querySelector(`[name=${name}]`),value);
  await click('Add trail');assert.equal(api.calls.findLast(c=>c.payload.verb==='add_hike').service,'community');assert.match(document.querySelector('.community-desk-trail').textContent,/Leader chosen trail/);
  await click('Archive');assert.equal(api.calls.findLast(c=>c.payload.verb==='toggle_hike').payload.active,false);await click('List again');assert.equal(api.calls.findLast(c=>c.payload.verb==='toggle_hike').payload.active,true);
  await click('Hide photo');assert.equal(api.calls.findLast(c=>c.payload.verb==='hide').payload.id,'photo-test');await click('Restore photo');assert.equal(api.calls.findLast(c=>c.payload.verb==='restore').payload.id,'photo-test');
  await click('Mark reviewed');assert.equal(api.calls.findLast(c=>c.payload.verb==='resolve').service,'community');
  await tab('Concerns (1)');assert.match(activePanel().textContent,/A private concern to review/);await click('Mark reviewed');assert.equal(api.calls.findLast(c=>c.payload.verb==='resolve').service,'club');assert.match(activePanel().textContent,/No open concerns/);
  api.showReports(false);await click('Refresh leadership data');assert.match(activePanel().textContent,/People make the club/,'Unavailable sections fall back to members instead of a blank panel.');api.showReports(true);await click('Refresh leadership data');
  await tab('Members');await tab('Ideas & votes');await tab('Events & RSVPs');
  await settle(()=>history.back());assert.equal(location.hash,'#ideas');assert.match(activePanel().textContent,/A student suggestion/);
  await click('Refresh leadership data');assert.match(activePanel().textContent,/A student suggestion/,'Refresh preserves the selected section.');
  await settle(()=>api.changeRole('student'));assert.equal(document.querySelector('.leader-desk'),null);assert.match(document.body.textContent,/hasn’t been granted leadership access/);assert.doesNotMatch(document.body.textContent,/Taylor Test|Robin Test/);
  await settle(()=>api.changeRole('leader'));for(let i=0;i<12&&!activePanel();i++)await settle();assert.ok(document.querySelector('.leader-desk'));
  await click('Sign out');assert.equal(document.querySelector('.leader-desk'),null);assert.match(document.body.textContent,/Log in/);assert.doesNotMatch(document.body.textContent,/Taylor Test|Robin Test/);
 }finally{await act(async()=>root.unmount());dom.window.close();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;HTMLAnchorElement.prototype.click=anchorClick;}
});

test('leadership text and control colors meet AA contrast with isolated light surfaces',async()=>{
 const css=await readFile(new URL('../app/leader-desk.css',import.meta.url),'utf8');
 function luminance(hex){const values=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
 for(const [ink,paper]of [['203b2e','f5efdf'],['53614e','f5efdf'],['914a30','fffcf5'],['f5efdf','142b23'],['913e2e','f9e9df'],['724027','f4e2c9'],['53614e','e4e8dc']]){const values=[luminance(ink),luminance(paper)].sort((a,b)=>b-a);assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,`${ink} on ${paper}`);assert.ok(css.includes('#'+ink));assert.ok(css.includes('#'+paper));}
});
