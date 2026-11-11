export type Review = {
  author: string;
  stars: number;
  text: string;
  at: string;
};

export type ReviewBook = Record<string, Review[]>;

export function emptyBook(): ReviewBook {
  return {};
}

export function averageOf(list: Review[] | undefined) {
  if (!list || list.length === 0) return null;
  const total = list.reduce((sum, review) => sum + review.stars, 0);
  return { average: total / list.length, count: list.length };
}

export function applyReview(book: ReviewBook, input: { sku: string; author: string; stars: number; text: string; at?: string }) {
  const sku = input.sku.trim();
  const author = input.author.trim();
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!/^\d{4,14}$/.test(sku)) return { ok: false as const, error: "Ce produit n’a pas de code SAQ." };
  if (author.length < 2 || author.length > 40) return { ok: false as const, error: "Le prénom du compte est requis." };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { ok: false as const, error: "Choisissez une note de 1 à 5." };
  if (text.length < 2 || text.length > 400) return { ok: false as const, error: "Le commentaire doit faire entre 2 et 400 caractères." };
  const review: Review = { author, stars: input.stars, text, at: input.at ?? new Date().toISOString() };
  const others = (book[sku] ?? []).filter((item) => item.author.localeCompare(author, "fr", { sensitivity: "accent" }) !== 0);
  return { ok: true as const, book: { ...book, [sku]: [review, ...others] } };
}
