import { describe, expect, it } from "vitest";
import { buildRoadmapPdf } from "./roadmapPdf";
import type { Summary } from "../types";

const summary: Summary = {
  maxiTotal: 5,
  igaTotal: 0,
  maxiMissing: 0,
  igaMissing: 1,
  optimized: 5,
  saved: 0,
  savedPct: 0,
  baselineStore: "maxi",
  versusMaxi: 0,
  versusIga: null,
  saqTotal: 0,
  saqLines: [],
  maxiLines: [
    {
      id: "lait",
      name: "Lait 2 %",
      brand: "Québon",
      size: "2 L",
      category: "Produits laitiers",
      qty: 1,
      unit: 5,
      total: 5,
      image: null,
      tie: false,
      card: null,
    },
  ],
  igaLines: [],
  count: 1,
};

describe("buildRoadmapPdf", () => {
  it("produit une page paysage sans passer par une capture d’écran", () => {
    const pdf = buildRoadmapPdf(summary);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight());
  });
});