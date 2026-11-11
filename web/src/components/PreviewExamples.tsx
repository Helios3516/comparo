import { useMemo } from "react";
import { money } from "../lib/format";
import { summarize } from "../lib/pricing";
import { previewBasket, previewSpotlight, previewWine } from "../lib/preview";
import type { Product, SaqProduct } from "../types";
import { EssenceView } from "./EssenceView";

type Props = {
  products?: Product[];
  wines?: SaqProduct[];
  spotlight?: Product | null;
  basket?: Product[];
  wine?: SaqProduct | null;
};

export function PreviewExamples({ products = [], wines = [], spotlight: givenSpotlight, basket: givenBasket, wine: givenWine }: Props) {
  const spotlight = useMemo(() => givenSpotlight ?? previewSpotlight(products), [givenSpotlight, products]);
  const basket = useMemo(() => givenBasket ?? previewBasket(products), [givenBasket, products]);
  const wine = useMemo(() => (givenWine !== undefined ? givenWine : previewWine(wines)), [givenWine, wines]);
  const summary = useMemo(
    () => summarize(basket.map((product) => ({ id: product.id, qty: 1 })), new Map(basket.map((product) => [product.id, product]))),
    [basket],
  );

  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm text-pine">Exemple 1 · le plus gros écart</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">Le même article, deux prix.</h2>
        {!spotlight ? (
          <p className="mt-3 text-sm text-muted">Le relevé des épiceries arrive.</p>
        ) : (
          <article className="mt-4 overflow-hidden rounded-3xl border border-line bg-card md:grid md:grid-cols-[12rem_1fr]">
            <div className="grid h-40 place-items-center bg-paper md:h-full">
              <img src={spotlight.image ?? undefined} alt="" className="h-36 w-full object-contain p-3" />
            </div>
            <div className="p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                {spotlight.brand || spotlight.category}
                {spotlight.size ? ` · ${spotlight.size}` : ""}
              </p>
              <h3 className="mt-1 font-serif text-2xl">{spotlight.name}</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <PriceTile label="Maxi · Laflèche" amount={spotlight.maxi?.price ?? null} best={spotlight.cheaper === "maxi"} />
                <PriceTile label="IGA · Bretagne" amount={spotlight.iga?.price ?? null} best={spotlight.cheaper === "iga"} />
              </div>
              <p className="mt-3 text-sm text-pine">
                {money(spotlight.gap)} de moins {spotlight.cheaper === "maxi" ? "au Maxi" : "à l’IGA"}. Le catalogue complet s’ouvre avec le compte.
              </p>
            </div>
          </article>
        )}
      </section>

      <section>
        <p className="text-sm text-pine">Exemple 2 · une petite liste</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">Deux arrêts, déjà séparés.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pain, lait, œufs, pommes de terre et café. Comparo place chaque article au magasin le moins cher.
          {summary.saved >= 0.01 ? ` Ici, ${money(summary.saved)} de moins qu’un seul arrêt.` : ""}
        </p>
        {basket.length === 0 ? (
          <p className="mt-3 text-sm text-muted">La liste d’exemple arrive avec le relevé.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Stop title="Maxi" place="Boulevard Laflèche" lines={summary.maxiLines} />
            <Stop title="IGA" place="Rue de Bretagne" lines={summary.igaLines} />
          </div>
        )}
      </section>

      <section>
        <p className="text-sm text-pine">Exemple 3 · les deux SAQ</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">Un vin en stock aux deux succursales.</h2>
        {!wine ? (
          <p className="mt-3 text-sm text-muted">Le relevé SAQ arrive.</p>
        ) : (
          <article className="mt-4 overflow-hidden rounded-3xl border border-line bg-card md:grid md:grid-cols-[12rem_1fr]">
            <div className="grid h-48 place-items-center bg-paper md:h-full">
              <img src={wine.image ?? undefined} alt="" className="h-44 w-full object-contain p-3" />
            </div>
            <div className="p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                {wine.subcategory}
                {wine.country ? ` · ${wine.country}` : ""}
              </p>
              <h3 className="mt-1 font-serif text-2xl">{wine.name}</h3>
              <p className="mt-2 text-sm">
                {money(wine.price)} · {wine.size}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3 rounded-2xl border border-pine bg-moss px-3 py-2">
                  <span>SAQ Laflèche</span>
                  <span className="text-pine">{wine.lafleche ? "En stock" : "Rupture"}</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-2xl border border-pine bg-moss px-3 py-2">
                  <span>SAQ Lasalle</span>
                  <span className="text-pine">{wine.lasalle ? "En stock" : "Rupture"}</span>
                </li>
              </ul>
              <a href={wine.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-pine underline-offset-2 hover:underline">
                Voir la bouteille sur SAQ.com
              </a>
            </div>
          </article>
        )}
      </section>

      <section>
        <p className="text-sm text-pine">Exemple 4 · l’essence</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">La carte des stations.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">Le vert est le moins cher. Touchez une station pour la centrer.</p>
        <div className="mt-4">
          <EssenceView embedded />
        </div>
      </section>
    </div>
  );
}

function PriceTile({ label, amount, best }: { label: string; amount: number | null; best: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${best ? "border-pine bg-moss" : "border-line"}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{amount == null ? "—" : money(amount)}</p>
      {best && <p className="text-xs text-pine">Le moins cher</p>}
    </div>
  );
}

function Stop({ title, place, lines }: { title: string; place: string; lines: { id: string; name: string; total: number }[] }) {
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return (
    <article className="rounded-3xl border border-line bg-card">
      <header className="flex items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{place}</p>
          <h3 className="font-serif text-2xl">{title}</h3>
        </div>
        <p className="tabular-nums">{lines.length ? money(total) : "—"}</p>
      </header>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">Rien à prendre ici dans cet exemple.</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
              <span className="min-w-0 truncate">{line.name}</span>
              <span className="shrink-0 tabular-nums">{money(line.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
