export const cloudConfigured = true, cloudAuthReady = true;
export const calls = [], listeners = new Set();
const id = '10000000-0000-4000-8000-000000000004';
let role = 'leader', failNext = false;
let data = {
 members: [
  {name:'Taylor Test',grade:'11',interest:'Explore',created_at:'2026-10-01T10:00:00Z',choices:'ridge',contact_email:'taylor@example.test',note:'Test note',notification_status:'sent'},
  {name:'Robin Test',grade:'10',interest:'Serve',created_at:'2026-10-01T10:00:00Z',choices:'coast',contact_email:'robin@example.test'}
 ], memberCount:2, totalIdeas:1,
 proposals:[{id:'idea-test',title:'A student suggestion',name:'Taylor Test',description:'A test idea from the crew.',category:'Explore',created_at:'2026-10-01T10:00:00Z'}],
 events:[{id:'event-test',title:'Confirmed test outing',starts_at:'2099-01-01T18:00:00Z',location:'Test meeting point',details:'Approved fixture event details.',status:'published',count:1}],
 attendees:[{event_id:'event-test',name:'Robin Test',grade:'10'}], votes:[{adventure_id:'ridge',count:2},{adventure_id:'coast',count:1}], interests:[{interest:'Explore',count:1},{interest:'Serve',count:1}],
 reports:[{id:'report-test',reason:'Test concern',details:'A private concern to review.',reported_name:'Taylor Test',created_at:'2026-10-01T10:00:00Z'}]
};
let community={hikes:[],photos:[{id:'photo-test',hike_name:'Previously approved test trail',hike_id:'test-trail',author_name:'Taylor',object_path:'test/photo.jpg',alt_text:'A test landscape',caption:'A fixture photo',status:'published',reports:1,reasons:['Permission concern']}]};
export function showReports(value) { if(value)data.reports=[];else delete data.reports; }
export function failNextSave() { failNext = true; }
export function changeRole(value) { role=value; for(const fn of listeners)fn(value==='none'?'SIGNED_OUT':'SIGNED_IN',value==='none'?null:{user:{id:value==='leader'?id:'10000000-0000-4000-8000-000000000001'}}); }
export async function clubRequest(operation,payload={}) {
 calls.push({service:'club',operation,payload});
 if(operation==='basecamp')return {signedIn:role!=='none',member:role==='none'?null:{name:'Test leader'},leader:role==='leader',votes:[],myVotes:[],proposals:[],events:[],rsvps:[]};
 if(operation!=='leader'||role!=='leader')throw new Error('Leadership access required.');
 if(payload.verb&&failNext){failNext=false;throw new Error('Could not save. Please try again.');}
 if(payload.verb==='event')data.events.push({...payload,starts_at:payload.startsAt,status:'published',count:0});
 if(payload.verb==='cancel')data.events.find(e=>e.id===payload.id).status='cancelled';
 if(payload.verb==='resolve')data.reports=data.reports.filter(r=>r.id!==payload.id);
 return structuredClone(data);
}
export async function communityRequest(operation,payload={}) {
 calls.push({service:'community',operation,payload});
 if(role!=='leader')throw new Error('Leadership access required.');
 if(payload.verb==='add_hike')community.hikes.push({id:'new-test-trail',...payload,active:true});
 if(payload.verb==='toggle_hike')community.hikes.find(h=>h.id===payload.hike_id).active=payload.active;
 if(payload.verb==='hide')community.photos.find(p=>p.id===payload.id).status='hidden';
 if(payload.verb==='restore')community.photos.find(p=>p.id===payload.id).status='published';
 if(payload.verb==='resolve')community.photos.find(p=>p.id===payload.id).reports=0;
 return structuredClone(community);
}
export const announceMemberChange=()=>{};
export async function signOutMember(){changeRole('none');}
export function cloudClient(){return {
 auth:{getUser:async()=>({data:{user:role==='none'?null:{id:role==='leader'?id:'10000000-0000-4000-8000-000000000001'}},error:null}),onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};}},
 storage:{from:()=>({download:async()=>({data:new Blob(['test image']),error:null})})}
};}
