-- Ghost : schéma complet. À coller une fois dans l'éditeur SQL de Supabase (projet neuf).
-- Aucune politique RLS : seules les routes serveur (clé secrète) lisent et écrivent ; le navigateur n'a aucun accès.

-- Annonces publiées sur les 3 portails de test (lues pour la vérification)
create table annonces_portails (
  id text primary key default gen_random_uuid()::text,
  portail text not null,
  titre text,
  prix int,
  surface_m2 int,
  ville text,
  description text,
  cree_le timestamptz not null default now()
);
create index on annonces_portails (portail, cree_le desc);

-- Photos du Portail C, rangées sous <id de l'annonce>/photo.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-annonces', 'photos-annonces', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Une session d'observation (partage d'écran)
create table observations (
  id uuid primary key default gen_random_uuid(),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'terminee')),
  cree_le timestamptz not null default now(),
  fini_le timestamptz
);

-- Ce que Holo a lu sur chaque capture (jamais l'image)
create table etapes (
  id bigint generated always as identity primary key,
  observation_id uuid not null references observations on delete cascade,
  tache int not null default 0,          -- numéro de la tâche dans l'observation
  site text,
  ecran text,
  action text,
  champ text,
  valeur text,
  fin_de_tache boolean not null default false,
  cree_le timestamptz not null default now()
);
create index on etapes (observation_id, id);

-- Tâche répétée repérée, puis transformée en agent H
create table workflows (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references observations on delete set null,
  nom text not null,
  statut text not null default 'repere' check (statut in ('repere', 'preparation', 'pret', 'erreur')),
  occurrences int not null default 2,
  procedure jsonb,
  skill text,
  agent text,                            -- nom de l'agent dans H
  sheet_url text,
  surveillance boolean not null default false,
  cree_le timestamptz not null default now()
);

-- Une exécution de l'agent H
create table executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows on delete cascade,
  cle_demande text not null unique,      -- même clé = même exécution (pas de doublon après un timeout)
  lignes jsonb not null,                 -- valeurs attendues, lues dans le Sheet au lancement
  statut text not null default 'en_cours' check (statut in ('en_cours', 'completed', 'failed')),
  etape text not null default 'recue',
  session_id text,
  version int not null default 0,        -- verrou : on n'avance que si la version n'a pas changé
  corrections int not null default 0,
  verification jsonb,
  resume text,
  duree_s int,
  cout_usd numeric,
  cree_le timestamptz not null default now(),
  fini_le timestamptz
);
-- Une seule exécution en cours à la fois
create unique index une_execution_en_cours on executions ((true)) where statut = 'en_cours';

-- Lignes du Sheet déjà confiées à l'agent (surveillance : jamais deux fois la même)
create table lignes_traitees (
  workflow_id uuid not null references workflows on delete cascade,
  cle_ligne text not null,
  execution_id uuid references executions on delete set null,
  cree_le timestamptz not null default now(),
  primary key (workflow_id, cle_ligne)
);

-- Accès aux plateformes : seulement la référence de l'élément du coffre-fort H, jamais le mot de passe
create table acces (
  id uuid primary key default gen_random_uuid(),
  plateforme text not null,
  url text not null,
  vault_item_id text not null,
  cree_le timestamptz not null default now()
);

alter table annonces_portails enable row level security;
alter table observations enable row level security;
alter table etapes enable row level security;
alter table workflows enable row level security;
alter table executions enable row level security;
alter table lignes_traitees enable row level security;
alter table acces enable row level security;

-- Vérification : doit lister les 7 tables
select tablename from pg_tables where schemaname = 'public' order by tablename;
