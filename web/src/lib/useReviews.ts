import { useCallback, useEffect, useState } from "react";
import { averageOf, type ReviewBook } from "./reviews";

export function useReviews(enabled: boolean) {
  const [book, setBook] = useState<ReviewBook>({});
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/reviews");
      if (!response.ok) throw new Error("load");
      setBook((await response.json()) as ReviewBook);
      setError("");
    } catch {
      setError("Les avis Comparo ne répondent pas.");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const timer = window.setInterval(() => void reload(), 15000);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  async function publish(sku: string, author: string, stars: number, text: string) {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, author, stars, text }),
    });
    const payload = (await response.json()) as ReviewBook & { error?: string };
    if (!response.ok) {
      setError(payload.error || "L’avis n’a pas été enregistré.");
      return payload.error || "L’avis n’a pas été enregistré.";
    }
    setBook(payload);
    setError("");
    return "";
  }

  return { book, error, publish, averageOf: (sku: string) => averageOf(book[sku]) };
}
