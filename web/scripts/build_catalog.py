"""Construit le catalogue JSON de Comparo à partir des Excel de Baie-Comeau.

- comparaison.xlsx : produits alignés Maxi / IGA, avec l'écart de prix
- baie-comeau.xlsx : fiches complètes (image, marque, prix régulier, format)
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ePYcerie-main"
SOURCE = DATA / "baie-comeau.xlsx"
COMPARE = DATA / "comparaison.xlsx"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "catalog.json"
UPCS = Path(__file__).resolve().parents[1] / "data" / "iga-upcs.json"

CATEGORIES = [
    "Fruits et légumes",
    "Boulangerie",
    "Viandes",
    "Poisson et fruits de mer",
    "Produits laitiers",
    "Confitures",
    "Conserves",
    "Épicerie",
    "Surgelés",
    "Boissons",
    "Collations",
    "Bébé",
    "Soins et maison",
    "Animaux",
    "Autres",
]

# Sous-catégories affichées quand le rayon est ouvert.
# Fruits et légumes : uniquement le frais. Confitures et conserves sont des rayons à part.

HERBS = re.compile(
    r"\b(persils?|coriandres?|basilics?|menthes?|thymes?|romarins?|aneths?|"
    r"ciboulettes?|estragon|sauges?|origans? frais|fines herbes|herbes fraiches)\b"
)
VEG = re.compile(
    r"\b(pommes? de terre|patates?(?!s)|patates? douces|patates? sucrees?|"
    r"laitues?|tomates?|carottes?|brocolis?|oignons?|concombres?|poivrons?|"
    r"celeris?|epinards?|champignons?|asperges?|avocats?|ails?|"
    r"choux?(?!x)|choux? fleurs?|navets?|betteraves?|courgettes?|zucchinis?|"
    r"roquettes?|kales?|radis|poireaux?|echalotes?|citrouilles?|"
    r"mais sucre|mais sucres|gingembres?|pak choi|bok choy|"
    r"haricots? verts|pois mange tout|edamames?|endives?|fenouils?|"
    r"aubergines?|panais|rutabagas?|topinambours?|salades?)\b"
)
FRUIT = re.compile(
    r"\b(pommes?(?! de terre)|bananes?|oranges?|citrons?|limes?|fraises?|framboises?|"
    r"bleuets?|raisins?(?! secs)|ananas|kiwis?|mangues?|melons?|cantaloups?|"
    r"peches?|poires?|prunes?|cerises?|clementines?|mandarines?|pamplemousses?|"
    r"nectarines?|abricots?|figues?|dattes?|papayes?|litchis?|goyaves?|"
    r"grenades?|canneberges?|mures|fruit de la passion)\b"
)

NOT_FRESH = re.compile(
    r"\b(ketchup|sauces?|salsas?|pestos?|hummus|trempettes?|vinaigrettes?|"
    r"mayonnaises?|moutardes?|relish|confitures?|marmelades?|compotes?|"
    r"gelees?|tartinades?|jus|nectars?|smoothies?|boissons?|sodas?|colas?|sechee?s?|"
    r"bieres?|vins?|cidres?|sirops?|coulis|pates? de|purees?|sechees?|"
    r"deshydratee?s?|lyophilisee?s?|en des|broyees?|broyee|conserves?|"
    r"soupes?|bouillons?|chips|croustilles?|biscuits?|chocolats?|bonbons?|reglisses?|"
    r"gateaux?|muffins?|yogourts?|yaourts?|fromages?|huiles?|vinaigres?|"
    r"epices?|assaisonnements?|saveurs?|aromatisee?s?|parfums?|parfumee?s?|"
    r"cocktails?|farines?|miels?|cereales?|gruaux?|craquelins?|"
    r"garnitures?|garnitudes?|nettoyants?|sprays?|shampoings?|shampooings?|savons?|"
    r"patisseries?|beignets?|pastilles?|friandises?|galettes?|granolas?|barres?|"
    r"tisanes?|thes?|poudings?|gaufres?|croutons?|chaussons?|bolognes?|"
    r"veginnaise|lattes?|rissoles?|avoines?|collations?|proteines?|poudres?|"
    r"lotions?|dentifrices?|deodorants?|lessives?|detergents?|desinfectants?|"
    r"javellisant|creme glacee|surgeles?|congeles?|pizzas?|olives?|"
    r"cornichons?|marinee?s?|farcies?|en poudre|moulue?s?|"
    r"en boite|en conserve|au sirop|nappages?|atomes?|aromes?|"
    r"desodorisants?|assainisseurs?|chandelles?|bougies?|lingettes?|"
    r"essuie|papiers? hygieniques?|vaisselle|eponges?)\b"
)

VOLUME = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:ml|l)\b")


def fold(text: object) -> str:
    if text is None or (isinstance(text, float) and math.isnan(text)):
        return ""
    value = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("'", " ")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _has(pattern: str, haystack: str) -> bool:
    return re.search(pattern, haystack) is not None


def _volume(haystack: str, size: str) -> bool:
    return VOLUME.search(haystack) is not None or VOLUME.search(fold(size)) is not None


def _epicerie_sub(haystack: str) -> str:
    if _has(
        r"\b(ketchups?|sauces?|salsas?|pestos?|mayonnaises?|moutardes?|vinaigrettes?|"
        r"relish|trempettes?|hummus|houmous)\b",
        haystack,
    ):
        return "Sauces"
    if _has(
        r"\b(pates?|spaghettis?|macaronis?|riz|nouilles?|couscous|quinoas?|lasagnes?|"
        r"penne|rotinis?|fusillis?|linguine|orzo)\b",
        haystack,
    ):
        return "Pâtes et riz"
    if _has(r"\b(cereales?|gruau|gruaux|avoine|granolas?)\b", haystack):
        return "Céréales"
    if _has(
        r"\b(epices?|cannelles?|paprikas?|cumin|poivres?|sels?|origan|cari|curry|"
        r"assaisonnements?|herbes de provence|piments?|muscade|laurier|clou de girofle)\b",
        haystack,
    ):
        return "Épices"
    return ""


def _produce_sub(haystack: str) -> str:
    if _has(r"\bsalades? de fruits?\b", haystack):
        return "Fruits"
    if HERBS.search(haystack):
        return "Fines herbes"
    if VEG.search(haystack):
        return "Légumes"
    if FRUIT.search(haystack):
        return "Fruits"
    return ""


def _prepared_shelf(haystack: str) -> tuple[str, str] | None:
    """Produits transformés qui contiennent un fruit ou un légume dans le nom."""
    if _has(
        r"\b(tisanes?|thes?|infusions?|twinings|tetley|salada|tazo|davids\s?tea|"
        r"red rose|clef des champs)\b",
        haystack,
    ):
        return "Épicerie", ""
    if _has(r"\b(comprimes?|probiotiques?|supplements?|fragrances?|infections?)\b", haystack):
        return "Soins et maison", ""
    if _has(
        r"\b(bouchees|hors d oeuvre|below zero|fruit dor|surg|denoyautees?|"
        r"en morceaux|tranchees?|cigares? au chou|coupe droite|"
        r"delices du lac|bleuets? sauvages|fraises? entieres|tipiak|gardein)\b",
        haystack,
    ):
        return "Surgelés", ""
    if _has(r"\bbatonnets\b", haystack) and not _has(r"\bcarottes?\b", haystack):
        return "Surgelés", ""
    if _has(r"\b(sels? de|cuites?|repas|choc)\b", haystack) or (
        _has(r"\bsans nom\b", haystack) and _has(r"\b(haricots?|pois)\b", haystack)
    ):
        if _has(r"\bsels?\b", haystack):
            return "Épicerie", "Épices"
        if _has(r"\bchoc\b", haystack):
            return "Collations", ""
        if _has(r"\bcuites?\b", haystack):
            return "Conserves", ""
        return "Surgelés", ""
    if _has(r"\b(menthes|mints|ice breakers)\b", haystack) or _has(r"\bexcel\b", haystack):
        return "Collations", ""
    if _has(
        r"\b(barres?|pastilles?|friandises?|granolas?|galettes? de riz|croutons?|"
        r"poudings?|puddings?|gels? juteux|snack packs?|collations?|johnvince|carres? aux)\b",
        haystack,
    ):
        return "Collations", ""
    if _has(r"\b(patisseries?|beignets?|strudels?|chaussons?|tartelettes?|toasters?)\b", haystack):
        return "Boulangerie", ""
    if _has(r"\bmelanges?\b", haystack) and _has(r"\b(crepes?|gaufres?)\b", haystack):
        return "Épicerie", ""
    if _has(r"\bgaufres?\b", haystack):
        return "Surgelés", ""
    if _has(
        r"\b(galettes? de pommes de terre|pommes de terre rissolees?|rondelles d oignons?|"
        r"cavendish|arctic gardens|bistro style|melanges? de(?: \d+)? fruits)\b",
        haystack,
    ):
        return "Surgelés", ""
    if _has(r"\bbolognes?\b", haystack):
        return "Viandes", ""
    if _has(
        r"\b(salades? de chou|salades? de lentilles|salades? de pommes? de terre|"
        r"garnitudes?|veginnaise|lattes?|poudres?|crepes?|avoines?|croustades?|"
        r"gratin|dauphinois|risotto|couscous|gnocchis?|chutneys?|farfalles?|"
        r"ragouts?|prets? a servir|cesars?|caramelisee?s?|oignons? frits|"
        r"moulins?|graines?|dattes?|escargots?|preparation pour|\bcake\b)\b",
        haystack,
    ):
        return "Épicerie", _epicerie_sub(haystack)
    return None


def _dried_herb(haystack: str, size: str) -> bool:
    if not HERBS.search(haystack) or _has(r"\b(botte|frais|fraiche)\b", haystack):
        return False
    blob = f"{haystack} {fold(size)}"
    return re.search(r"\b1\s*(?:un|ea)\b", blob) is None


def _fresh_produce(haystack: str, size: str) -> str:
    """Retourne la sous-catégorie si le produit est un fruit, un légume ou une herbe frais."""
    if NOT_FRESH.search(haystack) or _volume(haystack, size):
        return ""
    if _has(
        r"\b(fruits? secs?|raisins? secs?|canneberges? sechees?|dattes? sechees?|"
        r"salades? de (poulet|macaroni|pates|thon|oeufs|quinoa|couscous|riz)|"
        r"pommes? de terre en puree|en puree)\b",
        haystack,
    ):
        return ""
    # « fruits » tout seul attrape les fruits de mer et les collations. On exige un fruit ou un légume nommé.
    if _has(r"\bfruits de mer\b", haystack):
        return ""
    return _produce_sub(haystack)


def classify(name: str, brand: str, size: str = "") -> tuple[str, str]:
    """Rayon et sous-catégorie. La sous-catégorie est vide quand le rayon n'en a pas."""
    haystack = fold(f"{brand} {name}")
    if not haystack:
        return "Autres", ""
    if "pain de viande" in haystack:
        return "Viandes", ""
    if "lait d amande" in haystack or "lait de coco" in haystack or "lait d avoine" in haystack or "boisson d avoine" in haystack:
        return "Boissons", ""
    if _has(r"\bbeurres? d (arachides?|amandes?|noix|cajous?|noisettes?)\b", haystack):
        return "Collations", ""
    if _has(
        r"\b(chocolat|biscuits?|croustilles?|chips|bonbons?|gateaux?|gommes?|grignotines?|"
        r"barres? energetiques?|reglisses?|jujubes?|guimauves?|nibs|rubans? aux|"
        r"chocolat\w*|biscottis?|sables?|gaufrettes?)\b",
        haystack,
    ):
        return "Collations", ""
    if "saveur de fruit" in haystack or "fruitsation" in haystack or "gushers" in haystack:
        return "Collations", ""
    if _has(r"\b(couches?|biberons?|tetines?|lait infantile|formules?)\b", haystack) or (
        _has(r"\bbebes?\b", haystack) and not _produce_sub(haystack)
    ):
        return "Bébé", ""
    if _has(r"\b(chiens?|chats?|chiots?|chatons?|litieres?|gateries? pour)\b", haystack):
        return "Animaux", ""
    if _has(
        r"\b(detergents?|lessives?|assouplissants?|javellisant|javel|nettoyants?|sprays?|"
        r"shampoings?|shampooings?|revitalisants?|savons?|dentifrices?|deodorants?|"
        r"papiers? hygieniques?|mouchoirs?|essuie.?tout|vaisselle|eponges?|desinfectants?|"
        r"sacs? a ordures|lave.glace|adoucissants?|lotions?|creme corporelle|"
        r"desodorisants?|assainisseurs?|chandelles?|bougies?|gel douche|bain moussant)\b",
        haystack,
    ):
        return "Soins et maison", ""
    if _has(r"\beau de (toilette|cologne|rose|javel)\b|\beau (micellaire|oxygenee)\b", haystack):
        return "Soins et maison", ""
    if _has(r"\byogourts? glaces?\b", haystack):
        return "Surgelés", ""
    if _has(r"(surgeles?|congeles?|creme glacee|popsicles?|\bfrites\b|\bglacons?\b)", haystack):
        return "Surgelés", ""
    if _has(r"\bsachets? de glace\b", haystack):
        return "Surgelés", ""
    if _has(r"\b(soupes?|bouillons?)\b", haystack):
        return "Conserves", ""
    if _has(
        r"\b(jus|boissons?|sodas?|colas?|limonades?|kombuchas?|bieres?|cidres?|vins?|"
        r"eaux?|thes? glaces?|smoothies?|nectars?|energie)\b",
        haystack,
    ) or (_has(r"\bthes?\b", haystack) and _volume(haystack, size)):
        return "Boissons", ""
    if _has(r"\b(confitures?|marmelades?|compotes?|gelees? de|beurre de pommes?)\b", haystack) or (
        _has(r"\btartinades?\b", haystack) and _produce_sub(haystack)
    ):
        return "Confitures", ""
    if _has(r"\b(aromatisants?|garnitures? pour tarte)\b", haystack):
        return "Épicerie", ""
    if _has(r"\bsalades? de (poulet|macaroni|pates|thon|oeufs|quinoa|couscous|riz|pommes)\b", haystack):
        return "Épicerie", ""
    if _has(
        r"\b(pains?|bagels?|baguettes?|croissants?|muffins?|brioches?|ciabattas?|pitas?|"
        r"naans?|tortillas?|wraps?|beignes?|foccacia|fougasses?)\b",
        haystack,
    ) and not _has(r"\b(chocolat|gateau)\b", haystack):
        return "Boulangerie", ""
    if _has(
        r"\b(saumons?|crevettes?|poissons?|morues?|thons?|truites?|homards?|crabes?|"
        r"palourdes?|moules?|petoncles?|tilapias?|soles?|pangasius|haddocks?|aiglefins?|"
        r"seiches?|fruits de mer|calmars?|huitres?|maquereaux?|sardines?)\b",
        haystack,
    ):
        return "Poisson et fruits de mer", ""
    if _has(
        r"\b(boeufs?|poulets?|porcs?|dindes?|veaux?|agneaux?|steaks?|bacons?|jambons?|"
        r"saucisses?|viandes?|cotelettes?|pepperonis?|salamis?|chorizos?|merguez|"
        r"gigots?|rotis?|cuisses?|poitrines?|ailes de|haches?|farces?|pepperettes?|"
        r"bologna|smoked meat|rillettes?)\b",
        haystack,
    ):
        return "Viandes", ""
    if _has(
        r"\b(laits?|fromages?|yogourts?|yaourts?|beurres?|cremes?|kefirs?|cheddars?|"
        r"mozzarellas?|goudas?|fetas?|ricottas?|cottages?|babeurres?|brebis|emmentals?|skyrs?|"
        r"parmesans?)\b",
        haystack,
    ) and "huile" not in haystack:
        return "Produits laitiers", ""
    if _has(
        r"\b(croustilles?|chips|biscuits?|chocolats?|bonbons?|gommes?|"
        r"popcorns?|bretzels?|craquelins?|barres? tendres?|grignotines?|"
        r"amandes?|cajous?|pistaches?|noix|arachides?|fruits? secs?|raisins? secs?)\b",
        haystack,
    ):
        return "Collations", ""
    if _has(
        r"\b(en des|broyees?|broyee|conserves?|cornichons?|olives?|choucroute|"
        r"coeurs? de palmier|soupes?|bouillons?|pates? de tomates?|au sirop|"
        r"dans l huile|marinee?s?)\b",
        haystack,
    ) or (
        _volume(haystack, size)
        and _produce_sub(haystack)
        and not _has(
            r"\b(aromatisants?|garnitures?|reglisses?|bonbons?|cocktails?|thes?|poudres?|"
            r"gelees?|friandises?|desserts?|boissons?|jus|yogourts?|gateaux?|melanges? a)\b",
            haystack,
        )
    ):
        return "Conserves", ""
    prepared = _prepared_shelf(haystack)
    if prepared:
        return prepared
    if _dried_herb(haystack, size):
        return "Épicerie", "Épices"
    fresh = _fresh_produce(haystack, size)
    if fresh:
        return "Fruits et légumes", fresh
    if _has(
        r"\b(pates?|riz|sauces?|huiles?|vinaigres?|farines?|sucres?|sels?|cafes?|thes?|"
        r"cereales?|ketchups?|moutardes?|mayonnaises?|miels?|epices?|pois chiches|"
        r"lentilles?|quinoas?|couscous|gruau|avoines?|salsas?|pestos?|nouilles?|"
        r"sirops?|en des|broyees?|coulis|pates? de tomates?|hummus|trempettes?)\b",
        haystack,
    ):
        return "Épicerie", _epicerie_sub(haystack)
    return "Autres", ""


def num(value: object) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        parsed = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or parsed <= 0:
        return None
    return round(parsed, 2)


def text(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def clean_size(value: object) -> str:
    raw = text(value)
    if not raw:
        return ""
    raw = raw.split(",")[0].split("$")[0].strip()
    return raw[:48]


def http_url(value: object) -> str | None:
    raw = text(value)
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return None


def read_excel(path: Path, **kwargs: object) -> pd.DataFrame:
    try:
        return pd.read_excel(path, **kwargs)
    except PermissionError:
        copy = Path(tempfile.gettempdir()) / f"comparo-{path.name}"
        shutil.copyfile(path, copy)
        return pd.read_excel(copy, **kwargs)


def index_store(frame: pd.DataFrame) -> dict[str, dict]:
    indexed: dict[str, dict] = {}
    for record in frame.to_dict("records"):
        url = http_url(record.get("product_url"))
        name = text(record.get("name"))
        if not url or not name or url in indexed:
            continue
        indexed[url] = {
            "id": text(record.get("product_id")),
            "brand": text(record.get("brand")),
            "name": name,
            "size": clean_size(record.get("size")),
            "image": http_url(record.get("image_url")),
            "regular": num(record.get("regular_price")),
            "sale": num(record.get("sale_price")),
            "card": num(record.get("card_price")),
            "url": url,
        }
    return indexed


def price_of(row: dict) -> float | None:
    return row["sale"] if row["sale"] is not None else row["regular"]


def strip_brand(name: str, brand: str) -> str:
    if brand and name.lower().startswith(brand.lower()):
        trimmed = name[len(brand) :].strip(" -–·")
        if len(trimmed) >= 3:
            return trimmed
    return name


def deal_ratio(base: float | None, price: float | None) -> float:
    if base is None or price is None or base <= 0:
        return 0.0
    return max(0.0, (base - price) / base)


def store_block(row: dict | None, fallback_name: str, fallback_price: float, fallback_url: str) -> dict | None:
    if row is None and fallback_price <= 0:
        return None
    price = price_of(row) if row else fallback_price
    if price is None:
        price = fallback_price
    regular = row["regular"] if row else None
    if regular is not None and regular <= price:
        regular = None
    card = (row or {}).get("card")
    payable = round(float(price), 2)
    if card is None or card >= payable - 0.009:
        card = None
    return {
        "name": (row or {}).get("name") or fallback_name,
        "price": payable,
        "regular": regular,
        "card": card,
        "url": (row or {}).get("url") or fallback_url,
        "image": (row or {}).get("image"),
        "size": (row or {}).get("size") or "",
    }


def load_upcs() -> dict[str, list[str]]:
    if not UPCS.exists():
        return {}
    raw = json.loads(UPCS.read_text(encoding="utf-8"))
    cleaned: dict[str, list[str]] = {}
    if not isinstance(raw, dict):
        return cleaned
    for url, value in raw.items():
        codes = value if isinstance(value, list) else [value]
        digits = []
        for code in codes:
            token = re.sub(r"\D", "", str(code or ""))
            if 8 <= len(token) <= 14 and token not in digits:
                digits.append(token)
        if digits:
            cleaned[str(url)] = digits
    return cleaned


def product_id(prefix: str, key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}:{digest}"


def build() -> dict:
    upcs = load_upcs()
    iga = index_store(read_excel(SOURCE, sheet_name="IGA"))
    maxi = index_store(read_excel(SOURCE, sheet_name="Maxi"))
    compared = read_excel(COMPARE)
    compared = compared.sort_values("score", ascending=False)
    compared = compared.drop_duplicates(["url_iga", "url_maxi"])

    products: list[dict] = []
    used_iga: set[str] = set()
    used_maxi: set[str] = set()

    for record in compared.to_dict("records"):
        url_iga = http_url(record.get("url_iga")) or ""
        url_maxi = http_url(record.get("url_maxi")) or ""
        iga_row = iga.get(url_iga)
        maxi_row = maxi.get(url_maxi)
        iga_price = num(record.get("prix_iga"))
        maxi_price = num(record.get("prix_maxi"))
        if iga_price is None or maxi_price is None:
            continue
        used_iga.add(url_iga)
        used_maxi.add(url_maxi)
        brand = ""
        if iga_row and iga_row["brand"]:
            brand = iga_row["brand"]
        elif maxi_row and maxi_row["brand"]:
            brand = maxi_row["brand"]
        elif text(record.get("marque")):
            brand = text(record.get("marque")).title()
        display = text(record.get("nom_iga")) or text(record.get("nom_maxi"))
        cheaper_raw = text(record.get("moins_cher"))
        cheaper = {"Maxi": "maxi", "IGA": "iga"}.get(cheaper_raw, "egal")
        iga_block = store_block(iga_row, text(record.get("nom_iga")), iga_price, url_iga)
        maxi_block = store_block(maxi_row, text(record.get("nom_maxi")), maxi_price, url_maxi)
        if iga_block:
            iga_block["price"] = iga_price
            card = (iga_row or {}).get("card")
            iga_block["card"] = card if card is not None and card < iga_price - 0.009 else None
        if maxi_block:
            maxi_block["price"] = maxi_price
            maxi_block["card"] = None
        image = None
        if cheaper == "iga":
            image = (iga_block or {}).get("image") or (maxi_block or {}).get("image")
        elif cheaper == "maxi":
            image = (maxi_block or {}).get("image") or (iga_block or {}).get("image")
        else:
            image = (iga_block or {}).get("image") or (maxi_block or {}).get("image")
        category, subcategory = classify(display, brand, text(record.get("format")) or (iga_block or {}).get("size") or "")
        higher = max(iga_price, maxi_price)
        gap = round(abs(iga_price - maxi_price), 2)
        iga_base = (iga_row or {}).get("regular") or iga_price
        maxi_base = (maxi_row or {}).get("regular") or maxi_price
        deal = max(deal_ratio(iga_base, maxi_price), deal_ratio(maxi_base, iga_price))
        products.append(
            {
                "id": product_id("cmp", f"{url_iga}|{url_maxi}"),
                "name": strip_brand(display, brand),
                "brand": brand,
                "size": text(record.get("format")) or (iga_block or {}).get("size") or "",
                "category": category,
                "subcategory": subcategory,
                "image": image,
                "maxi": maxi_block,
                "iga": iga_block,
                "cheaper": cheaper,
                "gap": gap,
                "gapPct": round(gap / higher, 4) if higher else 0,
                "dealPct": round(deal, 4),
                "exclusive": False,
                "barcodes": upcs.get(url_iga, []),
            }
        )

    def add_exclusive(rows: dict[str, dict], store: str, used: set[str]) -> None:
        for url, row in rows.items():
            if url in used:
                continue
            current = price_of(row)
            regular = row["regular"]
            card = row.get("card")
            public_sale = current is not None and regular is not None and current < regular - 0.009
            card_sale = card is not None and regular is not None and card < (current if current is not None else regular) - 0.009
            if not public_sale and not card_sale:
                continue
            shown = current if current is not None else regular
            block = store_block(row, row["name"], shown, url)
            gap = round(regular - current, 2) if public_sale else 0.0
            category, subcategory = classify(row["name"], row["brand"], row["size"])
            item = {
                "id": product_id(store, row["id"] or url),
                "name": strip_brand(row["name"], row["brand"]),
                "brand": row["brand"],
                "size": row["size"],
                "category": category,
                "subcategory": subcategory,
                "image": row["image"],
                "maxi": block if store == "maxi" else None,
                "iga": block if store == "iga" else None,
                "cheaper": store,
                "gap": gap,
                "gapPct": round(gap / regular, 4) if public_sale and regular else 0,
                "dealPct": round(gap / regular, 4) if public_sale and regular else 0,
                "exclusive": True,
                "barcodes": upcs.get(url, []) if store == "iga" else [],
            }
            products.append(item)

    add_exclusive(maxi, "maxi", used_maxi)
    add_exclusive(iga, "iga", used_iga)

    products.sort(key=lambda item: (-item["dealPct"], -item["gap"], item["name"]))
    imbattables = sum(1 for item in products if not item["exclusive"] and item["dealPct"] >= 0.30)
    counts: dict[str, int] = {}
    for item in products:
        counts[item["category"]] = counts.get(item["category"], 0) + 1

    catalog = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "city": "Baie-Comeau",
        "categories": CATEGORIES,
        "products": products,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"produits {len(products)}")
    print(f"compares {sum(1 for item in products if not item['exclusive'])}")
    print(f"exclusifs {sum(1 for item in products if item['exclusive'])}")
    print(f"imbattables {imbattables}")
    print(f"codes-barres {sum(1 for item in products if item['barcodes'])}")
    print("categories", json.dumps(counts, ensure_ascii=False))
    print(OUTPUT, OUTPUT.stat().st_size)


if __name__ == "__main__":
    build()
