export type ArchivedLine = {
  id: string;
  name: string;
  qty: number;
};

export type ArchivedList = {
  id: string;
  at: string;
  count: number;
  total: number;
  saved: number;
  lines: ArchivedLine[];
};

export type ArchivedScan = {
  id: string;
  name: string;
  at: string;
};

export type BestSaving = {
  amount: number;
  at: string;
};

export type Archive = {
  lists: ArchivedList[];
  scans: ArchivedScan[];
  best: BestSaving | null;
};

const MAX_LISTS = 6;
const MAX_SCANS = 8;

export function emptyArchive(): Archive {
  return { lists: [], scans: [], best: null };
}

function cleanLine(value: unknown): ArchivedLine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ArchivedLine>;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (typeof raw.qty !== "number" || !Number.isFinite(raw.qty) || raw.qty <= 0) return null;
  return { id: raw.id, name: raw.name.trim(), qty: Math.min(99, Math.round(raw.qty)) };
}

function cleanList(value: unknown): ArchivedList | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ArchivedList>;
  if (typeof raw.id !== "string" || typeof raw.at !== "string") return null;
  if (typeof raw.count !== "number" || typeof raw.total !== "number" || typeof raw.saved !== "number") return null;
  const lines = Array.isArray(raw.lines) ? raw.lines.flatMap((item) => {
    const line = cleanLine(item);
    return line ? [line] : [];
  }) : [];
  if (!lines.length) return null;
  return { id: raw.id, at: raw.at, count: lines.length, total: raw.total, saved: raw.saved, lines };
}

export function normalizeArchive(value: unknown): Archive {
  if (!value || typeof value !== "object") return emptyArchive();
  const raw = value as Partial<Archive>;
  const lists = Array.isArray(raw.lists) ? raw.lists.flatMap((item) => {
    const list = cleanList(item);
    return list ? [list] : [];
  }).slice(0, MAX_LISTS) : [];
  const scans = Array.isArray(raw.scans) ? raw.scans.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const scan = item as Partial<ArchivedScan>;
    if (typeof scan.id !== "string" || typeof scan.name !== "string" || typeof scan.at !== "string") return [];
    if (!scan.id || !scan.name.trim()) return [];
    return [{ id: scan.id, name: scan.name.trim(), at: scan.at }];
  }).slice(0, MAX_SCANS) : [];
  const bestRaw = raw.best;
  const best = bestRaw && typeof bestRaw === "object" && typeof bestRaw.amount === "number" && Number.isFinite(bestRaw.amount) && typeof bestRaw.at === "string"
    ? { amount: bestRaw.amount, at: bestRaw.at }
    : null;
  return { lists, scans, best };
}

export function listSignature(lines: ArchivedLine[]) {
  return [...lines].map((line) => `${line.id}:${line.qty}`).sort().join("|");
}

export function rememberList(archive: Archive, lines: ArchivedLine[], total: number, saved: number, at: string): Archive {
  const clean = lines.flatMap((line) => (line.id && line.name.trim() && line.qty > 0 ? [{ ...line, name: line.name.trim(), qty: Math.min(99, Math.round(line.qty)) }] : []));
  if (!clean.length) return archive;
  const signature = listSignature(clean);
  const current = archive.lists[0];
  if (current && listSignature(current.lines) === signature) {
    if (current.total === total && current.saved === saved) return archive;
    const next = { ...current, at, total, saved, count: clean.length, lines: clean };
    return { ...archive, lists: [next, ...archive.lists.slice(1)] };
  }
  const list: ArchivedList = { id: at, at, count: clean.length, total, saved, lines: clean };
  return { ...archive, lists: [list, ...archive.lists.filter((item) => listSignature(item.lines) !== signature)].slice(0, MAX_LISTS) };
}

export function rememberScan(archive: Archive, id: string, name: string, at: string): Archive {
  const clean = name.trim();
  if (!id || !clean) return archive;
  const scan = { id, name: clean, at };
  return { ...archive, scans: [scan, ...archive.scans.filter((item) => item.id !== id)].slice(0, MAX_SCANS) };
}

export function rememberSaving(archive: Archive, amount: number, at: string): Archive {
  if (!Number.isFinite(amount) || amount < 0.01) return archive;
  if (archive.best && archive.best.amount >= amount - 0.009) return archive;
  return { ...archive, best: { amount, at } };
}
