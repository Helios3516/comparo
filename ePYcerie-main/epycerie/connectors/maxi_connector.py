try:
    from connectors.connector import Connector
except ImportError:
    from epycerie.connectors.connector import Connector

try:
    from store_keys import require
except ImportError:
    from epycerie.store_keys import require

from curl_cffi import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
import threading


class Maxi(Connector):
    """Connecteur Maxi (PC Express) pour Baie-Comeau.

    Le stock de base est le catalogue du Maxi dont le code postal commence par G5C.
    Les speciaux viennent de la circulaire de ce magasin.
    """

    __API = "https://api.pcexpress.ca/pcx-bff/api/v2"
    __LOCATIONS = "https://api.pcexpress.ca/pcx-bff/api/v1/pickup-locations?bannerIds=maxi"
    __ROOT_CATEGORY = "27985"
    __STORE = "MAXI"
    __POSTAL_PREFIX = "G5C"

    def __init__(self):
        self.session = requests.Session(impersonate="chrome")
        self.session.headers.update({
            "Accept": "application/json",
            "Accept-Language": "fr",
            "Content-Type": "application/json",
            "Origin": "https://www.maxi.ca",
            "Referer": "https://www.maxi.ca/",
            "x-apikey": require("MAXI_API_KEY"),
            "x-application-type": "Web",
            "x-channel": "web",
            "x-loblaw-tenant-id": "ONLINE_GROCERIES",
            "x-preview": "false",
        })
        self.store_id = self._resolve_store_id()
        self._local = threading.local()

    def _body(self, page, filters=None):
        return {
            "cart": {"cartId": "afc9da43-085f-477a-931c-bb9951d73dd6"},
            "fulfillmentInfo": {
                "storeId": self.store_id,
                "pickupType": "STORE",
                "offerType": "OG",
            },
            "listingInfo": {
                "filters": filters or {},
                "sort": {"name": "asc"},
                "pagination": {"from": page},
                "includeFiltersInResponse": False,
            },
            "banner": "maxi",
        }

    def _resolve_store_id(self):
        response = self.session.get(Maxi.__LOCATIONS, timeout=60)
        response.raise_for_status()
        for store in response.json():
            postal = ((store.get("address") or {}).get("postalCode") or "").replace(" ", "").upper()
            if postal.startswith(Maxi.__POSTAL_PREFIX):
                return str(store.get("storeId"))
        for store in response.json():
            town = ((store.get("address") or {}).get("town") or "").lower()
            if "baie" in town and "comeau" in town:
                return str(store.get("storeId"))
        return "8985"

    def _post(self, url, payload):
        session = getattr(self._local, "session", None)
        if session is None:
            session = requests.Session(impersonate="chrome")
            session.headers.update(self.session.headers)
            self._local.session = session
        response = session.post(url, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()

    def _listing(self, category_id, page):
        return self._post("{0}/listingPage/{1}".format(Maxi.__API, category_id), self._body(page))

    def _flyer_page(self, page):
        return self._post(
            "{0}/flyersPage".format(Maxi.__API),
            self._body(page, {"icta": ["flyer-homepage-hero-banner-guest"]}),
        )

    def _grid(self, data):
        sections = ((data.get("layout") or {}).get("sections") or {})
        listing = sections.get("productListingSection") or {}
        components = listing.get("components") or []
        if not components:
            return None
        return ((components[0].get("data") or {}).get("productGrid"))

    def _navigation(self, data):
        sections = ((data.get("layout") or {}).get("sections") or {})
        for section in sections.values():
            for component in section.get("components") or []:
                payload = component.get("data") or {}
                navigation = payload.get("navigation")
                nested = payload.get("categoryNavigation") or {}
                if not navigation and isinstance(nested, dict):
                    navigation = nested.get("navigation")
                if navigation:
                    return navigation
        return None

    def _collect_leaves(self, node, leaves):
        children = [child for child in (node.get("childNodes") or []) if child.get("displayName") != "Voir tout"]
        if not children:
            match = re.search(r"/c/(\d+)", node.get("url") or "")
            if match:
                leaves.add(match.group(1))
            return
        for child in children:
            self._collect_leaves(child, leaves)

    def _category_ids(self):
        root = self._listing(Maxi.__ROOT_CATEGORY, 1)
        navigation = self._navigation(root) or {}
        departments = [child for child in (navigation.get("childNodes") or []) if child.get("displayName") != "Voir tout"]
        leaves = set()
        if not departments:
            leaves.add(Maxi.__ROOT_CATEGORY)
            return leaves
        for department in departments:
            match = re.search(r"/c/(\d+)", department.get("url") or "")
            if not match:
                continue
            page = self._listing(match.group(1), 1)
            nav = self._navigation(page)
            if nav and nav.get("childNodes"):
                for child in nav["childNodes"]:
                    if child.get("displayName") == "Voir tout":
                        continue
                    self._collect_leaves(child, leaves)
            else:
                leaves.add(match.group(1))
        return leaves or {Maxi.__ROOT_CATEGORY}

    def _format_text(self, data):
        if not data:
            return ""
        return str(data).replace("\xa0", " ")

    def _price(self, value):
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return round(float(value), 2)
        return Maxi._format_price(str(value))

    def _format_product(self, product):
        pricing = product.get("pricing") or {}
        current = self._price(pricing.get("price"))
        was = self._price(pricing.get("wasPrice"))
        regular = was if was else current
        sale = current if current is not None else regular
        images = product.get("productImage") or []
        image = ""
        if images:
            image = images[0].get("imageUrl") or ""
            if image.startswith("/"):
                image = "https://www.maxi.ca" + image
        link = product.get("link") or ""
        if link.startswith("/"):
            link = "https://www.maxi.ca" + link
        return {
            "product_id": product.get("productId") or "",
            "brand": product.get("brand") or "",
            "size": self._format_text(product.get("packageSizing")),
            "name": product.get("title") or "",
            "product_url": link,
            "image_url": image,
            "regular_price": regular,
            "sale_price": sale,
            "store": Maxi.__STORE,
        }

    def _category_products(self, category_id):
        products = []
        page = 1
        while page <= 250:
            grid = self._grid(self._listing(category_id, page))
            if not grid:
                break
            tiles = grid.get("productTiles") or []
            products.extend(self._format_product(tile) for tile in tiles)
            if not (grid.get("pagination") or {}).get("hasMore"):
                break
            page += 1
        return products

    def _flyer_products(self):
        products = []
        page = 1
        while page <= 250:
            grid = self._grid(self._flyer_page(page))
            if not grid:
                break
            tiles = grid.get("productTiles") or []
            products.extend(self._format_product(tile) for tile in tiles)
            if not (grid.get("pagination") or {}).get("hasMore"):
                break
            page += 1
        return products

    def _merge(self, catalog, specials):
        by_id = {}
        for product in catalog:
            if product["product_id"]:
                by_id[product["product_id"]] = product
        for product in specials:
            current = by_id.get(product["product_id"])
            if current is None:
                by_id[product["product_id"]] = product
                continue
            if product["sale_price"] is not None:
                current["sale_price"] = product["sale_price"]
            if product["regular_price"] is not None:
                current["regular_price"] = product["regular_price"]
        return list(by_id.values())

    def _products(self, specials_only):
        specials = self._flyer_products()
        if specials_only:
            return [item for item in specials if item["regular_price"] != item["sale_price"]]
        categories = self._category_ids()
        catalog = []
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(self._category_products, category_id) for category_id in categories]
            for future in as_completed(futures):
                try:
                    catalog.extend(future.result())
                except Exception as error:
                    print("categorie ignoree", error)
        return self._merge(catalog, specials)

    def flyer():
        return Maxi()._products(True)

    def all():
        return Maxi()._products(False)
