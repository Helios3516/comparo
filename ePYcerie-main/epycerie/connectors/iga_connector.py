try:
    from connectors.connector import Connector
except ImportError:
    from epycerie.connectors.connector import Connector

try:
    from store_keys import require
except ImportError:
    from epycerie.store_keys import require

from curl_cffi import requests
import time


class IGA(Connector):
    """Connecteur IGA (iga.ca) pour Baie-Comeau.

    Le stock de base vient du magasin IGA de Baie-Comeau (code postal G5C).
    Le prix special est celui de la circulaire de ce magasin.
    """

    __POSTAL_CODE = "G5C 2B2"
    __STORE = "IGA"
    __INDEX = "dxp_product_fr"
    __STORE_INDEX = "dxp_stores"
    __PAGE_SIZE = 1000

    def __init__(self):
        self._app = require("IGA_ALGOLIA_APP")
        self._key = require("IGA_ALGOLIA_KEY")
        self.session = requests.Session(impersonate="chrome")
        self.session.headers.update({
            "Cookie": "PostalCode=G5C 2B2",
            "Accept-Language": "fr-CA,fr;q=0.9",
            "Referer": "https://www.iga.ca/",
            "Origin": "https://www.iga.ca",
            "x-algolia-application-id": self._app,
            "x-algolia-api-key": self._key,
            "Content-Type": "application/json",
        })
        self.session.cookies.set("PostalCode", IGA.__POSTAL_CODE, domain=".iga.ca")
        self.session.cookies.set("PostalCode", IGA.__POSTAL_CODE, domain=".iga.net")
        self.store_number = self._resolve_store_number()

    def _algolia(self, index, payload):
        url = "https://{0}-dsn.algolia.net/1/indexes/{1}".format(self._app, index)
        response = self.session.post(url, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()

    def _resolve_store_number(self):
        data = self._algolia(IGA.__STORE_INDEX + "/query", {"query": "G5C", "hitsPerPage": 5})
        for hit in data.get("hits") or []:
            postal = ((hit.get("address") or {}).get("postalCode") or "").replace(" ", "").upper()
            if postal.startswith("G5C") and hit.get("storeNumber"):
                return str(hit["storeNumber"])
        if data.get("hits"):
            return str(data["hits"][0].get("storeNumber") or "8526")
        return "8526"

    def _description(self, promo):
        return (promo.get("promotionDescription") or "").strip().upper()

    def _scene_card(self, promo):
        return self._description(promo).startswith("CARTE")

    def _reduced(self, price, promo, reward):
        raw = ((reward.get("value1Value20") or [{}])[0] or {}).get("value_1")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
        source = promo.get("source")
        kind = reward.get("rewardType")
        sale = None
        if kind == 1:
            off = value / 100 if source == "CMA" else value
            sale = price - off
        elif kind == 2:
            off = price * value / 100 if source == "CMA" else price * value
            sale = price - off
        elif kind in (4, 5):
            sale = value / 100 if source == "CMA" else value
        if sale is None:
            return None
        sale = round(sale, 2)
        if 0 < sale < price - 0.001:
            return sale
        return None

    def _split_prices(self, price, promotions):
        """Prix en tablette, puis prix avec la carte Scène.

        Les offres dont le libellé commence par CARTE sont le rabais
        carte. Elles ne remplacent pas le prix affiché pour tout le monde.
        """
        if price is None:
            return None, None
        now = time.time()
        public = None
        card = None
        for promo in promotions or []:
            if not promo.get("promotionComplianceFlag"):
                continue
            start = promo.get("startDate") or 0
            end = promo.get("endDate") or 0
            if start and start > now:
                continue
            if end and end < now:
                continue
            rewards = promo.get("promotionReward") or []
            if not rewards:
                continue
            reward = rewards[0]
            if self._description(promo).startswith("RAB EMPLOYE"):
                continue
            member = reward.get("membershipLevelText") or ""
            if "Y" in member:
                continue
            sale = self._reduced(price, promo, reward)
            if sale is None:
                continue
            if self._scene_card(promo):
                if card is None or sale < card:
                    card = sale
            elif public is None or sale < public:
                public = sale
        payable = public if public is not None else price
        if card is not None and card >= payable - 0.001:
            card = None
        return public, card

    def _sale_price(self, price, promotions):
        public, _card = self._split_prices(price, promotions)
        return public

    def _format_product(self, hit):
        price = hit.get("price")
        try:
            regular = round(float(price), 2)
        except (TypeError, ValueError):
            regular = None
        sale, card = self._split_prices(regular, hit.get("promotions"))
        amount = hit.get("itemAmountValue") or ""
        unit = hit.get("itemAmountUnit") or ""
        size = "{0} {1}".format(amount, unit).strip() or hit.get("weight") or ""
        images = hit.get("images") or []
        slug = hit.get("pageSlug") or ""
        return {
            "product_id": hit.get("objectID") or hit.get("articleNumber") or "",
            "brand": hit.get("brand") or "",
            "size": size,
            "name": hit.get("name") or "",
            "product_url": "https://www.iga.ca/fr/produits/{0}".format(slug) if slug else "",
            "image_url": images[0] if images else "",
            "regular_price": regular,
            "sale_price": sale if sale is not None else regular,
            "card_price": card,
            "store": IGA.__STORE,
            "upc": str(hit.get("upc") or ""),
        }

    def _browse(self):
        payload = {
            "filters": "storeId:{0}".format(self.store_number),
            "hitsPerPage": IGA.__PAGE_SIZE,
            "attributesToRetrieve": [
                "objectID", "articleNumber", "brand", "name", "pageSlug", "images",
                "price", "promotions", "weight", "itemAmountValue", "itemAmountUnit", "upc",
            ],
        }
        products = []
        while True:
            data = self._algolia(IGA.__INDEX + "/browse", payload)
            hits = data.get("hits") or []
            products.extend(self._format_product(hit) for hit in hits)
            cursor = data.get("cursor")
            if not cursor or not hits:
                break
            payload = {"cursor": cursor}
        return products

    def _products(self, specials_only):
        products = self._browse()
        if specials_only:
            return [item for item in products if item["sale_price"] is not None and item["regular_price"] is not None and item["sale_price"] < item["regular_price"]]
        return products

    def flyer():
        return IGA()._products(True)

    def all():
        return IGA()._products(False)
