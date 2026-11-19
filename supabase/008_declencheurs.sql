-- Plusieurs workflows peuvent tourner en même temps : une seule exécution en cours par workflow (et non plus par utilisateur).
drop index if exists une_execution_en_cours_par_utilisateur;
create unique index if not exists une_execution_en_cours_par_workflow on executions (workflow_id) where statut = 'en_cours';
-- D'où vient une exécution : manuel, veille, planifie, webhook.
alter table executions add column if not exists origine text not null default 'manuel';
-- Planification : {"frequence": "jour|ouvres|semaine|heure", "heure": "09:00", "jour": 1..7} à l'heure de Paris.
alter table workflows add column if not exists planification jsonb;
alter table workflows add column if not exists prochaine_execution timestamptz;
create index if not exists workflows_planifies on workflows (prochaine_execution) where prochaine_execution is not null;
-- Lien de déclenchement : un jeton secret par workflow, révocable.
alter table workflows add column if not exists webhook_jeton text unique;
