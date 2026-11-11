"""Récupère les UPC IGA de Baie-Comeau et les enregistre par URL de produit."""

from __future__ import annotations

import json
import re
from pathlib import Path

from curl_cffi import requests

APP = "L0APUSIH50"
KEY = "022f6cbb0292d0e78f65897fd6dabad9"
INDEX = "dxp_product_fr"
STORE_INDEX = "dxp_stores"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "iga-upcs.json"


def digits(value: object) -> str:
    token = re.sub(r"\D", "", str(value or ""))
    if 8 <= len(token) <= 14:
        return token
    return ""


def main() -> None:
    session = requests.Session(impersonate="chrome")
    session.headers.update(
        {
            "Accept-Language": "fr-CA,fr;q=0.9",
            "Referer": "https://www.iga.ca/",
            "Origin": "https://www.iga.ca",
            "x-algolia-application-id": APP,
            "x-algolia-api-key": KEY,
            "Content-Type": "application/json",
        }
    )

    def algolia(index: str, payload: dict) -> dict:
        response = session.post(
            f"https://{APP}-dsn.algolia.net/1/indexes/{index}",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    stores = algolia(STORE_INDEX + "/query", {"query": "G5C", "hitsPerPage": 5})
    store_number = "8526"
    for hit in stores.get("hits") or []:
        postal = ((hit.get("address") or {}).get("postalCode") or "").replace(" ", "").upper()
        if postal.startswith("G5C") and hit.get("storeNumber"):
            store_number = str(hit["storeNumber"])
            break

    payload: dict = {
        "filters": f"storeId:{store_number}",
        "hitsPerPage": 1000,
        "attributesToRetrieve": ["pageSlug", "upc", "gtin"],
    }
    found: dict[str, list[str]] = {}
    seen = 0
    while True:
        data = algolia(INDEX + "/browse", payload)
        hits = data.get("hits") or []
        seen += len(hits)
        for hit in hits:
            slug = hit.get("pageSlug") or ""
            if not slug:
                continue
            codes: list[str] = []
            for raw in (hit.get("upc"), hit.get("gtin")):
                code = digits(raw)
                if code and code not in codes:
                    codes.append(code)
            if codes:
                found[f"https://www.iga.ca/fr/produits/{slug}"] = codes
        cursor = data.get("cursor")
        if not cursor or not hits:
            break
        payload = {"cursor": cursor}

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(found, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"magasin {store_number}")
    print(f"fiches {seen}")
    print(f"upc {len(found)}")
    print(OUTPUT)


if __name__ == "__main__":
    main()
