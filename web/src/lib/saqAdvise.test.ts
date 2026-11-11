import { describe, expect, it } from "vitest";
import { adviseWines } from "./saqAdvise";
import type { SaqProduct } from "../types";

function wine(partial: Partial<SaqProduct> & Pick<SaqProduct, "id" | "name" | "price">): SaqProduct {
  return {
    sku: partial.id,
    producer: "",
    supplier: "SAQ",
    size: "750 ml",
    category: "Alcool",
    subcategory: "Vin",
    country: "France",
    image: null,
    regular: null,
    url: "",
    barcodes: [],
    lasalle: true,
    lafleche: false,
    ...partial,
  };
}

describe("adviseWines", () => {
  const products = [
    wine({ id: "rouge", name: "Côtes du Rhône", price: 18, colour: "Rouge", pairings: ["Viandes rouges"], country: "France" }),
    wine({ id: "blanc", name: "Sauvignon", price: 14, colour: "Blanc", pairings: ["Poisson"], country: "France" }),
    wine({ id: "cher", name: "Grand cru", price: 60, colour: "Rouge", country: "Italie" }),
  ];

  it("retient un rouge français sous le budget, qui va avec la viande", () => {
    const found = adviseWines(products, { style: "rouge", budget: "25", country: "France", dish: "viande", sweetness: "any" });
    expect(found.map((item) => item.id)).toEqual(["rouge"]);
  });

  it("sépare un blanc sec d’un blanc sucré", () => {
    const found = adviseWines(
      [
        wine({ id: "sec", name: "Sauvignon", price: 16, colour: "Blanc", tasting: "Sucrosité sec · Acidité présente", sugar: "2" }),
        wine({ id: "doux", name: "Sauternes", price: 22, colour: "Blanc", tasting: "Sucrosité doux · Corps ample", sugar: "120" }),
      ],
      { style: "blanc", budget: "25", country: "tous", dish: "any", sweetness: "sec" },
    );
    expect(found.map((item) => item.id)).toEqual(["sec"]);
  });
});
