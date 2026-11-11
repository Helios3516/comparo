import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { emptyMemory, forYou, normalizeMemory, rememberBuy, setUsualStore, toggleLike, togglePass } from "./memory";

function product(partial: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
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

describe("mémoire", () => {
  it("retient un favori et l’ôte d’un second toucher", () => {
    const liked = toggleLike(emptyMemory(), { id: "lait", name: "Lait" }, "2026-11-11");
    expect(liked.likes.map((item) => item.name)).toEqual(["Lait"]);
    expect(toggleLike(liked, { id: "lait", name: "Lait" }, "2026-11-11").likes).toEqual([]);
  });

  it("un article écarté n’est plus un favori, et l’ajouter à la liste ne le compte pas", () => {
    const liked = toggleLike(emptyMemory(), { id: "lait", name: "Lait" }, "2026-11-11");
    const passed = togglePass(liked, { id: "lait", name: "Lait" }, "2026-11-11");
    expect(passed.likes).toEqual([]);
    expect(passed.passes).toHaveLength(1);
    expect(rememberBuy(passed, { id: "lait", name: "Lait" }, "2026-11-11").repeats).toEqual([]);
  });

  it("compte les reprises et propose d’abord le magasin habituel", () => {
    let memory = setUsualStore(emptyMemory(), "maxi");
    memory = rememberBuy(memory, { id: "pain", name: "Pain" }, "2026-11-11");
    memory = rememberBuy(memory, { id: "pain", name: "Pain" }, "2026-11-11");
    memory = toggleLike(memory, { id: "cafe", name: "Café" }, "2026-11-11");
    const picks = forYou(
      [
        product({ id: "pain", name: "Pain", cheaper: "iga", dealPct: 0.5 }),
        product({ id: "cafe", name: "Café", cheaper: "maxi", dealPct: 0.1 }),
        product({ id: "autre", name: "Autre", dealPct: 0.9 }),
      ],
      memory,
    );
    expect(picks.map((item) => item.id)).toEqual(["cafe", "pain"]);
  });

  it("relit une mémoire incomplète", () => {
    expect(normalizeMemory({ store: "iga", likes: [{ id: "a", name: "A" }, { id: "a", name: "doublon" }], passes: [{ id: "a", name: "A" }] })).toEqual({
      store: "iga",
      likes: [{ id: "a", name: "A", at: "", kind: "epicerie" }],
      passes: [],
      repeats: [],
    });
    expect(normalizeMemory(null)).toEqual(emptyMemory());
  });
});
