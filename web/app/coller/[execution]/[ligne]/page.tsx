import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import type { Ligne } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

// Page lue par l'agent H, pas par l'utilisateur : les valeurs exactes d'une ligne, à copier puis coller dans le formulaire.
// Un copier-coller ne passe pas par le modèle de l'agent, qui sinon « corrige » en tapant (« Apartment », « commerciaux »).
// Accès par l'id (UUID) de l'exécution, impossible à deviner ; seules les colonnes demandées sont montrées.
export default async function Coller({ params, searchParams }: { params: Promise<{ execution: string; ligne: string }>; searchParams: Promise<{ c?: string | string[] }> }) {
  const { execution, ligne } = await params;
  const { c } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(execution)) notFound();
  const { data } = await db.from('executions').select('lignes, statut').eq('id', execution).maybeSingle();
  const l = (data?.lignes as Ligne[] | undefined)?.[Number(ligne)];
  if (!l || data?.statut !== 'en_cours') notFound();
  const colonnes = (Array.isArray(c) ? c : c ? [c] : []).filter((x) => l.valeurs[x]);

  return (
    <section className="mx-auto max-w-2xl pb-16 pt-10">
      <h1 className="text-2xl font-bold text-encre">Valeurs à copier</h1>
      <p className="mt-2 text-[15px] text-texte">Pour chaque champ : cliquez dans la zone, Ctrl+A, Ctrl+C, puis collez dans le formulaire avec Ctrl+V.</p>
      <div className="mt-8 space-y-6">
        {colonnes.map((x) => (
          <div key={x}>
            <label htmlFor={x} className="text-[15px] font-semibold text-encre">{x}</label>
            <textarea id={x} readOnly value={l.valeurs[x]} rows={Math.min(8, Math.ceil(l.valeurs[x].length / 60) + 1)} className="mt-2 w-full rounded-xl border border-champ bg-white px-4 py-3 text-[17px] text-encre" />
          </div>
        ))}
      </div>
    </section>
  );
}
