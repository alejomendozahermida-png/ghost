import { PageLegale } from '@/components/PageLegale';

export const metadata = { title: 'Mentions légales · Ghost' };

export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" maj="20 novembre 2026">
      <section>
        <h2>Éditeur du site</h2>
        <p>Ghost est un prototype réalisé dans le cadre du hackathon Eugenia × H Company.</p>
        <ul>
          <li>Responsable de la publication : [nom et prénom à compléter]</li>
          <li>Statut : [particulier, association ou société, à compléter ; pour une société : forme, capital, RCS, numéro de TVA]</li>
          <li>Adresse : [à compléter]</li>
          <li>Contact : [adresse e-mail à compléter]</li>
        </ul>
      </section>
      <section>
        <h2>Hébergement</h2>
        <ul>
          <li>Site et serveurs d’application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Fonctions exécutées à Francfort (Allemagne).</li>
          <li>Base de données et comptes : Supabase Inc., données hébergées à Francfort (Allemagne).</li>
        </ul>
      </section>
      <section>
        <h2>Services d’intelligence artificielle</h2>
        <p>Les agents et la lecture d’écran sont fournis par H Company (Paris, France), via ses services hébergés dans l’Union européenne. Le raisonnement sur les tâches observées utilise le modèle Qwen, appelé par Hugging Face.</p>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>Le nom Ghost, son logo et l’interface du site sont la propriété de leur éditeur. Les noms et logos des services tiers présentés dans « Mes accès » appartiennent à leurs propriétaires respectifs et ne sont utilisés que pour les désigner. Icônes issues du projet Simple Icons (licence CC0).</p>
      </section>
      <section>
        <h2>Signaler un contenu</h2>
        <p>Pour toute question ou signalement : [adresse e-mail à compléter].</p>
      </section>
    </PageLegale>
  );
}
