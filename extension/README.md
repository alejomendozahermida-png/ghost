# Ghost — adresses exactes (extension Chrome)

Pendant une observation, Ghost lisait l'adresse des sites dans l'image de la barre d'adresse. Dans la police de Chrome, « I » et « l » sont identiques au pixel près : une lecture d'image ne peut pas les distinguer. Cette extension donne à Ghost l'adresse **exacte** de l'onglet actif, telle que Chrome la connaît.

## Installer (2 minutes)

1. Téléchargez ce dossier `extension/` (ou clonez le dépôt).
2. Ouvrez `chrome://extensions` (ou `edge://extensions`) et activez le **mode développeur**.
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `extension/`.
4. Rechargez la page Observer de Ghost : elle affiche « Extension Ghost active · adresses exactes ».

## Ce qu'elle fait, et ce qu'elle ne fait pas

- Elle n'envoie rien tant qu'une observation n'est pas en cours (ni en pause, ni après l'arrêt).
- Pendant l'observation, elle transmet l'adresse et le titre de l'onglet actif **à l'onglet Ghost uniquement**, qui les joint aux captures.
- Elle ne lit pas le contenu des pages, ne garde rien et n'envoie rien à un autre serveur.
- Sans l'extension, Ghost continue de lire l'adresse dans l'image, comme avant.
