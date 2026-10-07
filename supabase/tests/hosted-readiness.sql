-- Hosted database permission checks. All fixtures and queued mail are rolled back.
-- This verifies SQL/RLS, not delivery of Auth emails or real Storage uploads.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('be800001-7889-4660-9000-000000000001','summit-check-a@example.test',now()),
('be800001-7889-4660-9000-000000000002','summit-check-b@example.test',now()),
('be800001-7889-4660-9000-000000000003','summit-check-unverified@example.test',null);

select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000001',true);
set local role authenticated;
select public.summit_request('join','{"name":"Readiness Student A","grade":"11","interest":"Explore","note":"Sunrise hikes","consent":true}');
select public.summit_request('vote','{"adventureId":"ridge","selected":true}');
select public.summit_request('vote','{"adventureId":"ridge","selected":true}');
select public.summit_request('save_profile','{"display_name":"Readiness A","bio":"Private profile","wants":"A sunrise hike","interests":["Hiking"],"visibility":"private","accepting_requests":true}');
select set_config('summit.test_tag',(public.summit_request('profile','{}')->'profile'->>'friend_tag'),true);
select public.community_request('rate',jsonb_build_object('hike_id','cowles-mountain','stars',5,'hiked',true,'hiked_on',timezone('America/Los_Angeles',now())::date));

select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000002',true);
select public.summit_request('join','{"name":"Readiness Student B","grade":"10","interest":"Serve","consent":true}');
do $$ begin
  if exists(select 1 from public.profiles where user_id='be800001-7889-4660-9000-000000000001') then raise exception 'Private profile leaked'; end if;
  begin
    perform public.summit_request('leader','{}');
    raise exception 'Leader access leaked';
  exception when raise_exception then
    if sqlerrm <> 'This account does not have leadership access.' then raise; end if;
  end;
  begin
    perform public.claim_registration_mail();
    raise exception 'Mail worker access leaked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.members;
    raise exception 'Roster table leaked';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into private.club_leaders(user_id) values('be800001-7889-4660-9000-000000000002');
    raise exception 'Self-promotion was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.summit_request('friend',jsonb_build_object('verb','send','tag',current_setting('summit.test_tag')));

select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000001',true);
select public.summit_request('friend','{"verb":"accept","user_id":"be800001-7889-4660-9000-000000000002"}');
select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000002',true);
do $$ begin
  if exists(select 1 from public.profiles where user_id='be800001-7889-4660-9000-000000000001') then raise exception 'Unshared friend profile leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000001',true);
select public.summit_request('save_profile','{"display_name":"Readiness A","bio":"Shared profile","wants":"A sunrise hike","interests":["Hiking"],"visibility":"friends","accepting_requests":true}');
select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000002',true);
do $$ begin
  if not exists(select 1 from public.profiles where user_id='be800001-7889-4660-9000-000000000001') then raise exception 'Shared friend profile inaccessible'; end if;
end $$;
select public.summit_request('friend','{"verb":"block","user_id":"be800001-7889-4660-9000-000000000001"}');
do $$ begin
  if exists(select 1 from public.profiles where user_id='be800001-7889-4660-9000-000000000001') then raise exception 'Blocked profile leaked'; end if;
end $$;

select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000003',true);
do $$ begin
  begin
    perform public.summit_request('join','{"name":"Unverified Student","grade":"11","interest":"Explore","consent":true}');
    raise exception 'Unverified registration allowed';
  exception when raise_exception then
    if sqlerrm <> 'Confirm your email before joining SUMMIT.' then raise; end if;
  end;
end $$;

reset role;
do $$ begin
  if (select count(*) from public.votes where user_id='be800001-7889-4660-9000-000000000001')<>1 then raise exception 'Duplicate vote recorded'; end if;
  if (select count(*) from public.hike_ratings where user_id='be800001-7889-4660-9000-000000000001')<>1 then raise exception 'Rating not persisted'; end if;
  if (select count(*) from private.registration_notifications where user_id in ('be800001-7889-4660-9000-000000000001','be800001-7889-4660-9000-000000000002') and status='pending' and recipient='Tkell2028@cchsdons.com')<>2 then raise exception 'Notification not queued'; end if;
  if exists(select 1 from storage.buckets where id in ('member-photos','hike-photos') and public) then raise exception 'Student photo bucket is public'; end if;
end $$;
insert into private.club_leaders(user_id) values('be800001-7889-4660-9000-000000000001');
select set_config('request.jwt.claim.sub','be800001-7889-4660-9000-000000000001',true);
set local role authenticated;
do $$ declare roster jsonb; begin
  roster:=public.summit_request('leader','{}');
  if not exists(select 1 from jsonb_array_elements(roster->'members') m where m->>'contact_email'='summit-check-a@example.test' and m->>'note'='Sunrise hikes') then raise exception 'Leader registration details missing'; end if;
end $$;
reset role;
rollback;
select 'Hosted permission checks passed; all fixtures rolled back.' as result;
