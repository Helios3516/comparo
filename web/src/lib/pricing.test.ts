import { describe, expect, it } from "vitest";
import { summarize } from "./pricing";
import type { Product } from "../types";

const product: Product = {
  id: "beurre",
  name: "Beurre",
  brand: "Lactantia",
  size: "454 g",
  category: "Produits laitiers",
  image: null,
  maxi: { name: "Beurre", price: 5, regular: null, url: "", image: null, size: "454 g" },
  iga: { name: "Beurre", price: 6.5, regular: null, url: "", image: null, size: "454 g" },
  cheaper: "maxi",
  gap: 1.5,
  gapPct: 0.23,
  dealPct: 0,
  exclusive: false,
};

describe("summarize", () => {
  it("calcule le parcours le moins cher en cents", () => {
    const summary = summarize([{ id: "beurre", qty: 2 }], new Map([[product.id, product]]));
    expect(summary.maxiTotal).toBe(10);
    expect(summary.igaTotal).toBe(13);
    expect(summary.optimized).toBe(10);
    expect(summary.saved).toBe(0);
    expect(summary.maxiLines).toHaveLength(1);
    expect(summary.igaLines).toHaveLength(0);
    expect(summary.versusIga).toBe(3);
    expect(summary.saqLines).toHaveLength(0);
  });

  it("pose une bouteille SAQ sur la même liste, sans l’attribuer au Maxi ni à l’IGA", () => {
    const wine: Product = {
      ...product,
      id: "1400",
      name: "Sauvignon",
      category: "Alcool",
      subcategory: "Vin",
      maxi: null,
      iga: null,
      cheaper: "egal",
      exclusive: true,
      saq: {
        id: "1400",
        sku: "1400",
        name: "Sauvignon",
        producer: "Domaine",
        supplier: "SAQ",
        size: "750 ml",
        category: "Alcool",
        subcategory: "Vin",
        country: "France",
        image: null,
        price: 16,
        regular: null,
        url: "https://www.saq.com/fr/1400",
        barcodes: [],
        lasalle: true,
        lafleche: false,
      },
    };
    const summary = summarize(
      [{ id: "beurre", qty: 1 }, { id: "1400", qty: 2 }],
      new Map([[product.id, product], [wine.id, wine]]),
    );
    expect(summary.maxiLines.map((line) => line.id)).toEqual(["beurre"]);
    expect(summary.igaLines).toHaveLength(0);
    expect(summary.saqLines).toHaveLength(1);
    expect(summary.saqTotal).toBe(32);
    expect(summary.optimized).toBe(5);
  });
});
