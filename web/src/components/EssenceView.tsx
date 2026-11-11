import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BrandMark } from "./BrandMark";
import {
  FUELS,
  cents,
  directionsUrl,
  fuelPrice,
  loadEssence,
  pinColor,
  type EssenceSnapshot,
  type FuelKind,
  type Station,
} from "../lib/essence";
import { amenitiesFor, brandMark, cachedPlaces, loadStationPlaces, type OsmPlace } from "../lib/stationServices";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}

function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EssenceView({ embedded = false }: { embedded?: boolean }) {
  const [snapshot, setSnapshot] = useState<EssenceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [fuel, setFuel] = useState<FuelKind>("ordinaire");
  const [selected, setSelected] = useState<string | null>(null);
  const [places, setPlaces] = useState<OsmPlace[] | null>(() => {
    const cached = cachedPlaces();
    return cached.length ? cached : null;
  });
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const fitted = useRef("");
  const rows = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    let alive = true;
    loadEssence()
      .then((next) => {
        if (alive) setSnapshot(next);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : "Prix d’essence indisponibles.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadStationPlaces()
      .then((next) => {
        if (alive) setPlaces(next);
      })
      .catch(() => {
        if (alive) setPlaces([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = mapNode.current;
    if (!node || mapRef.current) return;
    const map = L.map(node, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([49.216, -68.22], 12);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timer);
  }, [snapshot, embedded]);

  const ranked = useMemo(() => {
    const stations = snapshot?.stations ?? [];
    return stations
      .filter((station) => fuelPrice(station, fuel) != null)
      .sort((a, b) => fuelPrice(a, fuel)! - fuelPrice(b, fuel)! || a.brand.localeCompare(b.brand, "fr"));
  }, [snapshot, fuel]);

  const low = ranked.length ? fuelPrice(ranked[0], fuel)! : null;
  const high = ranked.length ? fuelPrice(ranked[ranked.length - 1], fuel)! : null;
  const average = ranked.length
    ? ranked.reduce((sum, station) => sum + fuelPrice(station, fuel)!, 0) / ranked.length
    : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tilesRef.current?.remove();
    const url = dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = dark
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    tilesRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
  }, [dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || low == null || high == null) return;
    map.closePopup();
    const key = `${fuel}:${ranked.map((station) => station.id).join(",")}`;
    if (fitted.current !== key && ranked.length) {
      if (ranked.length === 1) map.setView([ranked[0].lat, ranked[0].lng], 14);
      else map.fitBounds(L.latLngBounds(ranked.map((station) => [station.lat, station.lng])), { padding: [36, 36] });
      fitted.current = key;
    }
    const markers: L.Marker[] = [];
    for (const station of ranked) {
      const price = fuelPrice(station, fuel)!;
      const active = station.id === selected;
      const color = pinColor(price, low, high);
      const icon = L.divIcon({
        className: "fuel-pin-wrap",
        iconSize: [58, 28],
        iconAnchor: [29, 28],
        html: `<span class="fuel-pin${active ? " is-selected" : ""}${station.aged ? " is-aged" : ""}" style="background:${color}">${escapeHtml(cents(price).replace(" ¢", ""))}</span>`,
      });
      const marker = L.marker([station.lat, station.lng], { icon, zIndexOffset: active ? 800 : 0 });
      const mark = brandMark(station.brand);
      const services = places ? amenitiesFor(station, places).map((item) => escapeHtml(item.label)).join(" · ") : "";
      marker.bindPopup(
        `<span style="display:inline-grid;width:1.5rem;height:1.5rem;place-items:center;border-radius:999px;background:${mark.bg};color:${mark.fg};font-size:10px;font-weight:700;margin-right:0.35rem;vertical-align:middle">${escapeHtml(mark.letters)}</span><strong>${escapeHtml(station.brand)}</strong><br>${escapeHtml(station.address)}<br><span>${escapeHtml(cents(price))}/L</span>${services ? `<br><span>${services}</span>` : ""}`,
      );
      marker.on("click", () => setSelected(station.id));
      marker.addTo(map);
      if (active) marker.openPopup();
      markers.push(marker);
    }
    return () => {
      map.closePopup();
      for (const marker of markers) marker.remove();
    };
  }, [ranked, fuel, selected, low, high, places]);

  useEffect(() => {
    if (!selected) return;
    rows.current.get(selected)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function choose(station: Station) {
    setSelected(station.id);
    mapRef.current?.flyTo([station.lat, station.lng], 15, { duration: 0.45 });
    mapNode.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const fuelLabel = FUELS.find((item) => item.id === fuel)?.label ?? "Ordinaire";
  const missing = (snapshot?.stations.length ?? 0) - ranked.length;

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm text-pine">Baie-Comeau · stations-service</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">Le prix de l’essence, station par station.</h1>
          <p className="mt-3 max-w-xl text-muted">
            La carte montre l’ordinaire, le super et le diesel relevés à Baie-Comeau. Le vert est le moins cher, le rouge le plus cher.
          </p>
          {snapshot?.updatedAt && (
            <p className="mt-2 text-xs text-muted">
              {snapshot.live ? "Relevé en direct" : "Dernière copie enregistrée"} le {whenLabel(snapshot.updatedAt)}. Le prix à la pompe peut différer.
            </p>
          )}
        </div>
        {low != null && average != null && high != null && (
          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-pine bg-moss px-3 py-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-pine">Moins cher</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(low)}</dd>
            </div>
            <div className="rounded-2xl border border-line bg-card px-3 py-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Moyenne</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(average)}</dd>
            </div>
            <div className="rounded-2xl border border-line bg-card px-3 py-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Plus cher</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(high)}</dd>
            </div>
          </dl>
        )}
      </section>
      )}

      {embedded && low != null && average != null && high != null && (
        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-pine bg-moss px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-pine">Moins cher</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(low)}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Moyenne</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(average)}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Plus cher</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{cents(high)}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Type de carburant">
        {FUELS.map((item) => {
          const active = item.id === fuel;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFuel(item.id)}
              className={`rounded-full px-4 py-2 text-sm ${active ? "bg-pine text-pine-ink" : "border border-line bg-card"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-2xl border border-iga/30 bg-iga/10 px-4 py-3 text-sm">{error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className={`fuel-map isolate relative overflow-hidden rounded-3xl border border-line ${embedded ? "h-80" : "h-[28rem] lg:sticky lg:top-24 lg:h-[36rem]"}`}>
          <div ref={mapNode} className="h-full w-full" />
          {!snapshot && !error && <div className="absolute inset-0 animate-pulse bg-line/70" />}
        </div>
        <section className="rounded-3xl border border-line bg-card">
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-serif text-xl">{fuelLabel}</h2>
              <p className="text-xs text-muted">
                {ranked.length} station{ranked.length > 1 ? "s" : ""}
                {missing > 0 ? ` · ${missing} sans ce prix` : ""}
              </p>
            </div>
            <ol className={`divide-y divide-line overflow-auto ${embedded ? "max-h-80" : "max-h-[32rem]"}`}>
              {ranked.map((station, index) => {
                const price = fuelPrice(station, fuel)!;
                const active = station.id === selected;
                const cheapest = price === low;
                const amenities = places ? amenitiesFor(station, places) : null;
                return (
                  <li
                    key={station.id}
                    ref={(node) => {
                      if (node) rows.current.set(station.id, node);
                      else rows.current.delete(station.id);
                    }}
                    className={`flex items-stretch gap-2 px-3 py-3 ${active ? "bg-moss" : ""}`}
                  >
                    <button type="button" onClick={() => choose(station)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <BrandMark brand={station.brand} />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          <span className="mr-1.5 text-xs tabular-nums text-muted">{index + 1}</span>
                          {station.brand}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{station.address}</span>
                        {amenities && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {amenities.map((item) => (
                              <span key={item.id} className="rounded-full bg-moss px-2 py-0.5 text-[11px] font-medium text-pine">
                                {item.label}
                              </span>
                            ))}
                            {amenities.length === 0 && <span className="text-[11px] text-muted">Services non indiqués</span>}
                          </span>
                        )}
                        {station.aged && <span className="mt-1 block text-xs text-iga">Relevé de plus de deux jours</span>}
                      </span>
                    </button>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`font-serif text-xl tabular-nums ${cheapest ? "text-pine" : ""}`}>{cents(price)}</span>
                      <a
                        href={directionsUrl(station)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-pine underline-offset-2 hover:underline"
                      >
                        Y aller
                      </a>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
      </div>

      {snapshot && (
        <p className="text-center text-xs text-muted">
          <a href={snapshot.attributionUrl} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
            {snapshot.attribution}
          </a>
          {" · "}
          <a href={snapshot.sourceUrl} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
            Régie de l’énergie
          </a>
          . Licence CC BY 4.0. Un relevé peut avoir quelques heures de retard. Les services viennent d’OpenStreetMap : un dépanneur n’est affiché que s’il est noté à la station. La vente de cigarettes n’y figure pas.
        </p>
      )}
    </div>
  );
}
