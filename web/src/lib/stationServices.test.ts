import { describe, expect, it } from "vitest";
import { amenitiesFor, brandMark, parsePlaces, type OsmPlace } from "./stationServices";

const petro = { lat: 49.195282, lng: -68.274682 };
const irving = { lat: 49.19203, lng: -68.302023 };
const shell = { lat: 49.21512, lng: -68.194028 };

const places: OsmPlace[] = [
  {
    lat: 49.19527,
    lng: -68.2744,
    tags: { shop: "convenience", name: "Couche-Tard", brand: "Couche-Tard" },
  },
  {
    lat: 49.1920189,
    lng: -68.3018644,
    tags: { amenity: "fuel", name: "Irving", opening_hours: "24/7" },
  },
  {
    lat: 49.214964,
    lng: -68.1939909,
    tags: { amenity: "fuel", name: "Dépanneur Nord-Est, Boni-Soir, Shell", operator: "Boni-Soir", self_service: "yes" },
  },
  {
    lat: 49.1,
    lng: -68.1,
    tags: { shop: "convenience", name: "Ailleurs" },
  },
];

describe("amenitiesFor", () => {
  it("reconnaît le dépanneur Couche-Tard collé à la station", () => {
    expect(amenitiesFor(petro, places).map((item) => item.label)).toEqual(["Dépanneur Couche-Tard"]);
  });

  it("garde l’ouverture 24 h et le Boni-Soir, sans inventer les cigarettes", () => {
    expect(amenitiesFor(irving, places).map((item) => item.label)).toEqual(["Ouvert 24 h"]);
    expect(amenitiesFor(shell, places).map((item) => item.label)).toEqual(["Dépanneur Boni-Soir", "Libre-service"]);
    expect(amenitiesFor(petro, places).some((item) => /cigarette/i.test(item.label))).toBe(false);
  });

  it("ignore un commerce trop loin", () => {
    expect(amenitiesFor({ lat: 49.22, lng: -68.2 }, places)).toEqual([]);
  });
});

describe("marques et fichier OSM", () => {
  it("donne un sigle lisible à chaque bannière connue", () => {
    expect(brandMark("Shell").letters).toBe("SH");
    expect(brandMark("Canadian Tire").bg).toBe("#e31837");
    expect(brandMark("Station inconnue").letters).toBe("SI");
  });

  it("lit un nœud et un bâtiment", () => {
    const parsed = parsePlaces({
      elements: [
        { lat: 1, lon: 2, tags: { name: "Esso" } },
        { center: { lat: 3, lon: 4 }, tags: { shop: "convenience", building: "yes" } },
        { tags: { name: "sans point" } },
      ],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[1].tags.shop).toBe("convenience");
  });
});
