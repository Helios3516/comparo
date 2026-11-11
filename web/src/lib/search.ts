import type { Product } from "../types";

export function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bcocacola\b/g, "coca cola")
    .trim();
}

type Family = { keys: string[]; terms: string[] };

const FAMILIES: Family[] = [
  { keys: ["coca", "coke", "cocacola", "cola"], terms: ["coca", "coke", "cola", "pepsi"] },
  { keys: ["pepsi"], terms: ["pepsi"] },
  { keys: ["sprite"], terms: ["sprite"] },
  { keys: ["7up", "sevenup"], terms: ["7up", "seven up"] },
  { keys: ["crush"], terms: ["crush"] },
  { keys: ["yogourt", "yaourt", "yogurt"], terms: ["yogourt", "yaourt", "yogurt"] },
  { keys: ["oeuf", "oeufs"], terms: ["oeuf"] },
  { keys: ["patate", "patates", "pdt"], terms: ["patate", "pomme de terre"] },
  { keys: ["bleuet", "bleuets", "myrtille"], terms: ["bleuet", "myrtille"] },
  { keys: ["chips", "chip", "croustille", "croustilles"], terms: ["chips", "croustille", "doritos", "ruffles", "lays", "tostitos"] },
  { keys: ["cafe", "espresso", "cappuccino", "nescafe"], terms: ["cafe", "espresso", "cappuccino", "nescafe"] },
  { keys: ["the", "tisane"], terms: ["the", "tisane"] },
  { keys: ["biere"], terms: ["biere"] },
  { keys: ["pates", "pate", "spaghetti", "macaroni", "lasagne", "penne", "linguine", "nouille"], terms: ["pate", "pates", "spaghetti", "macaroni", "lasagne", "penne", "linguine", "nouille"] },
  { keys: ["pain", "baguette"], terms: ["pain", "baguette"] },
  { keys: ["pq", "hygienique"], terms: ["papier hygienique", "hygienique"] },
  { keys: ["essuie", "sopalin"], terms: ["essuie tout", "essuie"] },
  { keys: ["lessive", "detergent", "tide"], terms: ["lessive", "detergent", "tide"] },
  { keys: ["shampoing", "shampooing"], terms: ["shampoing", "shampooing"] },
  { keys: ["couche", "couches", "pampers", "huggies"], terms: ["couche", "pampers", "huggies"] },
  { keys: ["mayo", "mayonnaise"], terms: ["mayo", "mayonnaise"] },
  { keys: ["ketchup"], terms: ["ketchup"] },
  { keys: ["biscuit", "cookie", "cookies", "oreo"], terms: ["biscuit", "cookie", "oreo"] },
  { keys: ["chocolat"], terms: ["chocolat"] },
  { keys: ["bonbon", "jujube"], terms: ["bonbon", "jujube"] },
  { keys: ["cereale", "cereal", "cheerios"], terms: ["cereale", "cheerios"] },
  { keys: ["fromage"], terms: ["fromage", "cheddar", "mozzarella", "gouda", "feta", "ricotta", "parmesan"] },
  { keys: ["cheddar"], terms: ["cheddar"] },
  { keys: ["poulet"], terms: ["poulet"] },
  { keys: ["boeuf", "steak"], terms: ["boeuf", "steak"] },
  { keys: ["porc"], terms: ["porc"] },
  { keys: ["bacon"], terms: ["bacon"] },
  { keys: ["jambon"], terms: ["jambon"] },
  { keys: ["dinde"], terms: ["dinde"] },
  { keys: ["saucisse", "hotdog"], terms: ["saucisse", "hot dog", "hotdog"] },
  { keys: ["saumon"], terms: ["saumon"] },
  { keys: ["thon"], terms: ["thon"] },
  { keys: ["crevette"], terms: ["crevette"] },
  { keys: ["lait"], terms: ["lait"] },
  { keys: ["beurre"], terms: ["beurre"] },
  { keys: ["pomme"], terms: ["pomme"] },
  { keys: ["banane"], terms: ["banane"] },
  { keys: ["orange"], terms: ["orange"] },
  { keys: ["laitue", "iceberg"], terms: ["laitue", "iceberg"] },
  { keys: ["tomate"], terms: ["tomate"] },
  { keys: ["oignon"], terms: ["oignon"] },
  { keys: ["carotte"], terms: ["carotte"] },
  { keys: ["jus"], terms: ["jus"] },
  { keys: ["eau"], terms: ["eau"] },
  { keys: ["savon"], terms: ["savon"] },
  { keys: ["riz"], terms: ["riz"] },
  { keys: ["huile"], terms: ["huile"] },
  { keys: ["vin"], terms: ["vin"] },
  { keys: ["pizza"], terms: ["pizza"] },
  { keys: ["glace", "cornet"], terms: ["creme glacee", "cornet"] },
];

const BLOCKED: Record<string, RegExp> = {
  lait: /^(laitue|laitier)/,
  vin: /^vinaigr/,
  pain: /^peint/,
  the: /^therm/,
  sel: /^(selec|selon)/,
  jus: /^juste/,
  ail: /^(ailleur|aileron)/,
  porc: /^porcel/,
  riz: /^rizi/,
  eau: /^(eaus|eaube)/,
};

function wordsOf(value: string) {
  return fold(value).split(" ").filter(Boolean);
}

export type SearchRecord = {
  product: Product;
  name: string;
  brand: string;
  words: string[];
};

export function buildSearchIndex(products: Product[]): SearchRecord[] {
  return products.map((product) => {
    const name = fold(product.name);
    const brand = fold(product.brand);
    return {
      product,
      name,
      brand,
      words: `${brand} ${name}`.split(" ").filter(Boolean),
    };
  });
}

function wordHit(word: string, term: string) {
  if (term.includes(" ")) return false;
  if (!word.startsWith(term)) return false;
  if (BLOCKED[term]?.test(word)) return false;
  const rest = word.length - term.length;
  return rest === 0 || rest <= 2;
}

function textHas(text: string, term: string) {
  const folded = fold(text);
  if (term.includes(" ")) {
    if (term === "pomme de terre") return /\bpommes? de terre\b/.test(folded);
    return folded.includes(term);
  }
  if (term === "pomme") {
    const stripped = folded.replace(/\bpommes de terre\b/g, " ").replace(/\bpomme de terre\b/g, " ");
    return wordsOf(stripped).some((word) => wordHit(word, "pomme"));
  }
  return wordsOf(folded).some((word) => wordHit(word, term));
}

function familyFor(token: string) {
  const exact = FAMILIES.find((family) => family.keys.includes(token));
  if (exact) return exact;
  if (token.length < 3) return undefined;
  return FAMILIES.find((family) => family.keys.some((key) => key.startsWith(token) && key.length - token.length <= 2));
}

export function queryTokens(query: string) {
  const folded = fold(query);
  if (!folded) return [];
  return folded.split(" ").filter(Boolean);
}

function preparedHas(record: SearchRecord, term: string) {
  const blob = `${record.brand} ${record.name}`;
  if (term.includes(" ")) {
    if (term === "pomme de terre") return /\bpommes? de terre\b/.test(blob);
    return blob.includes(term);
  }
  if (term === "pomme") {
    const stripped = blob.replace(/\bpommes de terre\b/g, " ").replace(/\bpomme de terre\b/g, " ");
    return stripped.split(" ").filter(Boolean).some((word) => wordHit(word, "pomme"));
  }
  return record.words.some((word) => wordHit(word, term));
}

export function matchesPrepared(record: SearchRecord, query: string) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  return tokens.every((token) => {
    const family = familyFor(token);
    const terms = family ? family.terms : [token];
    return terms.some((term) => preparedHas(record, term));
  });
}

export function matchesQuery(haystack: string, query: string) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  return tokens.every((token) => {
    const family = familyFor(token);
    const terms = family ? family.terms : [token];
    return terms.some((term) => textHas(haystack, term));
  });
}

export function relevanceRecord(record: SearchRecord, query: string) {
  const tokens = queryTokens(query);
  let score = 0;
  for (const token of tokens) {
    if (record.name.startsWith(token) || record.brand.startsWith(token)) score += 100;
    else if (record.words.some((word) => wordHit(word, token))) score += 40;
    else {
      const family = familyFor(token);
      const terms = family ? family.terms : [token];
      if (terms.some((term) => preparedHas(record, term))) score += 10;
    }
  }
  return score;
}

export function relevance(product: Product, query: string) {
  const tokens = queryTokens(query);
  const name = fold(product.name);
  const brand = fold(product.brand);
  let score = 0;
  for (const token of tokens) {
    if (name.startsWith(token) || brand.startsWith(token)) score += 100;
    else if (wordsOf(`${brand} ${name}`).some((word) => wordHit(word, token))) score += 40;
    else score += 10;
  }
  return score;
}

export function suggest(records: SearchRecord[], query: string) {
  const needle = fold(query);
  if (needle.length < 2) return [];
  const ranked: { score: number; product: Product }[] = [];
  for (const record of records) {
    if (!matchesPrepared(record, needle)) continue;
    let score = 40;
    if (record.name.startsWith(needle) || record.brand.startsWith(needle)) score = 100;
    else if (record.words.some((word) => word.startsWith(needle))) score = 70;
    if (!record.product.exclusive) score += 5;
    ranked.push({ score, product: record.product });
  }
  ranked.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "fr"));
  return ranked.slice(0, 8).map((entry) => entry.product);
}

export function bestUnit(product: Product) {
  const prices = [product.maxi?.price, product.iga?.price].filter((price): price is number => price != null);
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}
