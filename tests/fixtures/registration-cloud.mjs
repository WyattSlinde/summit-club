export let cloudConfigured=true,cloudAuthReady=true;
export const calls=[],destinations=[];
let signedIn=false,member=null,user=null,returningMember=null;const subscribers=new Set();
export function reset(){calls.length=0;destinations.length=0;signedIn=false;member=null;user=null;returningMember=null;cloudConfigured=true;cloudAuthReady=true;}
export function returning(){returningMember={name:'Taylor Student',grade:'10',interest:'Explore',created_at:'2026-10-06'};}
export function setReady(value){cloudConfigured=value;cloudAuthReady=value;}
export function confirm(){signedIn=true;user={id:'test-user',email:'taylor@example.test',email_confirmed_at:'2026-10-06',user_metadata:{summit_registration:calls.find(c=>c.operation==='signup')?.payload.options.data.summit_registration}};}
export async function basecampRequest(init){const body=init?.body?JSON.parse(init.body):null;if(body?.action==='join'){calls.push({operation:'join',payload:body});member={...body,created_at:'2026-10-06'};return {saved:true,member};}return {signedIn,member,leader:false,votes:[],myVotes:[],events:[],proposals:[],rsvps:[]};}
export function cloudClient(){return {auth:{
 signUp:async payload=>{calls.push({operation:'signup',payload});return {data:{session:null},error:null};},
 signInWithPassword:async payload=>{calls.push({operation:'signin',payload});if(payload.password==='incorrect')return {error:new Error('Invalid login credentials')};confirm();member=returningMember;return {data:{session:{}},error:null};},
 signInWithOtp:async payload=>{calls.push({operation:'login-link',payload});return {data:{session:null},error:null};},
 resetPasswordForEmail:async(email,options)=>{calls.push({operation:'reset',payload:{email,options}});return {error:null};},
 getUser:async()=>({data:{user},error:null}),
 updateUser:async payload=>{calls.push({operation:'updateUser',payload});return {data:{user},error:null};},
 resend:async payload=>{calls.push({operation:'resend',payload});return {error:null};},
 onAuthStateChange:callback=>{subscribers.add(callback);return {data:{subscription:{unsubscribe(){subscribers.delete(callback);}}}};},
 signOut:async()=>{signedIn=false;member=null;user=null;return {error:null};}
}};}
export async function signOutMember(){signedIn=false;member=null;user=null;for(const callback of subscribers)callback('SIGNED_OUT',null);announceMemberChange();}
export function announceMemberChange(){window.dispatchEvent(new Event('summit:member-change'));}
const router={replace:href=>destinations.push(href),push:href=>destinations.push(href)};
export function useRouter(){return router;}
export async function clubRequest(){return null;}
export async function communityRequest(){return null;}
