import { get, put } from "@vercel/blob";

type Review = { author: string; stars: number; text: string; at: string };
type ReviewBook = Record<string, Review[]>;

type NodeRequest = {
  method?: string;
  body?: unknown;
  on: (event: string, listener: (chunk?: Buffer | string) => void) => void;
};

type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const BLOB_PATH = "reviews.json";

function applyReview(book: ReviewBook, input: { sku: string; author: string; stars: number; text: string }) {
  const sku = input.sku.trim();
  const author = input.author.trim();
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!/^\d{4,14}$/.test(sku)) return { ok: false as const, error: "Ce produit n’a pas de code SAQ." };
  if (author.length < 2 || author.length > 40) return { ok: false as const, error: "Le prénom du compte est requis." };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { ok: false as const, error: "Choisissez une note de 1 à 5." };
  if (text.length < 2 || text.length > 400) return { ok: false as const, error: "Le commentaire doit faire entre 2 et 400 caractères." };
  const review: Review = { author, stars: input.stars, text, at: new Date().toISOString() };
  const others = (book[sku] ?? []).filter((item) => item.author.localeCompare(author, "fr", { sensitivity: "accent" }) !== 0);
  return { ok: true as const, book: { ...book, [sku]: [review, ...others] } };
}

async function readBody(req: NodeRequest) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve());
    req.on("error", () => reject(new Error("body")));
  });
  return Buffer.concat(chunks).toString("utf8");
}

async function readBook(): Promise<ReviewBook> {
  const file = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!file || file.statusCode !== 200 || !file.stream) return {};
  return JSON.parse(await new Response(file.stream).text()) as ReviewBook;
}

async function writeBook(book: ReviewBook) {
  await put(BLOB_PATH, JSON.stringify(book, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      res.statusCode = 200;
      res.end(JSON.stringify(await readBook()));
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Méthode refusée." }));
      return;
    }
    let body: { sku?: string; author?: string; stars?: number; text?: string } = {};
    try {
      body = JSON.parse(await readBody(req)) as typeof body;
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Avis illisible." }));
      return;
    }
    const result = applyReview(await readBook(), {
      sku: String(body.sku ?? ""),
      author: String(body.author ?? ""),
      stars: Number(body.stars),
      text: String(body.text ?? ""),
    });
    if (!result.ok) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    await writeBook(result.book);
    res.statusCode = 200;
    res.end(JSON.stringify(result.book));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Les avis Comparo ne répondent pas." }));
  }
}
