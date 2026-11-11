import type { Product, Summary } from "../types";

export function money(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(value);
}

export function pct(value: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function articles(count: number) {
  return `${count} article${count > 1 ? "s" : ""}`;
}

export function advantage(product: Product) {
  if (product.exclusive) {
    return product.cheaper === "maxi" ? "Seulement chez Maxi" : "Seulement à l’IGA";
  }
  if (product.cheaper === "egal" || product.gap < 0.01) {
    return "Même prix dans les deux magasins";
  }
  const where = product.cheaper === "maxi" ? "chez Maxi" : "à l’IGA";
  if (product.gap >= 0.1) return `Économisez ${money(product.gap)} ${where}`;
  return product.cheaper === "maxi" ? "Meilleur prix chez Maxi" : "Meilleur prix à l’IGA";
}

export function savingsCopy(summary: Summary) {
  if (summary.count === 0) return "Ajoutez des produits pour voir ce que vous économisez.";
  const storeName = summary.baselineStore === "maxi" ? "Maxi" : "IGA";
  if (summary.baselineStore && summary.saved >= 0.01) {
    return `Vous économisez ${money(summary.saved)} (${pct(summary.savedPct)}) par rapport à tout acheter chez ${storeName}.`;
  }
  if (summary.baselineStore) {
    const otherSaved = summary.baselineStore === "maxi" ? summary.versusIga : summary.versusMaxi;
    if (otherSaved != null && otherSaved >= 0.01) {
      const other = summary.baselineStore === "maxi" ? "à l’IGA" : "chez Maxi";
      return `Un seul arrêt suffit. Vous évitez ${money(otherSaved)} par rapport à tout prendre ${other}.`;
    }
    const otherMissing = summary.baselineStore === "maxi" ? summary.igaMissing : summary.maxiMissing;
    if (otherMissing > 0) return "Un seul arrêt suffit — l’autre magasin n’a pas ces articles.";
    return "Les deux magasins affichent le même total.";
  }
  if (summary.saved >= 0.01) {
    return `Vous économisez ${money(summary.saved)} (${pct(summary.savedPct)}) en prenant chaque article à son meilleur prix.`;
  }
  return "Les deux arrêts sont nécessaires : certains articles ne sont offerts que dans un magasin.";
}

export function longDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
