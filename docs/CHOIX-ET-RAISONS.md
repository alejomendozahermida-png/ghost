# Nos choix et leurs raisons

Le README donne les offres et les grandes lignes (section « Business model » de Binta). Ce document explique **pourquoi** nous avons fait ces choix. Chaque raison s'appuie sur un chiffre mesuré pendant nos essais, cité avec sa source dans le README.

## 1. La cible : les agences immobilières d'abord

**Notre choix.** Nous commençons par les agences immobilières indépendantes, puis nous élargissons aux petites structures de 5 à 50 personnes qui recopient des données d'un outil web à l'autre.

**Pourquoi.**

1. **La douleur est mesurée.** Publier un bien sur trois portails prend 4 min 04 à la main. Pour 100 biens par mois, cela fait environ 7 heures de saisie (README, « Le problème » et « Coût de run »).
2. **La tâche revient sans cesse.** Chaque nouveau mandat doit être publié sur chaque portail. Plus la tâche est fréquente, plus Ghost fait gagner de temps.
3. **Il n'existe pas d'autre solution simple.** Les portails n'ont pas d'API, et Make, n8n ou Zapier demandent des compétences techniques que ces équipes n'ont pas. Ghost apprend en regardant faire : il n'y a rien à programmer.
4. **Le résultat se vérifie tout de suite.** Une annonce publiée se voit en ligne. Ghost relit chaque page publiée : le client constate lui-même que le travail est fait.

**Pourquoi ensuite les autres métiers.** Support client, e-commerce, administratif : partout, quelqu'un lit quelque part et écrit ailleurs. Ghost n'a pas besoin d'être reprogrammé pour un nouveau métier : il suffit qu'il observe une nouvelle tâche.

## 2. Le plan par étapes

**Notre choix.** Quatre étapes, chacune débloquée par la précédente.

| Étape | Pour qui | Pourquoi à ce moment-là | Ce qui prouve qu'on peut passer à la suivante |
|---|---|---|---|
| 1. Pilotes gratuits | Quelques agences immobilières | Passer de nos portails de test à de vrais portails, avec de vrais biens | Le temps gagné est mesuré chez l'agence, avec la même méthode que nos essais |
| 2. Premiers clients payants | Agences immobilières | Le pilote fournit la preuve chiffrée qui convainc les agences suivantes | Des agences passent de l'offre gratuite à l'offre Pro |
| 3. Autres métiers | Support client, e-commerce, administratif | Le même moteur sert : seule la tâche observée change | Une tâche hors immobilier est mesurée comme les publications |
| 4. Équipes | Structures où plusieurs personnes font la même tâche | Une même tâche partagée par plusieurs collègues augmente le nombre d'actions par client | Des comptes Équipe utilisés chaque semaine |

**Pourquoi ces canaux, dans cet ordre.** Les canaux sont listés dans le README ; voici pourquoi nous les utilisons dans cet ordre.

1. **La démonstration sur la tâche du client, d'abord**, parce que c'est elle qui lève le doute : une agence qui voit Ghost publier son propre bien n'a plus besoin d'être convaincue par un discours.
2. **Le bouche-à-oreille ensuite**, parce qu'il ne fonctionne qu'une fois les premiers pilotes satisfaits : il a besoin d'un résultat à raconter.
3. **Les partenaires en dernier** (éditeurs de logiciels métier, experts-comptables), parce qu'ils ne recommandent un outil qu'après avoir vu des clients s'en servir.

## 3. La logique de prix

Les offres sont dans le README : Découverte à 0 €, Pro à 29 € par mois, Équipe à 99 € par mois.

**Pourquoi un prix à l'action.** Chaque action nous coûte : environ 0,03 $ de crédits H par publication, relecture comprise (README, « Coût de run »). En facturant à l'action, notre marge reste la même quel que soit l'usage du client, et le client ne paie que ce qu'il utilise.

**Pourquoi une offre gratuite.** Un client croit à un agent quand il le voit travailler sur sa propre tâche. Les 50 actions gratuites suffisent pour publier une quinzaine de biens sur trois portails : assez pour juger, pas assez pour s'en servir au quotidien.

**Pourquoi 29 € pour l'offre Pro.** Une agence qui publie 100 biens par mois sur trois portails fait 300 actions. Les 400 actions de l'offre Pro la couvrent. Elle paie 29 € par mois au lieu d'environ 7 heures de saisie.

**Pourquoi 3 agents en Pro.** H autorise aujourd'hui 3 sessions en même temps par compte (README, « Résultats mesurés »). L'offre Pro utilise exactement cette capacité, sans file d'attente.

**Pourquoi c'est rentable.** Sur l'offre Pro, 400 actions consomment au plus environ 12 $ de crédits H pour 29 € encaissés : plus de la moitié du prix reste en marge brute. Sur l'offre Équipe, 1 500 actions consomment environ 45 $ pour 99 €, une marge du même ordre. Le coût de l'observation (Holo et Qwen) s'y ajoute : il est de quelques centimes par observation (README, « Coût de run »).

## 4. Ce que les pilotes doivent confirmer

Nos chiffres viennent de portails de test et de données fictives. Les pilotes servent à confirmer trois points :

1. **Le gain de temps sur de vrais portails**, mesuré comme dans nos essais.
2. **Le prix** : que les agences acceptent de payer 29 € par mois pour ce gain.
3. **La capacité chez H** pour l'offre Équipe, qui fait travailler 6 agents en même temps, au-delà de la limite actuelle de 3.
