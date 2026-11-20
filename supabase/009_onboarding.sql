-- Premier passage : l'accueil (onboarding) est montré une seule fois, jusqu'à ce qu'il soit fini ou passé.
alter table profils add column if not exists onboarding_fini timestamptz;
