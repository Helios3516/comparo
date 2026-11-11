import { jsPDF } from "jspdf";
import { articles, longDate, money, savingsCopy } from "./format";
import { roadmapPages, type RouteRow } from "./roadmapPages";
import type { Summary } from "../types";

const paper = [244, 240, 230] as const;
const ink = [28, 36, 48] as const;
const muted = [93, 103, 95] as const;
const pine = [31, 107, 69] as const;
const pineInk = [244, 255, 248] as const;
const maxi = [232, 180, 35] as const;
const iga = [210, 15, 43] as const;

function plain(value: string) {
  return value.replace(/[\u202f\u00a0]/g, " ").replace(/[\u2019\u2018]/g, "'").replace(/[\u2013\u2014]/g, "-");
}

function drawColumn(
  pdf: jsPDF,
  rows: RouteRow[],
  x: number,
  y: number,
  width: number,
  height: number,
  accent: readonly [number, number, number],
  stop: string,
  store: string,
  street: string,
  empty: string,
) {
  pdf.setFillColor(255, 253, 249);
  pdf.setDrawColor(228, 220, 207);
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
  pdf.setFillColor(...accent);
  pdf.rect(x, y, width, 1.6, "F");
  pdf.setTextColor(...muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(stop, x + 4, y + 7);
  pdf.setTextColor(...ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(store, x + 4, y + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...muted);
  pdf.text(street, x + width - 4, y + 14, { align: "right" });

  let cursor = y + 20;
  if (rows.length === 0) {
    pdf.setFontSize(9);
    pdf.text(plain(empty), x + 4, cursor);
    return;
  }
  for (const row of rows) {
    if (row.kind === "head") {
      pdf.setTextColor(...pine);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(plain(row.label).toUpperCase(), x + 4, cursor);
      cursor += 5;
      continue;
    }
    pdf.setDrawColor(...ink);
    pdf.setLineWidth(0.3);
    pdf.rect(x + 4, cursor - 3, 3.2, 3.2);
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const title = `${row.line.qty > 1 ? `${row.line.qty} x ` : ""}${row.line.name}`;
    const clipped = pdf.splitTextToSize(plain(title), width - 28)[0] ?? "";
    pdf.text(clipped, x + 10, cursor);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    const detail = [row.line.brand, row.line.size, plain(money(row.line.unit)), row.line.card != null ? `Carte Scène ${plain(money(row.line.card))}` : "", row.line.tie ? "même prix" : ""]
      .filter(Boolean)
      .join(" · ");
    pdf.text(pdf.splitTextToSize(plain(detail), width - 36)[0] ?? "", x + 10, cursor + 4);
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    pdf.text(plain(money(row.line.total)), x + width - 4, cursor, { align: "right" });
    cursor += 9;
  }
}

export function buildRoadmapPdf(summary: Summary) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const { maxiPages, igaPages, saqPages, pageCount } = roadmapPages(summary);
  const today = plain(longDate(new Date().toISOString()));

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage();
    pdf.setFillColor(...paper);
    pdf.rect(0, 0, 297, 210, "F");
    pdf.setTextColor(...pine);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("COMPARO · BAIE-COMEAU", 12, 12);
    pdf.setTextColor(...ink);
    pdf.setFont("times", "bold");
    pdf.setFontSize(22);
    pdf.text("Feuille de route", 12, 21);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text(today, 285, 12, { align: "right" });
    pdf.text(`Page ${page + 1} / ${pageCount} · ${plain(articles(summary.count))}`, 285, 17, { align: "right" });

    drawColumn(
      pdf,
      maxiPages[page] ?? [],
      10,
      28,
      135,
      158,
      maxi,
      "ARRÊT 1",
      "Maxi",
      "Boulevard Laflèche",
      page === 0 ? "Rien à prendre au Maxi." : "Fin de la liste pour cet arrêt.",
    );
    drawColumn(
      pdf,
      igaPages[page] ?? [],
      152,
      28,
      135,
      158,
      iga,
      "ARRÊT 2",
      "IGA",
      "Rue de Bretagne",
      page === 0 ? "Rien à prendre à l’IGA." : "Fin de la liste pour cet arrêt.",
    );

    pdf.setFillColor(...pine);
    pdf.roundedRect(10, 190, 277, 14, 2, 2, "F");
    pdf.setTextColor(...pineInk);
    pdf.setFontSize(8);
    pdf.text("100 % MAXI", 16, 195);
    pdf.text("100 % IGA", 62, 195);
    pdf.text("PARCOURS OPTIMISÉ", 108, 195);
    pdf.setFont("times", "bold");
    pdf.setFontSize(12);
    pdf.text(plain(money(summary.maxiTotal)), 16, 201);
    pdf.text(plain(money(summary.igaTotal)), 62, 201);
    pdf.text(plain(money(summary.optimized)), 108, 201);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const note = pdf.splitTextToSize(plain(savingsCopy(summary)), 90);
    pdf.text(note.slice(0, 2), 280, 196, { align: "right" });
  }

  for (let page = 0; page < saqPages.length; page += 1) {
    pdf.addPage();
    pdf.setFillColor(...paper);
    pdf.rect(0, 0, 297, 210, "F");
    pdf.setTextColor(...pine);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("COMPARO · BAIE-COMEAU", 12, 12);
    pdf.setTextColor(...ink);
    pdf.setFont("times", "bold");
    pdf.setFontSize(22);
    pdf.text("Feuille de route · SAQ", 12, 21);
    drawColumn(pdf, saqPages[page] ?? [], 10, 28, 277, 158, pine, "ARRÊT 3", "SAQ", "Lasalle ou Laflèche", "Rien à prendre à la SAQ.");
  }

  return pdf;
}
