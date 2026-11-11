import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { buildBarcodeIndex, findByBarcode } from "../lib/barcode";
import { advantage, money } from "../lib/format";
import type { Review } from "../lib/reviews";
import type { Product } from "../types";
import { SaqReviews } from "./SaqReviews";

type Props = {
  products: Product[];
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  onClose: () => void;
  kind?: "grocery" | "saq";
  author?: string;
  reviewsOf?: (sku: string) => Review[];
  averageOf?: (sku: string) => { average: number; count: number } | null;
  onPublish?: (sku: string, author: string, stars: number, text: string) => Promise<string>;
};

function Price({ label, amount, best, higher, card }: { label: string; amount: number | null; best: boolean; higher: boolean; card?: number | null }) {
  const box = amount == null
    ? "border-dashed border-line"
    : best
      ? "border-pine bg-moss"
      : higher
        ? "border-iga bg-iga/15"
        : "border-line";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${box}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-1 font-serif text-3xl tabular-nums ${higher ? "text-iga" : ""}`}>{amount == null ? "—" : money(amount)}</p>
      {card != null && amount != null && card < amount - 0.009 && (
        <p className="mt-1 text-xs text-muted">Carte Scène {money(card)}</p>
      )}
    </div>
  );
}

export function Scanner({ products, qtyOf, onAdd, onQty, onClose, kind = "grocery", author = "", reviewsOf, averageOf, onPublish }: Props) {
  const index = useMemo(() => buildBarcodeIndex(products), [products]);
  const indexRef = useRef(index);
  indexRef.current = index;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const scanner = new Html5Qrcode("rayon-scan", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ],
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 260, height: 120 }, aspectRatio: 1.6 },
        (decoded) => {
          const hit = findByBarcode(indexRef.current, decoded);
          setCode(decoded.replace(/\D/g, "") || decoded);
          setProduct(hit);
          setMissing(!hit);
          if (scanner.isScanning) scanner.pause(true);
        },
        () => undefined,
      )
      .catch(() => {
        if (!cancelled) setCameraError("La caméra n’est pas accessible. Entrez les chiffres sous le code-barres.");
      });

    return () => {
      cancelled = true;
      const done = scanner.isScanning ? scanner.stop() : Promise.resolve();
      done
        .catch(() => undefined)
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            /* le lecteur est déjà fermé */
          }
        });
    };
  }, []);

  function show(raw: string) {
    const hit = findByBarcode(indexRef.current, raw);
    setCode(raw.replace(/\D/g, "") || raw.trim());
    setProduct(hit);
    setMissing(!hit);
    if (scannerRef.current?.isScanning) scannerRef.current.pause(true);
  }

  function again() {
    setProduct(null);
    setMissing(false);
    setCode("");
    setTyped("");
    if (scannerRef.current?.isScanning) scannerRef.current.resume();
  }

  const qty = product ? qtyOf(product.id) : 0;

  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <div className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-pine">En rayon</p>
            <h2 id="scan-title" className="font-serif text-2xl tracking-tight">
              Scanner le code-barres
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
            Fermer
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          {kind === "saq"
            ? "Pointez la bouteille. Comparo dit si elle fait partie de l’inventaire à Lasalle et à Laflèche."
            : "Pointez l’emballage. Comparo affiche le prix du Maxi et celui de l’IGA."}
        </p>

        <div id="rayon-scan" className="mt-4 overflow-hidden rounded-2xl bg-ink empty:min-h-48" />
        {cameraError && <p className="mt-3 rounded-2xl border border-line bg-card px-3 py-2 text-sm">{cameraError}</p>}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim()) show(typed);
          }}
        >
          <label className="sr-only" htmlFor="code-manuel">
            Code-barres
          </label>
          <input
            id="code-manuel"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Ou entrer le code"
            className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-sm"
          />
          <button type="submit" className="btn-solid rounded-full px-4 py-2 text-sm font-medium">
            Voir
          </button>
        </form>

        {product?.saq && (
          <article className="mt-4 rounded-3xl border border-line bg-card p-4">
            <div className="flex gap-3">
              {product.image && <img src={product.image} alt="" className="h-24 w-16 object-contain" />}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {product.brand || product.category}
                  {product.size ? ` · ${product.size}` : ""}
                </p>
                <h3 className="mt-1 font-serif text-2xl leading-tight">{product.name}</h3>
                <p className="mt-1 font-serif text-3xl tabular-nums">{money(product.saq.price)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Price label="SAQ Lasalle" amount={product.saq.lasalle ? product.saq.price : null} best={product.saq.lasalle} higher={false} />
              <Price label="SAQ Laflèche" amount={product.saq.lafleche ? product.saq.price : null} best={product.saq.lafleche} higher={false} />
            </div>
            <p className="mt-2 text-sm text-muted">Fournisseur SAQ, rayon {product.saq.subcategory}. Le montant s’affiche seulement dans la succursale où la bouteille est en inventaire.</p>
            {author && onPublish && (
              <SaqReviews
                sku={product.saq.id}
                reviews={reviewsOf?.(product.saq.id) ?? []}
                author={author}
                average={averageOf?.(product.saq.id)?.average ?? null}
                onPublish={onPublish}
              />
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => onAdd(product.id)} className="btn-solid rounded-full px-4 py-2 text-sm font-medium">
                Ajouter à la liste
              </button>
              <a href={product.saq.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline-offset-2 hover:underline">
                Voir à la SAQ
              </a>
              <button type="button" onClick={again} className="rounded-full border border-line px-4 py-2 text-sm">
                Scanner un autre
              </button>
            </div>
          </article>
        )}

        {product && !product.saq && (
          <article className="mt-4 rounded-3xl border border-line bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              {product.brand || product.category}
              {product.size ? ` · ${product.size}` : ""}
            </p>
            <h3 className="mt-1 font-serif text-2xl leading-tight">{product.name}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Price label="Maxi" amount={product.maxi?.price ?? null} best={product.cheaper === "maxi"} higher={product.cheaper === "iga"} />
              <Price label="IGA" amount={product.iga?.price ?? null} best={product.cheaper === "iga"} higher={product.cheaper === "maxi"} card={product.iga?.card} />
            </div>
            <p className="mt-3 text-sm font-medium text-pine">{advantage(product)}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              {qty > 0 ? (
                <div className="flex items-center gap-1 rounded-full border border-line p-1">
                  <button type="button" aria-label="Diminuer" onClick={() => onQty(product.id, qty - 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums">{qty}</span>
                  <button type="button" aria-label="Augmenter" onClick={() => onQty(product.id, qty + 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">
                    +
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => onAdd(product.id)} className="btn-solid rounded-full px-4 py-2 text-sm font-medium">
                  Ajouter à la liste
                </button>
              )}
              <button type="button" onClick={again} className="rounded-full border border-line px-4 py-2 text-sm">
                Scanner un autre
              </button>
            </div>
          </article>
        )}

        {missing && (
          <div className="mt-4 rounded-3xl border border-line bg-card p-4">
            <p className="font-medium">Aucun produit pour {code || "ce code"}.</p>
            <p className="mt-1 text-sm text-muted">
              {kind === "saq"
                ? "Ce code n’est pas dans le relevé des deux SAQ de Baie-Comeau."
                : "Le code n’est pas dans le catalogue de Baie-Comeau. Les marques maison du Maxi n’ont pas toujours de code-barres relié."}
            </p>
            <button type="button" onClick={again} className="mt-3 rounded-full border border-line px-4 py-2 text-sm">
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
