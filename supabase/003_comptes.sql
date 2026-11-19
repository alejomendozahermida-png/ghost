-- Ghost v2.2 : chaque donnée appartient à un utilisateur (Supabase Auth).
alter table observations add column if not exists user_id uuid references auth.users on delete cascade;
alter table workflows add column if not exists user_id uuid references auth.users on delete cascade;
alter table executions add column if not exists user_id uuid references auth.users on delete cascade;
alter table acces add column if not exists user_id uuid references auth.users on delete cascade;
create index if not exists workflows_user on workflows (user_id, cree_le desc);

-- Une seule exécution en cours à la fois, par utilisateur (et non plus pour tout le monde)
drop index if exists une_execution_en_cours;
create unique index if not exists une_execution_en_cours_par_utilisateur on executions (user_id) where statut = 'en_cours';

-- Profil : le coffre-fort H de l'utilisateur (Mes accès)
create table if not exists profils (
  user_id uuid primary key references auth.users on delete cascade,
  vault_id text,
  cree_le timestamptz not null default now()
);
alter table profils enable row level security;
select 'ok' as migration;
