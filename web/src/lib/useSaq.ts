import { useEffect, useState } from "react";
import type { SaqCatalog } from "../types";

export function useSaq(enabled: boolean) {
  const [catalog, setCatalog] = useState<SaqCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || catalog) return;
    let live = true;
    fetch("/saq.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("manquant");
        return (await response.json()) as SaqCatalog;
      })
      .then((data) => {
        if (live) setCatalog(data);
      })
      .catch(() => {
        if (live) setError("Le relevé SAQ n’est pas encore là. Lancez npm run saq dans le dossier web.");
      });
    return () => {
      live = false;
    };
  }, [enabled, catalog]);

  return { catalog, error };
}
