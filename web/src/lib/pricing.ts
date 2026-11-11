import type { ListEntry, Product, StopLine, Summary } from "../types";

export const CATEGORY_ORDER = [
  "Fruits et légumes",
  "Boulangerie",
  "Viandes",
  "Poisson et fruits de mer",
  "Produits laitiers",
  "Confitures",
  "Conserves",
  "Épicerie",
  "Surgelés",
  "Boissons",
  "Collations",
  "Bébé",
  "Soins et maison",
  "Animaux",
  "Autres",
  "Alcool",
];

function cents(value: number) {
  return Math.round(value * 100);
}

export function summarize(entries: ListEntry[], byId: Map<string, Product>): Summary {
  let maxiCents = 0;
  let igaCents = 0;
  let optimizedCents = 0;
  let carelessCents = 0;
  let maxiMissing = 0;
  let igaMissing = 0;
  const maxiLines: StopLine[] = [];
  const igaLines: StopLine[] = [];
  const saqLines: StopLine[] = [];
  let saqCents = 0;

  for (const entry of entries) {
    const product = byId.get(entry.id);
    if (!product || entry.qty <= 0) continue;
    const qty = entry.qty;
    if (product.saq) {
      const unit = product.saq.price;
      saqCents += cents(unit) * qty;
      saqLines.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        size: product.size,
        category: product.saq.subcategory || "Alcool",
        qty,
        unit,
        total: (cents(unit) * qty) / 100,
        image: product.image,
        tie: false,
        card: null,
      });
      continue;
    }
    const maxi = product.maxi?.price ?? null;
    const iga = product.iga?.price ?? null;
    if (maxi == null) maxiMissing += 1;
    else maxiCents += cents(maxi) * qty;
    if (iga == null) igaMissing += 1;
    else igaCents += cents(iga) * qty;
    if (maxi == null && iga == null) continue;

    let store: "maxi" | "iga";
    let unit: number;
    let tie = false;
    if (maxi == null) {
      store = "iga";
      unit = iga as number;
    } else if (iga == null || maxi < iga) {
      store = "maxi";
      unit = maxi;
    } else if (iga < maxi) {
      store = "iga";
      unit = iga;
    } else {
      store = "maxi";
      unit = maxi;
      tie = true;
    }

    const source = store === "maxi" ? product.maxi : product.iga;
    const line: StopLine = {
      id: product.id,
      name: source?.name || product.name,
      brand: product.brand,
      size: product.size || source?.size || "",
      category: product.category,
      qty,
      unit,
      total: (cents(unit) * qty) / 100,
      image: source?.image || product.image,
      tie,
      card: store === "iga" ? product.iga?.card ?? null : null,
    };
    optimizedCents += cents(unit) * qty;
    if (maxi != null && iga != null) carelessCents += cents(Math.max(maxi, iga)) * qty;
    else carelessCents += cents(unit) * qty;
    (store === "maxi" ? maxiLines : igaLines).push(line);
  }

  const byAisle = (lines: StopLine[]) =>
    lines.sort((a, b) => {
      const left = CATEGORY_ORDER.indexOf(a.category);
      const right = CATEGORY_ORDER.indexOf(b.category);
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.name.localeCompare(b.name, "fr");
    });

  const maxiTotal = maxiCents / 100;
  const igaTotal = igaCents / 100;
  const optimized = optimizedCents / 100;
  let baselineStore: Summary["baselineStore"] = null;
  let baselineTotal = optimized;
  if (maxiMissing === 0 && igaMissing === 0) {
    baselineStore = maxiTotal <= igaTotal ? "maxi" : "iga";
    baselineTotal = Math.min(maxiTotal, igaTotal);
  } else if (maxiMissing === 0) {
    baselineStore = "maxi";
    baselineTotal = maxiTotal;
  } else if (igaMissing === 0) {
    baselineStore = "iga";
    baselineTotal = igaTotal;
  } else {
    baselineTotal = carelessCents / 100;
  }

  const saved = Math.max(0, Math.round((baselineTotal - optimized) * 100) / 100);
  return {
    maxiTotal,
    igaTotal,
    maxiMissing,
    igaMissing,
    optimized,
    saved,
    savedPct: baselineTotal > 0 ? saved / baselineTotal : 0,
    baselineStore,
    versusMaxi: maxiMissing === 0 ? Math.max(0, Math.round((maxiTotal - optimized) * 100) / 100) : null,
    versusIga: igaMissing === 0 ? Math.max(0, Math.round((igaTotal - optimized) * 100) / 100) : null,
    maxiLines: byAisle(maxiLines),
    igaLines: byAisle(igaLines),
    saqTotal: saqCents / 100,
    saqLines: byAisle(saqLines),
    count: maxiLines.length + igaLines.length + saqLines.length,
  };
}
