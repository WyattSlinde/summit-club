export type MailJob={id:string;lease_token:string;recipient:string;details:{name:string;email:string;grade:string;interest:string;note:string}};
type Config={url:string;serviceKey:string;resendKey:string;from:string;workerSecret:string};
type Fetcher=typeof fetch;
export function registrationEmail(job:MailJob,from:string){
 return {from,to:['Tkell2028@cchsdons.com'],subject:'New SUMMIT club registration',text:[
 'A student has joined SUMMIT.', '', `Name: ${job.details.name}`, `Email: ${job.details.email}`, `Grade: ${job.details.grade}`, `Interests: ${job.details.interest}`,
 `Their note: ${job.details.note||'No note added.'}`, '', 'View the latest registration and club plans:', 'https://wyattslinde.github.io/summit-club/leadership/', '',
 'This email contains private club registration information. Their password, profile, friend list, and photos are not included.'
 ].join('\n')};
}
export function createMailHandler(config:Config,transport:Fetcher=fetch){
 async function rpc(name:string,body:Record<string,unknown>={}){
  const response=await transport(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.serviceKey,Authorization:`Bearer ${config.serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Mail queue unavailable.');
  return response.json();
 }
 return async function handle(request:Request){
  if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
  if(!config.workerSecret||request.headers.get('authorization')!==`Bearer ${config.workerSecret}`)return new Response('Unauthorized',{status:401});
  if(!config.url||!config.serviceKey||!config.resendKey||!config.from)return new Response('Mail is not configured',{status:503});
  let accepted=0,failed=0;
  try{
   for(let i=0;i<5;i++){
    const job=await rpc('claim_registration_mail') as MailJob|null;
    if(!job)break;
    let providerId:string|null=null,problem:string|null=null;
    try{
     if(job.recipient!=='Tkell2028@cchsdons.com')throw new Error('Recipient mismatch.');
     const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.resendKey}`,'Content-Type':'application/json','Idempotency-Key':`summit-registration-${job.id}`},body:JSON.stringify(registrationEmail(job,config.from)),signal:AbortSignal.timeout(15000)});
     if(!response.ok)throw new Error(`Mail provider returned ${response.status}.`);
     const result=await response.json() as {id?:string};if(!result.id)throw new Error('Mail provider response was incomplete.');providerId=result.id;
    }catch(e){problem=e instanceof Error?e.message:'Mail provider unavailable.';}
    const recorded=await rpc('finish_registration_mail',{job_id:job.id,token:job.lease_token,accepted_id:providerId,failure:problem});
    if(!recorded)throw new Error('Mail lease changed; will reconcile on retry.');
    if(providerId)accepted++;else{failed++;break;}
   }
   return Response.json({accepted,failed},{status:failed?503:200});
  }catch{return Response.json({error:'Could not finish processing the mail queue.'},{status:503});}
 };
}
