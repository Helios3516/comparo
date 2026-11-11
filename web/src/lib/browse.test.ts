import { describe, expect, it } from "vitest";
import { browsePath, matchesStore, readBrowse, selectProducts } from "./browse";
import { buildSearchIndex } from "./search";
import type { Product } from "../types";

function product(partial: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    brand: "",
    size: "",
    category: "Épicerie",
    image: null,
    maxi: null,
    iga: null,
    cheaper: "egal",
    gap: 0,
    gapPct: 0,
    dealPct: 0,
    exclusive: false,
    ...partial,
  };
}

const lait = product({
  id: "lait",
  name: "Lait 2 %",
  brand: "Québon",
  category: "Produits laitiers",
  cheaper: "maxi",
  gap: 0.4,
  dealPct: 0.1,
  maxi: { name: "Lait", price: 4, regular: null, url: "", image: null, size: "2 L" },
  iga: { name: "Lait", price: 4.4, regular: null, url: "", image: null, size: "2 L" },
});

const chips = product({
  id: "chips",
  name: "Croustilles nature",
  brand: "Ruffles",
  category: "Collations",
  cheaper: "iga",
  gap: 1,
  dealPct: 0.4,
  maxi: { name: "Chips", price: 4, regular: 5, url: "", image: null, size: "200 g" },
  iga: { name: "Chips", price: 3, regular: null, url: "", image: null, size: "200 g" },
});

describe("readBrowse", () => {
  it("ouvre le catalogue en ordre alphabétique", () => {
    expect(readBrowse("")).toMatchObject({ view: "catalogue", sort: "alpha", page: 0, query: "" });
  });

  it("relit une adresse partagée", () => {
    const state = readBrowse("?vue=liste&q=lait&rayon=Boissons&magasin=iga&tri=prix&page=3");
    expect(state).toEqual({
      view: "liste",
      query: "lait",
      category: "Boissons",
      subcategory: "all",
      store: "iga",
      sort: "prix",
      page: 2,
      both: false,
      where: "either",
    });
    expect(browsePath(state)).toBe("/?vue=liste&q=lait&rayon=Boissons&magasin=iga&tri=prix&page=3");
  });

  it("trie les imbattables par rabais quand l’adresse ne dit rien", () => {
    expect(readBrowse("?vue=imbattables").sort).toBe("rabais");
  });
});

describe("selectProducts", () => {
  const products = [lait, chips];
  const index = buildSearchIndex(products);

  it("cherche le mot tapé dans tout le catalogue", () => {
    const found = selectProducts(products, index, {
      view: "catalogue",
      store: "comparables",
      category: "all",
      subcategory: "all",
      query: "croustille",
      sort: "alpha",
      both: false,
    });
    expect(found.map((item) => item.id)).toEqual(["chips"]);
  });

  it("laisse les comparables dans l’ordre alphabétique", () => {
    const found = selectProducts(products, index, {
      view: "catalogue",
      store: "comparables",
      category: "all",
      subcategory: "all",
      query: "",
      sort: "alpha",
      both: false,
    });
    expect(found.map((item) => item.name)).toEqual(["Croustilles nature", "Lait 2 %"]);
  });

  it("garde seulement les articles des deux magasins quand le filtre est actif", () => {
    const seule = product({
      id: "seule",
      name: "Bière locale",
      exclusive: true,
      cheaper: "iga",
      iga: { name: "Bière", price: 3, regular: null, url: "", image: null, size: "" },
    });
    const commune = product({
      id: "commune",
      name: "Bière blonde",
      maxi: { name: "Bière", price: 3, regular: null, url: "", image: null, size: "" },
      iga: { name: "Bière", price: 4, regular: null, url: "", image: null, size: "" },
    });
    const items = [seule, commune];
    const found = selectProducts(items, buildSearchIndex(items), {
      view: "catalogue",
      store: "comparables",
      category: "all",
      subcategory: "all",
      query: "biere",
      sort: "alpha",
      both: true,
    });
    expect(found.map((item) => item.id)).toEqual(["commune"]);
  });

  it("ouvre les fruits frais dans le rayon fruits et légumes", () => {
    const state = readBrowse("?rayon=Fruits");
    expect(state.category).toBe("Fruits et légumes");
    expect(state.subcategory).toBe("Fruits");
    const tomate = product({
      id: "tomate",
      name: "Tomates en grappe",
      category: "Fruits et légumes",
      subcategory: "Légumes",
    });
    const pomme = product({
      id: "pomme",
      name: "Pommes Gala",
      category: "Fruits et légumes",
      subcategory: "Fruits",
    });
    const confiture = product({
      id: "confiture",
      name: "Confiture de fraises",
      category: "Confitures",
    });
    const items = [tomate, pomme, confiture];
    const found = selectProducts(items, buildSearchIndex(items), {
      view: "catalogue",
      store: "comparables",
      category: "Fruits et légumes",
      subcategory: "Fruits",
      query: "",
      sort: "alpha",
      both: false,
    });
    expect(found.map((item) => item.id)).toEqual(["pomme"]);
  });
});

describe("matchesStore", () => {
  it("sépare un exclusif IGA d’un comparable", () => {
    const only = product({ id: "x", name: "Seul", exclusive: true, cheaper: "iga" });
    expect(matchesStore(only, "exclusive-iga")).toBe(true);
    expect(matchesStore(only, "comparables")).toBe(false);
    expect(matchesStore(lait, "maxi")).toBe(true);
  });
});
