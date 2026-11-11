import type { Product, SaqProduct } from "../types";
import { fold } from "./meals";

const SKIP = /chat|chien|bebe|gerber|nourriture pour|gaterie/;

type Need = {
  categories?: string[];
  include: RegExp;
  exclude?: RegExp;
};

const BASKET: Need[] = [
  { categories: ["Boulangerie"], include: /^pain\b/ },
  { categories: ["Produits laitiers"], include: /\blait (1|2)\b/, exclude: /chocolat|amande|coco|cafe|glace/ },
  { categories: ["Autres"], include: /\boeufs?\b.{0,24}(gros|brun|12)|(gros|bruns?).{0,24}\boeufs?\b/, exclude: /liquide|blanc|bouchee|sandwich|gruau|dinos/ },
  { categories: ["Fruits et légumes"], include: /pommes de terre/ },
  { categories: ["Épicerie"], include: /cafe moulu colombien/ },
];

function usable(product: Product, need: Need) {
  if (need.categories && !need.categories.includes(product.category)) return false;
  const name = fold(`${product.name} ${product.brand}`);
  if (SKIP.test(name) || !need.include.test(name)) return false;
  if (need.exclude?.test(name)) return false;
  return product.maxi != null || product.iga != null;
}

export function previewSpotlight(products: Product[]) {
  const ranked = products.filter((product) => {
    if (product.exclusive || !product.maxi || !product.iga || !product.image) return false;
    if (product.gap < 1 || SKIP.test(fold(product.name))) return false;
    return true;
  });
  ranked.sort((left, right) => right.gap - left.gap || left.name.localeCompare(right.name, "fr"));
  return ranked[0] ?? null;
}

export function previewBasket(products: Product[]) {
  const used = new Set<string>();
  const lines: Product[] = [];
  for (const need of BASKET) {
    const found = products.find((product) => !used.has(product.id) && usable(product, need));
    if (!found) continue;
    used.add(found.id);
    lines.push(found);
  }
  return lines;
}

export function previewWine(wines: SaqProduct[]) {
  const ranked = wines.filter((wine) => wine.lasalle && wine.lafleche && wine.image && wine.subcategory === "Vin" && /750/.test(wine.size));
  ranked.sort((left, right) => left.price - right.price || left.name.localeCompare(right.name, "fr"));
  return ranked[0] ?? null;
}
