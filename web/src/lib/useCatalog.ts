import { startTransition, useEffect, useState } from "react";
import type { Catalog } from "../types";

type WorkerResult = { ok: true; data: Catalog } | { ok: false; error: string };

async function loadCatalog() {
  const response = await fetch("/catalog.json");
  if (!response.ok) throw new Error("Le catalogue est introuvable.");
  return (await response.json()) as Catalog;
}

export function useCatalog(enabled: boolean) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || catalog) return;
    let live = true;
    const apply = (result: WorkerResult) => {
      if (!live) return;
      if (result.ok) startTransition(() => setCatalog(result.data));
      else setError(result.error);
    };

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./catalog.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker = null;
    }

    if (!worker) {
      loadCatalog().then(
        (data) => apply({ ok: true, data }),
        (reason: unknown) => apply({ ok: false, error: reason instanceof Error ? reason.message : "Lecture impossible." }),
      );
      return () => {
        live = false;
      };
    }

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      apply(event.data);
      worker?.terminate();
    };
    worker.onerror = () => {
      worker?.terminate();
      loadCatalog().then(
        (data) => apply({ ok: true, data }),
        (reason: unknown) => apply({ ok: false, error: reason instanceof Error ? reason.message : "Lecture impossible." }),
      );
    };
    worker.postMessage("load");
    return () => {
      live = false;
      worker?.terminate();
    };
  }, [enabled, catalog]);

  return { catalog, error };
}
