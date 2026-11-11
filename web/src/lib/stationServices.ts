export type OsmPlace = {
  lat: number;
  lng: number;
  tags: Record<string, string>;
};

export type Amenity = {
  id: string;
  label: string;
};

export type BrandMark = {
  letters: string;
  bg: string;
  fg: string;
};

const NEAR_METERS = 80;

const MARKS: Record<string, BrandMark> = {
  irving: { letters: "IR", bg: "#f15a22", fg: "#fff8f4" },
  "petro-canada": { letters: "PC", bg: "#d71920", fg: "#fff7f7" },
  ultramar: { letters: "UL", bg: "#0057b8", fg: "#f4f8ff" },
  shell: { letters: "SH", bg: "#fbce07", fg: "#7a1020" },
  esso: { letters: "ES", bg: "#d71920", fg: "#fff7f7" },
  "canadian tire": { letters: "CT", bg: "#e31837", fg: "#fff7f7" },
  axco: { letters: "AX", bg: "#163a72", fg: "#f4f8ff" },
};

export function brandMark(brand: string): BrandMark {
  const known = MARKS[brand.trim().toLowerCase()];
  if (known) return known;
  const letters = brand
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { letters: letters || "?", bg: "#1f7a4d", fg: "#f4fff8" };
}

function meters(lat: number, lng: number, otherLat: number, otherLng: number) {
  const earth = 6371000;
  const dLat = ((otherLat - lat) * Math.PI) / 180;
  const dLng = ((otherLng - lng) * Math.PI) / 180;
  const start = (lat * Math.PI) / 180;
  const end = (otherLat * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(haversine));
}

function textOf(tags: Record<string, string>) {
  return `${tags.name ?? ""} ${tags.operator ?? ""} ${tags.brand ?? ""}`;
}

function isConvenience(tags: Record<string, string>) {
  if (tags.shop === "convenience") return true;
  return /dépanneur|depanneur|boni-soir|couche-tard/i.test(textOf(tags));
}

export function parsePlaces(payload: unknown): OsmPlace[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { elements?: unknown }).elements)) return [];
  const places: OsmPlace[] = [];
  for (const item of (payload as { elements: unknown[] }).elements) {
    if (!item || typeof item !== "object") continue;
    const row = item as { lat?: unknown; lon?: unknown; center?: { lat?: unknown; lon?: unknown }; tags?: unknown };
    const lat = typeof row.lat === "number" ? row.lat : row.center && typeof row.center.lat === "number" ? row.center.lat : null;
    const lng = typeof row.lon === "number" ? row.lon : row.center && typeof row.center.lon === "number" ? row.center.lon : null;
    if (lat == null || lng == null || !row.tags || typeof row.tags !== "object") continue;
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(row.tags)) {
      if (typeof value === "string") tags[key] = value;
    }
    places.push({ lat, lng, tags });
  }
  return places;
}

export function amenitiesFor(station: { lat: number; lng: number }, places: OsmPlace[]): Amenity[] {
  const near = places.filter((place) => meters(station.lat, station.lng, place.lat, place.lng) <= NEAR_METERS);
  const amenities: Amenity[] = [];
  if (near.some((place) => isConvenience(place.tags))) {
    const couche = near.some((place) => /couche-tard/i.test(textOf(place.tags)));
    const boni = near.some((place) => /boni-soir/i.test(textOf(place.tags)));
    amenities.push({
      id: "depanneur",
      label: couche ? "Dépanneur Couche-Tard" : boni ? "Dépanneur Boni-Soir" : "Dépanneur",
    });
  }
  if (near.some((place) => place.tags.opening_hours === "24/7")) {
    amenities.push({ id: "24h", label: "Ouvert 24 h" });
  }
  if (near.some((place) => place.tags.self_service === "yes")) {
    amenities.push({ id: "self", label: "Libre-service" });
  }
  return amenities;
}

const OVERPASS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const QUERY = `[out:json][timeout:25];
(
  node["amenity"="fuel"](49.15,-68.36,49.28,-68.12);
  way["amenity"="fuel"](49.15,-68.36,49.28,-68.12);
  node["shop"="convenience"](49.15,-68.36,49.28,-68.12);
  way["shop"="convenience"](49.15,-68.36,49.28,-68.12);
);
out center tags;`;

const PLACES_KEY = "comparo-osm-v1";

export function cachedPlaces(): OsmPlace[] {
  try {
    const raw = localStorage.getItem(PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { lat?: unknown; lng?: unknown; tags?: unknown };
      if (typeof row.lat !== "number" || typeof row.lng !== "number" || !row.tags || typeof row.tags !== "object") return [];
      const tags: Record<string, string> = {};
      for (const [key, value] of Object.entries(row.tags as Record<string, unknown>)) {
        if (typeof value === "string") tags[key] = value;
      }
      return [{ lat: row.lat, lng: row.lng, tags }];
    });
  } catch {
    return [];
  }
}

function rememberPlaces(places: OsmPlace[]) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  } catch {
    /* navigation privée */
  }
}

export async function loadStationPlaces(): Promise<OsmPlace[]> {
  let lastError: unknown;
  for (const url of OVERPASS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain", Accept: "application/json" },
        body: QUERY,
      });
      if (!response.ok) continue;
      const places = parsePlaces(await response.json());
      if (places.length) {
        rememberPlaces(places);
        return places;
      }
    } catch (error) {
      lastError = error;
    }
  }
  const cached = cachedPlaces();
  if (cached.length) return cached;
  if (lastError) throw lastError;
  return [];
}
