import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
export const people = { alice: '10000000-0000-4000-8000-000000000001', bob: '10000000-0000-4000-8000-000000000002', eve: '10000000-0000-4000-8000-000000000003', leader: '10000000-0000-4000-8000-000000000004', unverified: '10000000-0000-4000-8000-000000000005' };
export async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  // PGlite has no background workers or outbound HTTP. Only this extension-only
  // migration is omitted; its scheduler and HTTP responses are checked on Supabase.
  const hostedOnly = new Set(['20261007014056_registration_mail_scheduler.sql']);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql') && !hostedOnly.has(name)).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  for (const [name, id] of Object.entries(people)) await db.query('insert into auth.users values($1,$2,$3)', [id, name === 'unverified' ? null : '2026-10-01T00:00:00Z', name + '@example.test']);
  await db.query('insert into private.club_leaders values($1)', [people.leader]);
  return db;
}
export async function as(db, name, query, args = []) {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [people[name] || '']);
    await tx.exec(`set local role ${name ? 'authenticated' : 'anon'}`);
    return (await tx.query(query, args)).rows;
  });
}
export const rpc = async (db, name, operation, payload = {}) => (await as(db, name, 'select public.summit_request($1,$2::jsonb) as result', [operation, JSON.stringify(payload)]))[0].result;
export const join = (db, name) => rpc(db, name, 'join', { name: name + ' Student', grade: '11', interest: 'All of it', consent: true });
export async function profile(db, name, overrides = {}) {
  return rpc(db, name, 'save_profile', { display_name: name, bio: 'I love the outdoors.', wants: 'Try a sunrise hike.', interests: ['Hiking', 'Wildlife'], visibility: 'friends', accepting_requests: true, ...overrides });
}
