import { money } from "../lib/format";
import type { UsualStore } from "../lib/memory";
import type { Product } from "../types";
import { ProductCard } from "./ProductCard";

type Props = {
  compared: number;
  deals: number;
  averageGap: number;
  updated: string;
  highlights: Product[];
  pourToi: Product[];
  store: UsualStore;
  liked: (id: string) => boolean;
  passed: (id: string) => boolean;
  onLike: (product: Product) => void;
  onPass: (product: Product) => void;
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  onCatalogue: () => void;
  onDeals: () => void;
  onScan: () => void;
  onEssence: () => void;
  onSaq: () => void;
  onMeals: () => void;
  onSearch: (query: string) => void;
};

const STEPS = [
  {
    title: "Le vert est le moins cher",
    text: "Chaque carte montre le Maxi, boulevard Laflèche, à côté de l’IGA, rue de Bretagne. Le cadre vert est le prix à prendre.",
  },
  {
    title: "La liste calcule les deux factures",
    text: "Ajoutez ce qu’il vous faut. Comparo compare un arrêt au Maxi, un arrêt à l’IGA, et le parcours qui mélange les deux.",
  },
  {
    title: "La feuille de route part avec vous",
    text: "Le PDF sépare les arrêts : d’abord le Maxi, ensuite l’IGA. Chaque article a une case à cocher dans l’allée.",
  },
];

const QUICK = ["lait", "pain", "poulet", "œufs", "café"];

export function HomeView({
  compared,
  deals,
  averageGap,
  updated,
  highlights,
  pourToi,
  store,
  liked,
  passed,
  onLike,
  onPass,
  qtyOf,
  onAdd,
  onQty,
  onCatalogue,
  onDeals,
  onScan,
  onEssence,
  onSaq,
  onMeals,
  onSearch,
}: Props) {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="text-sm text-pine">Baie-Comeau · Maxi Laflèche · IGA, rue de Bretagne</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-6xl">La semaine organisée, au magasin le moins cher.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Comparo prépare les repas et la liste, puis envoie chaque article au Maxi de Laflèche ou à l’IGA de la rue de Bretagne, là où l’écart est de votre côté.
        </p>
        <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-2">
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Comparés</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums md:text-3xl">{compared.toLocaleString("fr-CA")}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Écart moyen</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums md:text-3xl">{money(averageGap)}</dd>
          </div>
          <div className="rounded-2xl border border-pine bg-moss px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-pine">Imbattables</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums md:text-3xl">{deals.toLocaleString("fr-CA")}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onMeals} className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
            Organiser ma semaine
          </button>
          <button type="button" onClick={onCatalogue} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium">
            Comparer les prix
          </button>
          <button type="button" onClick={onDeals} className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium">
            {deals.toLocaleString("fr-CA")} écarts à 30 % et plus
          </button>
          <button type="button" onClick={onScan} className="rounded-full px-3 py-2.5 text-sm font-medium text-pine underline-offset-2 hover:underline">
            Scanner un code-barres
          </button>
          <button type="button" onClick={onSaq} className="rounded-full px-3 py-2.5 text-sm font-medium text-pine underline-offset-2 hover:underline">
            Les deux SAQ
          </button>
          <button type="button" onClick={onEssence} className="rounded-full px-3 py-2.5 text-sm font-medium text-pine underline-offset-2 hover:underline">
            Prix de l’essence
          </button>
        </div>
      </section>

      {pourToi.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl">Pour toi</h2>
          <p className="mt-1 text-sm text-muted">
            {store === "maxi"
              ? "Ce que vous aimez ou reprenez, d’abord quand le Maxi est moins cher."
              : store === "iga"
                ? "Ce que vous aimez ou reprenez, d’abord quand l’IGA est moins cher."
                : "Ce que vous aimez, et ce que vous remettez dans la liste."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {pourToi.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                qty={qtyOf(product.id)}
                liked={liked(product.id)}
                passed={passed(product.id)}
                onLike={() => onLike(product)}
                onPass={() => onPass(product)}
                onAdd={() => onAdd(product.id)}
                onQty={(qty) => onQty(product.id, qty)}
              />
            ))}
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">Les plus gros écarts</h2>
              <p className="mt-1 text-sm text-muted">Ajoutez-les tout de suite, ou ouvrez la liste complète.</p>
            </div>
            <button type="button" onClick={onDeals} className="shrink-0 text-sm font-medium text-pine underline-offset-2 hover:underline">
              Tout voir
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {highlights.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                qty={qtyOf(product.id)}
                liked={liked(product.id)}
                passed={passed(product.id)}
                onLike={() => onLike(product)}
                onPass={() => onPass(product)}
                onAdd={() => onAdd(product.id)}
                onQty={(qty) => onQty(product.id, qty)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <article key={step.title} className="rounded-3xl border border-line bg-card p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-pine">0{index + 1}</p>
            <h2 className="mt-2 font-serif text-2xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Cherchez comme vous parlez</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          « Coca » trouve les Coca-Cola et les Coke. « Patate » trouve les pommes de terre, « chips » les croustilles, « pq » le papier hygiénique.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => onSearch(word)}
              className="rounded-full border border-line bg-paper px-3 py-2 text-sm hover:border-pine"
            >
              {word}
            </button>
          ))}
        </div>
        {updated && <p className="mt-4 text-xs text-muted">Prix relevés le {updated} sur maxi.ca et iga.ca. Le prix comparé est celui en tablette. La carte Scène est indiquée à part.</p>}
      </section>
    </div>
  );
}
