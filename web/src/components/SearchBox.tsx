import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { suggest, type SearchRecord } from "../lib/search";
import { money } from "../lib/format";
import type { Product } from "../types";

type Props = {
  records: SearchRecord[];
  both: boolean;
  query: string;
  onQuery: (value: string) => void;
  onPick: (product: Product) => void;
  placeholder?: string;
};

export function SearchBox({ records, both, query, onQuery, onPick, placeholder = "Coca, lait, patates, chips…" }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [moved, setMoved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const deferred = useDeferredValue(query);
  const pool = both ? records.filter((record) => !record.product.exclusive) : records;
  const matches = open ? suggest(pool, deferred) : [];
  const activeId = matches.length > 0 ? `${listId}-opt-${active}` : undefined;

  useEffect(() => {
    setActive(0);
    setMoved(false);
  }, [query]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function choose(product: Product) {
    onPick(product);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor="recherche">
        Rechercher un produit
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 shadow-[var(--shadow)]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id="recherche"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={moved ? activeId : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown" && matches.length) {
              event.preventDefault();
              setMoved(true);
              setActive((index) => (index + 1) % matches.length);
            }
            if (event.key === "ArrowUp" && matches.length) {
              event.preventDefault();
              setMoved(true);
              setActive((index) => (index - 1 + matches.length) % matches.length);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (moved && matches.length) choose(matches[active] ?? matches[0]);
              else setOpen(false);
            }
          }}
          className="w-full bg-transparent outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" className="min-h-8 px-1 text-xs text-muted" aria-label="Effacer la recherche" onClick={() => onQuery("")}>
            Effacer
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow)]">
          {matches.map((product, index) => {
            const price = product.saq?.price ?? (product.cheaper === "iga" ? product.iga?.price : product.maxi?.price);
            return (
              <li key={product.id} id={`${listId}-opt-${index}`} role="option" aria-selected={moved && index === active}>
                <button
                  type="button"
                  onMouseEnter={() => {
                    setMoved(true);
                    setActive(index);
                  }}
                  onClick={() => choose(product)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${moved && index === active ? "bg-moss" : ""}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper">
                    {product.image ? (
                      <img src={product.image} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted">{product.brand.slice(0, 1) || "•"}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {product.brand || product.category}
                      {product.size ? ` · ${product.size}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    {price != null && <span className="block text-sm tabular-nums">{money(price)}</span>}
                    {product.iga?.card != null && <span className="block text-[10px] text-muted">Scène {money(product.iga.card)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
