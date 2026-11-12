import { sameName } from "./account";

const SEEN_KEY = "comparo-visite-v1";
const PENDING_KEY = "comparo-visite-attente";

function readNames() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function hasSeenVisit(name: string) {
  return readNames().some((item) => sameName(item, name));
}

export function queueVisit(name: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, name);
  } catch {
    /* la visite pourra se rouvrir à la prochaine inscription */
  }
}

export function visitPending(name: string) {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY);
    return Boolean(pending && sameName(pending, name) && !hasSeenVisit(name));
  } catch {
    return false;
  }
}

export function finishVisit(name: string) {
  try {
    sessionStorage.removeItem(PENDING_KEY);
    const names = readNames();
    if (!names.some((item) => sameName(item, name))) names.push(name);
    localStorage.setItem(SEEN_KEY, JSON.stringify(names));
  } catch {
    /* sans stockage, la visite pourra se réafficher */
  }
}

export function forgetVisit(name: string) {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending && sameName(pending, name)) sessionStorage.removeItem(PENDING_KEY);
    const names = readNames().filter((item) => !sameName(item, name));
    localStorage.setItem(SEEN_KEY, JSON.stringify(names));
  } catch {
    /* rien à retirer */
  }
}
