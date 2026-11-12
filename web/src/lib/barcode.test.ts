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

  it("relie le CUP SAQ de 14 chiffres au code lu sur la bouteille", () => {
    expect(barcodeKeys("08421950966161")).toEqual(expect.arrayContaining(["08421950966161", "8421950966161"]));
    const wine = product({ id: "vin", exclusive: true, barcodes: ["08421950966161", "15460261"] });
    const index = buildBarcodeIndex([wine]);
    expect(findByBarcode(index, "8421950966161")?.id).toBe("vin");
    expect(findByBarcode(index, "15460261")?.id).toBe("vin");
  });

  it("retrouve une bouteille par son code SAQ de six chiffres", () => {
    const wine = product({ id: "110056", exclusive: true, barcodes: ["00087000001725", "110056"] });
    const index = buildBarcodeIndex([wine]);
    expect(findByBarcode(index, "110056")?.id).toBe("110056");
    expect(findByBarcode(index, "00087000001725")?.id).toBe("110056");
  });

  it("garde un code SAQ court sans le rallonger", () => {
    expect(barcodeKeys("110056")).toEqual(["110056"]);
    expect(barcodeKeys("4011")).toEqual(["4011"]);
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
