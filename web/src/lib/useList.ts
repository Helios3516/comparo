import { useEffect, useRef, useState } from "react";
import { scheduleListSave } from "./cloud";
import type { ListEntry } from "../types";

const LEGACY_KEY = "comparo-liste-v1";

export function listKey(owner: string) {
  return `comparo-liste-v1:${encodeURIComponent(owner)}`;
}

function parse(raw: string | null): ListEntry[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const id = (entry as { id?: unknown }).id;
      const qty = (entry as { qty?: unknown }).qty;
      if (typeof id !== "string" || typeof qty !== "number" || qty <= 0) return [];
      return [{ id, qty: Math.min(99, Math.round(qty)) }];
    });
  } catch {
    return [];
  }
}

export function writeList(owner: string, items: ListEntry[]) {
  if (!owner) return;
  try {
    localStorage.setItem(listKey(owner), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("comparo-liste", { detail: owner }));
  } catch {
    /* la liste reste dans l’état déjà affiché */
  }
}

export function readList(owner: string): ListEntry[] {
  if (!owner) return [];
  try {
    const key = listKey(owner);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }
    return parse(raw);
  } catch {
    return [];
  }
}

export function useList(owner: string) {
  const [items, setItems] = useState<ListEntry[]>(() => readList(owner));
  const ownerRef = useRef(owner);

  useEffect(() => {
    function onRestore(event: Event) {
      const ownerName = (event as CustomEvent<string>).detail;
      if (ownerName === owner) setItems(readList(owner));
    }
    window.addEventListener("comparo-liste", onRestore);
    return () => window.removeEventListener("comparo-liste", onRestore);
  }, [owner]);

  useEffect(() => {
    if (ownerRef.current !== owner) {
      ownerRef.current = owner;
      setItems(readList(owner));
      return;
    }
    if (!owner) return;
    localStorage.setItem(listKey(owner), JSON.stringify(items));
    scheduleListSave(owner, items);
  }, [items, owner]);

  const count = items.length;

  function qtyOf(id: string) {
    return items.find((item) => item.id === id)?.qty ?? 0;
  }

  function add(id: string) {
    setItems((current) => {
      const found = current.find((item) => item.id === id);
      if (!found) return [...current, { id, qty: 1 }];
      return current.map((item) => (item.id === id ? { ...item, qty: Math.min(99, item.qty + 1) } : item));
    });
  }

  function setQty(id: string, qty: number) {
    setItems((current) => {
      if (qty <= 0) return current.filter((item) => item.id !== id);
      return current.map((item) => (item.id === id ? { ...item, qty: Math.min(99, Math.round(qty)) } : item));
    });
  }

  function remove(id: string) {
    setQty(id, 0);
  }

  function clear() {
    setItems([]);
  }

  function replace(entries: ListEntry[]) {
    setItems(entries.flatMap((entry) => (entry.id && entry.qty > 0 ? [{ id: entry.id, qty: Math.min(99, Math.round(entry.qty)) }] : [])));
  }

  function addMany(entries: ListEntry[]) {
    setItems((current) => {
      const qty = new Map(current.map((entry) => [entry.id, entry.qty]));
      for (const entry of entries) {
        if (!entry.id || entry.qty <= 0) continue;
        qty.set(entry.id, Math.min(99, (qty.get(entry.id) ?? 0) + Math.round(entry.qty)));
      }
      return [...qty].map(([id, next]) => ({ id, qty: next }));
    });
  }

  return { items, count, qtyOf, add, setQty, remove, clear, addMany, replace };
}
