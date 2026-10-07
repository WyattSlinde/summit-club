-- Hosted delivery infrastructure. The schedule is activated separately only
-- after the private worker token and verified sender have been configured.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
