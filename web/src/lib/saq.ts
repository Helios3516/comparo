import type { Product, SaqProduct, SaqStoreFilter, SortKey } from "../types";
import { matchesQuery } from "./search";

export function toProduct(item: SaqProduct): Product {
  const deal = item.regular != null && item.regular > item.price ? (item.regular - item.price) / item.regular : 0;
  return {
    id: item.id,
    name: item.name,
    brand: item.producer,
    size: item.size,
    category: "Alcool",
    subcategory: item.subcategory,
    image: item.image,
    maxi: null,
    iga: null,
    cheaper: "egal",
    gap: 0,
    gapPct: 0,
    dealPct: deal,
    exclusive: true,
    barcodes: item.barcodes,
    saq: item,
  };
}

function discount(product: SaqProduct) {
  if (product.regular == null || product.regular <= product.price) return 0;
  return (product.regular - product.price) / product.regular;
}

export function selectSaq(
  products: SaqProduct[],
  options: { query: string; subcategory: string; where: SaqStoreFilter; sort: SortKey; scoreOf?: (id: string) => number | null },
) {
  const query = options.query.trim();
  const next = products.filter((product) => {
    if (product.supplier !== "SAQ" || product.category !== "Alcool") return false;
    if (options.subcategory !== "all" && product.subcategory !== options.subcategory) return false;
    if (options.where === "both" && !(product.lasalle && product.lafleche)) return false;
    if (options.where === "lasalle" && !product.lasalle) return false;
    if (options.where === "lafleche" && !product.lafleche) return false;
    if (query.length >= 2) {
      const haystack = `${product.name} ${product.producer} ${product.country} ${product.sku} ${product.category}`;
      if (!matchesQuery(haystack, query)) return false;
    }
    return true;
  });
  next.sort((left, right) => {
    if (options.sort === "prix") return left.price - right.price || left.name.localeCompare(right.name, "fr");
    if (options.sort === "rabais") return discount(right) - discount(left) || left.name.localeCompare(right.name, "fr");
    if (options.sort === "note") {
      const rightScore = options.scoreOf?.(right.id) ?? -1;
      const leftScore = options.scoreOf?.(left.id) ?? -1;
      return rightScore - leftScore || left.name.localeCompare(right.name, "fr");
    }
    return left.name.localeCompare(right.name, "fr");
  });
  return next;
}

function likeness(left: SaqProduct, right: SaqProduct) {
  let score = 0;
  if (left.taste && left.taste === right.taste) score += 4;
  if (left.colour && left.colour === right.colour) score += 3;
  if (left.country && left.country === right.country) score += 2;
  if (left.grape && right.grape && left.grape === right.grape) score += 2;
  const gap = Math.abs(left.price - right.price);
  if (gap <= 5) score += 2;
  else if (gap <= 12) score += 1;
  return score;
}

export function similarSaq(product: SaqProduct, products: SaqProduct[], limit = 6) {
  return products
    .filter((other) => other.id !== product.id && other.supplier === "SAQ" && other.subcategory === product.subcategory)
    .map((other) => ({ other, score: likeness(product, other) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Math.abs(left.other.price - product.price) - Math.abs(right.other.price - product.price),
    )
    .slice(0, limit)
    .map((item) => item.other);
}
