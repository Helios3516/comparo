import { describe, expect, it } from "vitest";
import { selectSaq, similarSaq, toProduct } from "./saq";
import type { SaqProduct } from "../types";

function bottle(partial: Partial<SaqProduct> & Pick<SaqProduct, "id" | "name" | "subcategory">): SaqProduct {
  return {
    sku: partial.id,
    producer: "",
    supplier: "SAQ",
    size: "750 ml",
    category: "Alcool",
    country: "",
    image: null,
    price: 20,
    regular: null,
    url: "",
    barcodes: [],
    lasalle: false,
    lafleche: false,
    ...partial,
  };
}

const rouge = bottle({ id: "1", name: "Cuvée du fleuve", subcategory: "Vin", producer: "Domaine", lasalle: true, lafleche: true, price: 18 });
const blanc = bottle({ id: "2", name: "Sauvignon", subcategory: "Vin", lasalle: true, price: 15, country: "France" });
const vodka = bottle({ id: "3", name: "Vodka nordique", subcategory: "Vodka", lafleche: true, price: 40, sku: "14001234" });

describe("selectSaq", () => {
  const products = [rouge, blanc, vodka];

  it("garde un produit SAQ dès qu’il est dans l’inventaire d’une succursale", () => {
    expect(selectSaq(products, { query: "", subcategory: "all", where: "either", sort: "alpha" }).map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("filtre la succursale et la sous-catégorie", () => {
    const found = selectSaq(products, { query: "", subcategory: "Vin", where: "lasalle", sort: "prix" });
    expect(found.map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("retrouve un code SAQ et un nom", () => {
    expect(selectSaq(products, { query: "14001234", subcategory: "all", where: "either", sort: "alpha" }).map((item) => item.id)).toEqual(["3"]);
    expect(selectSaq(products, { query: "sauvignon", subcategory: "all", where: "either", sort: "alpha" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("exige les deux inventaires", () => {
    expect(selectSaq(products, { query: "", subcategory: "all", where: "both", sort: "alpha" }).map((item) => item.id)).toEqual(["1"]);
  });

  it("enregistre le fournisseur SAQ, sans prix Maxi ni IGA", () => {
    const product = toProduct(vodka);
    expect(product.category).toBe("Alcool");
    expect(product.subcategory).toBe("Vodka");
    expect(product.saq?.supplier).toBe("SAQ");
    expect(product.maxi).toBeNull();
    expect(product.iga).toBeNull();
  });

  it("met les mieux notés en premier, même pour un spiritueux", () => {
    const noted = bottle({ id: "4", name: "Whisky noté", subcategory: "Whisky", price: 50 });
    const quiet = bottle({ id: "5", name: "Whisky sans avis", subcategory: "Whisky", price: 30 });
    const found = selectSaq([quiet, noted], {
      query: "",
      subcategory: "Whisky",
      where: "either",
      sort: "note",
      scoreOf: (id) => (id === "4" ? 4.5 : null),
    });
    expect(found.map((item) => item.id)).toEqual(["4", "5"]);
  });
});

describe("similarSaq", () => {
  it("rapproche un vin du même goût et du même pays", () => {
    const source = bottle({ id: "a", name: "Rioja", subcategory: "Vin", country: "Espagne", colour: "Rouge", taste: "Souple", price: 15 });
    const close = bottle({ id: "b", name: "Autre Rioja", subcategory: "Vin", country: "Espagne", colour: "Rouge", taste: "Souple", price: 16 });
    const far = bottle({ id: "c", name: "Blanc français", subcategory: "Vin", country: "France", colour: "Blanc", taste: "Vif", price: 40 });
    expect(similarSaq(source, [source, far, close]).map((item) => item.id)).toEqual(["b", "c"]);
  });
});
