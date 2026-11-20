-- Modèle de l'agent, au choix par workflow : précis (holo4-27b, par défaut) ou rapide (holo3-1-35b-a3b).
-- Mesuré sur le Portail A : rapide = 3 étapes, 41 s, 0,006 $ ; mais plus de fautes de recopie (« suppresser »).
alter table workflows add column if not exists modele text not null default 'precis' check (modele in ('precis', 'rapide'));
