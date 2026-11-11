import { readFileSync, writeFileSync } from "node:fs";
import { previewBasket, previewSpotlight, previewWine } from "../src/lib/preview";
import type { Product, SaqCatalog } from "../src/types";

const catalog = JSON.parse(readFileSync(new URL("../public/catalog.json", import.meta.url), "utf8")) as {
  generatedAt: string;
  products: Product[];
};
const saq = JSON.parse(readFileSync(new URL("../public/saq.json", import.meta.url), "utf8")) as SaqCatalog;

const spotlight = previewSpotlight(catalog.products);
const basket = previewBasket(catalog.products);
const wine = previewWine(saq.products);

const payload = {
  generatedAt: catalog.generatedAt,
  spotlight,
  basket,
  wine,
};

writeFileSync(new URL("../public/preview.json", import.meta.url), JSON.stringify(payload));
console.log(`aperçu ${basket.length} courses, écart ${spotlight ? "oui" : "non"}, vin ${wine ? "oui" : "non"}`);
