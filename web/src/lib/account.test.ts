import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, checkPassword, createAccount, hashPassword, hashPasswordFnv, normalizeHabits, parsePortable, portableOf, readBook, writeBook } from "./account";
import { emptyNotebook } from "./meals";
import { emptyMemory } from "./memory";

describe("compte", () => {
  it("refuse un mot de passe trop court et une confirmation différente", async () => {
    expect((await createAccount("Émile", "abc", "abc")).ok).toBe(false);
    expect((await createAccount("Émile", "abcd", "abce")).ok).toBe(false);
  });

  it("retient le mot de passe sans le garder en clair", async () => {
    const created = await createAccount("Emma B", "secret", "secret");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.account.name).toBe("Emma B");
    expect(created.account.pass).not.toBe("secret");
    expect(created.account.algo).toBe("sha256");
    expect(created.account.pass).toBe(await hashPassword("secret", created.account.salt));
    expect(await checkPassword(created.account, "secret")).toBe(true);
    expect(await checkPassword(created.account, "autre")).toBe(false);
  });

  it("ouvre encore un verrou enregistré avec l’ancien calcul", async () => {
    const account = { name: "Emma B", salt: "selsel", pass: hashPasswordFnv("secret", "selsel"), habits: null, notebook: emptyNotebook(), memory: emptyMemory() };
    expect(await checkPassword(account, "secret")).toBe(true);
    expect(await checkPassword(account, "autre")).toBe(false);
  });

  it("relit des habitudes valides", () => {
    expect(normalizeHabits({ people: 4.2, meals: 2, diet: "peu", budget: "serre", avoids: ["porc", "porc", "chien"] })).toEqual({
      people: 4,
      small: 4,
      big: 0,
      meals: 2,
      diet: "peu",
      budget: "serre",
      avoids: ["porc"],
      allergens: [],
    });
    expect(normalizeHabits({ people: 2, meals: 1, diet: "tout", budget: "habituel", avoids: [], allergens: ["gluten", "chien"] })).toMatchObject({
      allergens: ["gluten"],
    });
    expect(normalizeHabits({ people: 0, meals: 1, diet: "tout", budget: "large", avoids: [] })).toBeNull();
    expect(normalizeHabits({ people: 2, small: 2, big: Number.NaN, meals: 1, diet: "tout", budget: "habituel", avoids: [] })).toEqual({
      people: 2,
      small: 2,
      big: 0,
      meals: 1,
      diet: "tout",
      budget: "habituel",
      avoids: [],
      allergens: [],
    });
  });

  it("transporte le compte avec sa liste, pas le mot de passe en clair", async () => {
    const created = await createAccount("Léo", "secret", "secret");
    if (!created.ok) return;
    const file = JSON.stringify(portableOf(created.account, [{ id: "lait", qty: 2 }]));
    expect(file).not.toContain("secret");
    const parsed = parsePortable(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.portable.list).toEqual([{ id: "lait", qty: 2 }]);
    expect(await checkPassword(parsed.portable.account, "secret")).toBe(true);
    expect(parsePortable("{").ok).toBe(false);
  });

  it("change le mot de passe et garde le prénom", async () => {
    const created = await createAccount("Léo", "secret", "secret");
    if (!created.ok) return;
    const changed = await changePassword(created.account, "secret", "autre", "autre");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.account.name).toBe("Léo");
    expect(await checkPassword(changed.account, "autre")).toBe(true);
    expect(await checkPassword(changed.account, "secret")).toBe(false);
  });
});

describe("comptes sur l’appareil", () => {
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

  it("reprend l’ancien verrou unique comme un compte", async () => {
    const created = await createAccount("Emma", "secret", "secret");
    if (!created.ok) return;
    mem.set("comparo-compte-v1", JSON.stringify(created.account));
    expect(readBook().map((item) => item.name)).toEqual(["Emma"]);
    expect(mem.has("comparo-compte-v1")).toBe(false);
    expect(readBook()).toHaveLength(1);
  });

  it("laisse deux prénoms côte à côte", async () => {
    const emma = await createAccount("Emma", "secret", "secret");
    const leo = await createAccount("Léo", "secret", "secret");
    if (!emma.ok || !leo.ok) return;
    writeBook([emma.account]);
    writeBook([...readBook(), leo.account]);
    expect(readBook().map((item) => item.name)).toEqual(["Emma", "Léo"]);
  });
});
