import { describe, expect, it } from "vitest";
import { previewBasket, previewSpotlight, previewWine } from "./preview";
import type { Product, SaqProduct } from "../types";

function product(partial: Partial<Product> & Pick<Product, "id" | "name" | "category">): Product {
  return {
    brand: "",
    size: "",
    image: "https://exemple.test/p.jpg",
    maxi: { name: partial.name, price: 4, regular: null, url: "", image: null, size: "" },
    iga: { name: partial.name, price: 6, regular: null, url: "", image: null, size: "" },
    cheaper: "maxi",
    gap: 2,
    gapPct: 0.3,
    dealPct: 0,
    exclusive: false,
    ...partial,
  };
}

function wine(partial: Partial<SaqProduct> & Pick<SaqProduct, "id" | "name">): SaqProduct {
  return {
    sku: partial.id,
    producer: "",
    supplier: "SAQ",
    size: "750 ml",
    category: "Alcool",
    subcategory: "Vin",
    country: "Espagne",
    image: "https://exemple.test/v.jpg",
    price: 12,
    regular: null,
    url: "https://www.saq.com/fr/x",
    barcodes: [],
    lasalle: true,
    lafleche: true,
    ...partial,
  };
}

describe("aperçu", () => {
  const products = [
    product({ id: "petit", name: "Lait 2 %", category: "Produits laitiers", gap: 0.4 }),
    product({ id: "gros", name: "Café moulu colombien 640 g", category: "Épicerie", gap: 14 }),
    product({ id: "pain", name: "Pain 12 grains", category: "Boulangerie", gap: 0.5 }),
    product({ id: "exclu", name: "Café moulu rare", category: "Épicerie", gap: 20, exclusive: true, iga: null }),
  ];

  it("choisit le plus grand écart vendu dans les deux magasins", () => {
    expect(previewSpotlight(products)?.id).toBe("gros");
  });

  it("monte une petite liste de courses", () => {
    const basket = previewBasket(products);
    expect(basket.map((item) => item.id)).toEqual(["pain", "petit", "gros"]);
  });

  it("prend un vin en bouteille présent aux deux SAQ", () => {
    const wines = [
      wine({ id: "can", name: "Sauvignon", size: "250 ml", price: 6 }),
      wine({ id: "une", name: "Merlot", lasalle: false, price: 8 }),
      wine({ id: "ok", name: "Tempranillo", price: 10 }),
    ];
    expect(previewWine(wines)?.id).toBe("ok");
  });
});
