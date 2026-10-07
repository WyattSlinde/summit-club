-- SUMMIT's hosted member backend. No browser key can grant leadership access.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

create table private.club_leaders (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table private.request_limits (
  user_id uuid references auth.users(id) on delete cascade,
  action text not null, day date not null default current_date, attempts integer not null default 1,
  primary key(user_id, action, day)
);
create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 70),
  grade text not null check (grade in ('9','10','11','12')),
  interest text not null check (interest in ('Explore','Serve','Lead','All of it')),
  consent_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.profiles (
  user_id uuid primary key references public.members(user_id) on delete cascade,
  friend_tag text unique not null default ('SUM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 50),
  bio text not null default '' check (char_length(bio) <= 300),
  wants text not null default '' check (char_length(wants) <= 400),
  interests text[] not null default '{}' check (cardinality(interests) <= 6 and interests <@ array['Hiking','Beach days','Wildlife','Photography','Trail care','Community service','Camping','Leadership']),
  photo_path text check (photo_path is null or photo_path = user_id::text || '/avatar.jpg'),
  visibility text not null default 'private' check (visibility in ('private','friends')),
  accepting_requests boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index friendships_pair on public.friendships(least(sender_id,recipient_id), greatest(sender_id,recipient_id));
create index friendships_sender on public.friendships(sender_id, status);
create index friendships_recipient on public.friendships(recipient_id, status);
create table public.blocks (
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(), primary key(owner_id, blocked_id), check(owner_id <> blocked_id)
);
create index blocks_target on public.blocks(blocked_id);
create table public.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.members(user_id) on delete cascade,
  reported_id uuid not null references public.members(user_id) on delete cascade,
  reason text not null check (reason in ('Unwanted requests','Inappropriate profile','Something else')),
  details text not null default '' check (char_length(details) <= 500),
  resolved boolean not null default false, created_at timestamptz not null default now(),
  check(reporter_id <> reported_id)
);
create index reports_reporter on public.member_reports(reporter_id);
create index reports_target on public.member_reports(reported_id);
create table public.votes (
  user_id uuid not null references public.members(user_id) on delete cascade,
  adventure_id text not null check(adventure_id in ('ridge','coast','wild')),
  created_at timestamptz not null default now(), primary key(user_id, adventure_id)
);
create index votes_adventure on public.votes(adventure_id);
create table public.proposals (
  id uuid primary key, user_id uuid not null references public.members(user_id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 5 and 90),
  category text not null check(category in ('Explore','Serve','Lead')),
  description text not null check(char_length(btrim(description)) between 15 and 600),
  created_at timestamptz not null default now()
);
create index proposals_owner on public.proposals(user_id, created_at desc);
create table public.events (
  id uuid primary key, title text not null check(char_length(btrim(title)) between 4 and 100),
  starts_at timestamptz not null, location text not null check(char_length(btrim(location)) between 3 and 150),
  details text not null check(char_length(btrim(details)) between 10 and 1500),
  status text not null default 'published' check(status in ('published','cancelled')),
  created_at timestamptz not null default now()
);
create table public.rsvps (
  user_id uuid not null references public.members(user_id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade, primary key(user_id,event_id)
);
create index rsvps_event on public.rsvps(event_id);

-- All exposed relations fail closed. Mutations go through the authorized RPC below.
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.member_reports enable row level security;
alter table public.votes enable row level security;
alter table public.proposals enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
revoke all on public.members, public.profiles, public.friendships, public.blocks, public.member_reports, public.votes, public.proposals, public.events, public.rsvps from anon, authenticated;
grant select on public.profiles to authenticated;

create function private.can_view_profile(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    target = (select auth.uid()) or (
      exists(select 1 from public.profiles p where p.user_id=target and p.visibility='friends')
      and exists(select 1 from public.friendships f where f.status='accepted' and
        ((f.sender_id=(select auth.uid()) and f.recipient_id=target) or (f.recipient_id=(select auth.uid()) and f.sender_id=target)))
      and not exists(select 1 from public.blocks b where
        (b.owner_id=(select auth.uid()) and b.blocked_id=target) or (b.blocked_id=(select auth.uid()) and b.owner_id=target))
    )
  );
$$;
revoke all on function private.can_view_profile(uuid) from public;
grant execute on function private.can_view_profile(uuid) to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(private.can_view_profile(user_id));

create function private.take_limit(kind text, maximum integer) returns void
language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  insert into private.request_limits(user_id,action,day) values(auth.uid(),kind,current_date)
    on conflict(user_id,action,day) do update set attempts=private.request_limits.attempts+1
    returning request_limits.attempts into attempts;
  if attempts > maximum then raise exception 'Daily limit reached. Please try again tomorrow.'; end if;
end;
$$;
revoke all on function private.take_limit(text,integer) from public, anon, authenticated;

create function private.summit_request(operation text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); other uuid; pair public.friendships; member public.members;
  leader boolean := false; result jsonb; verb text := payload->>'verb';
  own_profile public.profiles; target_profile public.profiles; choices text[];
begin
  if octet_length(payload::text)>12000 then raise exception 'That request is too large.'; end if;
  if me is not null then select exists(select 1 from private.club_leaders where user_id=me) into leader; end if;
  if operation='basecamp' then
    return jsonb_build_object(
      'signedIn',me is not null,'leader',leader,'previewOnly',false,
      'member',(select to_jsonb(m)-'user_id'-'consent_at' from public.members m where m.user_id=me),
      'votes',coalesce((select jsonb_agg(v) from (select adventure_id,count(*)::integer as count from public.votes group by adventure_id) v),'[]'),
      'myVotes',coalesce((select jsonb_agg(jsonb_build_object('adventure_id',adventure_id)) from public.votes where user_id=me),'[]'),
      'proposals',coalesce((select jsonb_agg(to_jsonb(p)-'user_id') from public.proposals p where p.user_id=me),'[]'),
      'events',coalesce((select jsonb_agg(e order by e.starts_at) from public.events e where e.status='published' and e.starts_at>now()),'[]'),
      'rsvps',coalesce((select jsonb_agg(jsonb_build_object('event_id',event_id)) from public.rsvps where user_id=me),'[]')
    );
  end if;
  if me is null then raise exception 'Sign in to continue.'; end if;
  -- Verified identity, not a client-editable user_metadata flag.
  if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then
    raise exception 'Confirm your email before joining SUMMIT.';
  end if;
  if operation='join' then
    if payload->'consent' is distinct from 'true'::jsonb then raise exception 'Please confirm your registration consent.'; end if;
    perform private.take_limit('join',40);
    insert into public.members(user_id,name,grade,interest) values(me,btrim(payload->>'name'),payload->>'grade',payload->>'interest')
      on conflict(user_id) do update set name=excluded.name,grade=excluded.grade,interest=excluded.interest returning * into member;
    insert into public.profiles(user_id,display_name) values(me,left(member.name,50)) on conflict(user_id) do nothing;
    return jsonb_build_object('saved',true,'member',to_jsonb(member)-'user_id'-'consent_at');
  end if;
  if operation='leader' then
    if not leader then raise exception 'This account does not have leadership access.'; end if;
    if verb='event' then
      if (payload->>'startsAt')::timestamptz<=now() then raise exception 'Choose a future event date.'; end if;
      insert into public.events(id,title,starts_at,location,details) values((payload->>'id')::uuid,btrim(payload->>'title'),(payload->>'startsAt')::timestamptz,btrim(payload->>'location'),btrim(payload->>'details')) on conflict(id) do nothing;
    elsif verb='cancel' then update public.events set status='cancelled' where id=(payload->>'id')::uuid;
    elsif verb='resolve' then update public.member_reports set resolved=true where id=(payload->>'id')::uuid;
    elsif verb is not null then raise exception 'Unknown leadership action.';
    end if;
    return jsonb_build_object(
      'members',coalesce((select jsonb_agg(x) from (select m.name,m.grade,m.interest,m.created_at,(select string_agg(v.adventure_id,',') from public.votes v where v.user_id=m.user_id) as choices from public.members m order by created_at desc limit 2000)x),'[]'),
      'memberCount',(select count(*) from public.members),
      'proposals',coalesce((select jsonb_agg(x) from (select p.id,p.title,p.description,p.category,p.created_at,m.name from public.proposals p join public.members m on m.user_id=p.user_id order by p.created_at desc limit 500)x),'[]'),
      'totalIdeas',(select count(*) from public.proposals),
      'events',coalesce((select jsonb_agg(x) from (select e.*,(select count(*) from public.rsvps r where r.event_id=e.id) as count from public.events e order by e.starts_at desc limit 100)x),'[]'),
      'attendees',coalesce((select jsonb_agg(x) from (select r.event_id,m.name,m.grade from public.rsvps r join public.members m on m.user_id=r.user_id)x),'[]'),
      'votes',coalesce((select jsonb_agg(x) from (select adventure_id,count(*) as count from public.votes group by adventure_id)x),'[]'),
      'interests',coalesce((select jsonb_agg(x) from (select interest,count(*) as count from public.members group by interest)x),'[]'),
      'reports',coalesce((select jsonb_agg(x) from (select r.id,r.reason,r.details,r.created_at,m.name as reported_name from public.member_reports r join public.members m on m.user_id=r.reported_id where not r.resolved order by r.created_at desc limit 100)x),'[]')
    );
  end if;
  select * into member from public.members where user_id=me;
  if operation='profile' then
    return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where p.user_id=me),'member',to_jsonb(member)-'user_id'-'consent_at');
  end if;
  if member.user_id is null then raise exception 'Register with SUMMIT first.'; end if;
  if operation='save_profile' then
    perform private.take_limit('profile',100);
    select coalesce(array_agg(distinct item),'{}') into choices from jsonb_array_elements_text(payload->'interests') item;
    update public.profiles set display_name=btrim(payload->>'display_name'),bio=btrim(coalesce(payload->>'bio','')),wants=btrim(coalesce(payload->>'wants','')),
      interests=choices,visibility=payload->>'visibility',accepting_requests=(payload->>'accepting_requests')::boolean,updated_at=now()
      where user_id=me returning * into own_profile;
    return to_jsonb(own_profile);
  elsif operation='photo' then
    update public.profiles set photo_path=case when payload->'remove'='true'::jsonb then null else me::text||'/avatar.jpg' end,updated_at=now()
      where user_id=me returning * into own_profile;
    return to_jsonb(own_profile);
  elsif operation='rotate_tag' then
    perform private.take_limit('rotate',5);
    update public.profiles set friend_tag='SUM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),updated_at=now() where user_id=me returning * into own_profile;
    return to_jsonb(own_profile);
  elsif operation='connections' then
    return jsonb_build_object(
      'connections',coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select f.id,f.status,f.sender_id=me as outgoing,f.created_at,p.user_id,p.display_name,
          case when private.can_view_profile(p.user_id) then p.photo_path end as photo_path,
          case when private.can_view_profile(p.user_id) then p.bio end as bio,
          case when private.can_view_profile(p.user_id) then p.wants end as wants,
          case when private.can_view_profile(p.user_id) then p.interests end as interests,
          p.updated_at,private.can_view_profile(p.user_id) as shared
        from public.friendships f join public.profiles p on p.user_id=case when f.sender_id=me then f.recipient_id else f.sender_id end
        where (f.sender_id=me or f.recipient_id=me) and not exists(select 1 from public.blocks b where (b.owner_id=me and b.blocked_id=p.user_id) or (b.owner_id=p.user_id and b.blocked_id=me))
      )x),'[]'),
      'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name)) from public.blocks b join public.profiles p on p.user_id=b.blocked_id where b.owner_id=me),'[]')
    );
  elsif operation='friend' then
    if verb='send' then
      -- Rate-limit failures too: an exact high-entropy tag is required, never a name directory.
      perform private.take_limit('friend',30);
      select * into target_profile from public.profiles where friend_tag=upper(btrim(payload->>'tag'));
      other:=target_profile.user_id;
      if other is null or other=me then return jsonb_build_object('error','That tag is unavailable. Ask your friend to check their tag and request settings.'); end if;
    else other:=(payload->>'user_id')::uuid;
    end if;
    if other is null or other=me then raise exception 'Choose another member.'; end if;
    -- Serialize all relationship changes for this pair, including simultaneous block/send.
    perform pg_advisory_xact_lock(hashtextextended(least(me,other)::text||greatest(me,other)::text,0));
    if verb='block' then
      insert into public.blocks(owner_id,blocked_id) values(me,other) on conflict do nothing;
      delete from public.friendships where least(sender_id,recipient_id)=least(me,other) and greatest(sender_id,recipient_id)=greatest(me,other);
    elsif verb='unblock' then delete from public.blocks where owner_id=me and blocked_id=other;
    elsif exists(select 1 from public.blocks where (owner_id=me and blocked_id=other) or (owner_id=other and blocked_id=me)) then
      return jsonb_build_object('error','That tag is unavailable. Ask your friend to check their tag and request settings.');
    else
      select * into pair from public.friendships where least(sender_id,recipient_id)=least(me,other) and greatest(sender_id,recipient_id)=greatest(me,other);
      if verb='send' then
        if pair.id is not null then return jsonb_build_object('saved',true,'status',case when pair.status='accepted' then 'friends' when pair.recipient_id=me then 'incoming' else 'pending' end); end if;
        if not target_profile.accepting_requests then return jsonb_build_object('error','That tag is unavailable. Ask your friend to check their tag and request settings.'); end if;
        if (select count(*) from public.friendships where sender_id=me or recipient_id=me)>=100 or (select count(*) from public.friendships where sender_id=other or recipient_id=other)>=100 then raise exception 'Your crew is full. Remove a request or friend before adding another.'; end if;
        insert into public.friendships(sender_id,recipient_id) values(me,other);
      elsif verb='accept' then
        if pair.recipient_id is distinct from me then raise exception 'Only the recipient can accept a request.'; end if;
        update public.friendships set status='accepted' where id=pair.id;
      elsif verb='remove' then delete from public.friendships where id=pair.id;
      else raise exception 'Unknown friend action.';
      end if;
    end if;
    return jsonb_build_object('saved',true,'status','saved');
  elsif operation='report' then
    other:=(payload->>'user_id')::uuid;
    if not exists(select 1 from public.friendships where (sender_id=me and recipient_id=other) or (sender_id=other and recipient_id=me)) and not exists(select 1 from public.blocks where owner_id=me and blocked_id=other) then raise exception 'Choose a member from your connections.'; end if;
    perform private.take_limit('report',5);
    insert into public.member_reports(reporter_id,reported_id,reason,details) values(me,other,payload->>'reason',coalesce(payload->>'details',''));
    return jsonb_build_object('saved',true);
  elsif operation='vote' then
    if payload->'selected'='true'::jsonb then insert into public.votes(user_id,adventure_id) values(me,payload->>'adventureId') on conflict do nothing;
    elsif payload->'selected'='false'::jsonb then delete from public.votes where user_id=me and adventure_id=payload->>'adventureId';
    else raise exception 'Choose whether to save this vote.'; end if;
    return private.summit_request('basecamp','{}');
  elsif operation='propose' then
    if not exists(select 1 from public.proposals where id=(payload->>'requestId')::uuid and user_id=me) then
      if (select count(*) from public.proposals where user_id=me)>=20 then raise exception 'You have 20 saved ideas. Talk to club leadership about your next idea.'; end if;
      insert into public.proposals(id,user_id,title,category,description) values((payload->>'requestId')::uuid,me,btrim(payload->>'title'),payload->>'category',btrim(payload->>'description'));
    end if;
    return jsonb_build_object('saved',true);
  elsif operation='rsvp' then
    if payload->'selected'='false'::jsonb then delete from public.rsvps where user_id=me and event_id=(payload->>'eventId')::uuid;
    elsif payload->'selected'='true'::jsonb then
      if not exists(select 1 from public.events where id=(payload->>'eventId')::uuid and status='published' and starts_at>now()) then raise exception 'This event is not accepting RSVPs.'; end if;
      insert into public.rsvps(user_id,event_id) values(me,(payload->>'eventId')::uuid) on conflict do nothing;
    else raise exception 'Choose whether to save this RSVP.'; end if;
    return jsonb_build_object('saved',true);
  elsif operation='delete_profile' then
    if payload->>'confirm' is distinct from 'DELETE' then raise exception 'Type DELETE to confirm.'; end if;
    -- Storage is deleted through its API first; never delete storage metadata with SQL.
    if exists(select 1 from storage.objects where bucket_id='member-photos' and name=me::text||'/avatar.jpg') then raise exception 'Remove your photo before deleting your club profile.'; end if;
    delete from public.members where user_id=me;
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Unknown club action.';
end;
$$;
revoke all on function private.summit_request(text,jsonb) from public;
grant execute on function private.summit_request(text,jsonb) to anon, authenticated;
create function public.summit_request(operation text, payload jsonb default '{}') returns jsonb
language sql security invoker set search_path = '' as $$ select private.summit_request(operation,payload); $$;
revoke all on function public.summit_request(text,jsonb) from public;
grant execute on function public.summit_request(text,jsonb) to anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('member-photos','member-photos',false,2097152,array['image/jpeg']) on conflict(id) do nothing;
create policy member_photo_read on storage.objects for select to authenticated using(
  bucket_id='member-photos' and (
    name=(select auth.uid())::text||'/avatar.jpg' or exists(
      select 1 from public.profiles p where p.photo_path=name and private.can_view_profile(p.user_id)
    )
  )
);
create policy member_photo_insert on storage.objects for insert to authenticated with check(
  bucket_id='member-photos' and name=(select auth.uid())::text||'/avatar.jpg'
  and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()))
);
create policy member_photo_update on storage.objects for update to authenticated using(
  bucket_id='member-photos' and name=(select auth.uid())::text||'/avatar.jpg'
) with check(bucket_id='member-photos' and name=(select auth.uid())::text||'/avatar.jpg');
create policy member_photo_delete on storage.objects for delete to authenticated using(
  bucket_id='member-photos' and name=(select auth.uid())::text||'/avatar.jpg'
);
