-- Run only after deploying registration-mail and configuring its secrets.
-- Enable pg_cron and pg_net in the Supabase dashboard first.
-- In Vault, create summit_project_url and summit_mail_worker_secret.
-- The latter must match the Edge Function's SUMMIT_MAIL_WORKER_SECRET.
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='summit_project_url')
 or not exists(select 1 from vault.decrypted_secrets where name='summit_mail_worker_secret') then
  raise exception 'Configure the project URL and worker secret in Vault first.';
 end if;
end;$$;
select cron.schedule('summit-registration-mail','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='summit_project_url')||'/functions/v1/registration-mail',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='summit_mail_worker_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=120000
 );
$$);
