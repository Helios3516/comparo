import { describe, expect, it } from "vitest";
import { emptyArchive, rememberList, rememberSaving, rememberScan } from "./archive";

describe("archive", () => {
  it("garde une liste et ne la duplique pas", () => {
    const lines = [{ id: "lait", name: "Lait", qty: 1 }];
    const once = rememberList(emptyArchive(), lines, 4, 0.5, "2026-11-11T12:00:00.000Z");
    const twice = rememberList(once, lines, 4, 0.5, "2026-11-11T13:00:00.000Z");
    expect(twice.lists).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it("met à jour le montant si les articles sont les mêmes", () => {
    const lines = [{ id: "lait", name: "Lait", qty: 1 }];
    const once = rememberList(emptyArchive(), lines, 4, 0.5, "2026-11-11T12:00:00.000Z");
    const next = rememberList(once, lines, 4.2, 0.7, "2026-11-11T13:00:00.000Z");
    expect(next.lists).toHaveLength(1);
    expect(next.lists[0]?.saved).toBe(0.7);
  });

  it("retient le dernier scan en tête et la meilleure économie", () => {
    const scanned = rememberScan(rememberScan(emptyArchive(), "lait", "Lait", "a"), "pain", "Pain", "b");
    expect(scanned.scans.map((item) => item.name)).toEqual(["Pain", "Lait"]);
    const again = rememberScan(scanned, "lait", "Lait 2 %", "c");
    expect(again.scans.map((item) => item.id)).toEqual(["lait", "pain"]);
    const saved = rememberSaving(rememberSaving(emptyArchive(), 2, "a"), 1, "b");
    expect(saved.best?.amount).toBe(2);
    expect(rememberSaving(saved, 3, "c").best?.amount).toBe(3);
  });
});
