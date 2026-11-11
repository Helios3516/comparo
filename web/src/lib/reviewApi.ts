import { applyReview, type ReviewBook } from "./reviews";

export type ReviewStore = {
  read: () => ReviewBook | Promise<ReviewBook>;
  write: (book: ReviewBook) => void | Promise<void>;
};

export async function handleReviewRequest(method: string | undefined, rawBody: string, store: ReviewStore) {
  if (method === "GET") return { status: 200, body: await store.read() };
  if (method !== "POST") return { status: 405, body: { error: "Méthode refusée." } };
  let body: { sku?: string; author?: string; stars?: number; text?: string } = {};
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return { status: 400, body: { error: "Avis illisible." } };
  }
  const result = applyReview(await store.read(), {
    sku: String(body.sku ?? ""),
    author: String(body.author ?? ""),
    stars: Number(body.stars),
    text: String(body.text ?? ""),
  });
  if (!result.ok) return { status: 400, body: { error: result.error } };
  await store.write(result.book);
  return { status: 200, body: result.book };
}
