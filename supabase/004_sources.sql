-- D'où viennent les valeurs d'une tâche : un Google Sheet, un formulaire rempli au lancement, ou aucune donnée.
alter table workflows add column if not exists source text check (source in ('sheet', 'formulaire', 'aucune'));
update workflows set source = 'sheet' where source is null and sheet_url is not null;
