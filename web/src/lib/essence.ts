export const ESSENCE_URL = "https://www.gasquebec.ca/api/cities/baie-comeau";
export const ESSENCE_FALLBACK = "/essence.json";

export type FuelKind = "ordinaire" | "super" | "diesel";

export const FUELS: { id: FuelKind; label: string }[] = [
  { id: "ordinaire", label: "Ordinaire" },
  { id: "super", label: "Super" },
  { id: "diesel", label: "Diesel" },
];

export type Station = {
  id: string;
  name: string;
  brand: string;
  address: string;
  lat: number;
  lng: number;
  ordinaire: number | null;
  super: number | null;
  diesel: number | null;
  updatedAt: string;
  aged: boolean;
};

export type EssenceSnapshot = {
  city: string;
  updatedAt: string;
  attribution: string;
  attributionUrl: string;
  sourceUrl: string;
  live: boolean;
  stations: Station[];
};

const STALE_MS = 48 * 60 * 60 * 1000;

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function fuelPrice(station: Station, fuel: FuelKind) {
  return station[fuel];
}

export function parseEssence(payload: unknown, live = false): EssenceSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.stations)) return null;

  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : "";
  const reference = Date.parse(updatedAt);
  const cutoff = (Number.isFinite(reference) ? reference : Date.now()) - STALE_MS;
  const meta = data.meta && typeof data.meta === "object" ? (data.meta as Record<string, unknown>) : {};
  const attribution =
    meta.attribution && typeof meta.attribution === "object" ? (meta.attribution as Record<string, unknown>) : {};
  const text = attribution.text && typeof attribution.text === "object" ? (attribution.text as Record<string, unknown>) : {};
  const source = meta.dataSource && typeof meta.dataSource === "object" ? (meta.dataSource as Record<string, unknown>) : {};

  const stations: Station[] = [];
  for (const item of data.stations) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const lat = numberOrNull(row.lat);
    const lng = numberOrNull(row.lng);
    if (lat == null || lng == null) continue;
    const stationUpdated = typeof row.updatedAt === "string" ? row.updatedAt : "";
    const seen = Date.parse(stationUpdated);
    const name = typeof row.name === "string" && row.name ? row.name : "Station";
    stations.push({
      id: String(row.stationId ?? `${lat},${lng}`),
      name,
      brand: typeof row.brand === "string" && row.brand ? row.brand : name,
      address: typeof row.address === "string" ? row.address : "",
      lat,
      lng,
      ordinaire: numberOrNull(row.prixOrdinaire),
      super: numberOrNull(row.prixSuper),
      diesel: numberOrNull(row.prixDiesel),
      updatedAt: stationUpdated,
      aged: !Number.isFinite(seen) || seen < cutoff,
    });
  }
  if (!stations.length) return null;

  return {
    city: typeof data.city === "string" && data.city ? data.city : "Baie-Comeau",
    updatedAt,
    attribution:
      typeof text.fr === "string" && text.fr ? text.fr : "Prix : Régie de l’énergie du Québec, via Gas Québec",
    attributionUrl:
      typeof attribution.url === "string" && attribution.url
        ? attribution.url
        : "https://www.gasquebec.ca/villes/baie-comeau",
    sourceUrl: typeof source.url === "string" && source.url ? source.url : "https://regieessencequebec.ca/",
    live,
    stations,
  };
}

export function cents(value: number) {
  return `${value.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ¢`;
}

export function pinColor(price: number, low: number, high: number) {
  if (!(high > low)) return "rgb(31, 122, 77)";
  const t = Math.min(1, Math.max(0, (price - low) / (high - low)));
  const from = t < 0.5 ? [31, 122, 77] : [201, 137, 26];
  const to = t < 0.5 ? [201, 137, 26] : [194, 59, 59];
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const channel = (index: number) => Math.round(from[index] + (to[index] - from[index]) * local);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function directionsUrl(station: Station) {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
}

export async function loadEssence(): Promise<EssenceSnapshot> {
  try {
    const live = await fetch(ESSENCE_URL, { headers: { Accept: "application/json" } });
    if (live.ok) {
      const parsed = parseEssence(await live.json(), true);
      if (parsed) return parsed;
    }
  } catch {
    // La copie enregistrée sert quand le réseau ne répond pas.
  }
  const file = await fetch(ESSENCE_FALLBACK);
  if (!file.ok) throw new Error("Prix d’essence indisponibles.");
  const parsed = parseEssence(await file.json(), false);
  if (!parsed) throw new Error("Prix d’essence illisibles.");
  return parsed;
}
