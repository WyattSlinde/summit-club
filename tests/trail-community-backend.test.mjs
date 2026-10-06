import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, as, rpc, join, people } from './fixtures/member-db.mjs';
const community = async (db, who, operation, payload = {}) => (await as(db, who, 'select public.community_request($1,$2::jsonb) as result', [operation, JSON.stringify(payload)]))[0].result;
const id = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';

test('monthly hikes: verified member ratings are unique, editable and correctly ranked by hike month', async () => {
  const db = await setup();
  try {
    for (const name of ['alice', 'bob', 'eve']) await join(db, name);
    const initial = await community(db, '', 'ratings');
    assert.equal(initial.hikes.length, 3); assert.ok(initial.hikes.every(h => h.average === null && h.rank === null && h.rating_count === 0));
    const rate = (who, hike, stars, extra = {}) => community(db, who, 'rate', { hike_id: hike, hiked_on: initial.today, stars, hiked: true, ...extra });
    await assert.rejects(rate('', 'cowles-mountain', 5), /Sign in/);
    await assert.rejects(rate('unverified', 'cowles-mountain', 5), /Confirm your email/);
    await assert.rejects(rate('leader', 'cowles-mountain', 5), /Register/);
    await assert.rejects(rate('alice', 'cowles-mountain', 5, { hiked: false }), /personally|Only rate/);
    await assert.rejects(rate('alice', 'cowles-mountain', 5, { hiked_on: '2099-01-01' }), /future/);
    await assert.rejects(rate('alice', 'cowles-mountain', 6), /check constraint/);
    await assert.rejects(rate('alice', 'cowles-mountain', 2.5), /invalid input/);
    await assert.rejects(rate('alice', 'unknown', 5), /listed trail/);
    for (const [who, stars] of [['alice',3],['bob',4],['eve',5]]) await rate(who, 'cowles-mountain', stars);
    await rate('alice', 'cowles-mountain', 3); // Retry, not another vote.
    let board = await community(db, '', 'ratings');
    let cowles = board.hikes.find(h => h.id === 'cowles-mountain');
    assert.equal(cowles.rating_count, 3); assert.equal(cowles.average, 4); assert.equal(cowles.rank, 1); assert.equal(cowles.my_rating, null);
    for (const who of ['alice','bob','eve']) await rate(who, 'torrey-guy-fleming', 5);
    assert.equal((await community(db, '', 'ratings')).hikes[0].id, 'torrey-guy-fleming');
    await rate('alice', 'torrey-guy-fleming', 1, { user_id: people.bob });
    assert.equal((await community(db, 'bob', 'ratings')).hikes.find(h => h.id === 'torrey-guy-fleming').my_rating.stars, 5);
    board = await community(db, '', 'ratings'); assert.equal(board.hikes[0].id, 'cowles-mountain');
    await community(db, 'eve', 'remove_rating', { hike_id: 'torrey-guy-fleming', month: initial.month });
    const torrey = (await community(db, '', 'ratings')).hikes.find(h => h.id === 'torrey-guy-fleming'); assert.equal(torrey.rank, null); assert.equal(torrey.rating_count, 2);
    const previous = (await db.query("select (date_trunc('month',timezone('America/Los_Angeles',now()))-interval '1 month')::date::text as month")).rows[0].month;
    for (const who of ['alice','bob','eve']) await rate(who, 'cowles-mountain', 1, { hiked_on: previous });
    assert.equal((await community(db, '', 'ratings', { month: previous })).hikes[0].average, 1);
    assert.equal((await community(db, '', 'ratings')).hikes.find(h => h.id === 'cowles-mountain').average, 4);
    await assert.rejects(community(db, '', 'ratings', { month: '2099-01-01' }), /last 12 months/);
    await assert.rejects(as(db, 'bob', 'select * from public.hike_ratings'), /permission denied/);
    await assert.rejects(as(db, 'bob', "insert into public.hike_ratings(user_id,hike_id,stars,hiked_on) values($1,'cowles-mountain',5,current_date)", [people.alice]), /permission denied/);
  } finally { await db.close(); }
});

test('hike photos: consent, private storage, immutable uploads, moderation, blocks, removal and profile deletion', async () => {
  const db = await setup();
  try {
    for (const name of ['alice','bob','eve']) await join(db, name);
    const { today } = await community(db, '', 'ratings');
    const fields = { id, hike_id: 'cowles-mountain', hiked_on: today, caption: 'Good company up here.', alt_text: 'Two friends at the trail summit', consent: true };
    await assert.rejects(community(db, 'alice', 'photo_draft', { ...fields, consent: false }), /permission to share/);
    await assert.rejects(community(db, 'leader', 'photo_draft', fields), /Register/);
    let photo = await community(db, 'alice', 'photo_draft', fields);
    assert.equal(photo.object_path, `${people.alice}/${id}.jpg`);
    await community(db, 'alice', 'photo_draft', fields); assert.equal((await community(db, 'alice', 'my_photos')).photos.length, 1);
    await assert.rejects(community(db, 'bob', 'photo_draft', fields), /unavailable/);
    await assert.rejects(community(db, 'alice', 'photo_publish', { id }), /Upload the photo/);
    await assert.rejects(as(db, 'bob', "insert into storage.objects(bucket_id,name) values('hike-photos',$1)", [photo.object_path]), /row-level security/);
    await assert.rejects(as(db, 'alice', "insert into storage.objects(bucket_id,name) values('hike-photos',$1)", [`${people.alice}/${secondId}.jpg`]), /row-level security/);
    await as(db, 'alice', "insert into storage.objects(bucket_id,name) values('hike-photos',$1)", [photo.object_path]);
    assert.equal((await as(db, 'bob', "select * from storage.objects where bucket_id='hike-photos'")).length, 0);
    await community(db, 'alice', 'photo_publish', { id }); await community(db, 'alice', 'photo_publish', { id });
    assert.equal((await as(db, 'bob', "select * from storage.objects where bucket_id='hike-photos'")).length, 1);
    await assert.rejects(community(db, '', 'gallery'), /Sign in/);
    await assert.rejects(as(db, '', "select * from storage.objects"), /permission denied/);
    assert.equal((await community(db, 'bob', 'gallery')).photos[0].author_name, 'alice Student');
    assert.equal((await community(db, 'bob', 'gallery')).photos[0].user_id, undefined);
    assert.equal((await community(db, 'bob', 'gallery', { hike_id: 'torrey-guy-fleming' })).photos.length, 0);
    assert.equal((await as(db, 'alice', 'update storage.objects set name=$1 where name=$1 returning id', [photo.object_path])).length, 0);
    await assert.rejects(community(db, 'bob', 'photo_edit', { id, caption: 'Hijack', alt_text: fields.alt_text }), /Only the owner/);
    await community(db, 'alice', 'photo_edit', { id, caption: 'An even better view.', alt_text: fields.alt_text });
    assert.equal((await community(db, 'bob', 'gallery')).photos[0].caption, 'An even better view.');
    await community(db, 'bob', 'report_photo', { id, reason: 'Permission concern' });
    await community(db, 'bob', 'report_photo', { id, reason: 'Permission concern' });
    let desk = await community(db, 'leader', 'leader'); assert.equal(desk.photos[0].reports, 1);
    await assert.rejects(community(db, 'bob', 'leader', { verb: 'hide', id }), /leadership/);
    await community(db, 'leader', 'leader', { verb: 'hide', id });
    assert.equal((await community(db, 'bob', 'gallery')).photos.length, 0);
    assert.equal((await as(db, 'bob', 'select * from storage.objects')).length, 0);
    assert.equal((await as(db, 'alice', 'select * from storage.objects')).length, 1);
    assert.equal((await as(db, 'leader', 'select * from storage.objects')).length, 1);
    await assert.rejects(community(db, 'alice', 'photo_publish', { id }), /cannot be published/);
    await community(db, 'leader', 'leader', { verb: 'restore', id });
    await community(db, 'leader', 'leader', { verb: 'resolve', id });
    assert.equal((await community(db, 'leader', 'leader')).photos[0].reports, 0);
    await rpc(db, 'alice', 'friend', { verb: 'block', user_id: people.bob });
    assert.equal((await community(db, 'bob', 'gallery')).photos.length, 0);
    assert.equal((await as(db, 'bob', 'select * from storage.objects')).length, 0);
    assert.equal((await community(db, 'eve', 'gallery')).photos.length, 1);
    await assert.rejects(rpc(db, 'alice', 'delete_profile', { confirm: 'DELETE' }), /hike photo files/);
    await assert.rejects(as(db, 'alice', "select private.summit_request_v1('delete_profile','{\"confirm\":\"DELETE\"}'::jsonb)"), /permission denied/);
    await assert.rejects(community(db, 'eve', 'photo_remove', { id }), /Only the owner/);
    await community(db, 'alice', 'photo_remove', { id });
    assert.equal((await community(db, 'eve', 'gallery')).photos.length, 0);
    await assert.rejects(community(db, 'alice', 'photo_delete', { id }), /Remove the photo file/);
    await as(db, 'alice', 'delete from storage.objects where name=$1', [photo.object_path]);
    await community(db, 'alice', 'photo_delete', { id }); await community(db, 'alice', 'photo_delete', { id });
    assert.equal((await community(db, 'alice', 'my_photos')).photos.length, 0);
    await rpc(db, 'alice', 'delete_profile', { confirm: 'DELETE' });
    assert.equal((await rpc(db, 'alice', 'profile')).profile, null);
  } finally { await db.close(); }
});

test('leaders manage real trails; gallery pagination is stable and quotas constrain abandoned uploads', async () => {
  const db = await setup();
  try {
    await join(db, 'alice'); await join(db, 'bob');
    await assert.rejects(community(db, 'alice', 'leader', { verb: 'add_hike', name: 'Fake' }), /leadership/);
    let desk = await community(db, 'leader', 'leader', { verb: 'add_hike', name: 'A test trail', area: 'Test park', official_url: 'https://example.test/park' });
    const hike = desk.hikes.find(h => h.name === 'A test trail'); assert.ok(hike);
    await assert.rejects(community(db, 'leader', 'leader', { verb: 'add_hike', name: 'Unsafe trail', area: 'Test park', official_url: 'javascript:alert(1)' }), /check constraint/);
    await community(db, 'leader', 'leader', { verb: 'toggle_hike', hike_id: hike.id, active: false });
    assert.ok(!(await community(db, '', 'ratings')).hikes.some(h => h.id === hike.id));
    const { today } = await community(db, '', 'ratings');
    for (let i = 1; i <= 10; i++) {
      const photoId = `30000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
      const p = await community(db, 'alice', 'photo_draft', { id: photoId, hike_id: 'cowles-mountain', hiked_on: today, caption: 'Photo', alt_text: 'View from the trail', consent: true });
      await as(db, 'alice', "insert into storage.objects(bucket_id,name) values('hike-photos',$1)", [p.object_path]); await community(db, 'alice', 'photo_publish', { id: photoId });
    }
    const first = (await community(db, 'bob', 'gallery')).photos;
    const after = (await community(db, 'bob', 'gallery', { before_at: first[4].published_at, before_id: first[4].id })).photos;
    assert.equal(first.length, 10); assert.equal(after.length, 5); assert.deepEqual(after.map(p => p.id), first.slice(5).map(p => p.id));
    await assert.rejects(community(db, 'bob', 'gallery', { before_id: id }), /Invalid gallery cursor/);
    await assert.rejects(community(db, 'alice', 'photo_draft', { id, hike_id: 'cowles-mountain', hiked_on: today, caption: '', alt_text: 'Another trail photo', consent: true }), /Daily limit/);
    // Quota still applies to unfinished/hidden records; deleting a record cannot reset the daily allowance.
    await community(db, 'alice', 'photo_remove', { id: first[0].id });
    await as(db, 'alice', 'delete from storage.objects where name=$1', [first[0].object_path]); await community(db, 'alice', 'photo_delete', { id: first[0].id });
    await assert.rejects(community(db, 'alice', 'photo_draft', { id, hike_id: 'cowles-mountain', hiked_on: today, alt_text: 'Another trail photo', consent: true }), /Daily limit/);
  } finally { await db.close(); }
});
