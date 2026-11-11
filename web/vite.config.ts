import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleReviewRequest } from "./src/lib/reviewApi";
import type { ReviewBook } from "./src/lib/reviews";

const REVIEWS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data", "reviews.json");

const ALLOWED_HOSTS = new Set([
  "media.sobeys.com",
  "digital.loblaws.ca",
  "assets.shop.loblaws.ca",
]);

function imgProxy(): Plugin {
  const middleware = async (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: Buffer | string) => void;
    },
    next: () => void,
  ) => {
    const raw = req.url ?? "";
    if (!raw.startsWith("/api/img?")) {
      next();
      return;
    }
    try {
      const target = new URL(raw, "http://comparo.local").searchParams.get("url");
      const parsed = target ? new URL(target) : null;
      if (!parsed || parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
        res.statusCode = 403;
        res.end("Hôte non autorisé");
        return;
      }
      const response = await fetch(parsed, {
        headers: { Accept: "image/avif,image/webp,image/*,*/*", "User-Agent": "Comparo/1.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        res.statusCode = response.status;
        res.end();
        return;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 2_500_000) {
        res.statusCode = 413;
        res.end();
        return;
      }
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(bytes);
    } catch {
      res.statusCode = 502;
      res.end();
    }
  };

  return {
    name: "comparo-img-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function readReviews(): ReviewBook {
  try {
    return JSON.parse(readFileSync(REVIEWS_FILE, "utf8")) as ReviewBook;
  } catch {
    return {};
  }
}

function reviewsApi(): Plugin {
  const handle = async (
    req: { url?: string; method?: string; on: (event: string, listener: (chunk: Buffer) => void) => void },
    res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
    next: () => void,
  ) => {
    const url = req.url ?? "";
    if (url !== "/api/reviews" && !url.startsWith("/api/reviews?")) {
      next();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const chunks: Buffer[] = [];
    if (req.method === "POST") {
      await new Promise<void>((resolve, reject) => {
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve());
        req.on("error", () => reject(new Error("body")));
      }).catch(() => undefined);
    }
    const result = await handleReviewRequest(req.method, Buffer.concat(chunks).toString("utf8"), {
      read: readReviews,
      write: (book) => {
        mkdirSync(path.dirname(REVIEWS_FILE), { recursive: true });
        writeFileSync(REVIEWS_FILE, JSON.stringify(book, null, 2));
      },
    });
    res.statusCode = result.status;
    res.end(JSON.stringify(result.body));
  };

  return {
    name: "comparo-reviews",
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), imgProxy(), reviewsApi()],
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 4173, host: "127.0.0.1" },
});
