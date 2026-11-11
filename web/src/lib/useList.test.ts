import { beforeEach, describe, expect, it, vi } from "vitest";
import { listKey, readList } from "./useList";

const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: (key: string) => {
      mem.delete(key);
    },
  });
});

describe("liste", () => {
  it("range l’ancienne liste sous le prénom, une seule fois", () => {
    mem.set("comparo-liste-v1", JSON.stringify([{ id: "lait", qty: 2 }, { id: "mauvais", qty: 0 }]));
    expect(readList("Emma").map((item) => item.id)).toEqual(["lait"]);
    expect(mem.has("comparo-liste-v1")).toBe(false);
    expect(mem.get(listKey("Emma"))).toContain("lait");
    expect(readList("Léo")).toEqual([]);
  });
});
