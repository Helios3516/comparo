import { advantage, money, pct } from "../lib/format";
import type { Product, StorePrice } from "../types";
import { TasteMarks } from "./TasteMarks";

type Props = {
  product: Product;
  qty: number;
  index: number;
  liked?: boolean;
  passed?: boolean;
  onLike?: () => void;
  onPass?: () => void;
  onAdd: () => void;
  onQty: (qty: number) => void;
  anchor?: string;
};

function Tile({
  label,
  price,
  best,
  higher,
}: {
  label: string;
  price: StorePrice | null;
  best: boolean;
  higher: boolean;
}) {
  const box = !price
    ? "border-dashed border-line"
    : best
      ? "border-pine bg-moss"
      : higher
        ? "border-iga bg-iga/15"
        : "border-line";
  return (
    <div className={`rounded-xl border px-2 py-1.5 ${box}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      {price ? (
        <>
          <p className="flex items-baseline gap-1">
            <span className={`text-sm font-semibold tabular-nums ${higher ? "text-iga" : ""}`}>{money(price.price)}</span>
            {price.regular != null && price.regular > price.price + 0.009 && (
              <span className="text-[10px] text-muted line-through tabular-nums">{money(price.regular)}</span>
            )}
          </p>
          {price.card != null && price.card < price.price - 0.009 && (
            <p className="text-[10px] leading-tight text-muted">Carte Scène {money(price.card)}</p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted">—</p>
      )}
    </div>
  );
}

export function ProductCard({ product, qty, index, liked = false, passed = false, onLike, onPass, onAdd, onQty, anchor }: Props) {
  const badge = advantage(product);
  const imbattable = !product.exclusive && product.dealPct >= 0.3;
  const fiche = (product.cheaper === "iga" ? product.iga?.url : product.maxi?.url) || product.iga?.url || product.maxi?.url;

  return (
    <article
      data-tour={anchor}
      className="card-rise flex flex-col rounded-2xl border border-line bg-card transition duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${(index % 10) * 20}ms` }}
    >
      <div className="relative h-28 bg-[color-mix(in_srgb,var(--ink)_4%,var(--card))]">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain p-2"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="grid h-full place-items-center font-serif text-xl text-muted/50">
            {(product.brand || product.name).slice(0, 1)}
          </div>
        )}
        {onLike && onPass && <TasteMarks name={product.name} liked={liked} passed={passed} onLike={onLike} onPass={onPass} />}
        {imbattable && (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.cheaper === "iga" ? "bg-iga text-iga-ink" : "bg-maxi text-maxi-ink"}`}
          >
            −{pct(product.dealPct)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            {product.brand || product.category}
            {product.size ? ` · ${product.size}` : ""}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{product.name}</h3>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <Tile label="Maxi" price={product.maxi} best={product.cheaper === "maxi"} higher={product.cheaper === "iga"} />
          <Tile label="IGA" price={product.iga} best={product.cheaper === "iga"} higher={product.cheaper === "maxi"} />
        </div>
        <p className="line-clamp-2 text-xs font-medium leading-snug text-pine">{badge}</p>
        <div className="flex flex-wrap items-center justify-between gap-1">
          {qty > 0 ? (
            <div className="flex items-center gap-0.5 rounded-full border border-line p-0.5">
              <button type="button" aria-label={`Retirer un ${product.name}`} onClick={() => onQty(qty - 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                −
              </button>
              <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
              <button type="button" aria-label={`Ajouter un ${product.name}`} onClick={() => onQty(qty + 1)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-moss">
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="btn-solid min-h-10 rounded-full px-3 text-sm font-medium"
            >
              Ajouter
            </button>
          )}
          {fiche && (
            <a
              href={fiche}
              target="_blank"
              rel="noreferrer"
              aria-label={`Vérifier le prix de ${product.name} sur le site du magasin`}
              className="inline-flex min-h-10 items-center px-2 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Vérifier
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
