"""Telecharge les prix d'essence de Baie-Comeau et ecrit public/essence.json."""

import json
import urllib.request
from pathlib import Path

URL = "https://www.gasquebec.ca/api/cities/baie-comeau"
DEST = Path(__file__).resolve().parents[1] / "public" / "essence.json"


def main():
    request = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "Comparo/1.0 (Baie-Comeau)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    city = payload.get("city") or "Baie-Comeau"
    count = payload.get("stationCount") or len(payload.get("stations") or [])
    print(f"{city} — {count} stations — {DEST}")
    stations = sorted(
        payload.get("stations") or [],
        key=lambda station: (
            station.get("prixOrdinaire") is None,
            station.get("prixOrdinaire") if isinstance(station.get("prixOrdinaire"), (int, float)) else 0,
        ),
    )
    for station in stations:
        price = station.get("prixOrdinaire")
        label = f"{price:.1f} c" if isinstance(price, (int, float)) else "     —"
        brand = station.get("brand") or station.get("name") or ""
        address = station.get("address") or ""
        print(f"{label:>8}  {brand:<16}  {address}")


if __name__ == "__main__":
    main()
