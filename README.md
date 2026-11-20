# Ghost

**Ghost voit ce que vous répétez, et le fait à votre place.**

Vous partagez votre fenêtre et travaillez normalement. Ghost repère la tâche que vous refaites, en écrit la méthode, crée un agent H Company, puis la refait à votre place sur vos sites, y compris ceux qui n'ont pas d'API. Chaque résultat est relu sur la page publiée avant d'être marqué comme fait.

- Application en ligne : https://ghost-the-task.vercel.app
- Projet d'Alejandro Mendoza Hermida, né pendant le hackathon « Build The Future » (Eugenia × H Company, 16 au 20 novembre 2026).

## Ce que fait Ghost

| Étape | Ce qui se passe |
|---|---|
| **Observer** | Partage de la fenêtre dans le navigateur. Chaque écran qui change est lu par Holo (H Company) ; seule sa description est gardée, jamais l'image. La barre d'adresse est lue sur une capture nette et agrandie. |
| **Repérer** | Quand une tâche revient (message de confirmation ou retour à l'écran de départ), Qwen compare les tâches et Ghost envoie une notification. |
| **Comprendre** | Qwen écrit la méthode : sites, étapes, champs, source des données. Ghost crée une Skill et un agent H propre au workflow. L'utilisateur relit et ajoute ses règles métier. |
| **Agir** | Un agent H par site et par ligne, en parallèle, ouvert directement sur le bon formulaire. |
| **Vérifier** | Ghost télécharge chaque page publiée et y cherche chaque valeur. Une valeur fausse relance l'agent sur ce seul site (deux fois au plus). |

**Sources de données** : l'agent lit lui-même le document (Google Sheet, tableau, CRM) dans son navigateur, ou Ghost le lit directement s'il s'ouvre par lien ; formulaire rempli au lancement (ou depuis un texte libre) ; ou aucune donnée.

**Déclencheurs** : à la main, à heure fixe (heure de Paris), à chaque nouvelle ligne du Sheet (veille toutes les 30 s), ou par un lien secret appelé par un autre outil (Google Sheets via Apps Script, Zapier, Airtable…). Plusieurs workflows tournent en même temps ; on peut quitter la page, une notification arrive à la fin.

**Garde-fous** : une valeur vide ou une ligne qui viole une règle de l'utilisateur est refusée par notre code avant tout agent ; l'agent ne paie rien, ne supprime rien et n'écrit à personne ; il complète un enregistrement existant sans jamais créer de doublon.

## Architecture

```
Navigateur (Next.js)                 Serveur (routes Next.js sur Vercel, Francfort)
  Observer : partage d'écran   ──►   /api/observations/…/captures ──► Holo (lecture d'écran)
  Fiche, Lancer, Mes accès     ──►   /api/workflows, /api/executions ──► Qwen (Hugging Face)
                                      lib/execution.ts : moteur          ──► Agents H (sessions, Skills, coffre-fort)
Supabase (Postgres, comptes)   ◄──►   lib/veille.ts ◄── pg_cron toutes les 30 s
```

Aucun serveur ne tourne en permanence : une exécution avance d'un cran à chaque appel (page de suivi ou veille planifiée), avec un verrou optimiste qui empêche deux appels de lancer deux fois la même session.

| Dossier | Contenu |
|---|---|
| `web/` | L'application (Next.js 15, React 19, Tailwind 4, TypeScript) |
| `web/lib/` | Moteur d'exécution, observation, préparation des workflows, veille, planification, coffre-fort, appels à H, Holo et Qwen |
| `web/app/api/` | Routes serveur (observations, workflows, exécutions, accès, déclencheurs, veille, notifications) |
| `supabase/` | Migrations SQL dans l'ordre (`001` à `009`) |
| `portails/` | Trois sites d'annonces de test sans API (Portail A, B, C), cibles des agents |
| `donnees/` | Données fictives de l'Agence Belvédère : mandats et photos |
| `reference/agent-h-v1/` | Première version de l'agent en Python, conservée pour référence |

## Lancer en local

```bash
cd web
cp .env.example .env.local   # puis remplir les clés (H Company, Hugging Face, Supabase)
npm install
npm run dev                  # http://localhost:3000
node --env-file=.env.local scripts/veille.mjs   # veille locale (exécutions sans page ouverte, planification, Sheets)
```

Appliquer les migrations de `supabase/` dans l'ordre sur un projet Supabase. Vérification du calcul des horaires : `node lib/planification.check.ts`.

## Sécurité

- **Mots de passe** : envoyés une fois en HTTPS, ils vont directement dans un coffre-fort H Company propre à chaque utilisateur. La base ne garde que le nom du site et la référence du secret ; l'agent ne voit jamais le mot de passe.
- **Clés** : uniquement dans les variables d'environnement (`.env.local`, Vercel), jamais dans le dépôt. La clé de service Supabase ne quitte pas le serveur.
- **Données** : chaque route vérifie que l'utilisateur est propriétaire de ce qu'il demande. Les observations ne gardent que des descriptions d'écran.
- **Liens de déclenchement** : jeton aléatoire de 32 caractères, révocable ; la veille est protégée par un secret stocké dans le Vault Supabase.

## Limites connues

- Prototype : pas de tests automatisés, pas d'audit de sécurité, règles d'accès fines de Supabase (RLS) encore à écrire.
- Un compte H exécute 3 sessions à la fois : au-delà, les agents attendent leur tour.
- La lecture d'une adresse sur une capture reste imparfaite ; Ghost corrige les caractères ambigus (I/l/1, O/0) en essayant les variantes.
- Les pages légales sont des brouillons à compléter et faire relire.

## Crédits

Ce dépôt reprend des éléments construits avec l'équipe 14 du hackathon :
- `portails/` : Vladimir Pilioua ;
- `donnees/` : Henriquet (données fictives et photos).

La capture d'écran dans le navigateur, la lecture des écrans par Holo et la génération de Skills s'inspirent du projet de référence [show-me-once](https://github.com/h-hackathon/show-me-once-hackathon-h), fourni par les organisateurs. Icônes des services : Simple Icons (CC0).
