// Mise en page commune des pages légales : lisible, une colonne, date de mise à jour visible.
export function PageLegale({ titre, maj, children }: { titre: string; maj: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl pb-16 pt-10">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Informations légales</p>
      <h1 className="mt-3 text-[36px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[44px]">{titre}</h1>
      <p className="mt-3 text-sm text-discret">Dernière mise à jour : {maj}</p>
      <p className="mt-6 rounded-2xl bg-nuit-clair px-5 py-4 text-sm text-nuit">
        Document en version de travail, rédigé pour un prototype. Les mentions entre crochets restent à compléter, et l’ensemble doit être relu par un professionnel du droit avant une ouverture au public.
      </p>
      <div className="legal mt-10 space-y-8 text-[16px] leading-relaxed text-texte [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-encre [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-nuit [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
