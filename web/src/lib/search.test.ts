import { describe, expect, it } from "vitest";
import { buildSearchIndex, matchesPrepared, matchesQuery, suggest } from "./search";
import type { Product } from "../types";

function named(name: string, brand = ""): Product {
  return {
    id: name,
    name,
    brand,
    size: "",
    category: "Épicerie",
    image: null,
    maxi: { name, price: 2, regular: null, url: "", image: null, size: "" },
    iga: { name, price: 3, regular: null, url: "", image: null, size: "" },
    cheaper: "maxi",
    gap: 1,
    gapPct: 0.3,
    dealPct: 0,
    exclusive: false,
  };
}

describe("matchesQuery", () => {
  it("comprend les surnoms sans confondre lait et laitue", () => {
    expect(matchesQuery("Laitue iceberg", "lait")).toBe(false);
    expect(matchesQuery("Pommes de terre jaunes", "patate")).toBe(true);
    expect(matchesQuery("Papier hygiénique 12 rouleaux", "pq")).toBe(true);
    expect(matchesQuery("Coca-Cola classique", "coca")).toBe(true);
  });
});

describe("suggest", () => {
  const index = buildSearchIndex([named("Lait 2 %", "Québon"), named("Laitue iceberg")]);

  it("propose le lait et pas la laitue", () => {
    expect(suggest(index, "lait").map((item) => item.name)).toEqual(["Lait 2 %"]);
  });

  it("retrouve un produit déjà indexé", () => {
    const record = index[0];
    expect(matchesPrepared(record, "québon")).toBe(true);
  });
});
