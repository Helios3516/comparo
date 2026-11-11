import type { Product, SaqStoreFilter, SortKey, StoreFilter, View } from "../types";
import { bestUnit, matchesPrepared, relevanceRecord, type SearchRecord } from "./search";

export type BrowseState = {
  view: View;
  query: string;
  category: string;
  subcategory: string;
  store: StoreFilter;
  sort: SortKey;
  page: number;
  both: boolean;
  where: SaqStoreFilter;
};

const VIEWS = new Set<View>(["accueil", "catalogue", "imbattables", "liste", "essence", "saq", "repas"]);
const WHERE = new Set<SaqStoreFilter>(["either", "both", "lasalle", "lafleche"]);
const STORES = new Set<StoreFilter>(["comparables", "maxi", "iga", "tie", "exclusive-maxi", "exclusive-iga"]);
const SORTS = new Set<SortKey>(["rabais", "alpha", "prix", "note"]);

export function matchesStore(product: Product, store: StoreFilter) {
  if (store === "comparables") return !product.exclusive;
  if (store === "maxi") return !product.exclusive && product.cheaper === "maxi";
  if (store === "iga") return !product.exclusive && product.cheaper === "iga";
  if (store === "tie") return product.cheaper === "egal";
  if (store === "exclusive-maxi") return product.exclusive && product.cheaper === "maxi";
  return product.exclusive && product.cheaper === "iga";
}

export function readBrowse(search: string): BrowseState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const viewParam = params.get("vue");
  const view = VIEWS.has(viewParam as View) ? (viewParam as View) : "catalogue";
  const storeParam = params.get("magasin");
  const sortParam = params.get("tri");
  const page = Number(params.get("page"));
  let category = params.get("rayon") || "all";
  let subcategory = params.get("sous") || "all";
  if (category === "Fruits") {
    category = "Fruits et légumes";
    if (subcategory === "all") subcategory = "Fruits";
  } else if (category === "Légumes") {
    category = "Fruits et légumes";
    if (subcategory === "all") subcategory = "Légumes";
  }
  return {
    view,
    query: params.get("q") ?? "",
    category,
    subcategory,
    store: STORES.has(storeParam as StoreFilter) ? (storeParam as StoreFilter) : "comparables",
    sort: SORTS.has(sortParam as SortKey) ? (sortParam as SortKey) : view === "imbattables" ? "rabais" : "alpha",
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
    both: params.get("deux") === "1",
    where: WHERE.has(params.get("succursale") as SaqStoreFilter) ? (params.get("succursale") as SaqStoreFilter) : "either",
  };
}

export function browsePath(state: BrowseState) {
  const params = new URLSearchParams();
  if (state.view !== "catalogue") params.set("vue", state.view);
  if (state.query) params.set("q", state.query);
  if (state.category !== "all") params.set("rayon", state.category);
  if (state.subcategory !== "all") params.set("sous", state.subcategory);
  if (state.store !== "comparables") params.set("magasin", state.store);
  if (state.sort !== "alpha") params.set("tri", state.sort);
  if (state.both) params.set("deux", "1");
  if (state.where !== "either") params.set("succursale", state.where);
  if (state.page > 0) params.set("page", String(state.page + 1));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function categoryChips(products: Product[], categories: string[], view: View, store: StoreFilter, both: boolean) {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (both && product.exclusive) continue;
    if (view === "imbattables" && (product.exclusive || product.dealPct < 0.3)) continue;
    if (view !== "imbattables" && !matchesStore(product, store)) continue;
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  const ordered = categories.filter((name) => counts.has(name));
  return [{ id: "all", label: "Toutes" }, ...ordered.map((name) => ({ id: name, label: name }))];
}

export function subcategoryChips(products: Product[], view: View, store: StoreFilter, both: boolean, category: string) {
  if (category === "all") return [];
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.category !== category || !product.subcategory) continue;
    if (both && product.exclusive) continue;
    if (view === "imbattables" && (product.exclusive || product.dealPct < 0.3)) continue;
    if (view !== "imbattables" && !matchesStore(product, store)) continue;
    counts.set(product.subcategory, (counts.get(product.subcategory) ?? 0) + 1);
  }
  if (counts.size < 2) return [];
  const order = ["Fruits", "Légumes", "Fines herbes", "Sauces", "Pâtes et riz", "Céréales", "Épices"];
  const names = [...counts.keys()].sort((a, b) => {
    const left = order.indexOf(a);
    const right = order.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.localeCompare(b, "fr");
  });
  return [{ id: "all", label: "Tout le rayon" }, ...names.map((name) => ({ id: name, label: name }))];
}

type SelectOptions = {
  view: View;
  store: StoreFilter;
  category: string;
  subcategory: string;
  query: string;
  sort: SortKey;
  both: boolean;
};

export function selectProducts(products: Product[], index: SearchRecord[], options: SelectOptions) {
  const searching = options.query.trim().length >= 2;
  const byProduct = new Map(index.map((record) => [record.product, record]));
  const next: Product[] = [];
  if (searching) {
    for (const record of index) {
      if (options.both && record.product.exclusive) continue;
      if (matchesPrepared(record, options.query)) next.push(record.product);
    }
  } else {
    for (const product of products) {
      if (options.both && product.exclusive) continue;
      if (options.view === "imbattables") {
        if (product.exclusive || product.dealPct < 0.3) continue;
      } else if (!matchesStore(product, options.store)) continue;
      if (options.category !== "all" && product.category !== options.category) continue;
      if (options.subcategory !== "all" && product.subcategory !== options.subcategory) continue;
      next.push(product);
    }
  }

  return next.sort((a, b) => {
    if (searching) {
      const gap =
        relevanceRecord(byProduct.get(b)!, options.query) - relevanceRecord(byProduct.get(a)!, options.query);
      if (gap !== 0) return gap;
    }
    if (options.sort === "alpha") return a.name.localeCompare(b.name, "fr");
    if (options.sort === "prix") return bestUnit(a) - bestUnit(b);
    return b.dealPct - a.dealPct || b.gap - a.gap;
  });
}
