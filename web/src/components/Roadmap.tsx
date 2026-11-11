import { useEffect, useState } from "react";
import { articles, longDate, money, savingsCopy } from "../lib/format";
import { buildRoadmapPdf } from "../lib/roadmapPdf";
import { roadmapPages, type RouteRow } from "../lib/roadmapPages";
import type { Summary } from "../types";

function picture(url: string | null) {
  if (!url || !/^https:\/\//.test(url)) return null;
  return url;
}

function Column({
  stop,
  store,
  street,
  rows,
  page,
  empty,
}: {
  stop: string;
  store: string;
  street: string;
  rows: RouteRow[];
  page: number;
  empty: string;
}) {
  const accent = store === "Maxi" ? "#e8b423" : "#d20f2b";
  return (
    <section style={{ flex: 1, minWidth: 0, background: "#fffdf9", border: "1px solid #e4dccf", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "14px 16px 12px", borderBottom: "1px solid #efe8dc", borderTop: `5px solid ${accent}` }}>
        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#5d675f" }}>{stop}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26 }}>{store}</strong>
          <span style={{ fontSize: 12, color: "#5d675f" }}>{street}</span>
        </div>
      </header>
      <div style={{ padding: "6px 10px 10px", flex: 1 }}>
        {rows.length === 0 ? (
          <p style={{ color: "#5d675f", fontSize: 13, padding: 12 }}>{page === 0 ? empty : "Fin de la liste pour cet arrêt."}</p>
        ) : (
          rows.map((row, index) =>
            row.kind === "head" ? (
              <div key={`h-${row.label}-${index}`} style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1f6b45", fontWeight: 620 }}>
                {row.label}
              </div>
            ) : (
              <div key={row.line.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 58, borderBottom: "1px solid #f0eae0" }}>
                <span style={{ width: 15, height: 15, border: "1.5px solid #1c2430", borderRadius: 3, flex: "0 0 auto" }} />
                <span style={{ width: 42, height: 42, borderRadius: 8, overflow: "hidden", background: "#f6f3ea", flex: "0 0 auto", display: "grid", placeItems: "center" }}>
                  {picture(row.line.image) ? (
                    <img
                      src={picture(row.line.image) ?? undefined}
                      alt=""
                      style={{ width: 42, height: 42, objectFit: "contain" }}
                      onError={(event) => {
                        event.currentTarget.remove();
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: "#5d675f" }}>•</span>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 620, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.line.qty > 1 ? `${row.line.qty} × ` : ""}
                    {row.line.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#5d675f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.line.brand ? `${row.line.brand} · ` : ""}
                    {row.line.size ? `${row.line.size} · ` : ""}
                    {money(row.line.unit)}
                    {row.line.card != null ? ` · Carte Scène ${money(row.line.card)}` : ""}
                    {row.line.tie ? " · même prix" : ""}
                  </span>
                </span>
                <strong style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{money(row.line.total)}</strong>
              </div>
            ),
          )
        )}
      </div>
    </section>
  );
}

type Props = {
  summary: Summary;
  onClose: () => void;
};

export function Roadmap({ summary, onClose }: Props) {
  const [status, setStatus] = useState("Préparation du PDF…");
  const { maxiPages, igaPages, pageCount } = roadmapPages(summary);
  const today = longDate(new Date().toISOString());

  function download() {
    setStatus("Mise en page du PDF…");
    try {
      buildRoadmapPdf(summary).save("feuille-de-route-baie-comeau.pdf");
      setStatus("PDF téléchargé.");
    } catch {
      setStatus("Le PDF n’a pas pu être généré. Utilisez Imprimer.");
    }
  }

  useEffect(() => {
    let cancel = false;
    const timer = window.setTimeout(() => {
      if (cancel) return;
      if (!cancel) download();
    }, 200);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
    // La feuille est figée à l'ouverture : un seul export.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-[#1b2420]/55">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-[#1b2420] px-4 py-3 text-[#f4f0e6]">
        <div>
          <p className="font-serif text-xl">Feuille de route</p>
          <p className="text-sm text-[#f4f0e6]/75">{status}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={download} className="rounded-full bg-[#f4f0e6] px-4 py-2 text-sm font-medium text-[#1b2420]">
            Télécharger le PDF
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-full border border-[#f4f0e6]/40 px-4 py-2 text-sm">
            Imprimer
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm">
            Fermer
          </button>
        </div>
      </div>
      <div className="sheet-scale mx-auto flex w-max flex-col gap-6 px-4 py-6">
        {Array.from({ length: pageCount }, (_, page) => (
          <article key={page} className="route-page" style={{ width: 1122, height: 794, background: "#f4f0e6", color: "#1c2430", fontFamily: "Outfit, Arial, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 8 }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "22px 26px 8px" }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1f6b45" }}>Comparo · Baie-Comeau</div>
                <h2 style={{ margin: "2px 0 0", fontFamily: "Fraunces, Georgia, serif", fontSize: 32, fontWeight: 560 }}>Feuille de route</h2>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "#5d675f" }}>
                <div style={{ textTransform: "capitalize" }}>{today}</div>
                <div>
                  Page {page + 1} / {pageCount} · {articles(summary.count)}
                </div>
              </div>
            </header>
            <div style={{ display: "flex", gap: 14, padding: "8px 22px 0", flex: 1, minHeight: 0 }}>
              <Column
                stop="ARRÊT 1"
                store="Maxi"
                street="Boulevard Laflèche"
                rows={maxiPages[page] ?? []}
                page={page}
                empty="Rien à prendre au Maxi — tout est moins cher à l’IGA."
              />
              <Column
                stop="ARRÊT 2"
                store="IGA"
                street="Rue de Bretagne"
                rows={igaPages[page] ?? []}
                page={page}
                empty="Rien à prendre à l’IGA — tout est moins cher au Maxi."
              />
            </div>
            <footer style={{ margin: "10px 22px 16px", background: "#1f6b45", color: "#f4fff8", borderRadius: 16, padding: "12px 16px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 22 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.75 }}>100 % Maxi</div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20 }}>{money(summary.maxiTotal)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.75 }}>100 % IGA</div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20 }}>{money(summary.igaTotal)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.75 }}>Parcours optimisé</div>
                  <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20 }}>{money(summary.optimized)}</div>
                </div>
              </div>
              <div style={{ maxWidth: 420, textAlign: "right", fontSize: 13, lineHeight: 1.35 }}>
                {savingsCopy(summary)}
              </div>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
