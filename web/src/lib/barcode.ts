import type { Product } from "../types";

export function barcodeKeys(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 14) return [];
  if (digits.length < 8) return [digits];
  const keys = new Set<string>([digits]);
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed.length >= 8 && trimmed.length <= 14) keys.add(trimmed);
  if (digits.length >= 12) {
    for (const body of [digits, trimmed]) {
      if (body.length < 8 || body.length > 14) continue;
      for (const size of [12, 13, 14]) {
        if (body.length <= size) keys.add(body.padStart(size, "0"));
      }
    }
  }
  return [...keys];
}

export function buildBarcodeIndex(products: Product[]) {
  const index = new Map<string, Product>();
  const ordered = [...products].sort((left, right) => Number(left.exclusive) - Number(right.exclusive));
  for (const product of ordered) {
    for (const code of product.barcodes ?? []) {
      for (const key of barcodeKeys(code)) {
        if (!index.has(key)) index.set(key, product);
      }
    }
  }
  return index;
}

export function findByBarcode(index: Map<string, Product>, raw: string) {
  for (const key of barcodeKeys(raw)) {
    const product = index.get(key);
    if (product) return product;
  }
  return null;
}
