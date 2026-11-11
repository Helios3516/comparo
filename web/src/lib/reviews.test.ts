import { describe, expect, it } from "vitest";
import { applyReview, averageOf, emptyBook } from "./reviews";

describe("avis Comparo", () => {
  it("refuse une note hors de 1 à 5 et un commentaire vide", () => {
    expect(applyReview(emptyBook(), { sku: "15460261", author: "Ethan", stars: 0, text: "Bon" }).ok).toBe(false);
    expect(applyReview(emptyBook(), { sku: "15460261", author: "Ethan", stars: 4, text: " " }).ok).toBe(false);
  });

  it("garde une note par personne et calcule la moyenne", () => {
    const first = applyReview(emptyBook(), { sku: "15460261", author: "Ethan", stars: 4, text: "Bon avec un fromage." });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyReview(first.book, { sku: "15460261", author: "Léa", stars: 2, text: "Trop boisé pour moi." });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const updated = applyReview(second.book, { sku: "15460261", author: "Ethan", stars: 5, text: "Encore meilleur le lendemain." });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.book["15460261"]).toHaveLength(2);
    expect(updated.book["15460261"].find((item) => item.author === "Ethan")?.stars).toBe(5);
    expect(averageOf(updated.book["15460261"])).toEqual({ average: 3.5, count: 2 });
  });
});
