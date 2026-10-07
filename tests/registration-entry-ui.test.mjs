import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
test('single signup form confirms email, saves club details, and opens members page; offline signup is disabled',async()=>{
 const rootPath=fileURLToPath(new URL('../',import.meta.url));
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/summit-club/register/',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Node','Element','Event','MouseEvent','CustomEvent','MutationObserver','getComputedStyle','FormData'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.location=dom.window.location;globalThis.history=dom.window.history;globalThis.localStorage=dom.window.localStorage;
 globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;
 globalThis.IntersectionObserver=class{observe(){}disconnect(){}};globalThis.matchMedia=window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const fixture=path.join(rootPath,'tests/fixtures/registration-cloud.mjs'),output=path.join(rootPath,'outputs/registration-ui-test.mjs');await mkdir(path.dirname(output),{recursive:true});
 const bundle=await build({entryPoints:[path.join(rootPath,'app/register/registration.tsx')],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/summit-club/"'},plugins:[{name:'registration-test',setup(builder){builder.onResolve({filter:/(?:@\/lib\/(?:cloud-client|basecamp-client)|next\/navigation)$/},()=>({path:fixture,external:true}));builder.onResolve({filter:/^next\/link$/},()=>({path:path.join(rootPath,'preview/link.tsx')}));}}]});
 await writeFile(output,bundle.outputFiles[0].text);
 const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
 const {default:Registration}=await import(pathToFileURL(output).href),fixtureApi=await import(pathToFileURL(fixture).href);fixtureApi.reset();
 const root=createRoot(document.getElementById('root'));
 async function settle(task=()=>{}){await act(async()=>{await task();await new Promise(r=>setTimeout(r,20));});}
 const field=name=>document.querySelector(`[name="${name}"]`);
 try{
  await settle(()=>root.render(createElement(Registration,{embedded:true,key:'signup'})));
  assert.match(document.body.textContent,/Tkell2028@cchsdons.com/);assert.equal(document.querySelectorAll('main').length,0);
  await settle(()=>{field('name').value='Taylor Student';field('email').value='taylor@example.test';field('password').value='very-long-test-password';field('grade').value='10';field('interest').value='Serve';field('note').value='A beach cleanup.';field('consent').checked=true;document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  const signup=fixtureApi.calls.find(c=>c.operation==='signup');assert.ok(signup);assert.equal(signup.payload.options.emailRedirectTo,'https://example.test/summit-club/register/?complete=1');assert.equal(signup.payload.options.data.summit_registration.note,'A beach cleanup.');assert.equal(signup.payload.options.data.summit_registration.password,undefined);assert.equal(fixtureApi.calls.some(c=>c.operation==='join'),false);assert.match(document.body.textContent,/Check your inbox/);
  fixtureApi.confirm();history.replaceState(null,'','/summit-club/register/?complete=1');
  await settle(()=>root.render(createElement(Registration,{key:'confirmed'})));
  const registration=fixtureApi.calls.find(c=>c.operation==='join');assert.equal(registration.payload.name,'Taylor Student');assert.equal(registration.payload.consent,true);assert.deepEqual(fixtureApi.destinations,['/members/']);
  fixtureApi.destinations.length=0;history.replaceState(null,'','/summit-club/');
  await settle(()=>root.render(createElement(Registration,{embedded:true,key:'registered-public'})));
  assert.deepEqual(fixtureApi.destinations,[],'returning members can replay the public hike without a forced redirect');assert.match(document.body.textContent,/Open member basecamp/);
  // A verified email-test account has no pending club fields. It must still be
  // able to fill in real details, without creating another Auth account.
  fixtureApi.reset();fixtureApi.confirm();history.replaceState(null,'','/summit-club/register/?complete=1');
  await settle(()=>root.render(createElement(Registration,{key:'confirmed-no-draft'})));
  assert.match(document.body.textContent,/Email confirmed. Add your details/);
  assert.equal(field('name').disabled,false);assert.equal(field('email'),null);
  assert.equal(document.querySelector('.registration-back').getAttribute('href'),'/summit-club/#home');
  assert.deepEqual(fixtureApi.destinations,[]);
  await settle(()=>{field('name').value='Taylor Student';field('grade').value='10';field('interest').value='Explore';field('consent').checked=true;document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(fixtureApi.calls.filter(c=>c.operation==='join').length,1);
  assert.equal(fixtureApi.calls.some(c=>c.operation==='signup'),false);
  assert.deepEqual(fixtureApi.destinations,['/members/']);
  fixtureApi.reset();fixtureApi.setReady(false);history.replaceState(null,'','/summit-club/register/');
  await settle(()=>root.render(createElement(Registration,{key:'offline'})));
  assert.ok(field('email').disabled);assert.ok(document.querySelector('button[type="submit"]')?.disabled??document.querySelector('.registration-primary').disabled);assert.equal(fixtureApi.calls.length,0);
  const memberOutput=path.join(rootPath,'outputs/member-gate-ui-test.mjs');
  const memberBundle=await build({entryPoints:[path.join(rootPath,'app/members/basecamp.tsx')],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/summit-club/"'},plugins:[{name:'member-gate-test',setup(builder){
   builder.onResolve({filter:/(?:@\/lib\/(?:cloud-client|basecamp-client)|next\/navigation)$/},()=>({path:fixture,external:true}));
   builder.onResolve({filter:/^next\/link$/},()=>({path:path.join(rootPath,'preview/link.tsx')}));
   builder.onResolve({filter:/\.\.\/(trail-community|expedition-console|leader-desk)$/},args=>({path:args.path,namespace:'member-tool'}));
   builder.onLoad({filter:/.*/,namespace:'member-tool'},()=>({contents:'import {createElement} from "react"; export default function Tool(){globalThis.__memberToolMounts++; return createElement("div",null,"Private member tool");}',loader:'js',resolveDir:rootPath}));
  }}]});
  await writeFile(memberOutput,memberBundle.outputFiles[0].text);
  const {default:MemberBasecamp}=await import(pathToFileURL(memberOutput).href);
  fixtureApi.reset();globalThis.__memberToolMounts=0;
  await settle(()=>root.render(createElement(MemberBasecamp,{key:'visitor'})));
  assert.match(document.body.textContent,/Join or sign in/);assert.equal(globalThis.__memberToolMounts,0);
  fixtureApi.confirm();await fixtureApi.basecampRequest({body:JSON.stringify({action:'join',name:'Taylor Student',grade:'10',interest:'Serve'})});
  await settle(()=>root.render(createElement(MemberBasecamp,{key:'member'})));
  assert.match(document.body.textContent,/Good to see you, Taylor/);assert.ok(globalThis.__memberToolMounts>0);
  await settle(()=>fixtureApi.signOutMember());
  assert.doesNotMatch(document.body.textContent,/Private member tool|Good to see you, Taylor/);assert.match(document.body.textContent,/Join or sign in/);

 }finally{await act(async()=>root.unmount());dom.window.close();}
});
