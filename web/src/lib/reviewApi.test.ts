import { describe, expect, it } from "vitest";
import { handleReviewRequest, type ReviewStore } from "./reviewApi";
import { emptyBook, type ReviewBook } from "./reviews";

function memoryStore(initial: ReviewBook = emptyBook()): ReviewStore & { book: ReviewBook } {
  const state = { book: initial };
  return {
    get book() {
      return state.book;
    },
    read: () => state.book,
    write: (book) => {
      state.book = book;
    },
  };
}

describe("API des avis", () => {
  it("renvoie le registre et refuse une méthode inconnue", async () => {
    const store = memoryStore({ "15460261": [] });
    const loaded = await handleReviewRequest("GET", "", store);
    expect(loaded).toEqual({ status: 200, body: { "15460261": [] } });
    const refused = await handleReviewRequest("PUT", "", store);
    expect(refused.status).toBe(405);
  });

  it("enregistre un avis valide et le retrouve ensuite", async () => {
    const store = memoryStore();
    const saved = await handleReviewRequest(
      "POST",
      JSON.stringify({ sku: "15460261", author: "Ethan", stars: 5, text: "Souple et fruité." }),
      store,
    );
    expect(saved.status).toBe(200);
    expect(store.book["15460261"]).toHaveLength(1);
    const again = await handleReviewRequest("GET", "", store);
    expect(again.status).toBe(200);
    if (!("15460261" in (again.body as ReviewBook))) throw new Error("avis absent");
  });

  it("refuse un avis illisible ou incomplet", async () => {
    const store = memoryStore();
    expect((await handleReviewRequest("POST", "{", store)).status).toBe(400);
    const invalid = await handleReviewRequest("POST", JSON.stringify({ sku: "12", author: "A", stars: 5, text: "ok" }), store);
    expect(invalid.status).toBe(400);
    expect(store.book).toEqual({});
  });
});
