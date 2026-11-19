-- Ghost v2.1 : adresse vue pour chaque étape, réglages du workflow modifiables.
alter table etapes add column if not exists url text;
alter table workflows add column if not exists destinations jsonb;   -- [{site, url}] confirmés par l'utilisateur
alter table workflows add column if not exists regles jsonb;         -- règles métier ajoutées par l'utilisateur
select column_name from information_schema.columns where table_name in ('etapes','workflows') and column_name in ('url','destinations','regles');
