import { advantage } from "./format";
import type { Product, SaqProduct } from "../types";

export type Diet = "tout" | "peu" | "poisson" | "vege";
export type Budget = "serre" | "habituel" | "large";
export type Avoid = "porc" | "boeuf" | "lactose";
export type Allergen = "gluten" | "oeuf" | "arachide" | "fruit-de-mer" | "soja" | "poisson" | "sesame";

export const ALLERGENS: { id: Allergen; label: string }[] = [
  { id: "gluten", label: "Gluten" },
  { id: "oeuf", label: "Œufs" },
  { id: "arachide", label: "Arachides" },
  { id: "fruit-de-mer", label: "Fruits de mer" },
  { id: "soja", label: "Soya" },
  { id: "poisson", label: "Poisson" },
  { id: "sesame", label: "Sésame" },
];

export type Habits = {
  people: number;
  small: number;
  big: number;
  meals: 1 | 2;
  diet: Diet;
  budget: Budget;
  avoids: Avoid[];
  allergens: Allergen[];
};

export type WineKind = "rouge-costaud" | "rouge-souple" | "blanc-vif" | "blanc-rond";

export type PlanLine = {
  id: string;
  name: string;
  role: string;
  qty: number;
  unit: number;
  price: number;
  deal: boolean;
  where: string;
  image: string | null;
};

export type PlanDay = {
  id: string;
  dishId: string;
  day: string;
  title: string;
  note: string;
  wine: string;
  busy: boolean;
  lunchNote: string;
  letter: "A" | "B" | "C" | "D";
  kcal: number;
  image: string | null;
  steps: string[];
  lines: PlanLine[];
};

export type WeekPlan = {
  days: PlanDay[];
  staples: PlanLine[];
  basket: PlanLine[];
  total: number;
};

export type DishVerdict = "refaire" | "plus-tard" | "jamais";

export type Notebook = {
  lastSavedAt: string | null;
  reviewed: boolean;
  lastDishes: { dishId: string; title: string }[];
  lastLines: { id: string; name: string; deal: boolean }[];
  opinions: { dishId: string; title: string; verdict: DishVerdict }[];
  pantry: { id: string; name: string }[];
  weekNote: string;
};

const VERDICTS = new Set<DishVerdict>(["refaire", "plus-tard", "jamais"]);

export function emptyNotebook(): Notebook {
  return { lastSavedAt: null, reviewed: true, lastDishes: [], lastLines: [], opinions: [], pantry: [], weekNote: "" };
}

export function normalizeNotebook(value: unknown): Notebook {
  const blank = emptyNotebook();
  if (!value || typeof value !== "object") return blank;
  const raw = value as Partial<Notebook>;
  const lastDishes = Array.isArray(raw.lastDishes)
    ? raw.lastDishes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const dishId = (item as { dishId?: unknown }).dishId;
        const title = (item as { title?: unknown }).title;
        if (typeof dishId !== "string" || typeof title !== "string") return [];
        return [{ dishId, title }];
      })
    : [];
  const lastLines = Array.isArray(raw.lastLines)
    ? raw.lastLines.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const id = (item as { id?: unknown }).id;
        const name = (item as { name?: unknown }).name;
        const deal = (item as { deal?: unknown }).deal;
        if (typeof id !== "string" || typeof name !== "string" || typeof deal !== "boolean") return [];
        return [{ id, name, deal }];
      })
    : [];
  const opinions = Array.isArray(raw.opinions)
    ? raw.opinions.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const dishId = (item as { dishId?: unknown }).dishId;
        const title = (item as { title?: unknown }).title;
        const verdict = (item as { verdict?: unknown }).verdict;
        if (typeof dishId !== "string" || typeof title !== "string" || !VERDICTS.has(verdict as DishVerdict)) return [];
        return [{ dishId, title, verdict: verdict as DishVerdict }];
      })
    : [];
  const pantry = Array.isArray(raw.pantry)
    ? raw.pantry.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const id = (item as { id?: unknown }).id;
        const name = (item as { name?: unknown }).name;
        if (typeof id !== "string" || typeof name !== "string") return [];
        return [{ id, name }];
      })
    : [];
  return {
    lastSavedAt: typeof raw.lastSavedAt === "string" ? raw.lastSavedAt : null,
    reviewed: raw.reviewed !== false,
    lastDishes,
    lastLines,
    opinions,
    pantry,
    weekNote: typeof raw.weekNote === "string" ? raw.weekNote.trim().slice(0, 400) : "",
  };
}

export function todayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function needsReview(notebook: Notebook, today = todayKey()) {
  return notebook.lastDishes.length > 0 && !notebook.reviewed && notebook.lastSavedAt !== today;
}

export function rememberWeek(notebook: Notebook, plan: WeekPlan, today = todayKey()): Notebook {
  const seen = new Set<string>();
  const lastDishes = plan.days.flatMap((day) => {
    if (seen.has(day.dishId)) return [];
    seen.add(day.dishId);
    return [{ dishId: day.dishId, title: day.title }];
  });
  return {
    ...notebook,
    lastSavedAt: today,
    reviewed: false,
    lastDishes,
    lastLines: plan.basket.map((line) => ({ id: line.id, name: line.name, deal: line.deal })),
    pantry: notebook.pantry,
    weekNote: notebook.weekNote,
  };
}

export function fadedDeals(notebook: Notebook, products: Product[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return notebook.lastLines.filter((line) => {
    if (!line.deal) return false;
    const product = byId.get(line.id);
    return product != null && product.dealPct < 0.3;
  });
}

export type Pairing = {
  plate: string;
  why: string;
  style: string;
  wine: SaqProduct | null;
  overBudget: boolean;
  sides: PlanLine[];
};

type Need = {
  categories?: string[];
  include: RegExp;
  exclude?: RegExp;
  maxPrice?: number;
};

type Slot = Need & {
  role: string;
  feeds: number;
  core?: boolean;
};

type Dish = {
  id: string;
  title: string;
  note: string;
  wine: WineKind;
  kind: "viande" | "poisson" | "vege";
  blocks: Avoid[];
  allergens: Allergen[];
  family: "pates" | "riz" | "patate";
  letter: "A" | "B" | "C" | "D";
  kcal: number;
  slots: Slot[];
};

const SKIP_CATEGORY = new Set(["Animaux", "Bébé", "Soins et maison"]);
const SKIP_NAME = /chat|chien|bebe|nourriture pour|gaterie|cereale|biscuit|chocolat|creme glacee|vinaigre|dentifrice|shampoing|sandwich|soupe|potage|bouillon|gerber|puree|compote|heure du repas/;

const WINE_TERMS: Record<WineKind, string[]> = {
  "rouge-costaud": ["cabernet", "syrah", "shiraz", "malbec", "tempranillo"],
  "rouge-souple": ["pinot noir", "gamay", "merlot"],
  "blanc-vif": ["sauvignon", "pinot gris", "riesling", "albarino", "verdejo"],
  "blanc-rond": ["chardonnay", "viognier"],
};

export const WINE_LABEL: Record<WineKind, string> = {
  "rouge-costaud": "Un rouge charpenté, cabernet, syrah ou malbec",
  "rouge-souple": "Un rouge souple, merlot ou pinot noir",
  "blanc-vif": "Un blanc vif, sauvignon ou pinot gris",
  "blanc-rond": "Un blanc rond, chardonnay",
};

const WINE_CAP: Record<Budget, number> = { serre: 16, habituel: 24, large: 40 };

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const tomate: Need = {
  categories: ["Épicerie", "Conserves"],
  include: /sauce pour pates tomate|sauce tomates? et basilic|tomate et basilic/,
  exclude: /alfredo|fromage|vodka|boeuf|porc|saucisse|champignon|carbonara|pesto/,
};
const onctueux: Need = {
  include: /creme champetre|lait de coco/,
  exclude: /savon|framboise|kefir|yogourt|glace|dessert|fouetter|cafe/,
};
const coco: Need = {
  categories: ["Boissons", "Épicerie"],
  include: /lait de coco/,
  exclude: /savon|framboise|kefir|yogourt|glace|dessert/,
};
const creme: Need = {
  categories: ["Produits laitiers"],
  include: /creme champetre|creme 35/,
  exclude: /fouetter|cafe|dessert/,
};
const cari: Need = {
  categories: ["Épicerie"],
  include: /cari en poudre|curry en poudre/,
  exclude: /pate|salade|sauce/,
};
const pateCari: Need = {
  categories: ["Épicerie"],
  include: /pate de cari/,
  exclude: /salade/,
};
const tomatesDes: Need = {
  categories: ["Conserves"],
  include: /tomates en des/,
  exclude: /soupe|sauce|pates/,
};
const cumin: Need = {
  categories: ["Épicerie"],
  include: /cumin moulu/,
  exclude: /huile|graines/,
};
const paprika: Need = {
  categories: ["Autres", "Épicerie"],
  include: /paprika moulu|^paprika\b/,
  exclude: /aile|poulet|chips/,
};
const citron: Need = {
  categories: ["Fruits et légumes"],
  include: /\bcitrons?\b/,
  exclude: /jus|gateau|confiture/,
};
const beurre: Need = {
  categories: ["Produits laitiers"],
  include: /^beurre\b/,
  exclude: /arachide|amande|vegetal/,
};
const moutarde: Need = {
  categories: ["Épicerie"],
  include: /moutarde de dijon|moutarde a l.ancienne/,
  exclude: /miel|erable/,
};
const ail: Need = {
  categories: ["Épicerie"],
  include: /ail en poudre/,
  exclude: /sauce|huile/,
};
const pates: Need = {
  categories: ["Épicerie"],
  include: /\b(spaghetti|spaghettini|penne|fusilli)\b/,
  exclude: /riz|pate de|campagne|fromage/,
};
const riz: Need = {
  categories: ["Épicerie"],
  include: /riz precuit|riz basmati|riz jasmin|\briz blanc\b|riz a grains longs/,
  exclude: /spaghetti|macaroni|fusilli|penne|pate|cafe|soupe|galette|vinaigre|collant|bistro|accompagnement/,
};
const patate: Need = { categories: ["Fruits et légumes"], include: /pommes de terre|patate sucree|patates/ };
const brocoli: Need = { categories: ["Fruits et légumes"], include: /\bbrocoli\b/ };
const poivron: Need = { categories: ["Fruits et légumes"], include: /\bpoivron/ };
const laitue: Need = { categories: ["Fruits et légumes"], include: /\blaitue\b/ };
const poulet: Need = {
  categories: ["Viandes", "Surgelés"],
  include: /poitrine de poulet|pilons de poulet|pilon de poulet|cuisse de poulet|haut de cuisse/,
  exclude: /pann|pane|nugget|pepite|popcorn|burger|fume|tranche|farci|moutarde|cornichon|aile|soupe|sauce|cuit/,
  maxPrice: 18,
};
const boeuf: Need = {
  categories: ["Viandes", "Surgelés"],
  include: /\bbavette\b|\bboeuf hache\b/,
  exclude: /sauce|bouillon|melange|soupe|pate |nouille|fondue|puree|gerber|plantes|avocat|vegetal|veggie|chien|galette/,
  maxPrice: 18,
};
const porc: Need = {
  categories: ["Viandes", "Surgelés"],
  include: /\b(cotes de porc|cotelettes? de porc|cotelettes? de longe de porc)\b/,
  exclude: /sauce|melange|pate |sandwich|bouillon|hache|korean|bbq|mijote/,
  maxPrice: 18,
};
const saumon: Need = {
  categories: ["Poisson et fruits de mer", "Surgelés"],
  include: /filet de saumon|filets saumon/,
  exclude: /pate |tartinade|rillette|\bbol\b|tube|fume|saumure/,
  maxPrice: 18,
};
const poisson: Need = {
  categories: ["Poisson et fruits de mer", "Surgelés"],
  include: /filet de truite|filets de truite|filet d.aiglefin|filets d.aiglefin/,
  exclude: /pane|croustillant|anglaise|rillette|tartinade|assaisonnement|sauce/,
  maxPrice: 18,
};
const lentilles: Need = {
  categories: ["Épicerie", "Conserves"],
  include: /\blentilles?\b/,
  exclude: /soupe|potage|burger|salade|farine|pois/,
};
const poisChiches: Need = {
  categories: ["Épicerie", "Conserves"],
  include: /\bpois chiches?\b/,
  exclude: /farine|burger|au beurre|sauce style|soupe/,
};
const haricots: Need = {
  categories: ["Épicerie", "Conserves", "Autres"],
  include: /haricots rouges/,
  exclude: /soupe|riz et|sauce/,
};
const tofu: Need = {
  categories: ["Autres"],
  include: /\btofu\b/,
  exclude: /dessert|tartinade|ramen|miso/,
};
const carotte: Need = {
  categories: ["Fruits et légumes"],
  include: /\bcarottes?\b/,
  exclude: /jus|gateau|soupe/,
};
const epinard: Need = {
  categories: ["Fruits et légumes"],
  include: /epinard/,
  exclude: /salade|craquelin|trempette/,
};
const chou: Need = {
  categories: ["Fruits et légumes"],
  include: /chou-fleur|chou fleur/,
  exclude: /\briz\b/,
};
const oeufs: Need = {
  categories: ["Autres"],
  include: /\boeufs?\b/,
  exclude: /liquide|blanc|chocolat|brouill|nouille|sandwich|gruau|dinos|bouchee/,
};
const pain: Need = { categories: ["Boulangerie"], include: /^pain\b/, exclude: /croque/ };
const lait: Need = {
  categories: ["Produits laitiers"],
  include: /\blait (1|2)\b/,
  exclude: /chocolat|cafe|glace|amande|coco|sans produits laitiers/,
};

const DISHES: Dish[] = [
  {
    id: "pates",
    title: "Pâtes tomate et brocoli",
    note: "Spaghetti, sauce tomate et un légume vert. Un souper complet, pas seulement des pâtes.",
    wine: "rouge-souple",
    kind: "vege",
    blocks: [],
    allergens: ["gluten"],
    family: "pates",
    letter: "B",
    kcal: 560,
    slots: [
      { role: "Féculent", feeds: 3, core: true, ...pates },
      { role: "Sauce", feeds: 4, core: true, ...tomate },
      { role: "Légume", feeds: 3, ...brocoli },
    ],
  },
  {
    id: "poulet",
    title: "Poulet au cari",
    note: "Le poulet mijote avec du riz, du brocoli et une sauce cari faite avec de la crème ou du lait de coco.",
    wine: "blanc-rond",
    kind: "viande",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "B",
    kcal: 620,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...poulet },
      { role: "Féculent", feeds: 6, ...riz },
      { role: "Légume", feeds: 3, ...brocoli },
      { role: "Sauce", feeds: 4, ...onctueux },
      { role: "Sauce", feeds: 12, ...cari },
    ],
  },
  {
    id: "saumon",
    title: "Saumon au beurre citronné",
    note: "Le saumon est nappé d’un beurre citronné, avec des patates et du brocoli.",
    wine: "blanc-vif",
    kind: "poisson",
    blocks: [],
    allergens: ["poisson"],
    family: "patate",
    letter: "A",
    kcal: 580,
    slots: [
      { role: "Protéine", feeds: 2, core: true, ...saumon },
      { role: "Féculent", feeds: 4, ...patate },
      { role: "Légume", feeds: 3, ...brocoli },
      { role: "Sauce", feeds: 8, ...beurre },
      { role: "Sauce", feeds: 4, ...citron },
    ],
  },
  {
    id: "boeuf",
    title: "Pâtes à la viande",
    note: "Du bœuf haché ou une bavette, des pâtes et une sauce tomate.",
    wine: "rouge-costaud",
    kind: "viande",
    blocks: ["boeuf"],
    allergens: ["gluten"],
    family: "pates",
    letter: "C",
    kcal: 680,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...boeuf },
      { role: "Féculent", feeds: 3, core: true, ...pates },
      { role: "Sauce", feeds: 4, ...tomate },
    ],
  },
  {
    id: "porc",
    title: "Côtelettes à la moutarde",
    note: "Les côtelettes prennent une sauce moutarde à la crème, avec des patates et des carottes.",
    wine: "rouge-souple",
    kind: "viande",
    blocks: ["porc"],
    allergens: [],
    family: "patate",
    letter: "C",
    kcal: 700,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...porc },
      { role: "Féculent", feeds: 4, ...patate },
      { role: "Légume", feeds: 4, ...carotte },
      { role: "Sauce", feeds: 8, ...moutarde },
      { role: "Sauce", feeds: 4, ...creme },
    ],
  },
  {
    id: "poisson",
    title: "Truite, sauce moutarde",
    note: "La truite est servie avec une sauce moutarde à la crème, des patates et des épinards.",
    wine: "blanc-vif",
    kind: "poisson",
    blocks: [],
    allergens: ["poisson"],
    family: "patate",
    letter: "A",
    kcal: 520,
    slots: [
      { role: "Protéine", feeds: 2, core: true, ...poisson },
      { role: "Féculent", feeds: 4, ...patate },
      { role: "Légume", feeds: 4, ...epinard },
      { role: "Sauce", feeds: 8, ...moutarde },
      { role: "Sauce", feeds: 4, ...creme },
    ],
  },
  {
    id: "lentilles",
    title: "Lentilles tomate et cumin",
    note: "Les lentilles mijotent dans des tomates en dés et du cumin, avec des carottes et du riz.",
    wine: "rouge-souple",
    kind: "vege",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "A",
    kcal: 540,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...lentilles },
      { role: "Féculent", feeds: 6, ...riz },
      { role: "Légume", feeds: 4, ...carotte },
      { role: "Sauce", feeds: 4, ...tomatesDes },
      { role: "Sauce", feeds: 12, ...cumin },
    ],
  },
  {
    id: "pois",
    title: "Pois chiches au cari coco",
    note: "Les pois chiches cuisent dans du lait de coco et une pâte de cari, avec du riz et des poivrons.",
    wine: "rouge-souple",
    kind: "vege",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "A",
    kcal: 560,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...poisChiches },
      { role: "Féculent", feeds: 6, ...riz },
      { role: "Légume", feeds: 4, ...poivron },
      { role: "Sauce", feeds: 4, ...coco },
      { role: "Sauce", feeds: 8, ...pateCari },
    ],
  },
  {
    id: "tofu",
    title: "Tofu au paprika",
    note: "Le tofu dore dans une sauce paprika liée à la crème ou au lait de coco, avec du riz et du brocoli.",
    wine: "blanc-vif",
    kind: "vege",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "A",
    kcal: 480,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...tofu },
      { role: "Féculent", feeds: 6, ...riz },
      { role: "Légume", feeds: 3, ...brocoli },
      { role: "Sauce", feeds: 4, ...onctueux },
      { role: "Sauce", feeds: 12, ...paprika },
    ],
  },
  {
    id: "haricots",
    title: "Haricots à la tomate",
    note: "Les haricots mijotent avec des tomates en dés, du paprika, du riz et des poivrons.",
    wine: "rouge-souple",
    kind: "vege",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "A",
    kcal: 560,
    slots: [
      { role: "Protéine", feeds: 3, core: true, ...haricots },
      { role: "Féculent", feeds: 6, ...riz },
      { role: "Légume", feeds: 4, ...poivron },
      { role: "Sauce", feeds: 4, ...tomatesDes },
      { role: "Sauce", feeds: 12, ...paprika },
    ],
  },
  {
    id: "legumes",
    title: "Sauté de légumes au beurre à l'ail",
    note: "Le brocoli et le chou-fleur sont sautés au beurre et à l'ail, servis avec du riz.",
    wine: "blanc-vif",
    kind: "vege",
    blocks: [],
    allergens: [],
    family: "riz",
    letter: "A",
    kcal: 480,
    slots: [
      { role: "Féculent", feeds: 6, core: true, ...riz },
      { role: "Légume", feeds: 3, core: true, ...brocoli },
      { role: "Légume", feeds: 3, ...chou },
      { role: "Sauce", feeds: 8, ...beurre },
      { role: "Sauce", feeds: 12, ...ail },
    ],
  },
  {
    id: "epinards",
    title: "Pâtes aux épinards",
    note: "Des pâtes, une sauce tomate et des épinards.",
    wine: "rouge-souple",
    kind: "vege",
    blocks: [],
    allergens: ["gluten"],
    family: "pates",
    letter: "B",
    kcal: 540,
    slots: [
      { role: "Féculent", feeds: 3, core: true, ...pates },
      { role: "Sauce", feeds: 4, ...tomate },
      { role: "Légume", feeds: 4, core: true, ...epinard },
    ],
  },
];

export const PLATES: { id: string; label: string; wine: WineKind; why: string; slots: Slot[] }[] = [
  {
    id: "boeuf",
    label: "Du bœuf",
    wine: "rouge-costaud",
    why: "Le tannin d’un rouge charpenté tient tête au goût de la viande.",
    slots: [
      { role: "Accompagnement", feeds: 4, ...patate },
      { role: "Légume", feeds: 4, ...laitue },
    ],
  },
  {
    id: "poulet",
    label: "Du poulet",
    wine: "blanc-rond",
    why: "Un chardonnay suit le poulet sans l’écraser. Un rouge souple marche aussi.",
    slots: [
      { role: "Accompagnement", feeds: 6, ...riz },
      { role: "Légume", feeds: 3, ...brocoli },
    ],
  },
  {
    id: "porc",
    label: "Du porc",
    wine: "rouge-souple",
    why: "Un merlot ou un pinot noir reste fruité à côté du porc.",
    slots: [
      { role: "Accompagnement", feeds: 4, ...patate },
      { role: "Légume", feeds: 4, ...poivron },
    ],
  },
  {
    id: "poisson",
    label: "Du poisson",
    wine: "blanc-vif",
    why: "Un sauvignon ou un pinot gris coupe le gras du poisson.",
    slots: [
      { role: "Accompagnement", feeds: 4, ...patate },
      { role: "Légume", feeds: 4, ...laitue },
    ],
  },
  {
    id: "pates",
    label: "Des pâtes",
    wine: "rouge-souple",
    why: "La tomate appelle un rouge léger, merlot ou pinot noir.",
    slots: [
      { role: "Pâtes", feeds: 3, ...pates },
      { role: "Sauce", feeds: 4, ...tomate },
    ],
  },
  {
    id: "vege",
    label: "Un plat de légumes",
    wine: "blanc-vif",
    why: "Un blanc vif laisse les légumes au premier plan.",
    slots: [
      { role: "Base", feeds: 3, ...lentilles },
      { role: "Légume", feeds: 3, ...brocoli },
    ],
  },
];

export function fold(value: string) {
  return value
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function shelfPrice(product: Product) {
  const prices = [product.maxi?.price, product.iga?.price].filter((price): price is number => typeof price === "number" && price > 0);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}

function finiteInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function eaters(habits: Habits) {
  const smallRaw = finiteInt(habits.small);
  const bigRaw = finiteInt(habits.big);
  const people = finiteInt(habits.people) ?? 1;
  let small = smallRaw ?? 0;
  let big = bigRaw ?? 0;
  if ((smallRaw == null && bigRaw == null) || small + big < 1) {
    small = Math.min(8, Math.max(1, people));
    big = 0;
  }
  return { small, big, units: small * 0.8 + big * 1.35 };
}

export function withEaters(current: Habits): Habits {
  const table = eaters(current);
  const allergens = Array.isArray(current.allergens) ? current.allergens : [];
  return { ...current, small: table.small, big: table.big, people: table.small + table.big, allergens };
}

export function adjustEaters(current: Habits, key: "small" | "big", delta: number): Habits {
  const base = withEaters(current);
  const small = Math.max(0, base.small + (key === "small" ? delta : 0));
  const big = Math.max(0, base.big + (key === "big" ? delta : 0));
  const total = small + big;
  if (total < 1 || total > 8) return base;
  return { ...base, small, big, people: total };
}

export function packs(people: number, meals: 1 | 2, feeds: number) {
  const servings = people * (meals === 2 ? 1.6 : 1);
  return Math.min(6, Math.max(1, Math.ceil(servings / feeds)));
}

function packsFor(habits: Habits, feeds: number) {
  const servings = eaters(habits).units * (habits.meals === 2 ? 1.6 : 1);
  return Math.min(6, Math.max(1, Math.ceil(servings / feeds)));
}

const ALLERGEN_NAME: Record<Allergen, RegExp> = {
  gluten: /\b(pate|pates|spaghetti|penne|macaroni|linguine|lasagne|couscous|ble|farine|chapelure|pain|bagel|tortilla|nouille)\b/,
  oeuf: /\boeufs?\b/,
  arachide: /arachide|cacahuete/,
  "fruit-de-mer": /crevette|moule|palourde|crabe|homard|calmar|fruit de mer/,
  soja: /\b(soja|soya|tofu)\b/,
  poisson: /saumon|truite|aiglefin|morue|thon|poisson|crevette/,
  sesame: /sesame/,
};

function hitsAllergen(name: string, allergen: Allergen) {
  if (allergen === "gluten" && /sans gluten/.test(name)) return false;
  return ALLERGEN_NAME[allergen].test(name);
}

export function pickProduct(products: Product[], need: Need, used: Set<string>, allergens: Allergen[] = [], avoids: Avoid[] = []) {
  const ranked = products.filter((product) => {
    if (used.has(product.id) || SKIP_CATEGORY.has(product.category)) return false;
    const name = fold(`${product.name} ${product.brand}`);
    if (SKIP_NAME.test(name) || !need.include.test(name)) return false;
    if (allergens.some((item) => hitsAllergen(name, item))) return false;
    if (avoids.includes("lactose") && /creme|beurre|fromage|yogourt|\blait\b/.test(name) && !/lait de coco|sans lactose/.test(name)) return false;
    if (need.exclude?.test(name)) return false;
    return Number.isFinite(shelfPrice(product));
  });
  const affordable = need.maxPrice ? ranked.filter((product) => shelfPrice(product) <= need.maxPrice!) : ranked;
  const pool = affordable.length ? affordable : ranked;
  pool.sort((left, right) => {
    if (need.categories?.length) {
      const leftAisle = need.categories.includes(left.category) ? 1 : 0;
      const rightAisle = need.categories.includes(right.category) ? 1 : 0;
      if (leftAisle !== rightAisle) return rightAisle - leftAisle;
    }
    if (!affordable.length && need.maxPrice) return shelfPrice(left) - shelfPrice(right) || left.name.localeCompare(right.name, "fr");
    const leftDeal = left.dealPct >= 0.3 ? 1 : 0;
    const rightDeal = right.dealPct >= 0.3 ? 1 : 0;
    if (leftDeal !== rightDeal) return rightDeal - leftDeal;
    if (Math.abs(right.dealPct - left.dealPct) > 0.05) return right.dealPct - left.dealPct;
    return shelfPrice(left) - shelfPrice(right) || left.name.localeCompare(right.name, "fr");
  });
  return pool[0] ?? null;
}

function lineFrom(product: Product, role: string, qty: number): PlanLine {
  const unit = shelfPrice(product);
  return {
    id: product.id,
    name: product.name,
    role,
    qty,
    unit,
    price: Math.round(unit * qty * 100) / 100,
    deal: product.dealPct >= 0.3,
    where: advantage(product),
    image: product.image,
  };
}

function wineDiscount(product: SaqProduct) {
  if (product.regular == null || product.regular <= product.price) return 0;
  return (product.regular - product.price) / product.regular;
}

function wineMatches(name: string, kind: WineKind) {
  if (kind === "blanc-vif" && name.includes("cabernet")) return false;
  return WINE_TERMS[kind].some((term) => name.includes(term));
}

export function pickWine(wines: SaqProduct[], kind: WineKind, budget: Budget) {
  const matches = wines.filter((wine) => {
    if (wine.category !== "Alcool") return false;
    if (wine.subcategory !== "Vin" && wine.subcategory !== "Mousseux") return false;
    return wineMatches(fold(wine.name), kind);
  });
  if (!matches.length) return null;
  const cap = WINE_CAP[budget];
  const under = matches.filter((wine) => wine.price <= cap);
  const pool = under.length ? under : matches;
  return [...pool].sort((left, right) => {
    const leftBottle = /750/.test(left.size) ? 0 : 1;
    const rightBottle = /750/.test(right.size) ? 0 : 1;
    if (leftBottle !== rightBottle) return leftBottle - rightBottle;
    return wineDiscount(right) - wineDiscount(left) || left.price - right.price || left.name.localeCompare(right.name, "fr");
  })[0];
}

const cafe: Need = {
  categories: ["Épicerie", "Autres"],
  include: /cafe moulu|cafe filtre|\bcafe\b/,
  exclude: /glace|capsule|decaf|chocolat|latte/,
};

export type TemplateId = "habitude" | "lunch" | "invite";

export const TEMPLATES: { id: TemplateId; label: string; text: string }[] = [
  { id: "habitude", label: "Chaque semaine", text: "Pain, lait, œufs et café, au magasin le moins cher." },
  { id: "lunch", label: "Boîtes à lunch", text: "De quoi remplir les midis sans racheter un souper complet." },
  { id: "invite", label: "Quelqu’un vient souper", text: "Un plat en rabais pour deux personnes de plus." },
];

export function buildTemplate(id: TemplateId, products: Product[], habits: Habits): PlanLine[] {
  const used = new Set<string>();
  if (id === "habitude") {
    const slots: Slot[] = [
      { role: "Pain", feeds: 5, ...pain },
      { role: "Œufs", feeds: 4, ...oeufs },
      { role: "Café", feeds: 8, ...cafe },
    ];
    if (!habits.avoids.includes("lactose")) slots.splice(1, 0, { role: "Lait", feeds: 4, ...lait });
    return fillSlots(products, slots, { ...habits, meals: 1 }, used);
  }
  if (id === "lunch") {
    return fillSlots(
      products,
      [
        { role: "Pain", feeds: 4, ...pain },
        { role: "Œufs", feeds: 3, ...oeufs },
        { role: "Légume", feeds: 4, ...laitue },
      ],
      { ...habits, meals: 1 },
      used,
    );
  }
  const table = eaters(habits);
  const guests = {
    ...habits,
    small: Math.min(8, table.small + 2),
    big: table.big,
    people: Math.min(8, table.small + table.big + 2),
  };
  const dish = DISHES.find((item) => item.id === "poulet" && eligible(item, guests)) ?? DISHES.find((item) => eligible(item, guests));
  if (!dish) return [];
  return fillSlots(products, dish.slots, guests, used);
}

function eligible(dish: Dish, habits: Habits) {
  if (dish.blocks.some((block) => habits.avoids.includes(block))) return false;
  if (dish.allergens.some((item) => habits.allergens?.includes(item))) return false;
  if (habits.diet === "vege") return dish.kind === "vege";
  if (habits.diet === "poisson") return dish.kind !== "viande";
  return true;
}

const MENU: Record<Diet, { viande: number; poisson: number; vege: number }> = {
  tout: { viande: 3, poisson: 2, vege: 2 },
  peu: { viande: 2, poisson: 2, vege: 3 },
  poisson: { viande: 0, poisson: 3, vege: 4 },
  vege: { viande: 0, poisson: 0, vege: 7 },
};

function rankDishes(dishes: Dish[], seed: number, recent: Set<string>, prefer: Set<string>) {
  return rotate(dishes, seed).sort((left, right) => {
    const leftPrefer = prefer.has(left.id) && !recent.has(left.id) ? 0 : 1;
    const rightPrefer = prefer.has(right.id) && !recent.has(right.id) ? 0 : 1;
    if (leftPrefer !== rightPrefer) return leftPrefer - rightPrefer;
    const leftRecent = recent.has(left.id) ? 1 : 0;
    const rightRecent = recent.has(right.id) ? 1 : 0;
    return leftRecent - rightRecent;
  });
}

function dishesForDiet(dishes: Dish[], diet: Diet, seed: number, recent: Set<string>, prefer: Set<string>) {
  const quota = MENU[diet];
  const picked: Dish[] = [];
  const used = new Set<string>();
  for (const kind of ["viande", "poisson", "vege"] as const) {
    const group = rankDishes(
      dishes.filter((dish) => dish.kind === kind),
      seed,
      recent,
      prefer,
    );
    const fresh = group.filter((dish) => !recent.has(dish.id));
    const again = group.filter((dish) => recent.has(dish.id));
    const chosen = fresh.slice(0, quota[kind]);
    if (chosen.length === 0) chosen.push(...again.slice(0, Math.min(2, quota[kind])));
    for (const dish of chosen) {
      picked.push(dish);
      used.add(dish.id);
    }
  }
  const extra = rankDishes(
    dishes.filter((dish) => !used.has(dish.id) && !recent.has(dish.id) && (diet !== "peu" || dish.kind !== "viande")),
    seed,
    recent,
    prefer,
  );
  const backup = rankDishes(
    dishes.filter((dish) => !used.has(dish.id) && recent.has(dish.id)),
    seed,
    recent,
    prefer,
  );
  return [...mix([...picked, ...extra]), ...backup];
}

function mix(dishes: Dish[]) {
  const buckets = [
    dishes.filter((dish) => dish.kind === "viande"),
    dishes.filter((dish) => dish.kind === "poisson"),
    dishes.filter((dish) => dish.kind === "vege"),
  ];
  const ordered: Dish[] = [];
  while (ordered.length < dishes.length) {
    let added = false;
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (!next) continue;
      ordered.push(next);
      added = true;
    }
    if (!added) break;
  }
  return ordered;
}

function rotate<T>(items: T[], seed: number) {
  if (!items.length) return items;
  const shift = ((seed % items.length) + items.length) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

function fillSlots(products: Product[], slots: Slot[], habits: Habits, used: Set<string>) {
  const lines: PlanLine[] = [];
  const seen = new Set(used);
  let missingCore = false;
  for (const slot of slots) {
    const product = pickProduct(products, slot, seen, habits.allergens ?? [], habits.avoids ?? []);
    if (!product) {
      if (slot.core) missingCore = true;
      continue;
    }
    seen.add(product.id);
    if (slot.role !== "Sauce") used.add(product.id);
    lines.push(lineFrom(product, slot.role, packsFor(habits, slot.feeds)));
  }
  if (missingCore || lines.length < 2) return [];
  return lines;
}

function merge(lines: PlanLine[]) {
  const map = new Map<string, PlanLine>();
  for (const line of lines) {
    const previous = map.get(line.id);
    if (!previous) {
      map.set(line.id, { ...line });
      continue;
    }
    if (line.role === "Sauce" && previous.role === "Sauce") {
      if (line.qty > previous.qty) {
        previous.qty = line.qty;
        previous.price = Math.round(previous.unit * previous.qty * 100) / 100;
      }
      continue;
    }
    previous.qty += line.qty;
    previous.price = Math.round(previous.unit * previous.qty * 100) / 100;
  }
  return [...map.values()];
}

function dateAt(start: Date, offset: number) {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  return date;
}

function dayName(start: Date, offset: number) {
  const name = DAY_NAMES[dateAt(start, offset).getDay()] ?? "jour";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export type WeekOptions = {
  seed?: number;
  start?: Date;
  recent?: string[];
  never?: string[];
  prefer?: string[];
  pantry?: string[];
};

const RECIPES: Record<string, string[]> = {
  pates: [
    "Faites bouillir les pâtes dans une grande casserole d’eau salée.",
    "Réchauffez la sauce tomate à feu doux.",
    "Coupez le brocoli en fleurettes et faites-le cuire 4 minutes à l’eau bouillante.",
    "Égouttez les pâtes, mélangez-les à la sauce et servez avec le brocoli.",
  ],
  poulet: [
    "Salez et poivrez le poulet. Faites-le dorer à la poêle.",
    "Ajoutez le cari, puis la crème ou le lait de coco. Laissez mijoter 15 minutes.",
    "Faites cuire le riz, et le brocoli 4 à 5 minutes à la vapeur.",
    "Servez le poulet nappé de sauce cari, avec le riz et le brocoli.",
  ],
  saumon: [
    "Déposez le saumon sur une plaque, sel et poivre, 12 à 15 minutes à 200 °C.",
    "Coupez les pommes de terre et faites-les bouillir 15 à 20 minutes.",
    "Faites cuire le brocoli 4 minutes.",
    "Faites fondre le beurre avec le jus d’un citron, puis nappez le filet. Servez avec les patates et le brocoli.",
  ],
  boeuf: [
    "Faites revenir le bœuf à la poêle jusqu’à ce qu’il soit cuit, puis égouttez le gras.",
    "Ajoutez la sauce tomate et laissez mijoter 10 minutes.",
    "Faites bouillir les pâtes.",
    "Mélangez les pâtes à la sauce, ou nappez-les au moment de servir.",
  ],
  porc: [
    "Faites dorer les côtelettes 4 à 5 minutes de chaque côté.",
    "Hors du feu, mélangez la moutarde avec un peu de crème. Nappez la viande et laissez 2 minutes à feu doux.",
    "Coupez les pommes de terre et les carottes, puis faites-les bouillir ensemble 15 à 20 minutes.",
    "Servez les côtelettes avec la sauce et les légumes.",
  ],
  poisson: [
    "Déposez la truite sur une plaque, sel et poivre, 10 à 12 minutes à 200 °C.",
    "Faites bouillir les pommes de terre 15 à 20 minutes.",
    "Faites tomber les épinards 2 minutes à la poêle avec une pincée de sel.",
    "Mélangez la moutarde et la crème, puis nappez le poisson. Servez avec les patates et les épinards.",
  ],
  lentilles: [
    "Rincez les lentilles. Si elles sont sèches, couvrez-les d’eau et faites-les mijoter 20 à 25 minutes.",
    "Coupez les carottes en rondelles et faites-les cuire avec les lentilles les 10 dernières minutes.",
    "Ajoutez les tomates en dés et le cumin, laissez 5 minutes.",
    "Faites cuire le riz à part et servez les lentilles dessus.",
  ],
  pois: [
    "Rincez les pois chiches.",
    "Faites revenir les poivrons 5 minutes, ajoutez la pâte de cari, puis les pois chiches et le lait de coco.",
    "Laissez mijoter 10 minutes.",
    "Faites cuire le riz et servez les pois chiches dessus.",
  ],
  tofu: [
    "Coupez le tofu en cubes et faites-le dorer à la poêle.",
    "Ajoutez le paprika, puis la crème ou le lait de coco. Laissez 5 minutes.",
    "Faites cuire le brocoli 4 minutes et le riz à part.",
    "Servez le tofu nappé de sauce, avec le riz et le brocoli.",
  ],
  haricots: [
    "Rincez les haricots rouges.",
    "Faites revenir les poivrons, ajoutez les tomates en dés, le paprika et les haricots.",
    "Laissez mijoter 8 minutes.",
    "Faites cuire le riz et servez les haricots dessus.",
  ],
  legumes: [
    "Faites cuire le riz.",
    "Coupez le brocoli et le chou-fleur en fleurettes.",
    "Faites-les sauter 6 à 8 minutes au beurre.",
    "Saupoudrez d’ail en poudre et servez sur le riz.",
  ],
  epinards: [
    "Faites bouillir les pâtes.",
    "Réchauffez la sauce tomate.",
    "Faites tomber les épinards 2 minutes à la poêle.",
    "Mélangez les pâtes, la sauce et les épinards.",
  ],
};

export function buildWeek(products: Product[], habits: Habits, options?: WeekOptions): WeekPlan {
  const seed = options?.seed ?? 0;
  const start = options?.start ?? new Date();
  const recent = new Set(options?.recent ?? []);
  const never = new Set(options?.never ?? []);
  const prefer = new Set(options?.prefer ?? []);
  const allowed = DISHES.filter((dish) => eligible(dish, habits) && !never.has(dish.id));
  const pool = dishesForDiet(allowed.length ? allowed : DISHES.filter((dish) => eligible(dish, habits)), habits.diet, seed, recent, prefer);

  const staples: PlanLine[] = [];
  const reserved = new Set((options?.pantry ?? []).filter((id) => id.length > 0));
  const days: PlanDay[] = [];
  const seen = new Map<string, number>();
  let guard = 0;
  while (days.length < 7 && pool.length && guard < 40) {
    guard += 1;
    const previous = DISHES.find((item) => item.id === days[days.length - 1]?.dishId);
    const dish =
      pool.find((item) => (seen.get(item.id) ?? 0) === 0 && item.family !== previous?.family) ??
      pool.find((item) => (seen.get(item.id) ?? 0) === 0);
    if (!dish) break;
    const lines = fillSlots(products, dish.slots, habits, new Set(reserved));
    if (!lines.length) {
      seen.set(dish.id, 99);
      continue;
    }
    seen.set(dish.id, (seen.get(dish.id) ?? 0) + 1);
    days.push({
      id: `${dish.id}-${days.length}`,
      dishId: dish.id,
      day: dayName(start, days.length),
      title: dish.title,
      note: dish.note,
      wine: WINE_LABEL[dish.wine],
      busy: false,
      lunchNote: "",
      letter: dish.letter,
      kcal: dish.kcal,
      image: lines[0]?.image ?? null,
      steps: RECIPES[dish.id] ?? [],
      lines,
    });
  }

  return finishWeek(days, staples);
}

function finishWeek(days: PlanDay[], staples: PlanLine[]): WeekPlan {
  for (const day of days) day.lunchNote = "";
  for (let index = 0; index < days.length - 1; index += 1) {
    const current = days[index];
    const next = days[index + 1];
    if (current && next && current.dishId === "poulet") {
      next.lunchNote = "Les restes de poulet peuvent remplir les lunchs : pas besoin de racheter la même viande.";
    }
  }
  const basket = merge([...days.flatMap((day) => day.lines), ...staples]);
  const total = Math.round(basket.reduce((sum, line) => sum + line.price, 0) * 100) / 100;
  return { days, staples, basket, total };
}

const DISH_WORDS: { ids: string[]; words: string[] }[] = [
  { ids: ["pates"], words: ["spaghetti", "penne", "pates", "pate"] },
  { ids: ["poulet"], words: ["poulet"] },
  { ids: ["saumon"], words: ["saumon"] },
  { ids: ["boeuf"], words: ["bavette", "steak", "boeuf"] },
  { ids: ["porc"], words: ["porc"] },
  { ids: ["poisson"], words: ["crevette", "aiglefin", "morue", "truite"] },
  { ids: ["saumon", "poisson"], words: ["poisson"] },
  { ids: ["pois"], words: ["pois chiches", "pois chiche"] },
  { ids: ["lentilles"], words: ["lentilles", "lentille"] },
  { ids: ["tofu"], words: ["tofu"] },
  { ids: ["haricots"], words: ["haricots", "haricot"] },
  { ids: ["epinards"], words: ["epinards", "epinard"] },
  { ids: ["legumes"], words: ["saute", "legumes", "legume"] },
  { ids: ["poulet", "boeuf", "porc"], words: ["viande"] },
];

export type Remark = {
  drop: string[];
  keepOne: string[];
  want: string[];
  days: string[];
  allergens: Allergen[];
  active: boolean;
};

function matchDishes(phrase: string) {
  const text = fold(phrase);
  let best: { ids: string[]; length: number } | null = null;
  for (const item of DISH_WORDS) {
    for (const word of item.words) {
      if (!new RegExp(`(?:^|\\s)${word}(?:\\s|$)`).test(text)) continue;
      if (!best || word.length > best.length) best = { ids: item.ids, length: word.length };
    }
  }
  return best?.ids ?? [];
}

export function parseRemark(text: string): Remark {
  const folded = fold(text);
  const days = DAY_NAMES.filter((day) => new RegExp(`(?:^|\\s)${day}(?:\\s|$)`).test(folded));
  const drop = new Set<string>();
  const keepOne = new Set<string>();
  const want = new Set<string>();
  for (const clause of folded.split(/[.,;]| et | ni | puis /)) {
    const ids = matchDishes(clause);
    if (!ids.length) continue;
    const tooMany = /trop de|trop d/.test(clause);
    const negative = /pas de|pas d |sans |aucun|aucune|aime pas|enleve|retire|plus jamais|marre|assez de|change|remplace/.test(clause);
    const desire = /davantage|plus souvent|aimerais|voudrais|je veux|encore |plus de|plus d /.test(clause);
    if (tooMany) ids.forEach((id) => keepOne.add(id));
    else if (desire && !negative) ids.forEach((id) => want.add(id));
    else if (negative) ids.forEach((id) => drop.add(id));
  }
  const allergens = new Set<Allergen>();
  const allergenRules: { id: Allergen; pattern: RegExp }[] = [
    { id: "gluten", pattern: /gluten/ },
    { id: "arachide", pattern: /arachide/ },
    { id: "sesame", pattern: /sesame/ },
    { id: "soja", pattern: /\bsoja\b|\bsoya\b/ },
    { id: "fruit-de-mer", pattern: /fruits? de mer|crevette/ },
    { id: "oeuf", pattern: /sans oeufs?|pas d.?oeufs?|allerg\w* aux oeufs?/ },
    { id: "poisson", pattern: /sans poisson|allerg\w* au poisson/ },
  ];
  for (const rule of allergenRules) {
    if (rule.pattern.test(folded)) allergens.add(rule.id);
  }
  const active =
    drop.size + keepOne.size + want.size + allergens.size > 0 || (days.length > 0 && /change|remplace|autre jour/.test(folded));
  return { drop: [...drop], keepOne: [...keepOne], want: [...want], days, allergens: [...allergens], active };
}

export function reviseWeek(
  products: Product[],
  habits: Habits,
  plan: WeekPlan,
  remark: Remark,
  pantry: string[] = [],
  blocks?: { never?: string[] },
): { plan: WeekPlan; changes: string[] } {
  if (!remark.active) return { plan, changes: [] };
  const never = new Set(blocks?.never ?? []);
  const habitsNow: Habits = {
    ...habits,
    allergens: [...new Set([...(habits.allergens ?? []), ...remark.allergens])],
  };
  const drop = new Set(remark.drop);
  for (const dish of DISHES) {
    if (dish.allergens.some((item) => remark.allergens.includes(item))) drop.add(dish.id);
  }
  const counts = new Map<string, number>();
  for (const day of plan.days) counts.set(day.dishId, (counts.get(day.dishId) ?? 0) + 1);
  let swapsLeft = remark.want.length && !remark.drop.length && !remark.keepOne.length && !remark.days.length ? 2 : Number.POSITIVE_INFINITY;
  const kept = new Map<string, number>();
  const replacing = plan.days.map((day) => {
    const name = fold(day.day);
    if (remark.days.length && !remark.days.includes(name)) return false;
    if (drop.has(day.dishId)) return true;
    if (remark.keepOne.includes(day.dishId)) {
      const seen = kept.get(day.dishId) ?? 0;
      kept.set(day.dishId, seen + 1);
      return seen >= 1;
    }
    if (remark.days.length && remark.want.length) return !remark.want.includes(day.dishId);
    if (remark.days.length && !remark.drop.length && !remark.keepOne.length && !remark.want.length) return true;
    if (!remark.days.length && remark.want.length && !remark.drop.length && !remark.keepOne.length) {
      if (remark.want.includes(day.dishId) || swapsLeft <= 0) return false;
      swapsLeft -= 1;
      return true;
    }
    return false;
  });

  const reserved = new Set(pantry.filter((id) => id.length > 0));
  for (const line of plan.staples) reserved.add(line.id);
  const next = plan.days.map((day) => ({ ...day, lines: [...day.lines] }));
  const changes: string[] = [];
  for (let index = 0; index < next.length; index += 1) {
    if (!replacing[index]) continue;
    const day = next[index];
    if (!day) continue;
    counts.set(day.dishId, Math.max(0, (counts.get(day.dishId) ?? 1) - 1));
    const pool = DISHES.filter((item) => eligible(item, habitsNow) && !drop.has(item.id) && !never.has(item.id) && item.id !== day.dishId);
    const wanted = pool.filter((item) => remark.want.includes(item.id));
    const ordered = wanted.length ? wanted : pool;
    const previous = next[index - 1]?.dishId;
    const following = next[index + 1]?.dishId;
    const choice =
      ordered.find((item) => item.id !== previous && item.id !== following && (counts.get(item.id) ?? 0) < 2) ??
      ordered.find((item) => (counts.get(item.id) ?? 0) < 2) ??
      null;
    if (!choice) {
      counts.set(day.dishId, (counts.get(day.dishId) ?? 0) + 1);
      continue;
    }
    const lines = fillSlots(products, choice.slots, habitsNow, new Set(reserved));
    if (!lines.length) {
      counts.set(day.dishId, (counts.get(day.dishId) ?? 0) + 1);
      continue;
    }
    for (const line of lines) reserved.add(line.id);
    counts.set(choice.id, (counts.get(choice.id) ?? 0) + 1);
    changes.push(`${day.day} : ${day.title} devient ${choice.title}.`);
    next[index] = {
      ...day,
      id: `${choice.id}-${index}`,
      dishId: choice.id,
      title: choice.title,
      note: choice.note,
      wine: WINE_LABEL[choice.wine],
      letter: choice.letter,
      kcal: choice.kcal,
      image: lines[0]?.image ?? null,
      steps: RECIPES[choice.id] ?? [],
      lines,
      lunchNote: "",
    };
  }
  const staples = plan.staples.filter((line) => !habitsNow.allergens.some((item) => hitsAllergen(fold(line.name), item)));
  if (staples.length !== plan.staples.length) {
    const removed = plan.staples.filter((line) => !staples.includes(line)).map((line) => line.name);
    if (removed.length) changes.push(`Retiré des courses : ${removed.join(", ")}.`);
  }
  return { plan: finishWeek(next, staples), changes };
}

export function pairPlate(plateId: string, products: Product[], wines: SaqProduct[], habits: Habits): Pairing | null {
  const plate = PLATES.find((item) => item.id === plateId);
  if (!plate) return null;
  const wine = pickWine(wines, plate.wine, habits.budget);
  const cap = WINE_CAP[habits.budget];
  return {
    plate: plate.label,
    why: plate.why,
    style: WINE_LABEL[plate.wine],
    wine,
    overBudget: wine != null && wine.price > cap,
    sides: fillSlots(products, plate.slots, habits, new Set()),
  };
}
