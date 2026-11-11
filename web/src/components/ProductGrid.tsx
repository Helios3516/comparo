import { pageWindow } from "../lib/pages";
import { ProductCard } from "./ProductCard";
import type { Product } from "../types";

type Props = {
  products: Product[];
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  qtyOf: (id: string) => number;
  liked?: (id: string) => boolean;
  passed?: (id: string) => boolean;
  onLike?: (product: Product) => void;
  onPass?: (product: Product) => void;
  onAdd: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  hint?: string;
};

export function ProductGrid({ products, page, pageSize, onPage, qtyOf, liked, passed, onLike, onPass, onAdd, onQty, hint }: Props) {
  const pages = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = products.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
        <p className="font-serif text-2xl">Aucun produit par ici</p>
        <p className="mt-2 text-sm text-muted">{hint ?? "Essayez un autre mot, une autre catégorie, ou un autre magasin."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {slice.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            qty={qtyOf(product.id)}
            liked={liked?.(product.id)}
            passed={passed?.(product.id)}
            onLike={onLike ? () => onLike(product) : undefined}
            onPass={onPass ? () => onPass(product) : undefined}
            onAdd={() => onAdd(product.id)}
            onQty={(qty) => onQty(product.id, qty)}
          />
        ))}
      </div>
      {pages > 1 && (
        <nav className="no-print mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pages du catalogue">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => onPage(safePage - 1)}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40"
          >
            Précédent
          </button>
          {pageWindow(safePage, pages).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-muted">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === safePage ? "page" : undefined}
                onClick={() => onPage(item)}
                className={`grid h-10 min-w-10 place-items-center rounded-full border px-2 text-sm tabular-nums ${item === safePage ? "border-pine bg-moss" : "border-line"}`}
              >
                {item + 1}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => onPage(safePage + 1)}
            className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40"
          >
            Suivant
          </button>
        </nav>
      )}
    </div>
  );
}
