export type StorePrice = {
  name: string;
  price: number;
  regular: number | null;
  card?: number | null;
  url: string;
  image: string | null;
  size: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  size: string;
  category: string;
  subcategory?: string;
  image: string | null;
  maxi: StorePrice | null;
  iga: StorePrice | null;
  cheaper: "maxi" | "iga" | "egal";
  gap: number;
  gapPct: number;
  dealPct: number;
  exclusive: boolean;
  barcodes?: string[];
  saq?: SaqProduct;
};

export type SaqProduct = {
  id: string;
  sku: string;
  name: string;
  producer: string;
  supplier: "SAQ";
  size: string;
  category: "Alcool";
  subcategory: string;
  country: string;
  region?: string;
  grape?: string;
  colour?: string;
  taste?: string;
  aromas?: string[];
  tasting?: string;
  pairings?: string[];
  abv?: string;
  sugar?: string;
  vintage?: string;
  story?: string;
  image: string | null;
  price: number;
  regular: number | null;
  url: string;
  barcodes: string[];
  lasalle: boolean;
  lafleche: boolean;
};

export type SaqCatalog = {
  generatedAt: string;
  city: string;
  supplier: "SAQ";
  stores: { id: string; name: string; address: string }[];
  categories: string[];
  subcategories: string[];
  products: SaqProduct[];
};

export type SaqStoreFilter = "either" | "both" | "lasalle" | "lafleche";

export type Catalog = {
  generatedAt: string;
  city: string;
  categories: string[];
  products: Product[];
};

export type ListEntry = {
  id: string;
  qty: number;
};

export type View = "accueil" | "catalogue" | "imbattables" | "liste" | "essence" | "saq" | "repas";

export type StoreFilter =
  | "comparables"
  | "maxi"
  | "iga"
  | "tie"
  | "exclusive-maxi"
  | "exclusive-iga";

export type SortKey = "rabais" | "alpha" | "prix" | "note";

export type StopLine = {
  id: string;
  name: string;
  brand: string;
  size: string;
  category: string;
  qty: number;
  unit: number;
  total: number;
  image: string | null;
  tie: boolean;
  card: number | null;
};

export type Summary = {
  maxiTotal: number;
  igaTotal: number;
  maxiMissing: number;
  igaMissing: number;
  optimized: number;
  saved: number;
  savedPct: number;
  baselineStore: "maxi" | "iga" | null;
  versusMaxi: number | null;
  versusIga: number | null;
  maxiLines: StopLine[];
  igaLines: StopLine[];
  saqTotal: number;
  saqLines: StopLine[];
  count: number;
};
