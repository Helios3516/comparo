import { useEffect, useState } from "react";
import type { Product, SaqProduct } from "../types";

export function usePreview(enabled: boolean) {
  const [spotlight, setSpotlight] = useState<Product | null>(null);
  const [basket, setBasket] = useState<Product[]>([]);
  const [wine, setWine] = useState<SaqProduct | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/preview.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("manquant");
        return (await response.json()) as { spotlight?: Product | null; basket?: Product[]; wine?: SaqProduct | null };
      })
      .then((data) => {
        if (!live) return;
        setSpotlight(data.spotlight ?? null);
        setBasket(Array.isArray(data.basket) ? data.basket : []);
        setWine(data.wine ?? null);
      })
      .catch(() => {
        if (live) setBasket([]);
      });
    return () => {
      live = false;
    };
  }, [enabled]);

  return { spotlight, basket, wine };
}
