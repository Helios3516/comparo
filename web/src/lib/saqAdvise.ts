import type { SaqProduct } from "../types";
import { fold } from "./search";

export type WineStyle = "rouge" | "blanc" | "rose" | "mousseux" | "any";
export type WineBudget = "15" | "25" | "40" | "any";
export type WineDish = "viande" | "volaille" | "poisson" | "fromage" | "apero" | "dessert" | "any";
export type WineSweetness = "sec" | "demi" | "sucre" | "any";

export type WineAnswers = {
  style: WineStyle;
  budget: WineBudget;
  country: string;
  dish: WineDish;
  sweetness: WineSweetness;
};

const DISH_WORDS: Record<Exclude<WineDish, "any">, string[]> = {
  viande: ["viande", "boeuf", "agneau", "grillade", "steak"],
  volaille: ["volaille", "poulet", "dinde"],
  poisson: ["poisson", "fruit de mer", "fruits de mer", "sushi"],
  fromage: ["fromage"],
  apero: ["apero", "aperitif"],
  dessert: ["dessert", "chocolat"],
};

function styleOf(product: SaqProduct): WineStyle | "other" {
  const blob = fold(`${product.colour ?? ""} ${product.subcategory} ${product.name}`);
  if (product.subcategory === "Mousseux" || blob.includes("mousseux") || blob.includes("champagne")) return "mousseux";
  if (blob.includes("rose")) return "rose";
  if (blob.includes("blanc") || blob.includes("white")) return "blanc";
  if (blob.includes("rouge") || blob.includes("red")) return "rouge";
  return "other";
}

function sugarGrams(product: SaqProduct) {
  const raw = (product.sugar ?? "").replace(",", ".").replace("<", "").trim();
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function sweetnessOf(product: SaqProduct): Exclude<WineSweetness, "any"> | "unknown" {
  const taste = fold(product.tasting ?? "");
  const label = taste.split("sucrosite ")[1] ?? "";
  if (label.startsWith("demi")) return "demi";
  if (label.startsWith("sec") || label.startsWith("brut")) return "sec";
  if (/\b(doux|moelleux|liquoreux)\b/.test(label)) return "sucre";
  const grams = sugarGrams(product);
  if (grams == null) return "unknown";
  const sparkling = product.subcategory === "Mousseux";
  if (sparkling) {
    if (grams <= 17) return "sec";
    if (grams <= 50) return "demi";
    return "sucre";
  }
  if (grams < 9) return "sec";
  if (grams < 45) return "demi";
  return "sucre";
}

function priceCap(budget: WineBudget) {
  if (budget === "15") return 15;
  if (budget === "25") return 25;
  if (budget === "40") return 40;
  return Number.POSITIVE_INFINITY;
}

export function adviseWines(products: SaqProduct[], answers: WineAnswers) {
  const cap = priceCap(answers.budget);
  const country = fold(answers.country);
  const words = answers.dish === "any" ? [] : DISH_WORDS[answers.dish];
  return products
    .filter((product) => product.supplier === "SAQ" && (product.subcategory === "Vin" || product.subcategory === "Mousseux"))
    .filter((product) => answers.style === "any" || styleOf(product) === answers.style)
    .filter((product) => product.price <= cap)
    .filter((product) => answers.sweetness === "any" || sweetnessOf(product) === answers.sweetness)
    .filter((product) => !country || country === "tous" || fold(product.country).includes(country))
    .filter((product) => {
      if (!words.length) return true;
      const blob = fold([...(product.pairings ?? []), ...(product.aromas ?? []), product.taste ?? "", product.story ?? ""].join(" "));
      if (!blob) return true;
      return words.some((word) => blob.includes(word));
    })
    .sort((left, right) => Number(right.lasalle && right.lafleche) - Number(left.lasalle && left.lafleche) || left.price - right.price)
    .slice(0, 12);
}
