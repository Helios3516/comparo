import type { StopLine, Summary } from "../types";

export const ROWS_PER_PAGE = 8;

export type RouteRow = { kind: "head"; label: string } | { kind: "item"; line: StopLine };

export function rowsOf(lines: StopLine[]): RouteRow[] {
  const rows: RouteRow[] = [];
  let category = "";
  for (const line of lines) {
    if (line.category !== category) {
      category = line.category;
      rows.push({ kind: "head", label: category });
    }
    rows.push({ kind: "item", line });
  }
  return rows;
}

export function paginate(rows: RouteRow[], perPage = ROWS_PER_PAGE) {
  if (rows.length === 0) return [[] as RouteRow[]];
  const pages: RouteRow[][] = [];
  for (let index = 0; index < rows.length; index += perPage) pages.push(rows.slice(index, index + perPage));
  return pages;
}

export function roadmapPages(summary: Summary) {
  const maxiPages = paginate(rowsOf(summary.maxiLines));
  const igaPages = paginate(rowsOf(summary.igaLines));
  const saqPages = summary.saqLines.length ? paginate(rowsOf(summary.saqLines)) : [];
  const pageCount = Math.max(maxiPages.length, igaPages.length);
  return { maxiPages, igaPages, saqPages, pageCount };
}
