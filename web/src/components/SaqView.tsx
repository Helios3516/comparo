import { useState } from "react";
import { money } from "../lib/format";
import { selectSaq } from "../lib/saq";
import type { Review } from "../lib/reviews";
import { SaqNote } from "./SaqNote";
import type { SaqCatalog, SaqProduct, SaqStoreFilter, SortKey } from "../types";
import { SaqDetail } from "./SaqDetail";
import { SaqGuide } from "./SaqGuide";
import { TasteMarks } from "./TasteMarks";

type Props = {
  catalog: SaqCatalog | null;
  error: string | null;
  query: string;
  subcategory: string;
  where: SaqStoreFilter;
  sort: SortKey;
  page: number;
  onSubcategory: (subcategory: string) => void;
  onWhere: (where: SaqStoreFilter) => void;
  onSort: (sort: SortKey) => void;
  onPage: (page: number) => void;
  onScan: () => void;
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  liked: (id: string) => boolean;
  passed: (id: string) => boolean;
  onLike: (product: SaqProduct) => void;
  onPass: (product: SaqProduct) => void;
  author: string;
  reviewsOf: (sku: string) => Review[];
  averageOf: (sku: string) => { average: number; count: number } | null;
  onPublish: (sku: string, author: string, stars: number, text: string) => Promise<string>;
};

const PAGE_SIZE = 24;

const WHERE: { id: SaqStoreFilter; label: string }[] = [
  { id: "either", label: "Les deux succursales" },
  { id: "both", label: "Dans les deux" },
  { id: "lasalle", label: "SAQ Lasalle" },
  { id: "lafleche", label: "SAQ Laflèche" },
];

function Presence({ label, present }: { label: string; present: boolean }) {
  return (
    <div className={`rounded-xl border px-2 py-1.5 ${present ? "border-pine bg-moss" : "border-dashed border-line"}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`text-xs font-medium ${present ? "text-ink" : "text-muted"}`}>{present ? "En inventaire" : "Pas dans l’inventaire"}</p>
    </div>
  );
}

function Card({ product, index, qty, note, liked, passed, onOpen, onAdd, onQty, onLike, onPass }: { product: SaqProduct; index: number; qty: number; note: { average: number; count: number } | null; liked: boolean; passed: boolean; onOpen: () => void; onAdd: () => void; onQty: (qty: number) => void; onLike: () => void; onPass: () => void }) {
  return (
    <article
      className="card-rise relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card"
      style={{ animationDelay: `${(index % 10) * 20}ms` }}
    >
      <TasteMarks name={product.name} liked={liked} passed={passed} onLike={onLike} onPass={onPass} />
      <button type="button" onClick={onOpen} className="relative h-36 bg-[color-mix(in_srgb,var(--ink)_4%,var(--card))]">
        {product.image ? (
          <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
        ) : (
          <div className="grid h-full place-items-center font-serif text-xl text-muted/50">{product.name.slice(0, 1)}</div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            SAQ · {product.subcategory}
            {product.size ? ` · ${product.size}` : ""}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">
            <button type="button" onClick={onOpen} className="text-left hover:underline">
              {product.name}
            </button>
          </h3>
        </div>
        <p className="flex items-baseline gap-2">
          <span className="font-serif text-xl tabular-nums">{money(product.price)}</span>
          {product.regular != null && <span className="text-xs text-muted line-through tabular-nums">{money(product.regular)}</span>}
        </p>
        <SaqNote average={note?.average} count={note?.count ?? 0} compact />
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <Presence label="SAQ Lasalle" present={product.lasalle} />
          <Presence label="SAQ Laflèche" present={product.lafleche} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {qty > 0 ? (
            <div className="flex items-center gap-0.5 rounded-full border border-line p-0.5">
              <button type="button" aria-label={`Retirer un ${product.name}`} onClick={() => onQty(qty - 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">
                −
              </button>
              <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
              <button type="button" aria-label={`Ajouter un ${product.name}`} onClick={() => onQty(qty + 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">
                +
              </button>
            </div>
          ) : (
            <button type="button" onClick={onAdd} className="btn-solid min-h-9 rounded-full px-3 text-sm font-medium">
              Ajouter
            </button>
          )}
          <button type="button" onClick={onOpen} className="text-xs font-medium text-pine underline-offset-2 hover:underline">
            Fiche
          </button>
        </div>
      </div>
    </article>
  );
}

export function SaqView({ catalog, error, query, subcategory, where, sort, page, onSubcategory, onWhere, onSort, onPage, onScan, qtyOf, onAdd, onQty, liked, passed, onLike, onPass, author, reviewsOf, averageOf, onPublish }: Props) {
  const [guide, setGuide] = useState(false);
  const [open, setOpen] = useState<SaqProduct | null>(null);
  const [minNote, setMinNote] = useState(0);
  if (error) {
    return <p className="rounded-2xl border border-iga/30 bg-iga/10 px-4 py-3 text-sm">{error}</p>;
  }
  if (!catalog) {
    return (
      <div>
        <p className="sr-only">Chargement du relevé SAQ</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl bg-line/70" />
          ))}
        </div>
      </div>
    );
  }

  const visible = selectSaq(catalog.products, {
    query,
    subcategory,
    where,
    sort,
    scoreOf: (id) => averageOf(id)?.average ?? null,
  }).filter((product) => minNote <= 0 || (averageOf(product.id)?.average ?? 0) >= minNote);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const searching = query.trim().length >= 2;
  const lasalle = catalog.stores.find((store) => store.id === "33550") ?? catalog.stores[0];
  const lafleche = catalog.stores.find((store) => store.id === "33614") ?? catalog.stores[1];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm text-pine">
            {lasalle ? lasalle.name : "Lasalle"}
            {lafleche ? ` · ${lafleche.name}` : ""}
          </p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">Prix et inventaire des deux SAQ.</h1>
          <p className="mt-3 max-w-xl text-muted">
            {searching
              ? "Recherche dans le relevé : nom, producteur, pays ou code SAQ."
              : `${catalog.products.length.toLocaleString("fr-CA")} produits qui font partie de l’inventaire d’au moins une des deux succursales. Le cadre vert veut dire que la bouteille y est, sans la quantité.`}
          </p>
          <p className="mt-2 text-xs text-muted">
            Relevé du {new Date(catalog.generatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}. Ce n’est pas le stock en direct.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setGuide((value) => !value)} className="rounded-3xl border border-pine bg-moss px-5 py-4 text-left">
            <p className="text-[11px] uppercase tracking-[0.16em] text-pine">Guide</p>
            <p className="mt-1 font-serif text-2xl">Choisir un vin</p>
          </button>
          <button type="button" onClick={onScan} className="rounded-3xl border border-line bg-card px-5 py-4 text-left shadow-[var(--shadow)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">En rayon</p>
          <p className="mt-1 font-serif text-2xl">Scanner</p>
          <p className="text-sm text-pine">code-barres ou code SAQ</p>
          </button>
        </div>
      </section>
      {guide && <SaqGuide products={catalog.products} onOpen={setOpen} onAdd={onAdd} onClose={() => setGuide(false)} averageOf={averageOf} />}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-pine bg-moss px-3 py-1.5 text-sm font-medium">Alcool · fournisseur SAQ</span>
        {!searching &&
          [{ id: "all", label: "Tout l’alcool" }, ...(catalog.subcategories ?? []).map((name) => ({ id: name, label: name }))].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSubcategory(chip.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${subcategory === chip.id ? "border-pine bg-moss" : "border-line bg-card"}`}
            >
              {chip.label}
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {WHERE.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onWhere(item.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${where === item.id ? "border-pine bg-moss" : "border-line bg-card"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Trier
          <select
            value={sort === "rabais" ? "rabais" : sort}
            onChange={(event) => onSort(event.target.value as SortKey)}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-ink"
          >
            <option value="alpha">Nom</option>
            <option value="note">Mieux notés</option>
            <option value="prix">Prix</option>
            <option value="rabais">Rabais</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { id: 0, label: "Toutes les notes" },
          { id: 3.5, label: "3,5 et +" },
          { id: 4, label: "4 et +" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMinNote(item.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${minNote === item.id ? "border-pine bg-moss" : "border-line bg-card"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        {visible.length.toLocaleString("fr-CA")} produit{visible.length > 1 ? "s" : ""}
      </p>
      {slice.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-serif text-2xl">Aucun produit par ici</p>
          <p className="mt-2 text-sm text-muted">Essayez un autre mot, un autre rayon, ou l’autre succursale.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {slice.map((product, index) => (
            <Card
              key={product.id}
              product={product}
              index={index}
              qty={qtyOf(product.id)}
              note={averageOf(product.id)}
              liked={liked(product.id)}
              passed={passed(product.id)}
              onOpen={() => setOpen(product)}
              onAdd={() => onAdd(product.id)}
              onQty={(qty) => onQty(product.id, qty)}
              onLike={() => onLike(product)}
              onPass={() => onPass(product)}
            />
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={safePage === 0} onClick={() => onPage(safePage - 1)} className="rounded-full border border-line bg-card px-4 py-2 text-sm disabled:opacity-40">
            Précédent
          </button>
          <span className="px-2 py-2 text-sm text-muted">
            {safePage + 1} / {pages}
          </span>
          <button type="button" disabled={safePage >= pages - 1} onClick={() => onPage(safePage + 1)} className="rounded-full border border-line bg-card px-4 py-2 text-sm disabled:opacity-40">
            Suivant
          </button>
        </div>
      )}
      {open && (
        <SaqDetail
          product={open}
          qty={qtyOf(open.id)}
          onAdd={() => onAdd(open.id)}
          onQty={(qty) => onQty(open.id, qty)}
          onClose={() => setOpen(null)}
          liked={liked(open.id)}
          passed={passed(open.id)}
          onLike={() => onLike(open)}
          onPass={() => onPass(open)}
          related={catalog.products}
          onOpen={setOpen}
          author={author}
          reviews={reviewsOf(open.id)}
          average={averageOf(open.id)?.average ?? null}
          averageOf={averageOf}
          onPublish={onPublish}
        />
      )}
    </div>
  );
}
