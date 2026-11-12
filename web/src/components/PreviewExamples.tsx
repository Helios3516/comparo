import { useMemo, useState } from "react";
import { money } from "../lib/format";
import { summarize } from "../lib/pricing";
import { previewBasket, previewSpotlight, previewWine } from "../lib/preview";
import type { Product, SaqProduct } from "../types";
import { EssenceView } from "./EssenceView";

type Chapter = "prix" | "liste" | "saq" | "repas" | "essence";

const CHAPTERS: { id: Chapter; label: string }[] = [
  { id: "prix", label: "Les prix" },
  { id: "liste", label: "La liste" },
  { id: "saq", label: "La SAQ" },
  { id: "repas", label: "Les repas" },
  { id: "essence", label: "L’essence" },
];

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
  const [chapter, setChapter] = useState<Chapter>("prix");

  return (
    <div className="rounded-3xl border border-line bg-card p-4 lg:p-5">
      <nav aria-label="Aperçus" className="sticky top-0 z-10 -mx-4 mb-4 grid grid-cols-3 gap-2 bg-card px-4 py-1 sm:grid-cols-5 lg:mx-0 lg:px-0">
        {CHAPTERS.map((item) => {
          const active = item.id === chapter;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setChapter(item.id)}
              className={`min-h-11 rounded-full px-2 text-sm lg:px-2 ${active ? "bg-pine font-semibold text-pine-ink" : "border border-line bg-paper"}`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div>
      {chapter === "prix" && (
      <section>
        <p className="text-sm text-pine">Exemple 1 · le plus gros écart</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">Le même article, deux prix.</h2>
        {!spotlight ? (
          <p className="mt-3 text-sm text-muted">Le relevé des épiceries arrive.</p>
        ) : (
          <article className="mt-4 rounded-2xl border border-line bg-paper p-3 sm:p-4">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
              <img src={spotlight.image ?? undefined} alt="" className="mx-auto h-16 w-16 object-contain sm:h-24 sm:w-24" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  {spotlight.brand || spotlight.category}
                  {spotlight.size ? ` · ${spotlight.size}` : ""}
                </p>
                <h3 className="mt-1 font-serif text-xl leading-snug sm:text-2xl">{spotlight.name}</h3>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PriceTile label="Maxi · Laflèche" amount={spotlight.maxi?.price ?? null} best={spotlight.cheaper === "maxi"} />
              <PriceTile label="IGA · Bretagne" amount={spotlight.iga?.price ?? null} best={spotlight.cheaper === "iga"} />
            </div>
            <p className="mt-3 text-sm text-pine">
              {money(spotlight.gap)} de moins {spotlight.cheaper === "maxi" ? "au Maxi" : "à l’IGA"}. Le catalogue complet s’ouvre avec le compte.
            </p>
          </article>
        )}
      </section>
      )}

      {chapter === "liste" && (
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
      )}

      {chapter === "saq" && (
      <section>
        <p className="text-sm text-pine">Exemple 3 · la SAQ</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">La bouteille qui vous plaît, pour plus tard.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Le relevé couvre les deux SAQ de Baie-Comeau. Chez un ami ou au restaurant, le scan lit la bouteille. Si elle vous plaît, le compte la retient pour l’achat, puis elle peut rejoindre la liste.
        </p>
        {!wine ? (
          <p className="mt-3 text-sm text-muted">Le relevé SAQ arrive.</p>
        ) : (
          <article className="mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-line bg-paper p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
            <img src={wine.image ?? undefined} alt="" className="mx-auto h-28 w-24 object-contain" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                {wine.subcategory}
                {wine.country ? ` · ${wine.country}` : ""}
              </p>
              <h3 className="mt-1 font-serif text-2xl">{wine.name}</h3>
              <p className="mt-2 text-sm">
                {money(wine.price)} · {wine.size}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3 rounded-2xl border border-pine bg-moss px-3 py-2">
                  <span>SAQ Laflèche</span>
                  <span className="text-pine">{wine.lafleche ? "En stock" : "Rupture"}</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2">
                  <span>SAQ Lasalle</span>
                  <span>{wine.lasalle ? "En stock" : "Rupture"}</span>
                </li>
              </ul>
              <a href={wine.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-pine underline-offset-2 hover:underline">
                Voir la bouteille sur SAQ.com
              </a>
            </div>
          </article>
        )}
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          <li className="rounded-2xl border border-line bg-paper px-3 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-pine">Scanner</p>
            <p className="mt-1">Le code-barres ou le code SAQ ouvre le prix et le stock des deux succursales.</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-3 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-pine">Retenir</p>
            <p className="mt-1">Une bouteille aimée chez un ami ou au restaurant reste dans le compte.</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-3 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-pine">Acheter</p>
            <p className="mt-1">Le jour venu, elle rejoint la liste, à côté de l’épicerie.</p>
          </li>
        </ol>
      </section>
      )}

      {chapter === "repas" && (
      <section>
        <p className="text-sm text-pine">Les repas · le principe</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">La semaine prépare la liste.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Vous indiquez les convives, le nombre de soupers, le régime et le budget. Comparo compose les plats avec le catalogue du Maxi et de l’IGA, puis envoie chaque ingrédient au magasin le moins cher.
        </p>
        <ol className="mt-4 grid gap-2">
          <li className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-pine">1 · La table</span>
            <p className="mt-1">Combien de personnes, midi et souper ou soupers seulement, ce qu’on ne mange pas.</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-pine">2 · Les plats</span>
            <p className="mt-1">Chaque jour reçoit une recette. Le carnet retient ce qu’on refait et ce qu’on ne ressert pas.</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-pine">3 · Les courses</span>
            <p className="mt-1">Les ingrédients deviennent une liste déjà séparée : Maxi Laflèche d’un côté, IGA de Bretagne de l’autre.</p>
          </li>
        </ol>
      </section>
      )}

      {chapter === "essence" && (
      <section>
        <p className="text-sm text-pine">L’essence</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight">La carte des stations.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">Le vert est le moins cher. Touchez une station pour la centrer.</p>
        <div className="mt-4">
          <EssenceView embedded />
        </div>
      </section>
      )}
      </div>
    </div>
  );
}

function PriceTile({ label, amount, best }: { label: string; amount: number | null; best: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${best ? "border-pine bg-moss" : "border-line"}`}>
      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums sm:text-3xl">{amount == null ? "—" : money(amount)}</p>
      {best && <p className="text-xs text-pine">Le moins cher</p>}
    </div>
  );
}

function Stop({ title, place, lines }: { title: string; place: string; lines: { id: string; name: string; total: number }[] }) {
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return (
    <article className="rounded-2xl border border-line bg-paper">
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
