import {getChatGPTUser} from '../../chatgpt-auth';
import {isLeader} from '../../../lib/leader';
import {database} from '../../../db/raw';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET() {
  const user = await getChatGPTUser();
  if (!isLeader(user)) return json({ error: 'Club leadership access required.' }, 403);
  try {
    const db = database();
    const [members, proposals, events, attendees, votes, interests, totals] = await Promise.all([
      db.prepare(`SELECT m.name,m.grade,m.interest,m.created_at,
        (SELECT GROUP_CONCAT(v.adventure_id) FROM votes v WHERE v.user_id=m.user_id) AS choices
        FROM members m ORDER BY m.created_at DESC,m.user_id LIMIT 2000`).all(),
      db.prepare(`SELECT p.id,p.title,p.category,p.description,p.created_at,m.name
        FROM proposals p LEFT JOIN members m ON m.user_id=p.user_id
        ORDER BY p.created_at DESC,p.id LIMIT 500`).all(),
      db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM rsvps r WHERE r.event_id=e.id) AS count
        FROM events e ORDER BY starts_at DESC LIMIT 100`).all(),
      db.prepare(`SELECT r.event_id,m.name,m.grade FROM rsvps r JOIN members m ON m.user_id=r.user_id
        WHERE r.event_id IN (SELECT id FROM events ORDER BY starts_at DESC LIMIT 100)
        ORDER BY m.name`).all(),
      db.prepare('SELECT adventure_id,COUNT(*) AS count FROM votes GROUP BY adventure_id').all(),
      db.prepare('SELECT interest,COUNT(*) AS count FROM members GROUP BY interest').all(),
      db.prepare('SELECT (SELECT COUNT(*) FROM members) AS members,(SELECT COUNT(*) FROM proposals) AS ideas').first<{members:number;ideas:number}>(),
    ]);
    return json({ members: members.results, memberCount: totals?.members ?? 0,
      proposals: proposals.results, totalIdeas: totals?.ideas ?? 0, events: events.results,
      attendees: attendees.results, votes: votes.results, interests: interests.results });
  } catch (error) {
    console.error('Leadership read failed', error);
    return json({ error: 'Could not load the leadership desk. Please try again.' }, 503);
  }
}
export async function POST(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);const user=await getChatGPTUser();if(!isLeader(user))return json({error:'Club leadership access required.'},403);if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);try{const raw=await request.text();if(raw.length>6000)return json({error:'Submission too long.'},413);let b;try{b=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Invalid request.'},400);const db=database();if(b.action==='cancel'){if(typeof b.id!=='string')return json({error:'Choose an event.'},400);await db.prepare("UPDATE events SET status='cancelled' WHERE id=?").bind(b.id).run();return json({saved:true});}if(b.action!=='event')return json({error:'Unknown action.'},400);if(typeof b.title!=='string'||b.title.trim().length<4||b.title.length>100||typeof b.location!=='string'||b.location.trim().length<3||b.location.length>150||typeof b.details!=='string'||b.details.length<10||b.details.length>1500||typeof b.startsAt!=='string'||!Number.isFinite(Date.parse(b.startsAt))||Date.parse(b.startsAt)<Date.now()||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id))return json({error:'Add a title, future date, meeting location, and details.'},400);await db.prepare('INSERT OR IGNORE INTO events(id,title,starts_at,location,details,status,created_at) VALUES(?,?,?,?,?,?,?)').bind(b.id,b.title.trim(),new Date(b.startsAt).toISOString(),b.location.trim(),b.details.trim(),'published',new Date().toISOString()).run();return json({saved:true});}catch(e){console.error(e);return json({error:'Could not save. Please try again.'},503);}}
