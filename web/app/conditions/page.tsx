import { PageLegale } from '@/components/PageLegale';

export const metadata = { title: 'Conditions d’utilisation · Ghost' };

export default function Conditions() {
  return (
    <PageLegale titre="Conditions d’utilisation" maj="20 novembre 2026">
      <section>
        <h2>Le service</h2>
        <p>Ghost observe, à votre demande, une tâche que vous faites sur votre ordinateur, en écrit la méthode, puis la confie à un agent qui la refait sur les sites que vous indiquez. Le service est un prototype : il peut évoluer, s’interrompre ou contenir des erreurs.</p>
      </section>
      <section>
        <h2>Ce que vous vous engagez à faire</h2>
        <ul>
          <li>N’automatiser que des sites et des comptes que vous avez le droit d’utiliser, en respectant leurs conditions d’utilisation.</li>
          <li>Ne pas utiliser Ghost pour envoyer du contenu illicite, trompeur ou non sollicité, ni pour contourner une protection.</li>
          <li>Relire la méthode et vos règles avant de lancer un agent, et vérifier les résultats importants.</li>
          <li>Garder secret tout lien de déclenchement : il permet de lancer votre agent.</li>
        </ul>
      </section>
      <section>
        <h2>Ce que fait l’agent, et ce qu’il ne fait pas</h2>
        <p>L’agent ne paie rien, ne supprime rien et n’écrit à personne. Une ligne qui ne respecte pas vos règles est refusée avant qu’il ne démarre, et chaque résultat est relu sur la page publiée. Ces garde-fous réduisent les erreurs sans les supprimer : vous restez responsable de l’usage que vous faites du service.</p>
      </section>
      <section>
        <h2>Responsabilité</h2>
        <p>[Clauses de limitation de responsabilité, de disponibilité et de garanties à rédiger et faire valider.]</p>
      </section>
      <section>
        <h2>Fin du service</h2>
        <p>Vous pouvez arrêter à tout moment : effacez vos workflows et vos accès, puis demandez la suppression de votre compte à [adresse e-mail à compléter].</p>
      </section>
      <section>
        <h2>Droit applicable</h2>
        <p>Les présentes conditions sont soumises au droit français. [Juridiction compétente à préciser.]</p>
      </section>
    </PageLegale>
  );
}
