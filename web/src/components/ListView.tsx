import { useState } from "react";
import { articles, money, savingsCopy } from "../lib/format";
import type { Summary } from "../types";

type Props = {
  summary: Summary;
  onQty: (id: string, qty: number) => void;
  onClear: () => void;
  onBrowse: () => void;
  onDeals: () => void;
  onPdf: () => void;
};

function Bill({
  kicker,
  title,
  amount,
  note,
  accent,
}: {
  kicker: string;
  title: string;
  amount: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${accent ? "border-pine bg-pine text-pine-ink" : "border-line bg-card"}`}>
      <p className={`text-[11px] font-medium uppercase tracking-[0.16em] ${accent ? "text-pine-ink/80" : "text-muted"}`}>{kicker}</p>
      <h3 className="mt-2 font-serif text-xl">{title}</h3>
      <p className="mt-3 font-serif text-4xl tabular-nums">{money(amount)}</p>
      <p className={`mt-2 text-sm ${accent ? "text-pine-ink/85" : "text-muted"}`}>{note}</p>
    </article>
  );
}

function StopColumn({
  title,
  place,
  lines,
  onQty,
}: {
  title: string;
  place: string;
  lines: Summary["maxiLines"];
  onQty: (id: string, qty: number) => void;
}) {
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return (
    <section className="rounded-3xl border border-line bg-card">
      <header className="flex items-end justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{place}</p>
          <h3 className="font-serif text-2xl">{title}</h3>
        </div>
        <p className="text-sm tabular-nums">{lines.length ? money(total) : "—"}</p>
      </header>
      {lines.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">Rien à prendre ici.</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper">
                {line.image ? <img src={line.image} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-muted">•</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="truncate text-xs text-muted">
                  {line.category}
                  {line.size ? ` · ${line.size}` : ""} · {money(line.unit)}
                  {line.card != null ? ` · Carte Scène ${money(line.card)}` : ""}
                  {line.tie ? " · même prix à l’IGA" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
                <button type="button" aria-label={`Retirer un ${line.name}`} onClick={() => onQty(line.id, line.qty - 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                  −
                </button>
                <span className="w-5 text-center text-sm tabular-nums">{line.qty}</span>
                <button type="button" aria-label={`Ajouter un ${line.name}`} onClick={() => onQty(line.id, line.qty + 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                  +
                </button>
              </div>
              <p className="w-16 text-right text-sm font-medium tabular-nums">{money(line.total)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ListView({ summary, onQty, onClear, onBrowse, onDeals, onPdf }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (summary.count === 0) {
    return (
      <div data-tour="liste" className="rounded-[2rem] border border-dashed border-line px-6 py-20 text-center">
        <p className="font-serif text-4xl">Votre liste est vide</p>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Ajoutez ce qu’il vous faut cette semaine. Comparo répartit chaque article au magasin le moins cher.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onBrowse} className="btn-solid rounded-full px-5 py-2.5 text-sm font-medium">
            Parcourir le catalogue
          </button>
          <button type="button" onClick={onDeals} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium">
            Voir les imbattables
          </button>
        </div>
      </div>
    );
  }

  const maxiNote =
    summary.maxiMissing > 0
      ? `Sans ${articles(summary.maxiMissing)} offert${summary.maxiMissing > 1 ? "s" : ""} seulement à l’IGA`
      : "Boulevard Laflèche";
  const igaNote =
    summary.igaMissing > 0
      ? `Sans ${articles(summary.igaMissing)} offert${summary.igaMissing > 1 ? "s" : ""} seulement au Maxi`
      : "Rue de Bretagne";

  return (
    <div className="space-y-6">
      <div data-tour="liste" className={`grid gap-3 ${summary.saqLines.length ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Bill kicker="Arrêt unique" title="100 % Maxi" amount={summary.maxiTotal} note={maxiNote} />
        <Bill kicker="Arrêt unique" title="100 % IGA" amount={summary.igaTotal} note={igaNote} />
        <Bill
          kicker="Le moins cher"
          title="Parcours épicerie"
          amount={summary.optimized}
          note={`${summary.maxiLines.length} au Maxi · ${summary.igaLines.length} à l’IGA`}
          accent
        />
        {summary.saqLines.length > 0 && (
          <Bill kicker="Même liste" title="SAQ" amount={summary.saqTotal} note="Lasalle ou Laflèche, en plus de l’épicerie" />
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-card px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-pine">Économie</p>
          <p className="mt-1 max-w-xl text-lg">{savingsCopy(summary)}</p>
        </div>
        <button
          type="button"
          onClick={onPdf}
          className="btn-solid shrink-0 rounded-full px-5 py-3 text-sm font-semibold shadow-[var(--shadow)] transition hover:-translate-y-0.5"
        >
          Générer ma feuille de route PDF
        </button>
      </div>

      <div className={`grid gap-4 ${summary.saqLines.length ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <StopColumn title="Maxi" place="Arrêt 1 · Blvd Laflèche" lines={summary.maxiLines} onQty={onQty} />
        <StopColumn title="IGA" place="Arrêt 2 · Rue de Bretagne" lines={summary.igaLines} onQty={onQty} />
        {summary.saqLines.length > 0 && <StopColumn title="SAQ" place="Arrêt 3 · Lasalle ou Laflèche" lines={summary.saqLines} onQty={onQty} />}
      </div>

      <div className="flex justify-end">
        {confirmClear ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setConfirmClear(false)} className="min-h-10 px-2 text-sm text-muted hover:text-ink">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onClear();
                setConfirmClear(false);
              }}
              className="min-h-10 px-2 text-sm text-iga"
            >
              Confirmer — vider la liste
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="min-h-10 px-2 text-sm text-muted hover:text-ink">
            Vider la liste
          </button>
        )}
      </div>
    </div>
  );
}
