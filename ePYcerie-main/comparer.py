"""Apparie les produits IGA et Maxi du fichier baie-comeau.xlsx."""

import re
import unicodedata
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "baie-comeau.xlsx"
DESTINATION = ROOT / "comparaison.xlsx"

STOPWORDS = {
    "de", "du", "des", "la", "le", "les", "et", "a", "au", "aux", "en", "un", "une",
    "pour", "avec", "sans", "saveur", "gout", "the", "d", "l",
}
PACK_SIZE_RE = re.compile(r"(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|ea|un|lb)\b", re.I)
SINGLE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|ea|un|lb)\b", re.I)
UNIT_PRICE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*\$\s*/\s*100\s*(ml|g)\b", re.I)
AGE_RE = re.compile(r"piece d.?identite requise.*", re.I)
CATEGORY_WORDS = {"biere", "beer", "cidre", "vin"}
VARIANT_MAP = {
    "light": "legere", "lite": "legere", "legere": "legere",
    "silver": "silver",
    "zero": "zero",
    "dry": "dry",
    "ipa": "ipa", "neipa": "ipa",
    "ultra": "ultra",
    "seltzer": "seltzer",
    "edge": "edge",
    "radler": "radler",
    "lime": "lime",
    "export": "export",
    "ex": "export",
    "ice": "ice",
    "brune": "brune",
    "bleue": "bleue", "bleu": "bleue", "blue": "bleue",
    "canadian": "canadian",
    "rouge": "rouge", "blanc": "blanc", "rose": "rose",
}
FAMILY_ALIAS = {
    "bud": "budweiser",
    "budlight": "budweiser",
    "coorslight": "coors",
}
SKIP_FAMILY = {"xx", "biere", "beer", "vin", "cidre", "the", "boisson", "birra", "brasserie"}
FILLER = STOPWORDS | CATEGORY_WORDS | {
    "canette", "canettes", "bouteille", "bouteilles", "conserve", "conserves",
    "paquet", "caisse", "alcool", "alcoolise", "alcoolisee", "alc", "vol", "lager",
    "ale", "forte", "style", "piece", "identite", "requise", "moment", "ramassage",
    "superieure", "qualite", "naturel", "naturels", "arome", "aromes", "format",
}


def fold(text):
    text = "" if text is None or (isinstance(text, float) and pd.isna(text)) else str(text)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().replace("'", " ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def tokens(text):
    return {token for token in fold(text).split() if token not in STOPWORDS and not token.isdigit()}


def normalize_unit(amount, unit):
    unit = unit.lower()
    if unit == "kg":
        return ("g", round(amount * 1000))
    if unit == "l":
        return ("ml", round(amount * 1000))
    if unit == "lb":
        return ("g", round(amount * 453.592))
    if unit == "un":
        return ("ea", round(amount))
    return (unit, round(amount))


def parse_size(size, name, price=None):
    raw_size = "" if size is None or (isinstance(size, float) and pd.isna(size)) else str(size)
    package = raw_size.split("$")[0]
    sources = [package, "" if name is None else str(name)]
    for text in sources:
        match = PACK_SIZE_RE.search(text)
        if match:
            unit, amount = normalize_unit(float(match.group(2).replace(",", ".")), match.group(3))
            return (int(match.group(1)), unit, amount)
    for text in sources:
        match = SINGLE_RE.search(text)
        if match:
            unit, amount = normalize_unit(float(match.group(1).replace(",", ".")), match.group(2))
            count = pack_count_from_unit_price(raw_size, unit, amount, price)
            return (count or 1, unit, amount)
    return None


def pack_count_from_unit_price(size_text, unit, amount, price):
    if unit not in {"ml", "g"} or not amount or price is None or pd.isna(price):
        return None
    match = UNIT_PRICE_RE.search(size_text or "")
    if not match or match.group(2).lower() != unit:
        return None
    each = float(match.group(1).replace(",", ".")) * amount / 100
    if each <= 0:
        return None
    estimate = float(price) / each
    count = round(estimate)
    if count >= 2 and abs(estimate - count) <= 0.35:
        return count
    return None


def same_family(left, right):
    if not left or not right:
        return False
    if left == right:
        return True
    trimmed_left, trimmed_right = left.rstrip("s"), right.rstrip("s")
    if trimmed_left == trimmed_right and len(trimmed_left) >= 4:
        return True
    return same_brand(left, right)


def same_brand(left, right):
    if not left or not right:
        return False
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    if len(shorter) < 6 or not longer.startswith(shorter):
        return False
    return len(longer) == len(shorter) or longer[len(shorter)] != " "


def cleaned_text(brand, name):
    return (fold(brand) + " " + AGE_RE.sub("", fold(name))).strip()


def variants_from_text(text):
    folded = fold(text)
    variants = set()
    if (
        "sans alcool" in folded
        or "non alcool" in folded
        or "sansalcool" in folded
        or "desalcoolisee" in folded
        or "desalcoolise" in folded
        or re.search(r"\b0\s*0\b", folded)
    ):
        variants.add("zero")
    for token in folded.split():
        mapped = VARIANT_MAP.get(token)
        if mapped:
            variants.add(mapped)
    return variants


def alcohol_profile(brand, name):
    text = cleaned_text(brand, name)
    family = ""
    for token in fold(brand).split():
        if token in FAMILY_ALIAS:
            family = FAMILY_ALIAS[token]
            break
        if token in SKIP_FAMILY or token in VARIANT_MAP:
            continue
        if len(token) > 2:
            family = token
            break
    return family, variants_from_text(text)


def variants_compatible(left, right):
    if left == right:
        return True
    if not left or not right:
        return False
    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    return smaller <= larger


def is_alcohol(brand, name):
    raw = fold(brand) + " " + fold(name)
    if "identite" in raw:
        return True
    return bool(set(raw.split()) & {"biere", "beer", "cidre", "vin"})


def is_generic(name):
    cleaned = AGE_RE.sub("", fold(name))
    words = {word for word in tokens(cleaned) if len(word) >= 3}
    return len(words & CATEGORY_WORDS) >= 1 and len(words - CATEGORY_WORDS) == 0


def format_size(size):
    count, unit, amount = size
    if count > 1:
        return "{0:g} x {1:g} {2}".format(count, amount, unit)
    return "{0:g} {1}".format(amount, unit)


def prepare(frame, store):
    rows = []
    for record in frame.to_dict("records"):
        brand = fold(record.get("brand"))
        name = fold(record.get("name"))
        shelf_price = record.get("regular_price")
        if shelf_price is None or pd.isna(shelf_price):
            shelf_price = record.get("sale_price")
        size = parse_size(record.get("size"), record.get("name"), shelf_price)
        raw_name = record.get("name") or ""
        words = tokens(AGE_RE.sub("", fold(raw_name)))
        if brand:
            words -= set(brand.split())
        family, variants = alcohol_profile(record.get("brand"), raw_name)
        rows.append({
            "store": store,
            "brand": brand,
            "name": raw_name,
            "words": words,
            "size": size,
            "generic": is_generic(raw_name),
            "family": family,
            "variants": variants,
            "alcohol": is_alcohol(record.get("brand"), raw_name),
            "regular_price": record.get("regular_price"),
            "sale_price": record.get("sale_price"),
            "product_url": record.get("product_url") or "",
            "image_url": record.get("image_url") or "",
            "upc": record.get("upc") or "",
        })
    return rows


def price_of(row):
    sale = row["sale_price"]
    regular = row["regular_price"]
    if pd.notna(sale):
        return float(sale)
    if pd.notna(regular):
        return float(regular)
    return None


def read_label(url):
    import asyncio
    from io import BytesIO
    from PIL import Image
    from curl_cffi import requests
    import winocr

    response = requests.get(url, timeout=40, impersonate="chrome", headers={"Accept": "image/jpeg"})
    response.raise_for_status()
    image = Image.open(BytesIO(response.content))
    result = asyncio.run(winocr.recognize_pil(image, "fr"))
    text = " ".join(line.text for line in result.lines)
    if len([token for token in fold(text).split() if len(token) >= 4]) < 2 and "/1/" in url:
        alt = requests.get(url.replace("/1/", "/2/", 1), timeout=40, impersonate="chrome", headers={"Accept": "image/jpeg"})
        if alt.status_code == 200 and len(alt.content) > 1000:
            alt_image = Image.open(BytesIO(alt.content))
            alt_result = asyncio.run(winocr.recognize_pil(alt_image, "fr"))
            text = text + " " + " ".join(line.text for line in alt_result.lines)
    return text


def distinctive_tokens(name, brand):
    brand_tokens = set(fold(brand).split())
    found = []
    for token in AGE_RE.sub("", fold(name)).split():
        if token in brand_tokens or token in FILLER or token.isdigit() or len(token) < 4:
            continue
        if token.startswith(("canett", "bout", "conserv", "bouteil")):
            continue
        found.append(token)
    return found


def add_photo_text(rows):
    targets = [row for row in rows if row["alcohol"] and row.get("image_url") and not distinctive_tokens(row["name"], row["brand"])]
    print("photos", len(targets))
    for row in targets:
        try:
            text = read_label(row["image_url"])
        except Exception as error:
            print("photo ignoree", row["brand"], error)
            text = ""
        row["ocr"] = fold(text)
        row["variants"] = set(row["variants"]) | variants_from_text(text)
        if row["ocr"]:
            print(row["brand"], row["ocr"][:80])


def token_hit(token, text):
    for other in text.split():
        if token == other:
            return True
        if len(token) >= 6 and len(other) >= 6 and (other.startswith(token) or token.startswith(other)):
            return True
    return False


def alcohol_options(maxi, iga_rows):
    exact = []
    for iga in iga_rows:
        if not iga["alcohol"] or not same_family(maxi["family"], iga["family"]) or not iga["size"]:
            continue
        if iga["size"] == maxi["size"]:
            exact.append(iga)
    def narrow(options):
        equal = [item for item in options if item["variants"] == maxi["variants"]]
        if equal:
            return equal
        if maxi["variants"]:
            subset = [item for item in options if maxi["variants"] <= item["variants"]]
            if subset:
                smallest = min(len(item["variants"]) for item in subset)
                return [item for item in subset if len(item["variants"]) == smallest]
        if len(options) == 1:
            return options
        return []

    pool = narrow(exact)
    name_hints = distinctive_tokens(maxi["name"], maxi["brand"])
    ocr_hints = [
        token for token in tokens(maxi.get("ocr") or "")
        if len(token) >= 5 and token not in FILLER and token not in set(fold(maxi["brand"]).split())
    ]
    if name_hints:
        useful = [token for token in name_hints if any(token_hit(token, fold(item["name"])) for item in pool)]
        if useful:
            pool = [item for item in pool if any(token_hit(token, fold(item["name"])) for token in useful)]
    if len(pool) > 1 and ocr_hints:
        scored = []
        for item in pool:
            overlap = sum(1 for token in ocr_hints if token_hit(token, fold(item["name"])))
            scored.append((overlap, item))
        best = max(overlap for overlap, _item in scored)
        if best > 0:
            pool = [item for overlap, item in scored if overlap == best]
    if len(pool) > 1 and not name_hints:
        signatures = {
            tuple(sorted(distinctive_tokens(item["name"], item["brand"])))
            for item in pool
        }
        if len(signatures) > 1:
            return []
    return pool


def match_alcohol(iga_rows, maxi_rows, used_iga, used_maxi):
    proposals = []
    for maxi in maxi_rows:
        if not maxi["alcohol"] or not maxi["size"] or maxi["product_url"] in used_maxi:
            continue
        hints = distinctive_tokens(maxi["name"], maxi["brand"])
        ocr_hints = [token for token in tokens(maxi.get("ocr") or "") if len(token) >= 5 and token not in FILLER]
        for iga in alcohol_options(maxi, iga_rows):
            if iga["product_url"] in used_iga:
                continue
            iga_text = fold(iga["name"])
            score = 98 if iga["variants"] == maxi["variants"] else 90
            score += min(sum(1 for token in hints + ocr_hints if token_hit(token, iga_text)), 4) * 4
            proposals.append((score, maxi, iga))
    proposals.sort(key=lambda item: item[0], reverse=True)
    pairs = []
    for score, maxi, iga in proposals:
        if maxi["product_url"] in used_maxi or iga["product_url"] in used_iga:
            continue
        paired = pair_rows(iga, maxi, score)
        if paired is None:
            continue
        pairs.append(paired)
        used_maxi.add(maxi["product_url"])
        used_iga.add(iga["product_url"])
    return pairs


def match_products(iga_rows, maxi_rows):
    buckets = {}
    iga_counts = {}
    maxi_generic_counts = {}
    for index, row in enumerate(maxi_rows):
        buckets.setdefault(row["size"], []).append(index)
        if row["generic"] and row["brand"] and row["size"]:
            key = (row["brand"], row["size"])
            maxi_generic_counts[key] = maxi_generic_counts.get(key, 0) + 1
    for row in iga_rows:
        if row["brand"] and row["size"]:
            key = (row["brand"], row["size"])
            iga_counts[key] = iga_counts.get(key, 0) + 1

    pairs = []
    for iga in iga_rows:
        if iga["size"] is None:
            continue
        best = None
        best_score = 0
        for index in buckets.get(iga["size"], []):
            maxi = maxi_rows[index]
            if iga["alcohol"] or maxi["alcohol"]:
                continue
            if iga["brand"] and maxi["brand"] and not same_brand(iga["brand"], maxi["brand"]):
                continue
            if (iga["generic"] or maxi["generic"]) and same_brand(iga["brand"], maxi["brand"]):
                one_iga = iga_counts.get((iga["brand"], iga["size"]), 0) == 1
                one_maxi = maxi_generic_counts.get((maxi["brand"], maxi["size"]), 0) == 1
                if one_iga and one_maxi and 96 > best_score:
                    best = maxi
                    best_score = 96
                continue
            common = {word for word in iga["words"] & maxi["words"] if len(word) > 3}
            if len(iga["words"]) >= 2 and len(maxi["words"]) >= 2 and len(common) < 2:
                continue
            if not common:
                continue
            shorter = min(len(iga["words"]), len(maxi["words"])) or 1
            if len(common) / shorter < 0.6:
                continue
            score = fuzz.token_sort_ratio(" ".join(sorted(iga["words"])), " ".join(sorted(maxi["words"])))
            minimum = 85 if iga["brand"] and maxi["brand"] else 90
            if score >= minimum and score > best_score:
                best = maxi
                best_score = score
        if best is None:
            continue
        iga_price = price_of(iga)
        maxi_price = price_of(best)
        if iga_price is None or maxi_price is None:
            continue
        if iga_price < maxi_price:
            cheaper = "IGA"
        elif maxi_price < iga_price:
            cheaper = "Maxi"
        else:
            cheaper = "egal"
        pairs.append({
            "marque": iga["brand"] or best["brand"],
            "format": format_size(iga["size"]),
            "nom_iga": iga["name"],
            "nom_maxi": best["name"],
            "prix_iga": iga_price,
            "prix_maxi": maxi_price,
            "moins_cher": cheaper,
            "ecart": round(abs(iga_price - maxi_price), 2),
            "score": best_score,
            "url_iga": iga["product_url"],
            "url_maxi": best["product_url"],
        })
    return pairs


def barcode_keys(value):
    keys = set()
    for raw in re.findall(r"\d{11,14}", str(value or "")):
        keys.add(raw)
        keys.add(raw.lstrip("0"))
        if len(raw) >= 12:
            keys.add(raw[:-1].lstrip("0"))
    return keys


def pair_rows(iga, maxi, score):
    iga_price = price_of(iga)
    maxi_price = price_of(maxi)
    if iga_price is None or maxi_price is None:
        return None
    if iga_price < maxi_price:
        cheaper = "IGA"
    elif maxi_price < iga_price:
        cheaper = "Maxi"
    else:
        cheaper = "egal"
    return {
        "marque": iga["brand"] or maxi["brand"],
        "format": format_size(iga["size"]) if iga["size"] else (format_size(maxi["size"]) if maxi["size"] else ""),
        "nom_iga": iga["name"],
        "nom_maxi": maxi["name"],
        "prix_iga": iga_price,
        "prix_maxi": maxi_price,
        "moins_cher": cheaper,
        "ecart": round(abs(iga_price - maxi_price), 2),
        "score": score,
        "url_iga": iga["product_url"],
        "url_maxi": maxi["product_url"],
    }


def match_by_barcode(iga_rows, maxi_rows):
    index = {}
    for row in iga_rows:
        for key in barcode_keys(row.get("upc")):
            index.setdefault(key, row)
    pairs = []
    for row in maxi_rows:
        hit = None
        for key in barcode_keys(row.get("image_url")):
            hit = index.get(key)
            if hit:
                break
        if hit is None:
            continue
        paired = pair_rows(hit, row, 100)
        if paired:
            pairs.append(paired)
    return pairs


def attach_iga_upcs(rows):
    import sys
    sys.path.insert(0, str(ROOT / "epycerie"))
    from connectors.iga_connector import IGA

    by_name = {}
    for product in IGA.all():
        upc = product.get("upc") or ""
        if upc and product.get("name"):
            by_name.setdefault(product["name"], upc)
    for row in rows:
        row["upc"] = by_name.get(row["name"], "")
    print("codes IGA", sum(1 for row in rows if row["upc"]))


def main():
    iga = prepare(pd.read_excel(SOURCE, sheet_name="IGA"), "IGA")
    maxi = prepare(pd.read_excel(SOURCE, sheet_name="Maxi"), "Maxi")
    print("IGA", len(iga), "Maxi", len(maxi))
    attach_iga_upcs(iga)
    add_photo_text(maxi)
    exact = match_by_barcode(iga, maxi)
    print("codes barres", len(exact))
    used_maxi = {pair["url_maxi"] for pair in exact}
    used_iga = {pair["url_iga"] for pair in exact}
    beers = match_alcohol(iga, maxi, used_iga, used_maxi)
    print("bieres", len(beers))
    fuzzy = match_products(iga, maxi)
    fuzzy = [pair for pair in fuzzy if pair["url_maxi"] not in used_maxi and pair["url_iga"] not in used_iga]
    pairs = exact + beers + fuzzy
    frame = pd.DataFrame(pairs)
    if not frame.empty:
        frame = frame.sort_values("score", ascending=False).drop_duplicates(["nom_iga", "nom_maxi"])
        frame = frame.sort_values(["ecart", "score"], ascending=[False, False])
    frame.to_excel(DESTINATION, index=False)
    print("paires", len(frame))
    print(frame["moins_cher"].value_counts().to_string())
    print(DESTINATION)


if __name__ == "__main__":
    main()
