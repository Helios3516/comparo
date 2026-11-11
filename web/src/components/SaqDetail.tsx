import { useEffect } from "react";
import { money } from "../lib/format";
import { similarSaq } from "../lib/saq";
import type { SaqProduct } from "../types";
import type { Review } from "../lib/reviews";
import { SaqReviews } from "./SaqReviews";
import { SaqNote } from "./SaqNote";
import { TasteMarks } from "./TasteMarks";

type Props = {
  product: SaqProduct;
  qty: number;
  onAdd: () => void;
  onQty: (qty: number) => void;
  onClose: () => void;
  liked: boolean;
  passed: boolean;
  onLike: () => void;
  onPass: () => void;
  related?: SaqProduct[];
  onOpen?: (product: SaqProduct) => void;
  author: string;
  reviews: Review[];
  average: number | null;
  averageOf?: (sku: string) => { average: number; count: number } | null;
  onPublish: (sku: string, author: string, stars: number, text: string) => Promise<string>;
};

function readableNumber(value: string) {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number)) return value;
  return Number.isInteger(number) ? String(number) : number.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
}

function pairingHint(story: string) {
  const match = story.match(/accompagn\p{L}*[^.]+\./iu);
  return match ? match[0].replace(/^./, (letter) => letter.toUpperCase()) : "";
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export function SaqDetail({ product, qty, onAdd, onQty, onClose, liked, passed, onLike, onPass, related = [], onOpen, author, reviews, average, averageOf, onPublish }: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const alike = similarSaq(product, related);
  const where = [
    product.lasalle ? "SAQ Lasalle" : "",
    product.lafleche ? "SAQ Laflèche" : "",
  ].filter(Boolean);

  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="saq-fiche">
      <div className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-paper p-5 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-pine">Fournisseur SAQ · {product.subcategory}</p>
          <button type="button" onClick={onClose} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
            Fermer
          </button>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-[160px_1fr]">
          <div className="grid h-48 place-items-center overflow-hidden rounded-2xl bg-card">
            {product.image ? <img src={product.image} alt="" className="h-full w-full object-contain p-3" /> : <span className="font-serif text-3xl text-muted">{product.name.slice(0, 1)}</span>}
          </div>
          <div>
            <h2 id="saq-fiche" className="font-serif text-3xl leading-tight">{product.name}</h2>
            <p className="mt-2 text-sm text-muted">
              {[product.producer, product.size, product.country, product.region].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3">
              <SaqNote average={average} count={reviews.length} />
            </div>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-serif text-4xl tabular-nums">{money(product.price)}</span>
              {product.regular != null && <span className="text-sm text-muted line-through">{money(product.regular)}</span>}
            </p>
            <p className="mt-2 text-sm">{where.length ? `En inventaire : ${where.join(" et ")}.` : "Pas dans l’inventaire des deux succursales."}</p>
            <div className="mt-3">
              <TasteMarks name={product.name} liked={liked} passed={passed} onLike={onLike} onPass={onPass} className="" />
            </div>
          </div>
        </div>
        {product.story && <p className="mt-5 text-sm leading-relaxed">{product.story}</p>}
        {product.tasting && <p className="mt-3 text-sm text-muted">{product.tasting}</p>}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label="Goût" value={product.taste ?? ""} />
          <Fact label="Cépage" value={product.grape && !product.grape.includes("{") ? product.grape : ""} />
          <Fact label="Couleur" value={product.colour ?? ""} />
          <Fact label="Millésime" value={product.vintage ?? ""} />
          <Fact label="Alcool" value={product.abv ? `${readableNumber(product.abv)} %` : ""} />
          <Fact label="Sucre" value={product.sugar ? `${product.sugar} g/L` : ""} />
        </div>
        {product.aromas && product.aromas.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Arômes</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {product.aromas.map((aroma) => (
                <li key={aroma} className="rounded-full border border-line bg-card px-3 py-1 text-sm">
                  {aroma}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Accords</p>
          {product.pairings && product.pairings.some((pairing) => !/^\d+$/.test(pairing)) ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {product.pairings.filter((pairing) => !/^\d+$/.test(pairing)).map((pairing) => (
                <li key={pairing} className="rounded-full border border-line bg-card px-3 py-1 text-sm">
                  {pairing}
                </li>
              ))}
            </ul>
          ) : pairingHint(product.story ?? "") ? (
            <p className="mt-2 text-sm">{pairingHint(product.story ?? "")}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">Les accords ne sont pas dans ce relevé. La fiche SAQ les détaille.</p>
          )}
        </div>
        {alike.length > 0 && onOpen && (
          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Dans le même genre</p>
            <ul className="mt-2 grid gap-2">
              {alike.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2 text-left hover:bg-moss">
                    <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden">
                      {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {item.country ? `${item.country} · ` : ""}
                        {money(item.price)}
                      </span>
                    </span>
                    <SaqNote average={averageOf?.(item.id)?.average} count={averageOf?.(item.id)?.count ?? 0} compact />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <SaqReviews sku={product.id} reviews={reviews} author={author} average={average} onPublish={onPublish} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {qty > 0 ? (
            <div className="flex items-center gap-1 rounded-full border border-line p-1">
              <button type="button" aria-label="Diminuer" onClick={() => onQty(qty - 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                −
              </button>
              <span className="w-6 text-center tabular-nums">{qty}</span>
              <button type="button" aria-label="Augmenter" onClick={() => onQty(qty + 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                +
              </button>
            </div>
          ) : (
            <button type="button" onClick={onAdd} className="btn-solid rounded-full px-4 py-2 text-sm font-medium">
              Ajouter à la liste
            </button>
          )}
          <a href={product.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline-offset-2 hover:underline">
            Fiche complète sur SAQ.com
          </a>
        </div>
      </div>
    </div>
  );
}
