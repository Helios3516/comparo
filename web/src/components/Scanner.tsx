import { useEffect, useMemo, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatOneDReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
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
  onFound?: (product: Product) => void;
  kind?: "grocery" | "saq";
  author?: string;
  reviewsOf?: (sku: string) => Review[];
  averageOf?: (sku: string) => { average: number; count: number } | null;
  onPublish?: (sku: string, author: string, stars: number, text: string) => Promise<string>;
};

type Detected = { rawValue?: string };
type NativeDetector = { detect: (source: CanvasImageSource) => Promise<Detected[]> };

function nativeDetector(): NativeDetector | null {
  const ctor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => NativeDetector }).BarcodeDetector;
  if (!ctor) return null;
  try {
    return new ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  } catch {
    return null;
  }
}

function within<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise.then((value) => value).catch(() => null),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function openCamera(video: HTMLVideoElement) {
  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      return stream;
    } catch (error) {
      if (video.srcObject instanceof MediaStream) stopStream(video.srcObject);
      video.srcObject = null;
      last = error;
    }
  }
  throw last;
}

function grabFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement, mode: number) {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (!srcW || !srcH) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if (mode === 1) {
    const sw = Math.round(srcW * 0.85);
    const sh = Math.round(srcH * 0.42);
    const sx = Math.round((srcW - sw) / 2);
    const sy = Math.round((srcH - sh) / 2);
    const scale = Math.min(2.4, 1200 / sw);
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  const scale = Math.min(1, 960 / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  if (mode === 2) {
    canvas.width = h;
    canvas.height = w;
    ctx.setTransform(0, 1, -1, 0, h, 0);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }
  canvas.width = w;
  canvas.height = h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

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

export function Scanner({ products, qtyOf, onAdd, onQty, onClose, onFound, kind = "grocery", author = "", reviewsOf, averageOf, onPublish }: Props) {
  const index = useMemo(() => buildBarcodeIndex(products), [products]);
  const indexRef = useRef(index);
  indexRef.current = index;
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);
  const [cameraError, setCameraError] = useState("");
  const [torchReady, setTorchReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const surface: HTMLVideoElement = video;
    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatOneDReader(hints);
    const canvas = document.createElement("canvas");
    const detector = nativeDetector();
    let turn = 0;

    function accept(raw: string) {
      if (cancelled || pausedRef.current) return;
      const hit = findByBarcode(indexRef.current, raw);
      const clean = raw.replace(/\D/g, "") || raw;
      setCode(clean);
      if (!hit) {
        setHint(clean);
        return;
      }
      pausedRef.current = true;
      setHint("");
      setProduct(hit);
      setMissing(false);
      onFoundRef.current?.(hit);
    }

    async function tick() {
      if (cancelled) return;
      if (!pausedRef.current && surface.readyState >= 2 && surface.videoWidth > 0) {
        if (detector) {
          const found = await within(detector.detect(surface), 400);
          const value = found?.find((item) => item.rawValue)?.rawValue;
          if (value) accept(value);
        }
        if (!cancelled && !pausedRef.current) {
          const shot = grabFrame(canvas, surface, turn % 3);
          turn += 1;
          if (shot) {
            try {
              const text = reader.decodeFromCanvas(shot).getText();
              if (text) accept(text);
            } catch {
              /* cette image ne contient pas de code lisible */
            }
          }
        }
      }
      if (!cancelled) window.setTimeout(tick, pausedRef.current ? 300 : 50);
    }

    openCamera(video)
      .then((stream) => {
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchReady(Boolean(caps?.torch));
        tick();
      })
      .catch(() => {
        if (!cancelled) setCameraError("La caméra n’est pas accessible. Entrez les chiffres sous le code-barres.");
      });

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      video.srcObject = null;
    };
  }, []);

  function show(raw: string) {
    const hit = findByBarcode(indexRef.current, raw);
    const clean = raw.replace(/\D/g, "") || raw.trim();
    setCode(clean);
    setHint("");
    setProduct(hit);
    setMissing(!hit);
    if (!hit) return;
    pausedRef.current = true;
    onFoundRef.current?.(hit);
  }

  function again() {
    pausedRef.current = false;
    setProduct(null);
    setMissing(false);
    setHint("");
    setCode("");
    setTyped("");
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchReady(false);
    }
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

        <div className="relative mt-4 h-72 w-full overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-xl border-2 border-white/80" />
          {torchReady && (
            <button type="button" onClick={toggleTorch} className="absolute bottom-3 right-3 rounded-full bg-paper/90 px-3 py-1.5 text-sm">
              {torchOn ? "Éteindre" : "Lumière"}
            </button>
          )}
        </div>
        {!cameraError && !product && <p className="mt-2 text-sm text-muted">Placez le code dans le cadre, à plat, à une quinzaine de centimètres.</p>}
        {hint && !product && <p className="mt-3 text-sm text-muted">Code lu : {hint}. Il n’est pas dans le relevé, le lecteur continue.</p>}
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
                ? "Ce code n’est pas dans le relevé des deux SAQ de Baie-Comeau. Le lecteur continue : tenez le code bien à plat."
                : "Ce code n’est pas dans le relevé de Baie-Comeau. Le lecteur continue : tenez le code bien à plat."}
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
