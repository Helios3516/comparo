import type { Product } from "../types";

export type UsualStore = "peu-importe" | "maxi" | "iga";
export type MarkKind = "epicerie" | "saq";

export type Mark = {
  id: string;
  name: string;
  at: string;
  kind: MarkKind;
};

export type Repeat = Mark & { count: number };

export type Memory = {
  store: UsualStore;
  likes: Mark[];
  passes: Mark[];
  repeats: Repeat[];
};

const STORES = new Set<UsualStore>(["peu-importe", "maxi", "iga"]);
const KINDS = new Set<MarkKind>(["epicerie", "saq"]);
const MAX = 40;

export function emptyMemory(): Memory {
  return { store: "peu-importe", likes: [], passes: [], repeats: [] };
}

function asMark(value: unknown): Mark | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Mark>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (!id || id.length > 80 || name.length < 1 || name.length > 120) return null;
  const kind = KINDS.has(raw.kind as MarkKind) ? (raw.kind as MarkKind) : "epicerie";
  const at = typeof raw.at === "string" && raw.at.length <= 40 ? raw.at : "";
  return { id, name, at, kind };
}

function takeMarks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const marks: Mark[] = [];
  for (const item of value) {
    const mark = asMark(item);
    if (!mark || seen.has(mark.id)) continue;
    seen.add(mark.id);
    marks.push(mark);
    if (marks.length >= MAX) break;
  }
  return marks;
}

export function normalizeMemory(value: unknown): Memory {
  if (!value || typeof value !== "object") return emptyMemory();
  const raw = value as Partial<Memory>;
  const likes = takeMarks(raw.likes);
  const liked = new Set(likes.map((item) => item.id));
  const passes = takeMarks(raw.passes).filter((item) => !liked.has(item.id));
  const passed = new Set(passes.map((item) => item.id));
  const repeats: Repeat[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.repeats)) {
    for (const item of raw.repeats) {
      const mark = asMark(item);
      const count = item && typeof item === "object" ? (item as { count?: unknown }).count : 0;
      if (!mark || seen.has(mark.id) || passed.has(mark.id) || typeof count !== "number" || !Number.isFinite(count) || count < 1) continue;
      seen.add(mark.id);
      repeats.push({ ...mark, count: Math.min(99, Math.round(count)) });
      if (repeats.length >= MAX) break;
    }
  }
  return {
    store: STORES.has(raw.store as UsualStore) ? (raw.store as UsualStore) : "peu-importe",
    likes,
    passes,
    repeats,
  };
}

type MarkInput = { id: string; name: string; kind?: MarkKind };

function stamp(input: MarkInput, at: string): Mark | null {
  return asMark({ id: input.id, name: input.name, kind: input.kind ?? "epicerie", at });
}

function without(marks: Mark[], id: string) {
  return marks.filter((item) => item.id !== id);
}

export function toggleLike(memory: Memory, input: MarkInput, at: string): Memory {
  const mark = stamp(input, at);
  if (!mark) return memory;
  const liked = memory.likes.some((item) => item.id === mark.id);
  if (liked) return { ...memory, likes: without(memory.likes, mark.id) };
  return {
    ...memory,
    likes: [mark, ...without(memory.likes, mark.id)].slice(0, MAX),
    passes: without(memory.passes, mark.id),
  };
}

export function togglePass(memory: Memory, input: MarkInput, at: string): Memory {
  const mark = stamp(input, at);
  if (!mark) return memory;
  const passed = memory.passes.some((item) => item.id === mark.id);
  if (passed) return { ...memory, passes: without(memory.passes, mark.id) };
  return {
    ...memory,
    passes: [mark, ...without(memory.passes, mark.id)].slice(0, MAX),
    likes: without(memory.likes, mark.id),
    repeats: memory.repeats.filter((item) => item.id !== mark.id),
  };
}

export function rememberBuy(memory: Memory, input: MarkInput, at: string): Memory {
  const mark = stamp(input, at);
  if (!mark) return memory;
  if (memory.passes.some((item) => item.id === mark.id)) return memory;
  const previous = memory.repeats.find((item) => item.id === mark.id);
  const count = Math.min(99, (previous?.count ?? 0) + 1);
  return {
    ...memory,
    repeats: [{ ...mark, count }, ...memory.repeats.filter((item) => item.id !== mark.id)].slice(0, MAX),
  };
}

export function setUsualStore(memory: Memory, store: UsualStore): Memory {
  if (!STORES.has(store)) return memory;
  return { ...memory, store };
}

function score(product: Product, memory: Memory, liked: Set<string>) {
  const favorite = liked.has(product.id) ? 2 : 0;
  const home = memory.store !== "peu-importe" && product.cheaper === memory.store ? 1 : 0;
  return favorite * 10 + home + product.dealPct;
}

export function forYou(products: Product[], memory: Memory) {
  const liked = new Set(memory.likes.map((item) => item.id));
  const repeats = new Set(memory.repeats.filter((item) => item.count >= 2).map((item) => item.id));
  const passed = new Set(memory.passes.map((item) => item.id));
  return products
    .filter((product) => !passed.has(product.id) && (liked.has(product.id) || repeats.has(product.id)))
    .sort((a, b) => score(b, memory, liked) - score(a, memory, liked) || a.name.localeCompare(b.name, "fr"))
    .slice(0, 4);
}
