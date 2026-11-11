"""Recalcule les prix IGA : tablette d'un côté, carte Scène de l'autre."""

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "epycerie"))

from connectors.iga_connector import IGA

SOURCE = ROOT / "baie-comeau.xlsx"
COMPARE = ROOT / "comparaison.xlsx"


def payable(value, regular):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None if regular is None or pd.isna(regular) else round(float(regular), 2)
    return round(float(value), 2)


def main():
    print("lecture IGA...")
    fresh = {row["product_url"]: row for row in IGA.all() if row.get("product_url")}
    print("fiches", len(fresh))
    iga = pd.read_excel(SOURCE, sheet_name="IGA")
    maxi = pd.read_excel(SOURCE, sheet_name="Maxi")
    changed = 0
    cards = 0
    missing = 0
    sales = []
    card_values = []
    for index, row in iga.iterrows():
        hit = fresh.get(row.get("product_url"))
        if hit is None:
            missing += 1
            sales.append(row.get("sale_price"))
            card_values.append(None)
            continue
        sale = hit.get("sale_price")
        card = hit.get("card_price")
        old = row.get("sale_price")
        if pd.notna(old) and sale is not None and abs(float(old) - float(sale)) > 0.009:
            changed += 1
        if card is not None:
            cards += 1
        sales.append(sale)
        card_values.append(card)
    iga["sale_price"] = sales
    iga["card_price"] = card_values
    with pd.ExcelWriter(SOURCE, engine="openpyxl") as writer:
        iga.to_excel(writer, sheet_name="IGA", index=False)
        maxi.to_excel(writer, sheet_name="Maxi", index=False)
    print("prix tablette corriges", changed)
    print("prix carte", cards)
    print("sans correspondance", missing)

    compare = pd.read_excel(COMPARE)
    by_url = iga.set_index("product_url")
    prices = []
    winners = []
    gaps = []
    for _, row in compare.iterrows():
        url = row.get("url_iga")
        maxi_price = row.get("prix_maxi")
        iga_price = row.get("prix_iga")
        if url in by_url.index:
            record = by_url.loc[url]
            if isinstance(record, pd.DataFrame):
                record = record.iloc[0]
            iga_price = payable(record.get("sale_price"), record.get("regular_price"))
        prices.append(iga_price)
        if pd.isna(iga_price) or pd.isna(maxi_price):
            winners.append(row.get("moins_cher"))
            gaps.append(row.get("ecart"))
            continue
        iga_price = float(iga_price)
        maxi_price = float(maxi_price)
        if iga_price < maxi_price - 0.001:
            winners.append("IGA")
        elif maxi_price < iga_price - 0.001:
            winners.append("Maxi")
        else:
            winners.append("egal")
        gaps.append(round(abs(iga_price - maxi_price), 2))
    compare["prix_iga"] = prices
    compare["moins_cher"] = winners
    compare["ecart"] = gaps
    compare.to_excel(COMPARE, index=False)
    print(compare["moins_cher"].value_counts().to_string())


if __name__ == "__main__":
    main()
