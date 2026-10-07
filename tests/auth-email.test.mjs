import test from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from 'standardwebhooks';
import { authMessages, createAuthEmailHandler } from '../supabase/functions/auth-email/handler.ts';

const secret = Buffer.alloc(32, 9).toString('base64');
const config = {url:'https://abcdefghijklmnopqrst.supabase.co',from:'summit@example.test',brevoKey:'private-provider-key',hookSecret:`v1,whsec_${secret}`};
const payload = {user:{email:'student@example.test',user_metadata:{recipient:'attacker@example.test'}},email_data:{email_action_type:'signup',token_hash:'a'.repeat(56),redirect_to:'https://wyattslinde.github.io/summit-club/register/?complete=1'}};
function request(data=payload,{date=new Date(),id='msg_summit_test',key=secret}={}){
 const body=JSON.stringify(data);
 return new Request('https://worker.test',{method:'POST',body,headers:{'webhook-id':id,'webhook-timestamp':String(Math.floor(date.getTime()/1000)),'webhook-signature':new Webhook(key).sign(id,date,body)}});
}
test('Auth email rejects forged, missing, stale, and future signatures before contacting Brevo',async()=>{
 let calls=0;const handler=createAuthEmailHandler(config,async()=>{calls++;throw Error('Must not send');});
 const unsigned=new Request('https://worker.test',{method:'POST',body:JSON.stringify(payload)});
 const original=request();const forged=new Request(original.url,{method:'POST',headers:original.headers,body:JSON.stringify({...payload,user:{email:'attacker@example.test'}})});
 for(const req of [unsigned,forged,request(payload,{date:new Date(Date.now()-600000)}),request(payload,{date:new Date(Date.now()+600000)}),request(payload,{key:Buffer.alloc(32,7).toString('base64')})])assert.equal((await handler(req)).status,401);
 assert.equal(calls,0);
});
test('Signed confirmation, sign-in, and recovery emails use the authenticated recipient and exact callback',async()=>{
 const calls=[];const handler=createAuthEmailHandler(config,async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return Response.json({messageId:'accepted-1'});});
 for(const action of ['signup','magiclink','recovery','invite']){
  const data={...payload,email_data:{...payload.email_data,email_action_type:action}};
  const response=await handler(request(data));assert.equal(response.status,200);assert.deepEqual(await response.json(),{});
  const sent=calls.at(-1);assert.equal(sent.url,'https://api.brevo.com/v3/smtp/email');assert.deepEqual(sent.body.to,[{email:'student@example.test'}]);
  const link=new URL(sent.body.textContent.split('\n').find(line=>line.startsWith('https:')));
  assert.equal(link.origin,config.url);assert.equal(link.pathname,'/auth/v1/verify');assert.equal(link.searchParams.get('token'),payload.email_data.token_hash);
  assert.equal(link.searchParams.get('type'),action);assert.equal(link.searchParams.get('redirect_to'),payload.email_data.redirect_to);
  assert.doesNotMatch(JSON.stringify(sent.body),/private-provider-key|attacker/);
 }
});
test('Signed but malformed payloads and off-site redirects cannot send an email',async()=>{
 let calls=0;const handler=createAuthEmailHandler(config,async()=>{calls++;return Response.json({messageId:'bad'});});
 for(const data of [null,{}, {...payload,user:{email:'bad\r\nBcc: attacker@example.test'}},...[
  {redirect_to:'https://attacker.example/'},{redirect_to:'https://wyattslinde.github.io/summit-club.evil/profile/'},{token_hash:'\"><script>'},{email_action_type:'constructor'},
 ].map(change=>({...payload,email_data:{...payload.email_data,...change}}))])assert.equal((await handler(request(data))).status,400);
 assert.equal(calls,0);
});
test('Secure email change maps both confirmation hashes to the documented addresses',()=>{
 const messages=authMessages({...payload,user:{email:'old@example.test',new_email:'new@example.test'},email_data:{...payload.email_data,email_action_type:'email_change',token_hash_new:'b'.repeat(56)}},config,'change1');
 assert.equal(messages.length,2);assert.deepEqual(messages.map(x=>x.to[0].email),['old@example.test','new@example.test']);
 assert.match(messages[0].textContent,new RegExp('token='+ 'b'.repeat(56)));assert.match(messages[1].textContent,new RegExp('token='+ 'a'.repeat(56)));
 assert.notEqual(messages[0].headers.idempotencyKey,messages[1].headers.idempotencyKey);
});
test('Provider failures do not report success, leak tokens, or change retry identity',async()=>{
 const keys=[];
 for(const outcome of ['reject','invalid','throw']){
  const handler=createAuthEmailHandler(config,async(url,options)=>{keys.push(JSON.parse(options.body).headers.idempotencyKey);if(outcome==='throw')throw Error('private-provider-key');return outcome==='reject'?new Response('private-provider-key',{status:401}):Response.json({});});
  const result=await handler(request());assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/private-provider-key|aaaaaa/);
 }
 assert.equal(new Set(keys).size,1);assert.match(keys[0],/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('Reauthentication codes are validated and missing server configuration fails closed',async()=>{
 const data={...payload,email_data:{...payload.email_data,email_action_type:'reauthentication',token:'12345678'}};
 assert.match(authMessages(data,config,'otp')[0].textContent,/12345678/);
 assert.throws(()=>authMessages({...data,email_data:{...data.email_data,token:'<script>'}},config,'otp'));
 let calls=0;const handler=createAuthEmailHandler({...config,hookSecret:''},async()=>{calls++;return Response.json({});});
 assert.equal((await handler(request())).status,503);assert.equal(calls,0);
});
