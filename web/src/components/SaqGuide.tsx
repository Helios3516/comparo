import { useMemo, useState } from "react";
import { money } from "../lib/format";
import { SaqNote } from "./SaqNote";
import { adviseWines, sweetnessOf, type WineBudget, type WineDish, type WineStyle, type WineSweetness } from "../lib/saqAdvise";
import type { SaqProduct } from "../types";

type Props = {
  products: SaqProduct[];
  onOpen: (product: SaqProduct) => void;
  onAdd: (id: string) => void;
  onClose: () => void;
  averageOf?: (sku: string) => { average: number; count: number } | null;
};

const STYLES: { id: WineStyle; label: string }[] = [
  { id: "rouge", label: "Rouge" },
  { id: "blanc", label: "Blanc" },
  { id: "rose", label: "Rosé" },
  { id: "mousseux", label: "Mousseux" },
  { id: "any", label: "Peu importe" },
];

const BUDGETS: { id: WineBudget; label: string }[] = [
  { id: "15", label: "Jusqu’à 15 $" },
  { id: "25", label: "Jusqu’à 25 $" },
  { id: "40", label: "Jusqu’à 40 $" },
  { id: "any", label: "Sans limite" },
];

const SWEETNESS: { id: WineSweetness; label: string }[] = [
  { id: "sec", label: "Sec" },
  { id: "demi", label: "Demi-sec" },
  { id: "sucre", label: "Sucré" },
  { id: "any", label: "Peu importe" },
];

const SWEETNESS_LABEL: Record<Exclude<WineSweetness, "any">, string> = {
  sec: "sec",
  demi: "demi-sec",
  sucre: "sucré",
};

const DISHES: { id: WineDish; label: string }[] = [
  { id: "viande", label: "Viande rouge" },
  { id: "volaille", label: "Volaille" },
  { id: "poisson", label: "Poisson" },
  { id: "fromage", label: "Fromage" },
  { id: "apero", label: "Apéro" },
  { id: "dessert", label: "Dessert" },
  { id: "any", label: "Pas de plat" },
];

export function SaqGuide({ products, onOpen, onAdd, onClose, averageOf }: Props) {
  const [style, setStyle] = useState<WineStyle>("rouge");
  const [budget, setBudget] = useState<WineBudget>("25");
  const [country, setCountry] = useState("tous");
  const [dish, setDish] = useState<WineDish>("any");
  const [sweetness, setSweetness] = useState<WineSweetness>("any");
  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.subcategory !== "Vin" && product.subcategory !== "Mousseux") continue;
      if (!product.country) continue;
      counts.set(product.country, (counts.get(product.country) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
  }, [products]);
  const matches = useMemo(
    () => adviseWines(products, { style, budget, country, dish, sweetness }),
    [products, style, budget, country, dish, sweetness],
  );

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-pine">Choisir un vin</p>
          <h2 className="mt-1 font-serif text-2xl">Cinq questions, des bouteilles de la SAQ.</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-line px-3 py-1.5 text-sm">
          Fermer
        </button>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Tu veux quoi comme vin ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {STYLES.map((item) => (
            <button key={item.id} type="button" onClick={() => setStyle(item.id)} className={`rounded-full border px-3 py-1.5 text-sm ${style === item.id ? "border-pine bg-moss" : "border-line"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Plutôt sec ou sucré ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SWEETNESS.map((item) => (
            <button key={item.id} type="button" onClick={() => setSweetness(item.id)} className={`rounded-full border px-3 py-1.5 text-sm ${sweetness === item.id ? "border-pine bg-moss" : "border-line"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Jusqu’à quel prix ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUDGETS.map((item) => (
            <button key={item.id} type="button" onClick={() => setBudget(item.id)} className={`rounded-full border px-3 py-1.5 text-sm ${budget === item.id ? "border-pine bg-moss" : "border-line"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Un pays en particulier ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setCountry("tous")} className={`rounded-full border px-3 py-1.5 text-sm ${country === "tous" ? "border-pine bg-moss" : "border-line"}`}>
            Tous
          </button>
          {countries.map((name) => (
            <button key={name} type="button" onClick={() => setCountry(name)} className={`rounded-full border px-3 py-1.5 text-sm ${country === name ? "border-pine bg-moss" : "border-line"}`}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">À marier avec un plat ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DISHES.map((item) => (
            <button key={item.id} type="button" onClick={() => setDish(item.id)} className={`rounded-full border px-3 py-1.5 text-sm ${dish === item.id ? "border-pine bg-moss" : "border-line"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="mt-5 text-sm text-muted">{matches.length} bouteille{matches.length > 1 ? "s" : ""} chez la SAQ</p>
      <ul className="mt-3 grid gap-2">
        {matches.map((product) => (
          <li key={product.id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2">
            <button type="button" onClick={() => onOpen(product)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden">
                {product.image ? <img src={product.image} alt="" className="h-full w-full object-contain" /> : "•"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{product.name}</span>
                <span className="block truncate text-xs text-muted">
                  {product.country}
                  {sweetnessOf(product) !== "unknown" ? ` · ${SWEETNESS_LABEL[sweetnessOf(product) as Exclude<WineSweetness, "any">]}` : ""}
                  {" · "}
                  {money(product.price)}
                  {product.lasalle ? " · Lasalle" : ""}
                  {product.lafleche ? " · Laflèche" : ""}
                </span>
                <SaqNote average={averageOf?.(product.id)?.average} count={averageOf?.(product.id)?.count ?? 0} compact />
              </span>
            </button>
            <button type="button" onClick={() => onAdd(product.id)} className="btn-solid shrink-0 rounded-full px-3 py-1.5 text-sm">
              Ajouter
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
