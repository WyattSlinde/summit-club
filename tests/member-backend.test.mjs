import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as, rpc, join, profile, people } from './fixtures/member-db.mjs';

test('hosted members: real Postgres authorization, friendships, private photos and club data', async t => {
  const db = await setup();
  try {
    await t.test('requires verified identity and consent, never self-grants leadership', async () => {
      await assert.rejects(rpc(db, '', 'join', {}), /Sign in/);
      await assert.rejects(join(db, 'unverified'), /Confirm your email/);
      await assert.rejects(rpc(db, 'alice', 'join', { name: 'Alice' }), /consent/);
      for (const name of ['alice', 'bob', 'eve']) await join(db, name);
      const state = await rpc(db, 'alice', 'basecamp'); assert.equal(state.member.name, 'alice Student'); assert.equal(state.leader, false);
      await assert.rejects(rpc(db, 'alice', 'leader'), /leadership access/);
      await assert.rejects(as(db, 'alice', 'insert into private.club_leaders values($1)', [people.alice]), /permission denied/);
      await assert.rejects(as(db, 'alice', "update public.profiles set visibility='friends' where user_id=$1", [people.bob]), /permission denied/);
      assert.equal((await rpc(db, 'alice', 'profile')).profile.visibility, 'private');
      assert.equal((await rpc(db, 'alice', 'profile')).profile.accepting_requests, false);
    });
    let alice, bob;
    await t.test('private profiles cannot be enumerated; anonymous summary has no records', async () => {
      alice = await profile(db, 'alice'); bob = await profile(db, 'bob');
      await profile(db, 'eve', { visibility: 'private' });
      assert.equal((await as(db, 'eve', 'select * from public.profiles')).length, 1);
      await assert.rejects(as(db, '', 'select * from public.profiles'), /permission denied/);
      await assert.rejects(as(db, 'alice', 'select * from public.members'), /permission denied/);
      const state = await rpc(db, '', 'basecamp'); assert.equal(state.member, null); assert.deepEqual(state.proposals, []);
      await assert.rejects(profile(db, 'alice', { interests: ['Invalid interest'] }), /check constraint/);
    });
    await t.test('exact tags, idempotent requests, recipient-only acceptance and friend visibility', async () => {
      const unavailable = await rpc(db, 'alice', 'friend', { verb: 'send', tag: 'NOT A TAG' }); assert.match(unavailable.error, /unavailable/);
      await rpc(db, 'alice', 'friend', { verb: 'send', tag: bob.friend_tag.toLowerCase() });
      assert.equal((await rpc(db, 'alice', 'friend', { verb: 'send', tag: bob.friend_tag })).status, 'pending');
      assert.equal((await rpc(db, 'bob', 'friend', { verb: 'send', tag: alice.friend_tag })).status, 'incoming');
      const pending = (await rpc(db, 'bob', 'connections')).connections; assert.equal(pending.length, 1); assert.equal(pending[0].bio, null); assert.equal(pending[0].outgoing, false);
      await assert.rejects(rpc(db, 'alice', 'friend', { verb: 'accept', user_id: people.bob }), /recipient/);
      await assert.rejects(rpc(db, 'eve', 'friend', { verb: 'accept', user_id: people.bob }), /recipient/);
      await rpc(db, 'bob', 'friend', { verb: 'accept', user_id: people.alice });
      assert.equal((await rpc(db, 'alice', 'connections')).connections[0].bio, 'I love the outdoors.');
      assert.equal((await as(db, 'alice', 'select * from public.profiles')).length, 2);
      assert.equal((await rpc(db, 'eve', 'connections')).connections.length, 0);
    });
    await t.test('private storage checks every download; privacy and blocking revoke access', async () => {
      const photo = people.bob + '/avatar.jpg';
      await as(db, 'bob', "insert into storage.objects(bucket_id,name) values('member-photos',$1)", [photo]);
      await rpc(db, 'bob', 'photo');
      assert.equal((await as(db, 'alice', 'select * from storage.objects')).length, 1);
      assert.equal((await as(db, 'eve', 'select * from storage.objects')).length, 0);
      await assert.rejects(as(db, 'alice', "insert into storage.objects(bucket_id,name) values('member-photos',$1)", [people.eve + '/avatar.jpg']), /row-level security/);
      await profile(db, 'bob', { visibility: 'private' });
      assert.equal((await as(db, 'alice', 'select * from storage.objects')).length, 0);
      assert.equal((await rpc(db, 'alice', 'connections')).connections[0].photo_path, null);
      await profile(db, 'bob');
      await rpc(db, 'alice', 'friend', { verb: 'block', user_id: people.bob });
      assert.equal((await rpc(db, 'alice', 'connections')).connections.length, 0);
      assert.equal((await as(db, 'alice', 'select * from storage.objects')).length, 0);
      assert.match((await rpc(db, 'bob', 'friend', { verb: 'send', tag: alice.friend_tag })).error, /unavailable/);
      assert.equal((await rpc(db, 'alice', 'connections')).blocked[0].user_id, people.bob);
      await rpc(db, 'alice', 'friend', { verb: 'unblock', user_id: people.bob });
      assert.equal((await rpc(db, 'alice', 'connections')).connections.length, 0);
    });
    await t.test('tags can rotate, requests can cancel/decline, reports are leader-only', async () => {
      const next = await rpc(db, 'bob', 'rotate_tag'); assert.notEqual(next.friend_tag, bob.friend_tag);
      assert.match((await rpc(db, 'alice', 'friend', { verb: 'send', tag: bob.friend_tag })).error, /unavailable/);
      await rpc(db, 'alice', 'friend', { verb: 'send', tag: next.friend_tag });
      await rpc(db, 'alice', 'report', { user_id: people.bob, reason: 'Unwanted requests', details: 'Please review.' });
      const leader = await rpc(db, 'leader', 'leader'); assert.equal(leader.reports.length, 1);
      await assert.rejects(as(db, 'bob', 'select * from public.member_reports'), /permission denied/);
      await rpc(db, 'leader', 'leader', { verb: 'resolve', id: leader.reports[0].id });
      assert.equal((await rpc(db, 'leader', 'leader')).reports.length, 0);
      await rpc(db, 'bob', 'friend', { verb: 'remove', user_id: people.alice });
      assert.equal((await rpc(db, 'alice', 'connections')).connections.length, 0);
      await rpc(db, 'alice', 'friend', { verb: 'send', tag: next.friend_tag });
      await rpc(db, 'alice', 'friend', { verb: 'remove', user_id: people.bob });
      assert.equal((await rpc(db, 'bob', 'connections')).connections.length, 0);
    });
    await t.test('votes persist once, student ideas remain private, leaders get real totals and RSVPs', async () => {
      await rpc(db, 'alice', 'vote', { adventureId: 'ridge', selected: true });
      await rpc(db, 'alice', 'vote', { adventureId: 'ridge', selected: true });
      await rpc(db, 'bob', 'vote', { adventureId: 'ridge', selected: true });
      assert.equal((await rpc(db, '', 'basecamp')).votes[0].count, 2);
      await rpc(db, 'alice', 'vote', { adventureId: 'ridge', selected: false });
      assert.equal((await rpc(db, '', 'basecamp')).votes[0].count, 1);
      const id = '20000000-0000-4000-8000-000000000001';
      const proposal = { requestId: id, title: 'Sunrise hike', category: 'Explore', description: 'Let us go on a sunrise hike together.' };
      await rpc(db, 'alice', 'propose', proposal); await rpc(db, 'alice', 'propose', proposal);
      assert.equal((await rpc(db, 'bob', 'basecamp')).proposals.length, 0);
      assert.equal((await rpc(db, 'leader', 'leader')).totalIdeas, 1);
      await assert.rejects(rpc(db, 'alice', 'leader', { verb: 'event' }), /leadership access/);
      await rpc(db, 'leader', 'leader', { verb: 'event', id, title: 'A confirmed hike', startsAt: '2099-01-01T16:00:00Z', location: 'School meeting point', details: 'Bring water and your required permission.' });
      await rpc(db, 'alice', 'rsvp', { eventId: id, selected: true }); await rpc(db, 'alice', 'rsvp', { eventId: id, selected: true });
      assert.equal((await rpc(db, 'leader', 'leader')).attendees.length, 1);
      await rpc(db, 'leader', 'leader', { verb: 'cancel', id });
      await assert.rejects(rpc(db, 'bob', 'rsvp', { eventId: id, selected: true }), /not accepting/);
      await rpc(db, 'alice', 'rsvp', { eventId: id, selected: false });
    });
    await t.test('request rate limit counts invalid guesses; no broad name lookup', async () => {
      for (let i = 0; i < 30; i++) await rpc(db, 'eve', 'friend', { verb: 'send', tag: 'SUM-0000000000' });
      await assert.rejects(rpc(db, 'eve', 'friend', { verb: 'send', tag: alice.friend_tag }), /Daily limit/);
      await assert.rejects(rpc(db, 'eve', 'lookup', { name: 'bob' }), /Unknown club action/);
    });
    await t.test('deletion requires confirmation and storage cleanup; cascades club records', async () => {
      await assert.rejects(rpc(db, 'bob', 'delete_profile', { confirm: 'no' }), /Type DELETE/);
      await assert.rejects(rpc(db, 'bob', 'delete_profile', { confirm: 'DELETE' }), /Remove your photo/);
      await as(db, 'bob', 'delete from storage.objects where name=$1', [people.bob + '/avatar.jpg']);
      await rpc(db, 'bob', 'delete_profile', { confirm: 'DELETE' });
      assert.equal((await rpc(db, 'bob', 'profile')).profile, null);
      assert.equal((await rpc(db, '', 'basecamp')).votes.length, 0);
      await rpc(db, 'alice', 'delete_profile', { confirm: 'DELETE' });
      assert.equal((await rpc(db, 'leader', 'leader')).totalIdeas, 0);
    });
  } finally { await db.close(); }
});
