import { PageLegale } from '@/components/PageLegale';

export const metadata = { title: 'Cookies · Ghost' };

export default function Cookies() {
  return (
    <PageLegale titre="Cookies et stockage" maj="20 novembre 2026">
      <section>
        <h2>Ce que Ghost dépose</h2>
        <ul>
          <li><strong>Cookie de session</strong> (Supabase) : vous garde connecté. Indispensable au service.</li>
          <li><strong>Stockage du navigateur</strong> : retient les notifications déjà affichées, pour ne pas vous prévenir deux fois.</li>
          <li><strong>Service worker</strong> : affiche les notifications et ouvre la bonne page quand vous cliquez dessus.</li>
        </ul>
      </section>
      <section>
        <h2>Ce que Ghost ne dépose pas</h2>
        <p>Aucun cookie publicitaire ni de mesure d’audience. Ces éléments étant strictement nécessaires au fonctionnement, ils ne demandent pas de consentement préalable.</p>
      </section>
      <section>
        <h2>Les effacer</h2>
        <p>Vous pouvez les supprimer depuis les réglages de votre navigateur ; vous serez alors déconnecté.</p>
      </section>
    </PageLegale>
  );
}
