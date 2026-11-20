-- Veille en ligne : Supabase appelle /api/veille toutes les 30 s. Le secret vit dans le Vault, jamais dans la tâche.
-- Avant : select vault.create_secret('<GHOST_CRON_SECRET>', 'ghost_cron_secret');  (fait une fois, hors du dépôt)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('ghost-veille') where exists (select 1 from cron.job where jobname = 'ghost-veille');
select cron.schedule('ghost-veille', '30 seconds', $$
  select net.http_post(
    url := 'https://ghost-the-task.vercel.app/api/veille',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ghost_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
