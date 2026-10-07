-- Brevo documents a minimum 15-minute idempotency window. Stop at ten minutes
-- from the first claim, including worker crashes, to avoid an uncertain resend.
-- Never switch providers while old-provider attempts remain in flight.
do $$ begin
 if exists(select 1 from private.registration_notifications where attempts>0 and status in ('pending','sending')) then
  raise exception 'Reconcile in-flight notification attempts before changing the email provider.';
 end if;
end $$;

create or replace function private.claim_registration_mail() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.registration_notifications;
begin
 update private.registration_notifications set status='needs_review',last_error='Delivery window expired; reconcile Brevo logs before resending.'
 where status in ('pending','sending') and (first_attempt_at<=now()-interval '10 minutes' or attempts>=8) and (lease_until is null or lease_until<now());
 select * into job from private.registration_notifications
 where (status='pending' or (status='sending' and lease_until<now())) and next_attempt_at<=now()
 order by next_attempt_at for update skip locked limit 1;
 if not found then return null; end if;
 update private.registration_notifications set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),
 lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()) where id=job.id returning * into job;
 return to_jsonb(job);
end;
$$;
revoke all on function private.claim_registration_mail() from public,anon,authenticated;
grant execute on function private.claim_registration_mail() to service_role;
