import { describe, expect, it } from "vitest";
import { adjustEaters, buildWeek, eaters, fadedDeals, fold, needsReview, packs, pairPlate, parseRemark, pickProduct, pickWine, reviseWeek, shelfPrice, type Habits } from "./meals";
import type { Product, SaqProduct } from "../types";

function product(partial: Partial<Product> & Pick<Product, "id" | "name" | "category">): Product {
  const price = partial.maxi?.price ?? partial.iga?.price ?? 3;
  return {
    brand: "",
    size: "",
    image: null,
    maxi: { name: partial.name, price, regular: null, url: "", image: null, size: "" },
    iga: { name: partial.name, price: price + 0.4, regular: null, url: "", image: null, size: "" },
    cheaper: "maxi",
    gap: 0.4,
    gapPct: 0,
    dealPct: 0,
    exclusive: false,
    ...partial,
  };
}

function wine(partial: Partial<SaqProduct> & Pick<SaqProduct, "id" | "name" | "price">): SaqProduct {
  return {
    sku: partial.id,
    producer: "",
    supplier: "SAQ",
    size: "750 ml",
    category: "Alcool",
    subcategory: "Vin",
    country: "France",
    image: null,
    regular: null,
    url: "https://www.saq.com/fr/x",
    barcodes: [],
    lasalle: true,
    lafleche: true,
    ...partial,
  };
}

const grocery: Product[] = [
  product({ id: "pain", name: "Pain 12 grains 550 g", category: "Boulangerie", dealPct: 0.4 }),
  product({ id: "lait", name: "Lait 2 % partiellement écrémé 2 L", category: "Produits laitiers", dealPct: 0.2 }),
  product({ id: "lait-cher", name: "Lait 2 % familial 2 L", category: "Produits laitiers", dealPct: 0.45, maxi: { name: "Lait", price: 4, regular: 8, url: "", image: null, size: "2 L" } }),
  product({ id: "oeufs", name: "Oeufs gros naturels 12 un", category: "Autres", dealPct: 0.1 }),
  product({ id: "pates", name: "Pâtes spaghetti 454 g", category: "Épicerie", subcategory: "Pâtes et riz", dealPct: 0.48 }),
  product({ id: "sauce", name: "Sauce pour pâtes tomate et basilic 600 ml", category: "Épicerie", dealPct: 0.35 }),
  product({ id: "soja", name: "Sauce soja 296 ml", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "tartare", name: "Sauce Tartare 354 ml", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "bbq", name: "Sauce barbecue 398 ml", category: "Épicerie", dealPct: 0.2 }),
  product({ id: "coco", name: "Lait de coco 400 ml", category: "Boissons", dealPct: 0.2 }),
  product({ id: "creme", name: "Crème champêtre 35 % 473 ml", category: "Produits laitiers", dealPct: 0.35 }),
  product({ id: "cari", name: "Cari en poudre 130 g", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "pate-cari", name: "Pâte de cari rouge 112 g", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "tomates-des", name: "Tomates en dés 796 ml", category: "Conserves", dealPct: 0.2 }),
  product({ id: "cumin", name: "Cumin moulu 97 g", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "paprika", name: "Paprika moulu 145 g", category: "Autres", dealPct: 0.1 }),
  product({ id: "citron", name: "Citrons frais 908 g", category: "Fruits et légumes", dealPct: 0.15 }),
  product({ id: "beurre", name: "Beurre salé 454 g", category: "Produits laitiers", dealPct: 0.2 }),
  product({ id: "moutarde", name: "Moutarde de Dijon 500 ml", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "ail", name: "Ail en poudre 155 g", category: "Épicerie", dealPct: 0.1 }),
  product({ id: "riz", name: "Riz précuit blanc 2 kg", category: "Épicerie", subcategory: "Pâtes et riz", dealPct: 0.2 }),
  product({ id: "poulet", name: "Poitrine de poulet 600 g", category: "Viandes", dealPct: 0.4 }),
  product({ id: "boeuf", name: "Bavette de boeuf 400 g", category: "Viandes", dealPct: 0.5 }),
  product({ id: "porc", name: "Côtes de porc 585 g", category: "Viandes", dealPct: 0.47 }),
  product({ id: "saumon", name: "Filet de saumon 300 g", category: "Poisson et fruits de mer", dealPct: 0.3 }),
  product({ id: "truite", name: "Filet de truite 300 g", category: "Poisson et fruits de mer", dealPct: 0.2 }),
  product({ id: "brocoli", name: "Brocoli 1 un", category: "Fruits et légumes", subcategory: "Légumes", dealPct: 0.4 }),
  product({ id: "laitue", name: "Laitue Iceberg 1 un", category: "Fruits et légumes", subcategory: "Légumes", dealPct: 0.2 }),
  product({ id: "poivron", name: "Poivrons mélangés 1.14 kg", category: "Fruits et légumes", subcategory: "Légumes", dealPct: 0.3 }),
  product({ id: "patate", name: "Pommes de terre Russet, sac de 10 lb", category: "Fruits et légumes", subcategory: "Légumes", dealPct: 0.2 }),
  product({ id: "lentilles", name: "Lentilles en conserve 540 ml", category: "Conserves", dealPct: 0.33 }),
  product({ id: "pois", name: "Pois chiches en conserve 540 ml", category: "Épicerie", dealPct: 0.4 }),
  product({ id: "tofu", name: "Tofu ferme nature 454 g", category: "Autres", dealPct: 0.2 }),
  product({ id: "haricots", name: "Haricots rouges 540 ml", category: "Autres", dealPct: 0.25 }),
  product({ id: "carottes", name: "Carottes nantaises 454 g", category: "Fruits et légumes", dealPct: 0.1 }),
  product({ id: "epinards", name: "Jeunes épinards 142 g", category: "Fruits et légumes", dealPct: 0.2 }),
  product({ id: "chou", name: "Chou-fleur 1 un", category: "Fruits et légumes", dealPct: 0.3 }),
  product({ id: "chat", name: "Gâteries pour chats saveur de poulet", category: "Animaux", dealPct: 0.9 }),
  product({ id: "soupe", name: "Soupe au poulet et riz 540 ml", category: "Conserves", dealPct: 0.8 }),
];

const wines: SaqProduct[] = [
  wine({ id: "cher", name: "Cabernet Sauvignon Réserve", price: 32 }),
  wine({ id: "cab", name: "Cabernet Sauvignon", price: 15, regular: 22 }),
  wine({ id: "merlot", name: "Merlot", price: 14 }),
  wine({ id: "sauv", name: "Sauvignon Blanc", price: 13 }),
  wine({ id: "piege", name: "Cabernet-Sauvignon", price: 8 }),
  wine({ id: "chard", name: "Chardonnay", price: 18 }),
];

const base: Habits = { people: 4, small: 2, big: 2, meals: 1, diet: "tout", budget: "habituel", avoids: [], allergens: [] };

describe("repas", () => {
  it("enlève les accents pour comparer les noms", () => {
    expect(fold("Bœuf rôti")).toBe("boeuf roti");
    expect(fold("Œufs")).toBe("oeufs");
  });

  it("préfère le rabais, puis le plus bas prix", () => {
    const chosen = pickProduct(grocery, { categories: ["Produits laitiers"], include: /\blait (1|2)\b/ }, new Set());
    expect(chosen?.id).toBe("lait-cher");
    expect(shelfPrice(grocery[1]!)).toBeGreaterThan(0);
  });

  it("ignore la nourriture pour animaux", () => {
    const chosen = pickProduct(grocery, { include: /\bpoulet\b/ }, new Set());
    expect(chosen?.id).toBe("poulet");
  });

  it("sert plus gros quand la tablée a des gros mangeurs", () => {
    const light = buildWeek(grocery, { ...base, people: 2, small: 2, big: 0 });
    const heavy = buildWeek(grocery, { ...base, people: 2, small: 0, big: 2 });
    const lightQty = light.basket.reduce((sum, line) => sum + line.qty, 0);
    const heavyQty = heavy.basket.reduce((sum, line) => sum + line.qty, 0);
    expect(heavyQty).toBeGreaterThan(lightQty);
    expect(heavy.days[0]?.kcal).toBeGreaterThan(400);
    expect(heavy.days[0]?.letter).toMatch(/A|B|C|D/);
  });

  it("ajoute un gros mangeur même si l’ancien foyer n’avait pas ce champ", () => {
    const old = { people: 2, meals: 1, diet: "tout", budget: "habituel", avoids: [] } as unknown as Habits;
    const next = adjustEaters(old, "big", 1);
    expect(next).toMatchObject({ small: 2, big: 1, people: 3 });
    expect(eaters({ ...base, small: Number.NaN, big: Number.NaN }).units).toBeGreaterThan(0);
    const week = buildWeek(grocery, { ...base, small: Number.NaN, big: 1 });
    expect(week.total).not.toBeNaN();
    expect(week.basket.every((line) => Number.isFinite(line.price) && Number.isFinite(line.qty))).toBe(true);
  });

  it("augmente les quantités avec la tablée", () => {
    expect(packs(2, 1, 4)).toBe(1);
    expect(packs(8, 2, 4)).toBeGreaterThan(packs(2, 1, 4));
  });

  it("monte une semaine sans porc ni lactose", () => {
    const week = buildWeek(grocery, { ...base, avoids: ["porc", "lactose"] }, { start: new Date(2026, 10, 9) });
    expect(week.days).toHaveLength(7);
    const names = week.basket.map((line) => line.name).join(" ");
    expect(names).not.toMatch(/\bporc\b/i);
    expect(names).not.toMatch(/\blait [0-9]/i);
    expect(names).not.toMatch(/\bcr[eè]me\b/i);
    expect(names).not.toMatch(/\bbeurre\b/i);
    expect(week.days[0]?.day).toBe("Lundi");
    expect(week.total).toBeGreaterThan(0);
  });

  it("met une sauce sur les plats qui seraient secs", () => {
    const week = buildWeek(grocery, base, { start: new Date(2026, 10, 9) });
    const chicken = week.days.find((day) => day.dishId === "poulet");
    const fish = week.days.find((day) => day.dishId === "saumon" || day.dishId === "poisson");
    expect(chicken?.lines.some((line) => /cari en poudre/i.test(line.name))).toBe(true);
    expect(chicken?.lines.some((line) => /coco|cr[eè]me champ/i.test(line.name))).toBe(true);
    expect(fish?.lines.some((line) => /citron|beurre|moutarde/i.test(line.name))).toBe(true);
  });

  it("suit le filtre d’alimentation", () => {
    const start = new Date(2026, 10, 9);
    const varied = buildWeek(grocery, { ...base, diet: "tout" }, { start, recent: ["poulet", "saumon", "boeuf", "porc", "poisson"] });
    expect(varied.days.some((day) => ["poulet", "boeuf", "porc"].includes(day.dishId))).toBe(true);
    expect(varied.days.some((day) => ["saumon", "poisson"].includes(day.dishId))).toBe(true);
    const fish = buildWeek(grocery, { ...base, diet: "poisson" }, { start });
    expect(fish.days.some((day) => day.dishId === "poulet" || day.dishId === "boeuf" || day.dishId === "porc")).toBe(false);
    expect(fish.days.some((day) => day.dishId === "saumon" || day.dishId === "poisson")).toBe(true);
  });

  it("reste végétarien", () => {
    const week = buildWeek(grocery, { ...base, diet: "vege" });
    expect(week.days).toHaveLength(7);
    expect(week.days.every((day) => /pâtes|lentille|légume|pois|tofu|haricot/i.test(day.title))).toBe(true);
    const lentils = week.days.find((day) => day.dishId === "lentilles");
    const chickpeas = week.days.find((day) => day.dishId === "pois");
    expect(lentils?.lines.some((line) => /lentille/i.test(line.name))).toBe(true);
    expect(lentils?.lines.some((line) => /pois chiche/i.test(line.name))).toBe(false);
    expect(chickpeas?.lines.some((line) => /pois chiche/i.test(line.name))).toBe(true);
    expect(chickpeas?.lines.some((line) => /laitue|pommes de terre/i.test(line.name))).toBe(false);
    expect(week.days.filter((day) => /omelette/i.test(day.title))).toHaveLength(0);
    const names = week.basket.map((line) => fold(line.name)).join(" ");
    expect(names).not.toMatch(/poulet|boeuf|porc|saumon|truite/);
  });

  it("propose un vin sous le plafond et un accompagnement", () => {
    const pairing = pairPlate("boeuf", grocery, wines, { ...base, budget: "serre" });
    expect(pairing?.wine?.id).toBe("cab");
    expect(pairing?.overBudget).toBe(false);
    expect(pairing?.sides.length).toBeGreaterThan(0);
    expect(pickWine(wines, "blanc-vif", "serre")?.id).toBe("sauv");
  });

  it("ne ressert pas les plats de la semaine passée et écarte un refus", () => {
    const week = buildWeek(grocery, base, { start: new Date(2026, 10, 9), recent: ["pates", "poulet"], never: ["porc"] });
    const ids = week.days.map((day) => day.dishId);
    expect(ids).not.toContain("pates");
    expect(ids).not.toContain("poulet");
    expect(ids).not.toContain("porc");
    expect(ids.filter((id) => id === "oeufs")).toHaveLength(0);
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    expect(week.basket[0]?.where).toMatch(/Maxi|IGA/);
  });

  it("écarte le gluten des plats et du pain", () => {
    const week = buildWeek(grocery, { ...base, allergens: ["gluten"] }, { start: new Date(2026, 10, 9) });
    expect(week.days.every((day) => day.dishId !== "pates")).toBe(true);
    const names = week.basket.map((line) => fold(line.name)).join(" ");
    expect(names).not.toMatch(/\bpain\b|\bpates\b/);
  });

  it("change la semaine selon le commentaire", () => {
    const start = new Date(2026, 10, 9);
    const week = buildWeek(grocery, base, { start });
    expect(parseRemark("pas de pâtes").drop).toContain("pates");
    expect(parseRemark("trop de poulet").keepOne).toEqual(["poulet"]);
    expect(parseRemark("bonjour").active).toBe(false);
    const withoutPasta = reviseWeek(grocery, base, week, parseRemark("pas de pâtes"));
    expect(withoutPasta.plan.days.every((day) => day.dishId !== "pates")).toBe(true);
    const friday = reviseWeek(grocery, base, week, parseRemark("je veux plus de poisson vendredi"));
    const fridayDish = friday.plan.days.find((day) => day.day === "Vendredi");
    expect(["saumon", "poisson"]).toContain(fridayDish?.dishId);
    const gluten = reviseWeek(grocery, base, week, parseRemark("sans gluten"));
    const glutenNames = gluten.plan.basket.map((line) => fold(line.name)).join(" ");
    expect(gluten.plan.days.every((day) => day.dishId !== "pates")).toBe(true);
    expect(glutenNames).not.toMatch(/\bpain\b/);
    expect(gluten.changes.length).toBeGreaterThan(0);
  });

  it("laisse revenir plus tard un plat qu’on a aimé", () => {
    const week = buildWeek(grocery, base, { start: new Date(2026, 10, 9), prefer: ["lentilles"] });
    expect(week.days.some((day) => day.dishId === "lentilles")).toBe(true);
  });

  it("n’achète pas ce qui est encore à la maison", () => {
    const week = buildWeek(grocery, base, { pantry: ["pain", "lait-cher", "oeufs"] });
    const ids = week.basket.map((line) => line.id);
    expect(ids).not.toContain("pain");
    expect(ids).not.toContain("lait-cher");
    expect(ids).not.toContain("oeufs");
  });

  it("signale un rabais disparu et demande l’avis le lendemain", () => {
    const notebook = {
      lastSavedAt: "2026-11-10",
      reviewed: false,
      lastDishes: [{ dishId: "pates", title: "Pâtes tomate" }],
      lastLines: [{ id: "pates", name: "Pâtes spaghetti 454 g", deal: true }],
      opinions: [],
      pantry: [],
      weekNote: "",
    };
    expect(needsReview(notebook, "2026-11-11")).toBe(true);
    expect(needsReview({ ...notebook, lastSavedAt: "2026-11-11" }, "2026-11-11")).toBe(false);
    const faded = fadedDeals(notebook, grocery.map((item) => (item.id === "pates" ? { ...item, dealPct: 0 } : item)));
    expect(faded.map((line) => line.id)).toEqual(["pates"]);
  });
});
