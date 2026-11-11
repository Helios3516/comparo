import type { SortKey, StoreFilter } from "../types";

type Chip = { id: string; label: string };

type Props = {
  categories: Chip[];
  category: string;
  onCategory: (id: string) => void;
  subcategories: Chip[];
  subcategory: string;
  onSubcategory: (id: string) => void;
  store: StoreFilter;
  onStore: (id: StoreFilter) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  total: number;
  showStore: boolean;
  hideExclusive: boolean;
  both: boolean;
  onBoth: () => void;
};

const STORES: { id: StoreFilter; label: string }[] = [
  { id: "comparables", label: "Prix comparés" },
  { id: "maxi", label: "Moins cher au Maxi" },
  { id: "iga", label: "Moins cher à l’IGA" },
  { id: "tie", label: "Même prix" },
  { id: "exclusive-maxi", label: "Seulement au Maxi" },
  { id: "exclusive-iga", label: "Seulement à l’IGA" },
];

export function Filters(props: Props) {
  return (
    <div className="no-print space-y-3">
      {props.categories.length > 0 && (
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Rayons">
        {props.categories.map((chip) => {
          const active = props.category === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => props.onCategory(chip.id)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm transition ${active ? "border-pine bg-moss text-ink" : "border-line bg-card text-ink hover:border-pine"}`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      )}
      {props.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sous-catégorie">
          {props.subcategories.map((chip) => {
            const active = props.subcategory === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => props.onSubcategory(chip.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-pine bg-pine text-pine-ink" : "border-line bg-paper text-muted hover:text-ink"}`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={props.both}
          onClick={props.onBoth}
          title="N’afficher que les articles vendus au Maxi et à l’IGA"
          className={`rounded-full border px-3 py-2 text-sm font-medium transition ${props.both ? "border-pine bg-moss text-ink" : "border-line bg-card text-ink"}`}
        >
          Les deux magasins{props.both ? " · activé" : ""}
        </button>
        {props.showStore &&
          STORES.filter((chip) => !props.hideExclusive || (chip.id !== "exclusive-maxi" && chip.id !== "exclusive-iga")).map((chip) => {
            const active = props.store === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => props.onStore(chip.id)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-moss text-ink" : "text-muted hover:text-ink"}`}
              >
                {chip.label}
              </button>
            );
          })}
        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-muted">{props.total.toLocaleString("fr-CA")} produits</p>
          <label htmlFor="tri" className="text-sm text-muted">
            Trier
          </label>
          <select
            id="tri"
            value={props.sort}
            onChange={(event) => props.onSort(event.target.value as SortKey)}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-sm outline-none"
          >
            <option value="rabais">Plus gros rabais</option>
            <option value="alpha">Ordre alphabétique</option>
            <option value="prix">Prix le plus bas</option>
          </select>
        </div>
      </div>
    </div>
  );
}
