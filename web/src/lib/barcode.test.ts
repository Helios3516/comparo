import { describe, expect, it } from "vitest";
import { barcodeKeys, buildBarcodeIndex, findByBarcode } from "./barcode";
import type { Product } from "../types";

function product(partial: Partial<Product> & Pick<Product, "id">): Product {
  return {
    name: "Produit",
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

describe("barcodeKeys", () => {
  it("relie le UPC-A et l’EAN-13 du même article", () => {
    expect(barcodeKeys("067000104862")).toEqual(expect.arrayContaining(["067000104862", "67000104862", "0067000104862"]));
    expect(barcodeKeys("0067000104862")).toEqual(expect.arrayContaining(["067000104862"]));
  });

  it("ignore un code trop court", () => {
    expect(barcodeKeys("4011")).toEqual([]);
  });
});

describe("findByBarcode", () => {
  const shared = "067000104862";
  const compared = product({ id: "cmp", exclusive: false, barcodes: [shared] });
  const exclusive = product({ id: "iga", exclusive: true, barcodes: [shared] });
  const index = buildBarcodeIndex([exclusive, compared]);

  it("préfère le produit vendu dans les deux magasins", () => {
    expect(findByBarcode(index, "0067000104862")?.id).toBe("cmp");
  });

  it("ne trouve rien sans code", () => {
    expect(findByBarcode(index, "")).toBeNull();
  });
});
