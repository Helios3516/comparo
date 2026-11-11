"""Ajoute les produits vendus aux deux magasins qui n'ont pas encore de prix comparé.

Le jumelage d'origine rate des marques comme Kellogg's : l'apostrophe
droite devient un espace (« kellogg s ») et l'apostrophe courbe disparaît
(« kelloggs »), donc la marque n'est plus reconnue.
"""

import json
import re
import sys
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from comparer import (  # noqa: E402
    DESTINATION,
    SOURCE,
    fold,
    pair_rows,
    prepare,
)


def cores(value):
    found = set()
    for raw in re.findall(r"\d{10,14}", str(value or "")):
        found.add(raw.lstrip("0"))
        if len(raw) >= 12:
            found.add(raw[:-1].lstrip("0"))
            found.add(raw[1:-1].lstrip("0"))
    return {code for code in found if len(code) >= 10}

UPCS = ROOT.parent / "web" / "data" / "iga-upcs.json"
WEAK = {"original", "originaux", "originale", "nature", "naturel", "classic", "classique", "regular", "gout"}
FLAGS = ("leger", "light", "zero", "chocolat", "chocolate", "fraise", "vanille", "bio", "biologique")


def brand_key(brand):
    return re.sub(r"[^a-z0-9]", "", fold(brand))


def same_brand_key(left, right):
    if not left or not right:
        return False
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    return len(shorter) >= 7 and longer.startswith(shorter)


def strong_words(words):
    return {word for word in words if len(word) > 3 and word not in WEAK and word not in {"kellogg", "kelloggs"}}


def number_conflict(left, right):
    left_numbers = set(re.findall(r"\d+", fold(left)))
    right_numbers = set(re.findall(r"\d+", fold(right)))
    if not left_numbers or not right_numbers:
        return False
    return left_numbers != right_numbers


def flag_conflict(left, right):
    left_text = fold(left)
    right_text = fold(right)
    for flag in FLAGS:
        if (flag in left_text.split()) != (flag in right_text.split()):
            return True
    return False


def propose(iga_rows, maxi_rows, used_iga, used_maxi):
    pairs = []

    def take(iga, maxi, score):
        if iga["product_url"] in used_iga or maxi["product_url"] in used_maxi:
            return
        paired = pair_rows(iga, maxi, score)
        if paired is None:
            return
        pairs.append(paired)
        used_iga.add(iga["product_url"])
        used_maxi.add(maxi["product_url"])

    iga_by_code = {}
    for row in iga_rows:
        if row["product_url"] in used_iga:
            continue
        codes = cores(row.get("upc")) | cores(" ".join(row.get("extra_codes") or []))
        for code in codes:
            iga_by_code.setdefault(code, []).append(row)

    for row in maxi_rows:
        if row["product_url"] in used_maxi:
            continue
        hits = []
        seen = set()
        for code in cores(row.get("image_url")) | cores(row.get("upc")):
            for iga in iga_by_code.get(code, []):
                if iga["product_url"] in seen or iga["product_url"] in used_iga:
                    continue
                seen.add(iga["product_url"])
                hits.append(iga)
        if len(hits) == 1:
            take(hits[0], row, 100)

    buckets = {}
    for row in maxi_rows:
        if row["product_url"] in used_maxi or row["alcohol"] or not row["size"]:
            continue
        buckets.setdefault((brand_key(row["brand"]), row["size"]), []).append(row)

    proposals = []
    for iga in iga_rows:
        if iga["product_url"] in used_iga or iga["alcohol"] or not iga["size"]:
            continue
        key = brand_key(iga["brand"])
        if len(key) < 4:
            continue
        candidates = []
        for (maxi_key, size), rows in buckets.items():
            if size != iga["size"] or not same_brand_key(key, maxi_key):
                continue
            candidates.extend(rows)
        ranked = []
        iga_words = strong_words(iga["words"])
        for maxi in candidates:
            if maxi["product_url"] in used_maxi:
                continue
            if number_conflict(iga["name"], maxi["name"]) or flag_conflict(iga["name"], maxi["name"]):
                continue
            maxi_words = strong_words(maxi["words"])
            common = iga_words & maxi_words
            smaller, larger = (iga_words, maxi_words) if len(iga_words) <= len(maxi_words) else (maxi_words, iga_words)
            subset = bool(smaller) and smaller <= larger and len(smaller) >= 2
            if len(common) < 2 and not subset:
                continue
            score = fuzz.token_sort_ratio(" ".join(sorted(iga_words)), " ".join(sorted(maxi_words)))
            if subset:
                score = max(score, 90)
            if score < 88:
                continue
            ranked.append((score, len(common), maxi))
        if not ranked:
            continue
        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        best_score, _common, best = ranked[0]
        if len(ranked) > 1 and best_score - ranked[1][0] < 6:
            continue
        proposals.append((best_score, iga, best))

    proposals.sort(key=lambda item: item[0], reverse=True)
    for score, iga, maxi in proposals:
        take(iga, maxi, score)
    return pairs


def main():
    iga = prepare(pd.read_excel(SOURCE, sheet_name="IGA"), "IGA")
    maxi = prepare(pd.read_excel(SOURCE, sheet_name="Maxi"), "Maxi")
    extra = {}
    if UPCS.exists():
        raw = json.loads(UPCS.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            extra = {str(url): value if isinstance(value, list) else [value] for url, value in raw.items()}
    for row in iga:
        row["extra_codes"] = [str(code) for code in extra.get(row["product_url"], [])]

    current = pd.read_excel(DESTINATION)
    used_iga = set(current["url_iga"].astype(str))
    used_maxi = set(current["url_maxi"].astype(str))
    found = propose(iga, maxi, used_iga, used_maxi)
    print("ajoutes", len(found))
    interesting = [row for row in found if "krisp" in fold(row["nom_iga"] + " " + row["nom_maxi"])]
    print("rice krispies", len(interesting))
    for row in interesting:
        print(f"{row['score']:>5}  {row['prix_maxi']}  {row['nom_maxi'][:50]}  ||  {row['prix_iga']}  {row['nom_iga'][:60]}")
    print("--- echantillon ---")
    for row in found[:25]:
        print(f"{row['score']:>5}  {row['format']:<12} {row['nom_maxi'][:42]:<42} || {row['nom_iga'][:48]}")
    print("--- scores bas ---")
    for row in found[-15:]:
        print(f"{row['score']:>5}  {row['format']:<12} {row['nom_maxi'][:42]:<42} || {row['nom_iga'][:48]}")
    if "--write" in sys.argv:
        frame = pd.concat([current, pd.DataFrame(found)], ignore_index=True)
        frame.to_excel(DESTINATION, index=False)
        print("ecrit", DESTINATION, len(frame))


if __name__ == "__main__":
    main()
