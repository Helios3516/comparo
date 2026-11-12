import { useEffect, useRef, useState } from "react";
import type { Archive, ArchivedList } from "../lib/archive";
import { money } from "../lib/format";

type Props = {
  firstName: string;
  fullName: string;
  email: string;
  archive: Archive;
  onAccount: () => void;
  onLogout: () => void;
  onResume: (list: ArchivedList) => void;
  onScan: (id: string, name: string) => void;
};

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(date);
}

export function AccountMenu({ firstName, fullName, email, archive, onAccount, onLogout, onResume, onScan }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-40 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm"
      >
        <span className="truncate">{firstName}</span>
        <span aria-hidden="true" className="text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-3xl border border-line bg-card p-4 shadow-[var(--shadow)]">
          <p className="font-serif text-2xl leading-tight">{fullName}</p>
          {email && <p className="mt-1 truncate text-sm text-muted">{email}</p>}

          <section className="mt-4 rounded-2xl bg-moss px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-pine">Meilleure économie</p>
            <p className="mt-1 font-serif text-3xl tabular-nums">{archive.best ? money(archive.best.amount) : "—"}</p>
            <p className="text-xs text-muted">{archive.best ? `sur une liste, le ${when(archive.best.at)}` : "Elle apparaîtra quand une liste coûte moins cher en deux arrêts."}</p>
          </section>

          <section className="mt-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Dernières listes</h2>
            {archive.lists.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucune liste archivée pour l’instant.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {archive.lists.map((list) => (
                  <li key={list.id} className="rounded-2xl border border-line px-3 py-2">
                    <p className="text-sm">{list.count} article{list.count > 1 ? "s" : ""} · {money(list.total)}</p>
                    <p className="truncate text-xs text-muted">{when(list.at)} · {list.lines.map((line) => line.name).slice(0, 3).join(", ")}</p>
                    <button
                      type="button"
                      className="mt-1 text-sm font-medium text-pine"
                      onClick={() => {
                        onResume(list);
                        setOpen(false);
                      }}
                    >
                      Reprendre cette liste
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Derniers produits scannés</h2>
            {archive.scans.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucun code scanné pour l’instant.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {archive.scans.map((scan) => (
                  <li key={scan.id}>
                    <button
                      type="button"
                      className="w-full truncate py-2 text-left text-sm hover:underline"
                      onClick={() => {
                        onScan(scan.id, scan.name);
                        setOpen(false);
                      }}
                    >
                      {scan.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { onAccount(); setOpen(false); }} className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-pine-ink">
              Mon compte
            </button>
            <button type="button" onClick={() => { onLogout(); setOpen(false); }} className="rounded-full border border-line px-4 py-2 text-sm">
              Sortir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
