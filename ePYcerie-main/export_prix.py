"""Ecrit le catalogue IGA et Maxi de Baie-Comeau dans un fichier Excel."""

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "epycerie"))

from connectors.iga_connector import IGA
from connectors.maxi_connector import Maxi


COLUMNS = [
    "product_id",
    "brand",
    "size",
    "name",
    "product_url",
    "image_url",
    "regular_price",
    "sale_price",
    "card_price",
    "store",
]


def main():
    destination = ROOT / "baie-comeau.xlsx"
    print("IGA...")
    iga = IGA.all()
    print("IGA", len(iga))
    print("Maxi...")
    maxi = Maxi.all()
    print("Maxi", len(maxi))
    if len(iga) < 50 or len(maxi) < 50:
        raise SystemExit(f"relevé trop court (IGA {len(iga)}, Maxi {len(maxi)}), fichier conservé")
    with pd.ExcelWriter(destination, engine="openpyxl") as writer:
        pd.DataFrame(iga, columns=COLUMNS).to_excel(writer, sheet_name="IGA", index=False)
        pd.DataFrame(maxi, columns=COLUMNS).to_excel(writer, sheet_name="Maxi", index=False)
    print(destination)


if __name__ == "__main__":
    main()
