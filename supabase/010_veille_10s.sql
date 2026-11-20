-- Veille toutes les 10 s au lieu de 30 : H ne prévient pas quand une session se termine (pas de webhook),
-- c'est donc la veille qui fait avancer une exécution quand personne n'a la page de suivi ouverte.
select cron.alter_job((select jobid from cron.job where jobname = 'ghost-veille'), schedule := '10 seconds');
