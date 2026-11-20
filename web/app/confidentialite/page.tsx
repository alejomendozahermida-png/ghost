import { PageLegale } from '@/components/PageLegale';

export const metadata = { title: 'Confidentialité · Ghost' };

export default function Confidentialite() {
  return (
    <PageLegale titre="Politique de confidentialité" maj="20 novembre 2026">
      <section>
        <h2>Responsable du traitement</h2>
        <p>[Nom de l’éditeur à compléter], joignable à [adresse e-mail à compléter].</p>
      </section>
      <section>
        <h2>Ce que nous collectons, et pourquoi</h2>
        <ul>
          <li><strong>Votre compte</strong> : adresse e-mail et mot de passe (chiffré par Supabase), pour vous connecter. Base légale : exécution du service.</li>
          <li><strong>Vos observations</strong> : pendant que vous partagez votre écran, chaque capture est envoyée au modèle de lecture d’écran de H Company, qui en renvoie une description (site, écran, action, valeur saisie). Nous gardons uniquement cette description, jamais l’image. Les pages de connexion sont ignorées. Base légale : exécution du service, à votre demande.</li>
          <li><strong>Vos workflows et exécutions</strong> : la méthode écrite, vos règles, les lignes traitées, les adresses des pages publiées et leur résultat, pour faire le travail et vous en rendre compte.</li>
          <li><strong>Vos accès</strong> : les identifiants que vous enregistrez vont directement dans votre coffre-fort chez H Company. Ghost ne conserve que le nom et l’adresse du site, jamais le mot de passe.</li>
          <li><strong>Vos sources</strong> : si vous utilisez un Google Sheet partagé par lien, Ghost en lit le contenu au moment de l’exécution.</li>
        </ul>
      </section>
      <section>
        <h2>Qui reçoit ces données</h2>
        <ul>
          <li>Supabase (base de données et comptes, Francfort, Allemagne).</li>
          <li>Vercel (hébergement du site, fonctions à Francfort).</li>
          <li>H Company (lecture d’écran, agents, coffre-fort des accès ; services dans l’Union européenne).</li>
          <li>Hugging Face (raisonnement sur la description de vos étapes, sans image).</li>
          <li>Les sites sur lesquels l’agent agit pour vous, avec les valeurs de vos lignes.</li>
        </ul>
        <p>Certains de ces prestataires sont établis hors de l’Union européenne ; les transferts s’appuient sur [garanties à préciser : clauses contractuelles types, cadre de protection des données UE–États-Unis].</p>
      </section>
      <section>
        <h2>Combien de temps</h2>
        <p>Vos données sont conservées tant que votre compte existe. Un workflow effacé l’est avec son historique et son agent. [Durée de conservation après suppression du compte à préciser.]</p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>Vous pouvez accéder à vos données, les corriger, les effacer, les récupérer ou vous opposer à leur traitement en écrivant à [adresse e-mail à compléter]. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      </section>
    </PageLegale>
  );
}
