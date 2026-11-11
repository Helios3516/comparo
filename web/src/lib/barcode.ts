import type { Product } from "../types";

export function barcodeKeys(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) return [];
  const keys = new Set<string>([digits]);
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed.length >= 8) keys.add(trimmed);
  if (digits.length === 12) keys.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith("0")) keys.add(digits.slice(1));
  if (digits.length === 14 && digits.startsWith("0")) keys.add(digits.slice(1));
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
