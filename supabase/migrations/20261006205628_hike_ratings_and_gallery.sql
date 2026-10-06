-- Member-rated trails and an explicitly members-only photo gallery.
create table public.hikes (
  id text primary key check(id ~ '^[a-z0-9-]{3,80}$'),
  name text not null check(char_length(btrim(name)) between 3 and 100),
  area text not null check(char_length(btrim(area)) between 3 and 120),
  official_url text not null check(char_length(official_url)<=500 and official_url ~ '^https://[^[:space:]]+$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index hikes_name_area on public.hikes(lower(name),lower(area));
insert into public.hikes(id,name,area,official_url) values
('torrey-guy-fleming','Guy Fleming Trail','Torrey Pines State Natural Reserve','https://www.parks.ca.gov/?page_id=23207'),
('cowles-mountain','Cowles Mountain','Mission Trails Regional Park','https://www.sandiego.gov/cowles-mountain-summit'),
('penasquitos-canyon','Los Peñasquitos Canyon','Los Peñasquitos Canyon Preserve','https://www.sandiego.gov/park-and-recreation/parks/osp/lospenasquitos');
create table public.hike_ratings (
  user_id uuid not null references public.members(user_id) on delete cascade,
  hike_id text not null references public.hikes(id),
  stars smallint not null check(stars between 1 and 5),
  hiked_on date not null,
  rating_month date generated always as (make_date(extract(year from hiked_on)::integer,extract(month from hiked_on)::integer,1)) stored,
  updated_at timestamptz not null default now(),
  primary key(user_id,hike_id,rating_month)
);
create index hike_ratings_month on public.hike_ratings(rating_month,hike_id) include(stars);
create index hike_ratings_hike on public.hike_ratings(hike_id);
create table public.hike_photos (
  id uuid primary key,
  user_id uuid not null references public.members(user_id) on delete cascade,
  hike_id text not null references public.hikes(id),
  object_path text not null unique check(object_path=user_id::text||'/'||id::text||'.jpg'),
  caption text not null default '' check(char_length(btrim(caption))<=240),
  alt_text text not null check(char_length(btrim(alt_text)) between 5 and 180),
  hiked_on date not null,
  status text not null default 'draft' check(status in ('draft','published','hidden','deleting')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index hike_photos_owner on public.hike_photos(user_id,created_at desc);
create index hike_photos_gallery on public.hike_photos(published_at desc,id desc) where status='published';
create index hike_photos_hike on public.hike_photos(hike_id);
create table public.hike_photo_reports (
  photo_id uuid not null references public.hike_photos(id) on delete cascade,
  reporter_id uuid not null references public.members(user_id) on delete cascade,
  reason text not null check(reason in ('Permission concern','Inappropriate photo','Wrong trail or spam')),
  created_at timestamptz not null default now(),
  primary key(photo_id,reporter_id)
);
create index hike_photo_reports_reporter on public.hike_photo_reports(reporter_id);
alter table public.hikes enable row level security;
alter table public.hike_ratings enable row level security;
alter table public.hike_photos enable row level security;
alter table public.hike_photo_reports enable row level security;
revoke all on public.hikes,public.hike_ratings,public.hike_photos,public.hike_photo_reports from anon,authenticated;

create function private.can_read_hike_photo(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.hike_photos p where p.object_path=object_name and (
      p.user_id=(select auth.uid()) or exists(select 1 from private.club_leaders where user_id=(select auth.uid()))
      or (p.status='published' and exists(select 1 from public.members where user_id=(select auth.uid()))
        and not exists(select 1 from public.blocks b where
          (b.owner_id=(select auth.uid()) and b.blocked_id=p.user_id) or (b.blocked_id=(select auth.uid()) and b.owner_id=p.user_id)))
    )
  );
$$;
create function private.can_upload_hike_photo(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(select 1 from public.hike_photos p
    where p.object_path=object_name and p.user_id=(select auth.uid()) and p.status='draft' and p.created_at>now()-interval '1 hour');
$$;
revoke all on function private.can_read_hike_photo(text),private.can_upload_hike_photo(text) from public;
grant execute on function private.can_read_hike_photo(text),private.can_upload_hike_photo(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hike-photos','hike-photos',false,4194304,array['image/jpeg']) on conflict(id) do nothing;
create policy hike_photo_read on storage.objects for select to authenticated using(bucket_id='hike-photos' and private.can_read_hike_photo(name));
create policy hike_photo_insert on storage.objects for insert to authenticated with check(bucket_id='hike-photos' and private.can_upload_hike_photo(name));
-- Immutable images: replacing an approved image through upsert is intentionally forbidden.
create policy hike_photo_delete on storage.objects for delete to authenticated using(bucket_id='hike-photos' and split_part(name,'/',1)=(select auth.uid())::text);

create function private.community_request(operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  me uuid:=auth.uid(); today date:=timezone('America/Los_Angeles',now())::date;
  current_month date:=date_trunc('month',timezone('America/Los_Angeles',now()))::date;
  selected_month date; hike_date date; leader boolean; member boolean;
  photo public.hike_photos; selected_id uuid; verb text:=payload->>'verb'; result jsonb;
  before_time timestamptz:=(payload->>'before_at')::timestamptz; before_id uuid:=(payload->>'before_id')::uuid;
begin
  if octet_length(payload::text)>8000 then raise exception 'That request is too large.'; end if;
  select exists(select 1 from private.club_leaders where user_id=me) into leader;
  select exists(select 1 from public.members where user_id=me) into member;
  selected_month:=coalesce((payload->>'month')::date,current_month);
  if extract(day from selected_month)<>1 or selected_month>current_month or selected_month<(current_month-interval '11 months')::date then raise exception 'Choose one of the last 12 months.'; end if;
  if (before_time is null)<>(before_id is null) then raise exception 'Invalid gallery cursor.'; end if;
  if operation='ratings' then
    with scored as (
      select h.id,h.name,h.area,h.official_url,count(r.user_id)::integer as rating_count,round(avg(r.stars),1) as average,
        avg(r.stars) as exact_average,
        (select jsonb_build_object('stars',own.stars,'hiked_on',own.hiked_on) from public.hike_ratings own where own.user_id=me and own.hike_id=h.id and own.rating_month=selected_month) as my_rating
      from public.hikes h left join public.hike_ratings r on r.hike_id=h.id and r.rating_month=selected_month
      where h.active group by h.id
    ), ranked as (
      select s.*,case when rating_count>=3 then row_number() over(order by (rating_count>=3) desc,exact_average desc nulls last,rating_count desc,name,id) end as rank from scored s
    )
    select jsonb_build_object('month',selected_month,'today',today,'minimum_ratings',3,'hikes',coalesce(jsonb_agg(to_jsonb(r)-'exact_average' order by rank nulls last,name,id),'[]')) into result from ranked r;
    return result;
  end if;
  if me is null then raise exception 'Sign in to continue.'; end if;
  if not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then raise exception 'Confirm your email to continue.'; end if;
  if operation='leader' then
    if not leader then raise exception 'This account does not have leadership access.'; end if;
    if verb='add_hike' then
      insert into public.hikes(id,name,area,official_url) values('trail-'||substr(replace(gen_random_uuid()::text,'-',''),1,16),btrim(payload->>'name'),btrim(payload->>'area'),payload->>'official_url');
    elsif verb='toggle_hike' then
      if payload->'active' not in ('true'::jsonb,'false'::jsonb) or payload->'active' is null then raise exception 'Choose whether the trail is active.'; end if;
      update public.hikes set active=(payload->>'active')::boolean where id=payload->>'hike_id';
    elsif verb='hide' then update public.hike_photos set status='hidden' where id=(payload->>'id')::uuid and status='published';
    elsif verb='restore' then
      update public.hike_photos set status='published' where id=(payload->>'id')::uuid and status='hidden';
    elsif verb='resolve' then delete from public.hike_photo_reports where photo_id=(payload->>'id')::uuid;
    elsif verb is not null then raise exception 'Unknown gallery action.';
    end if;
    return jsonb_build_object(
      'hikes',coalesce((select jsonb_agg(h order by h.name) from public.hikes h),'[]'),
      'photos',coalesce((select jsonb_agg(x) from (select p.*,h.name as hike_name,pr.display_name as author_name,
        (select count(*) from public.hike_photo_reports r where r.photo_id=p.id) as reports,
        coalesce((select jsonb_agg(r.reason) from public.hike_photo_reports r where r.photo_id=p.id),'[]') as reasons
        from public.hike_photos p join public.hikes h on h.id=p.hike_id join public.profiles pr on pr.user_id=p.user_id
        where p.status in ('published','hidden') order by (exists(select 1 from public.hike_photo_reports r where r.photo_id=p.id)) desc,p.created_at desc limit 100)x),'[]')
    );
  end if;
  if not member then raise exception 'Register with SUMMIT first.'; end if;
  if operation='rate' then
    if payload->'hiked' is distinct from 'true'::jsonb then raise exception 'Only rate a trail you have hiked.'; end if;
    hike_date:=(payload->>'hiked_on')::date;
    if hike_date is null or hike_date>today or hike_date<(current_month-interval '11 months')::date then raise exception 'Choose a hike date in the last 12 months, not in the future.'; end if;
    if not exists(select 1 from public.hikes where id=payload->>'hike_id' and active) then raise exception 'Choose a listed trail.'; end if;
    perform private.take_limit('rating',60);
    insert into public.hike_ratings(user_id,hike_id,stars,hiked_on) values(me,payload->>'hike_id',(payload->>'stars')::smallint,hike_date)
      on conflict(user_id,hike_id,rating_month) do update set stars=excluded.stars,hiked_on=excluded.hiked_on,updated_at=now();
    return jsonb_build_object('saved',true);
  elsif operation='remove_rating' then
    delete from public.hike_ratings where user_id=me and hike_id=payload->>'hike_id' and rating_month=selected_month;
    return jsonb_build_object('saved',true);
  elsif operation='gallery' then
    return jsonb_build_object('photos',coalesce((select jsonb_agg(x order by x.published_at desc,x.id desc) from (
      select p.id,p.hike_id,p.object_path,p.caption,p.alt_text,p.hiked_on,p.status,p.published_at,h.name as hike_name,pr.display_name as author_name,p.user_id=me as mine
      from public.hike_photos p join public.hikes h on h.id=p.hike_id join public.profiles pr on pr.user_id=p.user_id
      where p.status='published' and private.can_read_hike_photo(p.object_path)
      and (coalesce(payload->>'hike_id','')='' or p.hike_id=payload->>'hike_id')
      and (before_time is null or (p.published_at,p.id)<(before_time,before_id))
      order by p.published_at desc,p.id desc limit 25
    )x),'[]'));
  elsif operation='my_photos' then
    return jsonb_build_object('photos',coalesce((select jsonb_agg(x order by x.created_at desc,x.id desc) from (
      select p.id,p.hike_id,p.object_path,p.caption,p.alt_text,p.hiked_on,p.status,p.published_at,p.created_at,h.name as hike_name,pr.display_name as author_name,true as mine
      from public.hike_photos p join public.hikes h on h.id=p.hike_id join public.profiles pr on pr.user_id=p.user_id where p.user_id=me
    )x),'[]'));
  elsif operation='photo_draft' then
    if payload->'consent' is distinct from 'true'::jsonb then raise exception 'Confirm that you have permission to share this photo with SUMMIT members.'; end if;
    hike_date:=(payload->>'hiked_on')::date;
    if hike_date is null or hike_date>today or hike_date<date '2000-01-01' then raise exception 'Choose the date of your hike, not a future date.'; end if;
    if not exists(select 1 from public.hikes where id=payload->>'hike_id' and active) then raise exception 'Choose a listed trail.'; end if;
    selected_id:=(payload->>'id')::uuid;
    if selected_id is null then raise exception 'A photo upload needs an ID.'; end if;
    -- Serialize a member's quota and idempotent draft retries.
    perform pg_advisory_xact_lock(hashtextextended('photo:'||me::text,0));
    select * into photo from public.hike_photos where id=selected_id;
    if photo.id is not null then
      if photo.user_id<>me then raise exception 'This upload ID is unavailable.'; end if;
      if photo.status='draft' then
        update public.hike_photos set caption=btrim(coalesce(payload->>'caption','')),alt_text=btrim(payload->>'alt_text'),hike_id=payload->>'hike_id',hiked_on=hike_date where id=photo.id returning * into photo;
      end if;
      return to_jsonb(photo);
    end if;
    if (select count(*) from public.hike_photos where user_id=me)>=30 then raise exception 'You have 30 photos. Remove an older photo or unfinished upload to add another.'; end if;
    perform private.take_limit('hike_photo',10);
    insert into public.hike_photos(id,user_id,hike_id,object_path,caption,alt_text,hiked_on)
      values(selected_id,me,payload->>'hike_id',me::text||'/'||selected_id::text||'.jpg',btrim(coalesce(payload->>'caption','')),btrim(payload->>'alt_text'),hike_date) returning * into photo;
    return to_jsonb(photo);
  elsif operation in ('photo_publish','photo_edit','photo_remove','photo_delete') then
    select * into photo from public.hike_photos where id=(payload->>'id')::uuid for update;
    if photo.id is null and operation='photo_delete' then return jsonb_build_object('saved',true); end if;
    if photo.user_id is distinct from me then raise exception 'Only the owner can change this photo.'; end if;
    if operation='photo_publish' then
      if photo.status='published' then return jsonb_build_object('saved',true); end if;
      if photo.status<>'draft' then raise exception 'This photo cannot be published.'; end if;
      if not exists(select 1 from storage.objects where bucket_id='hike-photos' and name=photo.object_path) then raise exception 'Upload the photo before sharing it.'; end if;
      update public.hike_photos set status='published',published_at=now() where id=photo.id;
    elsif operation='photo_edit' then
      if photo.status<>'published' then raise exception 'Only published captions can be edited.'; end if;
      update public.hike_photos set caption=btrim(coalesce(payload->>'caption','')),alt_text=btrim(payload->>'alt_text') where id=photo.id;
    elsif operation='photo_remove' then
      update public.hike_photos set status='deleting' where id=photo.id;
      return jsonb_build_object('object_path',photo.object_path);
    else
      if exists(select 1 from storage.objects where bucket_id='hike-photos' and name=photo.object_path) then raise exception 'Remove the photo file before deleting its record.'; end if;
      delete from public.hike_photos where id=photo.id;
    end if;
    return jsonb_build_object('saved',true);
  elsif operation='report_photo' then
    select * into photo from public.hike_photos where id=(payload->>'id')::uuid;
    if photo.status is distinct from 'published' or not private.can_read_hike_photo(photo.object_path) or photo.user_id=me then raise exception 'Choose a shared photo from another member.'; end if;
    perform private.take_limit('photo_report',10);
    insert into public.hike_photo_reports(photo_id,reporter_id,reason) values(photo.id,me,payload->>'reason') on conflict(photo_id,reporter_id) do update set reason=excluded.reason;
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Unknown trail action.';
end;
$$;
revoke all on function private.community_request(text,jsonb) from public;
grant execute on function private.community_request(text,jsonb) to anon,authenticated;
create function public.community_request(operation text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.community_request(operation,payload); $$;
revoke all on function public.community_request(text,jsonb) from public;
grant execute on function public.community_request(text,jsonb) to anon,authenticated;

-- Preserve the original club API while extending its deletion guard for gallery files.
alter function private.summit_request(text,jsonb) rename to summit_request_v1;
revoke all on function private.summit_request_v1(text,jsonb) from anon,authenticated;
create function private.summit_request(operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if operation='delete_profile' then
    if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
    if exists(select 1 from storage.objects where bucket_id='hike-photos' and split_part(name,'/',1)=auth.uid()::text) then
      raise exception 'Remove your hike photo files before deleting your club profile.';
    end if;
  end if;
  return private.summit_request_v1(operation,payload);
end;
$$;
revoke all on function private.summit_request(text,jsonb) from public;
grant execute on function private.summit_request(text,jsonb) to anon,authenticated;
create or replace function public.summit_request(operation text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.summit_request(operation,payload); $$;
