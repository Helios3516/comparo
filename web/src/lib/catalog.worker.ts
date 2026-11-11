type WorkerScope = {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (data: unknown) => void;
};

const worker = globalThis as unknown as WorkerScope;

worker.onmessage = () => {
  fetch("/catalog.json")
    .then((response) => {
      if (!response.ok) throw new Error("Le catalogue est introuvable.");
      return response.json();
    })
    .then((data) => {
      worker.postMessage({ ok: true, data });
    })
    .catch((reason: unknown) => {
      worker.postMessage({
        ok: false,
        error: reason instanceof Error ? reason.message : "Lecture impossible.",
      });
    });
};
