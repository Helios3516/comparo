import { describe, expect, it } from "vitest";
import { cents, fuelPrice, parseEssence, pinColor } from "./essence";

const payload = {
  city: "Baie-Comeau",
  updatedAt: "2026-11-11T13:01:10.723Z",
  stations: [
    {
      stationId: "a",
      name: "Irving Oil",
      brand: "Irving",
      address: "2929 Bd Laflèche",
      lat: 49.19,
      lng: -68.3,
      prixOrdinaire: 178.9,
      prixSuper: 205.9,
      prixDiesel: 279.9,
      updatedAt: "2026-11-11T13:01:03.741Z",
    },
    {
      stationId: "b",
      name: "Axco",
      brand: "Axco",
      address: "Baie-Comeau",
      lat: 49.21,
      lng: -68.19,
      prixOrdinaire: 187.4,
      prixSuper: null,
      prixDiesel: 279.9,
      updatedAt: "2026-11-06T02:26:04.169Z",
    },
    { name: "Sans coordonnées", prixOrdinaire: 100 },
  ],
  meta: {
    attribution: { url: "https://www.gasquebec.ca/villes/baie-comeau", text: { fr: "Prix : Régie, via Gas Québec" } },
    dataSource: { url: "https://regieessencequebec.ca/" },
  },
};

describe("parseEssence", () => {
  it("garde les stations géolocalisées et marque un relevé ancien", () => {
    const snapshot = parseEssence(payload, true);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.live).toBe(true);
    expect(snapshot?.stations).toHaveLength(2);
    expect(snapshot?.stations[0].aged).toBe(false);
    expect(snapshot?.stations[1].aged).toBe(true);
    expect(fuelPrice(snapshot!.stations[1], "super")).toBeNull();
    expect(snapshot?.attributionUrl).toContain("gasquebec");
  });

  it("refuse un fichier sans stations", () => {
    expect(parseEssence({ stations: [] })).toBeNull();
    expect(parseEssence(null)).toBeNull();
  });
});

describe("affichage des prix", () => {
  it("formate les cents et colore le moins cher en vert", () => {
    expect(cents(178.9)).toBe("178,9 ¢");
    expect(pinColor(178.9, 178.9, 187.4)).toBe("rgb(31, 122, 77)");
    expect(pinColor(187.4, 178.9, 187.4)).toBe("rgb(194, 59, 59)");
  });
});
