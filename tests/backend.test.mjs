import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';

// Execute the real route handlers and migrations against isolated SQLite.
// Only the Sites identity and D1 transport are replaced; production data is untouched.
const sql = new DatabaseSync(':memory:');
for (const file of (await readdir(new URL('../drizzle/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
  sql.exec(await readFile(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
}
const env = { SUMMIT_LEADER_IDS: 'leader-one, leader-two', DB: {
  prepare(query) {
    const statement = sql.prepare(query); let params = [];
    return { bind(...values) { params = values; return this; },
      async all() { return { results: statement.all(...params) }; },
      async first() { return statement.get(...params) ?? null; },
      async run() { return { success: true, meta: statement.run(...params) }; },
    };
  },
} };
globalThis.__summitBackendTest = { env, user: null };
async function route(path) {
  const output = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, write: false,
    format: 'esm', platform: 'node', define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'isolated-platform', setup(plugin) {
      plugin.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'test' }));
      plugin.onResolve({ filter: /chatgpt-auth$/ }, () => ({ path: 'auth', namespace: 'test' }));
      plugin.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ contents: path === 'env'
        ? 'export const env=globalThis.__summitBackendTest.env'
        : 'export async function getChatGPTUser(){return globalThis.__summitBackendTest.user}' }));
    } }] });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}
const basecamp = await route('../app/api/basecamp/route.ts'), leader = await route('../app/api/leader/route.ts');
const signIn = id => { globalThis.__summitBackendTest.user = id ? { userId: id, email: `${id}@example.test`, fullName: id, displayName: id } : null; };
const post = (handler, body, origin = 'https://summit.example') => handler.POST(new Request('https://summit.example/api/test', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));
const register = (name, interest) => post(basecamp, { action: 'join', name, grade: '10', interest, consent: true });

test('registrations, interests, votes and private ideas flow to authorized club leaders', async () => {
  try {
    signIn(null);
    assert.equal((await register('Unauthenticated Student', 'Explore')).status, 401);
    assert.equal((await leader.GET()).status, 403);
    signIn('student-one');
    assert.equal((await register('Test Student One', 'Explore')).status, 200);
    assert.equal((await post(basecamp, { action: 'join', name: 'Bad Consent', grade: '10', interest: 'Lead', consent: false })).status, 400);
    assert.equal((await post(basecamp, { action: 'vote', adventureId: 'ridge', selected: true })).status, 200);
    assert.equal((await post(basecamp, { action: 'vote', adventureId: 'ridge', selected: true })).status, 200);
    const idea = { action: 'propose', requestId: crypto.randomUUID(), title: 'A local trail cleanup', category: 'Serve', description: 'Plan a weekend trail cleanup with the club.' };
    assert.equal((await post(basecamp, idea)).status, 200);
    assert.equal((await post(basecamp, idea)).status, 200);
    signIn('student-two');
    assert.equal((await register('Test Student Two', 'Serve')).status, 200);
    const own = await (await basecamp.GET()).json();
    assert.equal(own.member.name, 'Test Student Two');
    assert.deepEqual(own.proposals, []);
    assert.equal(own.leader, false);
    assert.equal(own.votes.find(item => item.adventure_id === 'ridge').count, 1);
    assert.equal((await leader.GET()).status, 403);
    assert.equal((await post(leader, { action: 'event', leader: true })).status, 403);
    signIn('leader-one');
    const response = await leader.GET(), desk = await response.json();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(desk.memberCount, 2);
    assert.equal(desk.totalIdeas, 1);
    assert.equal(desk.proposals[0].name, 'Test Student One');
    assert.equal(desk.members.find(member => member.name === 'Test Student One').choices, 'ridge');
    assert.equal(desk.interests.find(item => item.interest === 'Serve').count, 1);
    assert.ok(desk.members.every(member => !('user_id' in member) && !('email' in member)));
    signIn('leader-two'); assert.equal((await leader.GET()).status, 200);
    signIn('local_seedy'); assert.equal((await leader.GET()).status, 403, 'the local demo leader is denied in a production build');
    env.SUMMIT_LEADER_IDS = '';
    signIn('leader-one'); assert.equal((await leader.GET()).status, 403, 'unconfigured leadership fails closed');
    env.SUMMIT_LEADER_IDS = 'leader-one,leader-two';
    const eventId = crypto.randomUUID();
    const event = { action: 'event', id: eventId, title: 'Test club meeting', startsAt: new Date(Date.now() + 86400000).toISOString(), location: 'Test meeting point', details: 'Bring your ideas for the next club outing.' };
    assert.equal((await post(leader, event, 'https://other.example')).status, 403);
    assert.equal((await post(leader, event)).status, 200);
    assert.equal((await post(leader, event)).status, 200);
    signIn('not-a-member'); assert.equal((await post(basecamp, { action: 'rsvp', eventId, selected: true })).status, 400);
    signIn('student-one');
    for (let i = 0; i < 2; i++) assert.equal((await post(basecamp, { action: 'rsvp', eventId, selected: true })).status, 200);
    signIn('leader-two');
    const withEvent = await (await leader.GET()).json();
    assert.equal(withEvent.events.length, 1);
    assert.equal(withEvent.events[0].count, 1);
    assert.equal(withEvent.attendees[0].name, 'Test Student One');
    assert.equal((await post(leader, { action: 'cancel', id: eventId })).status, 200);
    signIn('student-one');
    assert.equal((await post(basecamp, { action: 'rsvp', eventId, selected: true })).status, 409);
    assert.deepEqual((await (await basecamp.GET()).json()).events, []);
    signIn(null);
    const publicData = await (await basecamp.GET()).json();
    assert.equal(publicData.member, null);
    assert.deepEqual(publicData.proposals, []);
    assert.deepEqual(publicData.rsvps, []);
    assert.ok(!JSON.stringify(publicData).includes('Test Student'));
  } finally { sql.close(); delete globalThis.__summitBackendTest; }
});
