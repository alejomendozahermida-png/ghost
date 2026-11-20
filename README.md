# Ghost

**Ghost voit ce que vous répétez, et le fait à votre place.**

Vous partagez votre fenêtre et travaillez normalement. Ghost repère la tâche que vous refaites, en écrit la méthode, crée un agent H Company, puis la refait à votre place sur vos sites, y compris ceux qui n'ont pas d'API. Chaque résultat est relu sur la page publiée avant d'être marqué comme fait.

- Application en ligne : https://ghost-the-task.vercel.app
- Projet de la **Team 14** du hackathon « Build The Future » (Eugenia × H Company, 16 au 20 novembre 2026).
- Équipe : Alejandro Mendoza Hermida (CTO, application et agents H), Assel (CEO), Binta (CPO), Henriquet Makiadi (CDO, données et Supabase), Omar (CAIO), Vladimir (CAO).
- Dépôt de l'équipe : https://github.com/alejomendozahermida-png/ghost

## Le problème

Dans une agence immobilière, chaque nouveau mandat doit être publié à la main sur plusieurs portails d'annonces. Le même bien est ressaisi sur chaque site, avec des formulaires différents (« Prix » ici, « Montant demandé » là), sans API pour le faire automatiquement. L'équipe 14 a mesuré **4 min 04** pour publier un seul bien sur trois portails à la main, à refaire pour chaque bien, chaque semaine.

Le cas n'est pas propre à l'immobilier : support client (recopier un ticket dans le CRM), e-commerce (mettre à jour des fiches produits), administratif (saisir des factures). Partout, une personne **lit quelque part et écrit ailleurs**, sur des outils qui n'ont pas d'API.

**Cible** : les petites structures (agences, cabinets, boutiques) dont les salariés passent des heures par semaine sur des saisies répétitives dans des interfaces web, sans équipe technique pour les automatiser.

**Pourquoi un agent computer-use plutôt qu'une automatisation classique** : les portails n'ont pas d'API, leurs formulaires changent, et décrire la tâche à Make ou n8n demande des compétences que ces utilisateurs n'ont pas. Ghost apprend la tâche **en la regardant faire**, puis un agent H la refait dans un vrai navigateur, comme un humain.

## La solution en une phrase

Vous montrez une tâche une fois ; Ghost la comprend, crée un agent, et la refait à votre place sur vos sites, en vérifiant chaque résultat.

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

## Comment tester

Il faut un ordinateur avec **Chrome ou Edge** (le partage d'écran n'existe pas sur téléphone). Comptez une dizaine de minutes.

**Données de démonstration** (fictives) :
- le tableau des mandats de l'Agence Belvédère : [Google Sheet, lecture par lien](https://docs.google.com/spreadsheets/d/1fjAPbVMct9mhLNKqZiDFUd3XaYImE6jIgVObAfdr8Tk/edit) ;
- trois portails d'annonces sans API : [Portail A](https://portail-a-ghost.vercel.app/deposer), [Portail B](https://portail-b-ghost.vercel.app/nouvelle), [Portail C](https://portail-c-ghost.vercel.app/publier).

**Le parcours** :
1. Ouvrez https://ghost-the-task.vercel.app et créez un compte (e-mail et mot de passe d'au moins 8 caractères). Un court accueil explique le fonctionnement et propose d'activer les notifications.
2. **Observer** : cliquez sur « Démarrer l'observation » et partagez **la fenêtre** de Chrome (pas un seul onglet : la barre d'adresse doit être visible). Dans un autre onglet, recopiez un bien du Sheet sur le Portail A, puis sur le Portail B. Recommencez avec un deuxième bien. Une notification « Ghost a repéré une tâche répétitive » arrive.
3. **La fiche** : Ghost a écrit la méthode et choisi la source. Ajoutez une règle, par exemple « Ne publie pas une vente sans classe énergie ».
4. **Lancer** : laissez « Lignes à faire » vide (les nouvelles lignes) ou écrivez « M-0143 et M-0144 ». Suivez l'agent en direct ; chaque ligne finit « Fait et relu » portail par portail. La ligne piège **M-T01** (classe énergie vide) est refusée avant qu'un agent ne démarre.
5. **Déclencheurs** (sur la fiche) : planifiez une heure, ou créez un lien de déclenchement (le code Apps Script pour Google Sheets est fourni). Vous pouvez quitter la page : l'agent continue, une notification arrive à la fin.

Un workflow naît toujours d'une observation : il n'y en a pas de prêt à l'avance sur un nouveau compte.

## Résultats mesurés

Essais réels sur les portails de test, avec l'Agent API de H Company (durée de bout en bout, relecture comprise).

| Essai | Lignes × sites | Durée | Coût H | Résultat |
|---|---|---|---|---|
| Un bien, agent générique | 1 × 3 | 2 min 03 | 0,10 $ | 3/3 publiés et relus |
| Un bien, avec la vue en direct | 1 × 3 | 1 min 55 | 0,10 $ | 3/3 publiés et relus |
| Cinq biens lus par l'agent, un par un | 5 × 2 | 7 min 59 | 0,40 $ | 10/10 publiés, mais la ligne piège est passée (corrigé depuis, voir plus bas) |
| Deux biens, lignes et sites en parallèle | 2 × 2 | 1 min 42 | 0,11 $ | 4/4 publiés et relus |
| Ligne piège M-T01 | 1 | refusée en quelques secondes | 0 $ | refusée avant tout agent |

Ce que les mesures ont changé :
- **Parallélisme** : passer d'une ligne après l'autre à toutes les lignes en même temps a divisé la durée par deux environ. Une session H met **31 à 49 s** à remplir et publier un formulaire.
- **Cas d'échec observés** : file d'attente de 61 à 86 s quand plus de 3 sessions tournent sur le même compte ; une relance après une relecture ratée (+90 s) ; la ligne piège acceptée par deux agents en parallèle, qui jugeaient chacun seul. Le contrôle des valeurs vides et des règles est désormais fait par notre code, une fois, avant tout agent.
- **Lecture des adresses** : réduite à 1 280 px, une adresse de Google Sheet était lue avec 6 à 10 caractères faux ; sur une capture nette et agrandie de la barre d'adresse, il en reste 1 (I et l identiques dans la police de Chrome), que Ghost corrige en essayant les variantes jusqu'à ce que le Sheet s'ouvre.

## Coût de run

| Poste | Coût |
|---|---|
| Une publication (une ligne sur un site, relecture comprise) | environ 0,03 $ de crédits H |
| Un bien publié sur trois portails | environ 0,08 à 0,10 $ |
| Lecture de l'écran pendant l'observation (Holo) et raisonnement (Qwen sur Hugging Face) | quelques centimes par observation, non mesurés précisément |
| Hébergement (Vercel, Supabase) | 0 € à l'échelle du prototype (offres gratuites) |

Exemple : une agence qui publie 100 biens par mois sur trois portails dépense environ **10 $ de crédits H par mois**, contre 100 × 4 min ≈ 7 heures de saisie.

## Business model et go-to-market

**Pour qui.** Les petites structures de 5 à 50 personnes (agences, cabinets, boutiques) dont les salariés recopient chaque jour des données d'un outil web à l'autre, sans équipe technique ni API pour les relier. C'est la cible retenue pour le pitch ; elle reste une hypothèse à valider avec des pilotes.

**Offres** (page Tarifs de l'application) :

| Offre | Prix | Actions par mois | Agents en parallèle | Au-delà |
|---|---|---|---|---|
| Découverte | 0 € | 50 | 1 | - |
| Pro | 29 € par mois | 400 | 3 | 0,09 € l'action |
| Équipe | 99 € par mois | 1 500 | 6 | 0,07 € l'action |

**Économie.** Une publication (une ligne sur un site, relecture comprise) coûte environ 0,03 $ de crédits H (voir « Coût de run »). Si une action correspond à une publication, l'offre Pro consomme au plus environ 12 $ de crédits pour 29 € : une marge brute estimée à plus de 50 %. Estimation à confirmer sur des usages réels.

**Go-to-market, en trois étapes.**
1. **Le cas prouvé : l'immobilier.** Publier un bien sur plusieurs portails prend 4 min 04 à la main contre environ 2 min avec Ghost (essais sur les portails de test). On commence par des pilotes gratuits avec l'offre Découverte.
2. **Les autres métiers** : support client (ticket vers CRM), e-commerce (fiches produits), administratif (factures). Ils figurent sur la page d'accueil comme cas d'usage ; ils ne sont pas encore mesurés.
3. **Les équipes** : l'offre Équipe, avec des accès partagés entre collègues.

**Comment on atteint nos premiers clients (pistes à valider).** Des démonstrations courtes (la page d'accueil promet trois minutes pour confier une tâche), le bouche-à-oreille entre agences, et des partenaires proches des petites structures (éditeurs de logiciels métier, experts-comptables).

**Ce qui n'est pas encore validé.** Aucun client réel à ce jour : les mesures viennent des portails de test et les données sont fictives. Le prix, la cible et les canaux sont des hypothèses de départ.

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

## Retours sur l'Agent API de H Company

**Ce qui a bien marché**
- **Agents, Skills et sessions** : créer un agent par workflow, avec sa Skill (la méthode écrite par Ghost) et sa page de départ, se fait en deux appels. Le même agent sert pour toutes les exécutions.
- **Réponses structurées** (`answer_format`) : l'agent rend un JSON fiable (publié ou refusé, adresses des pages), sur lequel notre code peut décider sans interpréter du texte.
- **Coffre-fort** : rattacher le coffre de l'utilisateur à l'agent permet de se connecter à un site sans que le modèle voie le mot de passe.
- **Événements de session** : les captures d'écran et les actions (clic, saisie, position) permettent de montrer l'agent au travail en direct dans notre propre interface.
- **Vitesse** : 31 à 49 s pour remplir et publier un formulaire complet, photo comprise.

**Ce qui a cassé ou résisté**
- **3 sessions simultanées par compte** : au-delà, les sessions attendent leur tour (61 à 86 s observés). C'est la première limite de vitesse dès qu'on parallélise.
- **Jugement non déterministe** : la même ligne piège a été refusée par un agent, puis acceptée par deux agents lancés en parallèle. Les contrôles métier doivent être faits avant l'agent, pas confiés à lui.
- **Dépôt de fichier trop tôt** : pendant les premières secondes d'une session, le dépôt d'une photo répond 404 ; il faut réessayer.
- **Envoi de message** : la réponse a un corps vide, ce que notre premier client prenait pour une erreur (et renvoyait la photo en boucle).
- **Consigne partielle** : quand le message citait une partie des sites, l'agent n'allait que sur ceux-là ; il faut lui donner explicitement la liste complète, ou un seul site par session.
- **Lecture d'adresses par Holo** sur une capture réduite : caractères proches confondus (I/l/1, O/0). Résolu par une capture nette de la barre d'adresse.
- **Connexion Google** : bloquée pour un navigateur automatisé, même avec les bons identifiants.

**Ce qui nous a surpris**
- L'agent comprend les libellés par leur sens (« Superficie » = « Surface », « Commune » = « Ville ») sans qu'on les lui mappe.
- Le coût : quelques centimes par publication rend le modèle économique crédible dès maintenant.
- Les sessions tournent entièrement dans le cloud : l'utilisateur peut fermer son ordinateur, ce qui a rendu possibles la planification et le déclenchement par lien.

## Limites connues

- Prototype : pas de tests automatisés, pas d'audit de sécurité, règles d'accès fines de Supabase (RLS) encore à écrire.
- Un compte H exécute 3 sessions à la fois : au-delà, les agents attendent leur tour.
- La lecture d'une adresse sur une capture reste imparfaite ; Ghost corrige les caractères ambigus (I/l/1, O/0) en essayant les variantes.
- Les pages légales sont des brouillons à compléter et faire relire.

## Crédits

Ce dépôt reprend des éléments construits avec l'équipe 14 du hackathon :
- `portails/` : Vladimir Pilioua ;
- `donnees/` : Henriquet (données fictives et photos).
- pitch, positionnement, go-to-market et vidéo de présentation : Binta Kande.

La capture d'écran dans le navigateur, la lecture des écrans par Holo et la génération de Skills s'inspirent du projet de référence [show-me-once](https://github.com/h-hackathon/show-me-once-hackathon-h), fourni par les organisateurs. Icônes des services : Simple Icons (CC0).

## Équipe

Projet réalisé par l'équipe 14 du hackathon « Build The Future » (Eugenia × H Company, 16 au 20 novembre 2026) :

| Nom | Rôle dans le projet |
|---|---|
| Alejandro Mendoza Hermida | Produit, application et agents H |
| Vladimir Pilioua | Portails de test sans API |
| Henriquet | Données fictives et photos |
| Binta Kande | Pitch, positionnement, go-to-market et vidéo |
| Assel | Pilotage de l'équipe, planning et documents du hackathon |
| Omar | Détection des tâches répétées et floutage (première version) |
