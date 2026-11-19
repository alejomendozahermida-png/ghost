-- Empreinte des valeurs d'une ligne déjà tentée : la veille ne la relance que si ses valeurs ont changé dans la source.
alter table lignes_traitees add column if not exists empreinte text;
alter table lignes_traitees add column if not exists statut text;
create index if not exists etapes_observation on etapes (observation_id);
create index if not exists executions_workflow on executions (workflow_id, cree_le desc);
create index if not exists executions_utilisateur on executions (user_id, cree_le desc);
create index if not exists executions_en_cours on executions (statut) where statut = 'en_cours';
create index if not exists workflows_utilisateur on workflows (user_id);
