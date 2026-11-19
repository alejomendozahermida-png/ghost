-- L'agent lit lui-même la source (un Sheet, une page) dans son navigateur : on garde son nom tel que vu à l'écran.
alter table workflows drop constraint if exists workflows_source_check;
alter table workflows add constraint workflows_source_check check (source in ('lecture', 'sheet', 'formulaire', 'aucune'));
alter table workflows add column if not exists source_nom text;
