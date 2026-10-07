-- Registration details and a private, durable email outbox. No browser can send mail.
alter table public.members add column note text not null default '' check (char_length(note)<=400);
alter table public.members add column contact_email text;
create table private.registration_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.members(user_id) on delete cascade,
 recipient text not null default 'Tkell2028@cchsdons.com' check (recipient='Tkell2028@cchsdons.com'),
 details jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','needs_review')),
 attempts integer not null default 0,
 created_at timestamptz not null default now(), first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(), lease_until timestamptz,
 lease_token uuid, provider_id text, sent_at timestamptz, last_error text
);
alter table private.registration_notifications enable row level security;
revoke all on private.registration_notifications from public,anon,authenticated;
create index registration_mail_pending on private.registration_notifications(next_attempt_at) where status in ('pending','sending');
create function private.queue_registration_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare verified_email text;
begin
 select email into verified_email from auth.users where id=new.user_id and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Confirm your email before registering.'; end if;
 insert into private.registration_notifications(user_id,details) values(new.user_id,jsonb_build_object(
 'name',new.name,'grade',new.grade,'interest',new.interest,'note',new.note,'email',verified_email));
 return new;
end;
$$;
revoke all on function private.queue_registration_notification() from public,anon,authenticated;
create trigger queue_registration_notification after insert on public.members for each row execute function private.queue_registration_notification();

alter function private.summit_request(text,jsonb) rename to summit_request_v2;
revoke all on function private.summit_request_v2(text,jsonb) from public,anon,authenticated;
create function private.summit_request(operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); email text; saved_member public.members; result jsonb;
begin
 if octet_length(payload::text)>12000 then raise exception 'That request is too large.'; end if;
 if operation='join' then
  if me is null then raise exception 'Sign in to continue.'; end if;
  select u.email into email from auth.users u where u.id=me and u.email_confirmed_at is not null;
  if email is null then raise exception 'Confirm your email before joining SUMMIT.'; end if;
  if payload->'consent' is distinct from 'true'::jsonb then raise exception 'Please confirm your registration consent.'; end if;
  perform private.take_limit('join',40);
  insert into public.members(user_id,name,grade,interest,note,contact_email)
   values(me,btrim(payload->>'name'),payload->>'grade',payload->>'interest',btrim(coalesce(payload->>'note','')),email)
   on conflict(user_id) do update set name=excluded.name,grade=excluded.grade,interest=excluded.interest,note=excluded.note,contact_email=excluded.contact_email
   returning * into saved_member;
  insert into public.profiles(user_id,display_name) values(me,left(saved_member.name,50)) on conflict(user_id) do nothing;
  return jsonb_build_object('saved',true,'member',to_jsonb(saved_member)-'user_id'-'consent_at','notification','queued');
 end if;
 result:=private.summit_request_v2(operation,payload);
 if operation='leader' then
  -- v2 verified the caller against the private leader allowlist first.
  result:=result||jsonb_build_object('members',coalesce((select jsonb_agg(x) from (
   select m.name,m.grade,m.interest,m.note,m.contact_email,m.created_at,
    (select string_agg(v.adventure_id,',') from public.votes v where v.user_id=m.user_id) as choices,
    (select n.status from private.registration_notifications n where n.user_id=m.user_id) as notification_status
   from public.members m order by m.created_at desc limit 2000)x),'[]'));
 end if;
 return result;
end;
$$;
revoke all on function private.summit_request(text,jsonb) from public;
grant execute on function private.summit_request(text,jsonb) to anon,authenticated;
create or replace function public.summit_request(operation text,payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.summit_request(operation,payload);$$;

-- Worker-only RPCs. Service credentials never enter the client bundle.
create function private.claim_registration_mail() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.registration_notifications;
begin
 update private.registration_notifications set status='needs_review',last_error='Delivery window expired; reconcile provider logs before resending.'
 where status in ('pending','sending') and (first_attempt_at<now()-interval '23 hours' or attempts>=8) and (lease_until is null or lease_until<now());
 select * into job from private.registration_notifications
 where (status='pending' or (status='sending' and lease_until<now())) and next_attempt_at<=now()
 order by next_attempt_at for update skip locked limit 1;
 if not found then return null; end if;
 update private.registration_notifications set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),
 lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()) where id=job.id returning * into job;
 return to_jsonb(job);
end;
$$;
create function private.finish_registration_mail(job_id uuid, token uuid, accepted_id text default null, failure text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if accepted_id is not null and (length(accepted_id)<1 or length(accepted_id)>100) then raise exception 'Invalid provider ID.'; end if;
 update private.registration_notifications set
  status=case when accepted_id is not null then 'sent' when attempts>=8 then 'needs_review' else 'pending' end,
  provider_id=accepted_id,sent_at=case when accepted_id is not null then now() else null end,
  last_error=case when accepted_id is not null then null else left(coalesce(failure,'Provider temporarily unavailable.'),200) end,
  next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),lease_until=null,lease_token=null
 where id=job_id and lease_token=token and status='sending';
 return found;
end;
$$;
revoke all on function private.claim_registration_mail() from public,anon,authenticated;
revoke all on function private.finish_registration_mail(uuid,uuid,text,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_registration_mail() to service_role;
grant execute on function private.finish_registration_mail(uuid,uuid,text,text) to service_role;
create function public.claim_registration_mail() returns jsonb language sql security invoker set search_path='' as $$select private.claim_registration_mail();$$;
create function public.finish_registration_mail(job_id uuid,token uuid,accepted_id text default null,failure text default null) returns boolean language sql security invoker set search_path='' as $$select private.finish_registration_mail(job_id,token,accepted_id,failure);$$;
revoke all on function public.claim_registration_mail() from public,anon,authenticated;
revoke all on function public.finish_registration_mail(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_registration_mail() to service_role;
grant execute on function public.finish_registration_mail(uuid,uuid,text,text) to service_role;
