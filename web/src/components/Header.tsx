import { useEffect, useRef, useState } from "react";
import type { SearchRecord } from "../lib/search";
import type { Product, View } from "../types";
import type { ThemeMode } from "../lib/useTheme";
import { SearchBox } from "./SearchBox";
import { AccountMenu } from "./AccountMenu";
import type { Archive, ArchivedList } from "../lib/archive";

type Props = {
  view: View;
  onView: (view: View) => void;
  count: number;
  deals: number;
  mode: ThemeMode;
  onTheme: () => void;
  records: SearchRecord[];
  both: boolean;
  query: string;
  onQuery: (value: string) => void;
  onPick: (product: Product) => void;
  onScan: () => void;
  placeholder?: string;
  accountName: string;
  fullName: string;
  email: string;
  archive: Archive;
  onAccount: () => void;
  onLogout: () => void;
  onResume: (list: ArchivedList) => void;
  onOpenScan: (id: string, name: string) => void;
};

const NAV: { id: View; label: string }[] = [
  { id: "catalogue", label: "Catalogue" },
  { id: "imbattables", label: "Imbattables" },
  { id: "repas", label: "Repas" },
  { id: "saq", label: "SAQ" },
  { id: "essence", label: "Essence" },
  { id: "liste", label: "Ma liste" },
];

const THEME_LABEL: Record<ThemeMode, string> = {
  system: "Thème automatique",
  dark: "Mode sombre",
  light: "Mode clair",
};

const THEME_SHORT: Record<ThemeMode, string> = {
  system: "Auto",
  dark: "Sombre",
  light: "Clair",
};

export function Header(props: Props) {
  const [pop, setPop] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPop(true);
    const timer = window.setTimeout(() => setPop(false), 280);
    return () => window.clearTimeout(timer);
  }, [props.count]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.getElementById("recherche")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[90rem] grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-2 px-4 py-3 md:flex md:gap-3 md:px-6">
          <button type="button" onClick={() => props.onView("accueil")} aria-label="Comparo, retour à l’accueil" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-pine-ink">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M5 15c2-5 4.2-7.5 7-7.5S17 10 19 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="8.2" r="1.3" fill="currentColor" />
              </svg>
            </span>
            <span className="text-left leading-tight">
              <span className="block font-serif text-xl tracking-tight">Comparo</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted">Baie-Comeau</span>
            </span>
          </button>

          <button
            type="button"
            onClick={props.onScan}
            className="flex h-10 items-center gap-1.5 rounded-full bg-pine px-3 text-sm font-medium text-pine-ink md:order-4"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M4 7V5h3M17 5h3v2M4 17v2h3M20 17v2h-3M7 8v8M10 8v8M14 8v8M17 8v8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Scanner</span>
            <span className="sm:hidden">Scan</span>
          </button>

          <button
            type="button"
            onClick={props.onTheme}
            aria-label={THEME_LABEL[props.mode]}
            title={THEME_LABEL[props.mode]}
            className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm md:order-5"
          >
            <span aria-hidden="true">{props.mode === "dark" ? "☾" : props.mode === "light" ? "☀" : "◐"}</span>
            <span className="hidden lg:inline">{THEME_SHORT[props.mode]}</span>
          </button>

          <div className="col-span-3 flex justify-end md:order-6 md:col-auto">
            <AccountMenu
              firstName={props.accountName}
              fullName={props.fullName}
              email={props.email}
              archive={props.archive}
              onAccount={props.onAccount}
              onLogout={props.onLogout}
              onResume={props.onResume}
              onScan={props.onOpenScan}
            />
          </div>

          <div className="col-span-3 min-w-0 md:order-2 md:col-auto md:min-w-[12rem] md:flex-1">
            <SearchBox records={props.records} both={props.both} query={props.query} onQuery={props.onQuery} onPick={props.onPick} placeholder={props.placeholder} />
          </div>

          <nav className="col-span-3 flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-card p-1 md:order-3 md:col-auto md:shrink-0">
            {NAV.map((item) => {
              const active = props.view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => props.onView(item.id)}
                  className={`relative shrink-0 rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-moss text-ink" : "text-ink hover:bg-moss"}`}
                >
                  {item.label}
                  {item.id === "imbattables" && props.deals > 0 && (
                    <span className="ml-1.5 text-[11px] text-pine">{props.deals}</span>
                  )}
                  {item.id === "liste" && (
                    <span
                      className={`ml-1.5 inline-grid min-w-5 place-items-center rounded-full px-1 text-[11px] ${pop ? "pop" : ""} ${active ? "bg-paper text-ink" : "bg-pine text-pine-ink"}`}
                      aria-label={`${props.count} article${props.count > 1 ? "s" : ""} dans la liste`}
                    >
                      {props.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
    </header>
  );
}
