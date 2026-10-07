import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, rpc, as, join, people } from './fixtures/member-db.mjs';
import { registrationEmail, createMailHandler } from '../supabase/functions/registration-mail/worker.ts';
import { registrationDetails } from '../lib/club-registration.ts';
const workerRpc=async(db,operation,payload=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query(operation,payload)).rows[0].result;});
const claim=db=>workerRpc(db,'select public.claim_registration_mail() as result');
const finish=(db,job,id=null,error=null)=>workerRpc(db,'select public.finish_registration_mail($1,$2,$3,$4) as result',[job.id,job.lease_token,id,error]);
test('signup queues the verified contact details once; student cannot read mail or spoof recipient',async()=>{
 const db=await setup();try{
  const payload={name:'Alice Student',grade:'10',interest:'Serve',note:'Beach cleanup with friends.',consent:true,email:'spoof@example.test',recipient:'evil@example.test'};
  await assert.rejects(rpc(db,'unverified','join',payload),/Confirm your email/);
  await assert.rejects(rpc(db,'alice','join',{...payload,consent:false}),/consent/);
  await rpc(db,'alice','join',payload);await rpc(db,'alice','join',payload);
  const rows=(await db.query('select * from private.registration_notifications')).rows;assert.equal(rows.length,1);
  assert.equal(rows[0].recipient,'Tkell2028@cchsdons.com');assert.equal(rows[0].details.email,'alice@example.test');assert.equal(rows[0].details.note,payload.note);
  for(const viewer of [null,'alice','leader']){
   await assert.rejects(as(db,viewer,'select * from private.registration_notifications'),/permission denied/);
   await assert.rejects(as(db,viewer,'select public.claim_registration_mail()'),/permission denied/);
   await assert.rejects(as(db,viewer,'select private.summit_request_v2($1,$2::jsonb)',['join',JSON.stringify(payload)]),/permission denied/);
  }
  const leader=await rpc(db,'leader','leader');assert.equal(leader.members[0].contact_email,'alice@example.test');assert.equal(leader.members[0].notification_status,'pending');
  await assert.rejects(rpc(db,'bob','leader'),/leadership access/);
  assert.equal((await rpc(db,'bob','basecamp')).member,null);
  const first=await claim(db);assert.equal(first.attempts,1);assert.equal(await claim(db),null);
  assert.equal(await finish(db,{...first,lease_token:people.bob},'provider-1'),false);
  assert.equal(await finish(db,first,'provider-1'),true);assert.equal(await claim(db),null);
  assert.equal((await rpc(db,'leader','leader')).members[0].notification_status,'sent');
 }finally{await db.close();}
});
test('notification retries keep their original payload and stop before provider deduplication expires',async()=>{
 const db=await setup();try{
  await join(db,'alice');const first=await claim(db);await finish(db,first,null,'Provider temporarily unavailable.');assert.equal(await claim(db),null);
  await db.exec("update private.registration_notifications set next_attempt_at=now()-interval '1 minute'");
  const retry=await claim(db);assert.equal(retry.id,first.id);assert.deepEqual(retry.details,first.details);assert.notEqual(retry.lease_token,first.lease_token);
  await db.exec("update private.registration_notifications set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 minute'");
  assert.equal(await claim(db),null);assert.equal((await db.query('select status from private.registration_notifications')).rows[0].status,'needs_review');
  await rpc(db,'alice','delete_profile',{confirm:'DELETE'});assert.equal((await db.query('select count(*)::int as n from private.registration_notifications')).rows[0].n,0);
 }finally{await db.close();}
});
const job={id:'job-123',lease_token:'lease-123',recipient:'Tkell2028@cchsdons.com',details:{name:'Taylor <script>',email:'taylor@example.test',grade:'11',interest:'All of it',note:'Try a sunrise hike.'}};
const config={url:'https://example.supabase.co',serviceKey:'test-service',resendKey:'test-resend',from:'SUMMIT <club@example.test>',workerSecret:'test-worker'};
test('mail worker authenticates callers, fixes destination, and retries with a stable idempotency key',async()=>{
 const calls=[];let claimed=false;
 const transport=async(url,options)=>{calls.push({url,...options,parsed:JSON.parse(options.body)});if(url.endsWith('claim_registration_mail')){const result=claimed?null:job;claimed=true;return Response.json(result);}if(url.endsWith('finish_registration_mail'))return Response.json(true);return Response.json({id:'provider-123'});};
 const handle=createMailHandler(config,transport);
 assert.equal((await handle(new Request('https://worker.test',{method:'POST'}))).status,401);assert.equal(calls.length,0);
 const result=await handle(new Request('https://worker.test',{method:'POST',headers:{Authorization:'Bearer test-worker'}}));assert.equal(result.status,200);assert.deepEqual(await result.json(),{accepted:1,failed:0});
 const mail=calls.find(c=>c.url==='https://api.resend.com/emails');assert.deepEqual(mail.parsed.to,['Tkell2028@cchsdons.com']);assert.equal(mail.headers['Idempotency-Key'],'summit-registration-job-123');assert.equal(mail.parsed.html,undefined);assert.match(mail.parsed.text,/Try a sunrise hike/);assert.doesNotMatch(JSON.stringify(mail.parsed),/test-service|test-resend/);
 assert.equal(calls.find(c=>c.url.endsWith('finish_registration_mail')).parsed.accepted_id,'provider-123');
 assert.deepEqual(registrationEmail(job,config.from),mail.parsed);
});
test('mail failures remain retryable and never report a sent notification',async()=>{
 const calls=[];const transport=async(url,options)=>{calls.push({url,...options,parsed:JSON.parse(options.body)});if(url.endsWith('claim_registration_mail'))return Response.json(job);if(url.endsWith('finish_registration_mail'))return Response.json(true);return new Response('Unavailable',{status:429});};
 const result=await createMailHandler(config,transport)(new Request('https://worker.test',{method:'POST',headers:{Authorization:'Bearer test-worker'}}));assert.equal(result.status,503);
 const finish=calls.find(c=>c.url.endsWith('finish_registration_mail'));assert.equal(finish.parsed.accepted_id,null);assert.match(finish.parsed.failure,/429/);
});
test('pending signup details are validated and strip arbitrary metadata',()=>{
 const input={name:' Taylor Student ',grade:'10',interest:'Explore',note:' Trails ',consent:true,leader:true};
 assert.deepEqual(registrationDetails(input),{name:'Taylor Student',grade:'10',interest:'Explore',note:'Trails',consent:true});
 for(const invalid of [null,{}, {...input,consent:'true'}, {...input,grade:'13'}, {...input,note:'x'.repeat(401)}, {...input,name:'x'}, {...input,interest:'admin'}])assert.equal(registrationDetails(invalid),null);
});
