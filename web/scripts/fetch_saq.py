"""Relève le catalogue SAQ des deux succursales de Baie-Comeau.

Le site public expose son catalogue Adobe Commerce (Live Search). Chaque produit
inclut le prix, la photo, le code CUP et la liste des succursales où il fait
partie de l'inventaire. On ne conserve pas de quantité : seulement la présence
à Lasalle (33550) et à Laflèche (33614).
"""

from __future__ import annotations

import ast
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "saq.json"
PAGE = "https://www.saq.com/fr/produits/vin"
GRAPHQL = "https://catalog-service.adobe.io/graphql"
LOCATOR = "https://www.saq.com/fr/store/locator/ajaxlist/"
CUSTOMER_GROUP = "b6589fc6ab0dc82cf12099d1c2d40ab994e8410c"
PAGE_SIZE = 100

FALLBACK_STORES = {
    "33550": {"name": "SAQ Baie-Comeau — Lasalle", "address": "300, boulevard Lasalle"},
    "33614": {"name": "SAQ Baie-Comeau — Laflèche", "address": "Boulevard Laflèche"},
}

IDENTITY = {
    "red wine": "Vin",
    "white wine": "Vin",
    "rose wine": "Vin",
    "rosé wine": "Vin",
    "orange wine": "Vin",
    "sparkling wine": "Mousseux",
    "champagne": "Mousseux",
    "beer": "Bière",
    "cider": "Cidre",
    "sake": "Saké",
    "spirit": "Spiritueux",
    "spirits": "Spiritueux",
    "gin": "Spiritueux",
    "whisky": "Spiritueux",
    "whiskey": "Spiritueux",
    "rum": "Spiritueux",
    "vodka": "Spiritueux",
    "brandy": "Spiritueux",
    "cognac": "Spiritueux",
    "tequila": "Spiritueux",
    "liqueur": "Spiritueux",
    "aperitif": "Apéritif",
    "port": "Porto et vin fortifié",
    "dessert wine": "Vin de dessert",
    "non-alcoholic": "Sans alcool",
    "cooler": "Cooler",
    "hydromel": "Hydromel",
    "mead": "Hydromel",
    "perry": "Poiré",
}

QUERY = """
query productSearch(
  $phrase: String!
  $pageSize: Int
  $currentPage: Int
  $filter: [SearchClauseInput!]
  $sort: [ProductSearchSortInput!]
  $context: QueryContextInput
) {
  productSearch(
    phrase: $phrase
    page_size: $pageSize
    current_page: $currentPage
    filter: $filter
    sort: $sort
    context: $context
  ) {
    total_count
    page_info { current_page page_size total_pages }
    items {
      product { sku name canonical_url thumbnail { url } }
      productView {
        sku
        name
        url
        urlKey
        ... on SimpleProductView {
          attributes { name value }
          price { final { amount { value } } regular { amount { value } } }
        }
      }
    }
  }
}
"""


def fold(value: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFD", value or "")
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return text.lower()


def unescape(value: str) -> str:
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda match: chr(int(match.group(1), 16)), value)


def load_public_config(session: requests.Session) -> dict:
    response = session.get(PAGE, timeout=40)
    response.raise_for_status()
    html = response.text
    key = re.search(r'apiKey:\s*"([0-9a-fA-F]+)"', html)
    environment = re.search(r'environmentId:\s*"([^"]+)"', html)
    if not key or not environment:
        raise RuntimeError("La configuration publique du catalogue SAQ est introuvable.")
    return {
        "apiKey": key.group(1),
        "environmentId": unescape(environment.group(1)),
        "websiteCode": "base",
        "storeCode": "main_website_store",
        "storeViewCode": "fr",
    }


def headers_for(config: dict, view: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": config["apiKey"],
        "Magento-Environment-Id": config["environmentId"],
        "Magento-Store-Code": config["storeCode"],
        "Magento-Store-View-Code": view,
        "Magento-Website-Code": config["websiteCode"],
    }


def attr(attributes: list, name: str):
    for item in attributes:
        if item.get("name") == name:
            return item.get("value")
    return None


def as_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str) and value.startswith("["):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    return []


def text_of(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(text_of(item) for item in value if text_of(item))
    if isinstance(value, dict):
        parts = [text_of(item) for item in value.values()]
        return ", ".join(part for part in parts if part)
    text = re.sub(r"<[^>]+>", " ", str(value))
    return re.sub(r"\s+", " ", text).strip()


def number_text(value) -> str:
    text = text_of(value).replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return text_of(value)
    if number.is_integer():
        return str(int(number))
    return f"{number:.1f}".replace(".", ",")


def tasting_of(attributes: list) -> str:
    bits = []
    for key, label in (
        ("portrait_sucre", "Sucrosité"),
        ("portrait_acidite", "Acidité"),
        ("portrait_corps", "Corps"),
        ("portrait_bouche", "Bouche"),
        ("portrait_bois", "Bois"),
    ):
        value = text_of(attr(attributes, key))
        if value:
            bits.append(f"{label} {value}")
    low = text_of(attr(attributes, "portrait_temp_service_de"))
    high = text_of(attr(attributes, "portrait_temp_service_a"))
    if low and high:
        bits.append(f"Service {low} à {high} °C")
    return " · ".join(bits)


def text_list(value) -> list[str]:
    if isinstance(value, list):
        return [text_of(item) for item in value if text_of(item)]
    text = text_of(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"\s*[|,;]\s*", text) if part.strip()]


def barcodes_from(value, sku: str) -> list[str]:
    found: list[str] = []
    payload = value
    if isinstance(value, str) and value[:1] in "{[":
        try:
            payload = json.loads(value)
        except json.JSONDecodeError:
            try:
                payload = ast.literal_eval(value)
            except (SyntaxError, ValueError):
                payload = value
    if isinstance(payload, dict):
        for _date, code in sorted(payload.items()):
            digits = re.sub(r"\D", "", str(code))
            if len(digits) >= 8:
                found.append(digits)
    elif isinstance(payload, str):
        digits = re.sub(r"\D", "", payload)
        if len(digits) >= 8:
            found.append(digits)
    sku_digits = re.sub(r"\D", "", sku)
    if len(sku_digits) >= 8:
        found.append(sku_digits)
    unique: list[str] = []
    for code in found:
        if code not in unique:
            unique.append(code)
    return unique


ALCOOL = "Alcool"
SUBCATEGORY_ORDER = [
    "Vin",
    "Mousseux",
    "Vin fortifié",
    "Bière",
    "Cidre",
    "Vodka",
    "Gin",
    "Rhum",
    "Whisky",
    "Tequila",
    "Cognac",
    "Liqueur",
    "Apéritif",
    "Saké",
    "Hydromel",
    "Poiré",
    "Prêts à boire",
    "Accessoires",
    "Autres",
]


def has_term(key: str, term: str) -> bool:
    return re.search(rf"(^| ){re.escape(term)}( |$)", key) is not None


def subcategory_of(identity: str, name: str, spirit: str) -> str:
    key = fold(f"{identity} {spirit} {name}")
    if any(word in key for word in ("tire-bouchon", "tire bouchon", "caissette", "sac cadeau", "sac reutilisable", "alcootest", "pompe et bouchon", "coffret")):
        return "Accessoires"
    if "biere" in key:
        return "Bière"
    if "cidre" in key:
        return "Cidre"
    if "mousseux" in key or "champagne" in key:
        return "Mousseux"
    if any(word in key for word in ("cooler", "boisson", "cocktail", "melangeur")):
        return "Prêts à boire"
    if any(word in key for word in ("porto", "xeres", "madere", "marsala", "fortifie")):
        return "Vin fortifié"
    if "vin" in key or "sauternes" in key:
        return "Vin"
    if "sake" in key:
        return "Saké"
    if "hydromel" in key:
        return "Hydromel"
    if has_term(key, "poire"):
        return "Poiré"
    if any(word in key for word in ("aperitif", "vermouth", "pineau", "ouzo", "pastis")):
        return "Apéritif"
    if "vodka" in key:
        return "Vodka"
    if has_term(key, "gin") or "genievre" in key:
        return "Gin"
    if "rhum" in key or has_term(key, "rum"):
        return "Rhum"
    if any(word in key for word in ("whisky", "whiskey", "bourbon", "scotch")):
        return "Whisky"
    if "tequila" in key or "mezcal" in key:
        return "Tequila"
    if any(word in key for word in ("cognac", "armagnac", "brandy")):
        return "Cognac"
    if "liqueur" in key or "absinthe" in key:
        return "Liqueur"
    return "Autres"


def find_stores(session: requests.Session) -> dict[str, dict]:
    found: dict[str, dict] = {}
    loaded = 0
    total = 1
    while loaded < total and loaded < 800:
        response = session.get(
            LOCATOR,
            params={"loaded": loaded},
            headers={"Accept": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": "https://www.saq.com/fr/store"},
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        total = int(data.get("total") or 0)
        batch = data.get("list") or []
        if not batch:
            break
        for store in batch:
            city = fold(str(store.get("city") or ""))
            if "baie-comeau" not in city and "baie comeau" not in city:
                continue
            identifier = str(store.get("identifier") or "")
            if not identifier:
                continue
            found[identifier] = {
                "name": str(store.get("name") or f"SAQ {identifier}"),
                "address": " ".join(
                    part
                    for part in (str(store.get("address1") or "").strip(), str(store.get("city") or "").strip())
                    if part
                ),
            }
        loaded += len(batch)
    return found or FALLBACK_STORES


def search(session, config, view: str, phrase: str, page: int, store_ids: list[str]) -> dict:
    body = {
        "query": QUERY,
        "variables": {
            "phrase": phrase,
            "pageSize": PAGE_SIZE,
            "currentPage": page,
            "filter": [
                {"attribute": "catalog_type", "in": ["1"]},
                {"attribute": "store_availability_list", "in": store_ids},
            ],
            "sort": [{"attribute": "name", "direction": "ASC"}],
            "context": {"customerGroup": CUSTOMER_GROUP, "userViewHistory": []},
        },
    }
    last_error = None
    for _attempt in range(4):
        try:
            response = session.post(GRAPHQL, headers=headers_for(config, view), json=body, timeout=50)
            response.raise_for_status()
            payload = response.json()
            if payload.get("errors"):
                raise RuntimeError(payload["errors"][0].get("message") or "Erreur GraphQL")
            search_data = (payload.get("data") or {}).get("productSearch")
            if not search_data:
                raise RuntimeError("Réponse catalogue vide")
            return search_data
        except Exception as error:  # noqa: BLE001 - on réessaie le réseau
            last_error = error
            time.sleep(1.2)
    raise RuntimeError(f"Catalogue SAQ inaccessible : {last_error}")


def choose_view(session, config, store_ids: list[str]) -> tuple[str, str]:
    for view in ("fr", "en"):
        for phrase in ("", "*"):
            data = search(session, config, view, phrase, 1, store_ids)
            total = int(data.get("total_count") or 0)
            print(f"essai vue={view} phrase={phrase!r} total={total}", flush=True)
            if total > 0:
                return view, phrase
    raise RuntimeError("Aucun produit des succursales de Baie-Comeau dans le catalogue public.")


def is_lasalle(store_id: str, info: dict) -> bool:
    label = fold(f"{info.get('name', '')} {info.get('address', '')}")
    return store_id == "33550" or "lasalle" in label


def is_lafleche(store_id: str, info: dict) -> bool:
    label = fold(f"{info.get('name', '')} {info.get('address', '')}")
    return store_id == "33614" or "lafleche" in label


def product_of(item: dict, directory: dict[str, dict]) -> dict | None:
    view = item.get("productView") or {}
    product = item.get("product") or {}
    attributes = view.get("attributes") or []
    sku = str(view.get("sku") or product.get("sku") or "").strip()
    name = str(view.get("name") or product.get("name") or "").strip()
    if not sku or not name:
        return None
    available = set(as_list(attr(attributes, "store_availability_list")))
    lasalle = any(is_lasalle(store_id, directory[store_id]) for store_id in available if store_id in directory)
    lafleche = any(is_lafleche(store_id, directory[store_id]) for store_id in available if store_id in directory)
    if not lasalle and not lafleche:
        known = available.intersection(FALLBACK_STORES)
        lasalle = lasalle or "33550" in known
        lafleche = lafleche or "33614" in known
    if not lasalle and not lafleche:
        return None
    price_block = ((view.get("price") or {}).get("final") or {}).get("amount") or {}
    regular_block = ((view.get("price") or {}).get("regular") or {}).get("amount") or {}
    price = price_block.get("value")
    regular = regular_block.get("value")
    if not isinstance(price, (int, float)) or price <= 0:
        return None
    regular_value = float(regular) if isinstance(regular, (int, float)) and float(regular) > float(price) + 0.009 else None
    volume = attr(attributes, "format_contenant_ml")
    size = f"{volume} ml" if volume else ""
    identity = str(attr(attributes, "identite_produit") or "")
    spirit = str(attr(attributes, "type_spiritueux") or "")
    url = str(view.get("url") or product.get("canonical_url") or "")
    if url.startswith("/"):
        url = "https://www.saq.com" + url
    url = url.replace("://www.saq.com/en/", "://www.saq.com/fr/")
    if not url:
        key = view.get("urlKey") or sku
        url = f"https://www.saq.com/fr/{key}"
    thumbnail = ((product.get("thumbnail") or {}).get("url") or "") or None
    if isinstance(thumbnail, str) and thumbnail.startswith("//"):
        thumbnail = "https:" + thumbnail
    producer = str(attr(attributes, "nom_producteur") or "")
    country = str(attr(attributes, "pays_origine") or "")
    return {
        "id": sku,
        "sku": sku,
        "name": name,
        "producer": producer,
        "supplier": "SAQ",
        "size": size,
        "category": ALCOOL,
        "subcategory": subcategory_of(identity, name, spirit),
        "country": country,
        "region": text_of(attr(attributes, "region_origine")),
        "grape": ", ".join(text_list(attr(attributes, "cepage"))),
        "colour": text_of(attr(attributes, "couleur")),
        "taste": text_of(attr(attributes, "pastille_gout")),
        "aromas": text_list(attr(attributes, "portrait_arome")),
        "tasting": tasting_of(attributes),
        "pairings": [item for item in text_list(attr(attributes, "famille_accords")) if not item.isdigit()],
        "abv": number_text(attr(attributes, "pourcentage_alcool_par_volume")),
        "sugar": number_text(attr(attributes, "taux_sucre")),
        "vintage": text_of(attr(attributes, "millesime_produit") or attr(attributes, "portrait_millesime_deguste")),
        "story": text_of(attr(attributes, "argumentaire_vente_externe"))[:700],
        "image": thumbnail,
        "price": round(float(price), 2),
        "regular": round(regular_value, 2) if regular_value is not None else None,
        "url": url,
        "barcodes": barcodes_from(attr(attributes, "cup"), sku),
        "lasalle": lasalle,
        "lafleche": lafleche,
    }


def main() -> None:
    session = requests.Session(impersonate="chrome")
    config = load_public_config(session)
    try:
        stores = find_stores(session)
    except Exception as error:  # noqa: BLE001
        print(f"annuaire succursales indisponible ({error}), identifiants connus", flush=True)
        stores = FALLBACK_STORES
    stores = {store_id: info for store_id, info in stores.items() if is_lasalle(store_id, info) or is_lafleche(store_id, info)}
    if not stores:
        stores = FALLBACK_STORES
    store_ids = list(stores)
    print("succursales", ", ".join(f"{store_id} {stores[store_id]['name']}" for store_id in store_ids), flush=True)
    view, phrase = choose_view(session, config, store_ids)
    first = search(session, config, view, phrase, 1, store_ids)
    total_pages = int((first.get("page_info") or {}).get("total_pages") or 1)
    print(f"pages {total_pages}, produits annoncés {first.get('total_count')}", flush=True)
    collected: dict[str, dict] = {}

    def absorb(page_data: dict) -> None:
        for item in page_data.get("items") or []:
            row = product_of(item, stores)
            if row:
                collected[row["id"]] = row

    absorb(first)
    for page in range(2, total_pages + 1):
        absorb(search(session, config, view, phrase, page, store_ids))
        if page % 10 == 0:
            print(f"page {page}/{total_pages}, gardés {len(collected)}", flush=True)
        time.sleep(0.05)

    products = sorted(collected.values(), key=lambda row: row["name"].lower())
    used = {row["subcategory"] for row in products}
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "city": "Baie-Comeau",
        "supplier": "SAQ",
        "stores": [
            {"id": store_id, "name": info["name"], "address": info["address"]}
            for store_id, info in stores.items()
        ],
        "categories": [ALCOOL],
        "subcategories": [name for name in SUBCATEGORY_ORDER if name in used],
        "products": products,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    both = sum(1 for row in products if row["lasalle"] and row["lafleche"])
    print(f"écrit {OUTPUT} — {len(products)} produits, {both} dans les deux inventaires", flush=True)


if __name__ == "__main__":
    code = 0
    try:
        main()
    except Exception as error:
        print(error, flush=True)
        code = 1
    finally:
        os._exit(code)
