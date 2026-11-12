import type { ListEntry } from "../types";
import { emptyArchive, normalizeArchive, type Archive } from "./archive";
import { ALLERGENS, emptyNotebook, normalizeNotebook, type Allergen, type Avoid, type Budget, type Diet, type Habits, type Notebook } from "./meals";
import { emptyMemory, normalizeMemory, type Memory } from "./memory";

const LEGACY_KEY = "comparo-compte-v1";
const BOOK_KEY = "comparo-comptes-v1";
const SESSION_KEY = "comparo-session-v1";
const LAST_KEY = "comparo-dernier-v1";

export type StoredAccount = {
  id?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  salt: string;
  pass: string;
  algo?: "sha256";
  habits: Habits | null;
  notebook: Notebook;
  memory: Memory;
  archive?: Archive;
};

export type AccountDraft = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
};

export type PortableAccount = {
  version: 1;
  account: StoredAccount;
  list: ListEntry[];
};

const DIETS = new Set<Diet>(["tout", "peu", "poisson", "vege"]);
const BUDGETS = new Set<Budget>(["serre", "habituel", "large"]);
const AVOIDS = new Set<Avoid>(["porc", "boeuf", "lactose"]);
const ALLERGEN_IDS = new Set<Allergen>(ALLERGENS.map((item) => item.id));

export function sameName(left: string, right: string) {
  return left.localeCompare(right, "fr", { sensitivity: "accent" }) === 0;
}

export function cleanPerson(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function accountKey(account: Pick<StoredAccount, "name" | "email"> & { id?: string }) {
  if (account.id) return account.id;
  const email = account.email ? normalizeEmail(account.email) : "";
  return email || account.name;
}

export function firstNameOf(account: Pick<StoredAccount, "name" | "firstName">) {
  const first = account.firstName ? cleanPerson(account.firstName) : "";
  return first || account.name.split(" ")[0] || account.name;
}

export function fullNameOf(account: Pick<StoredAccount, "name" | "firstName" | "lastName">) {
  const first = account.firstName ? cleanPerson(account.firstName) : "";
  const last = account.lastName ? cleanPerson(account.lastName) : "";
  if (first && last) return `${first} ${last}`;
  return account.name;
}

export function hashPasswordFnv(password: string, salt: string) {
  let hash = 2166136261;
  const value = `${salt}:${password}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export async function hashPassword(password: string, salt: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return hashPasswordFnv(password, salt);
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function finiteInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function normalizeHabits(value: unknown): Habits | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Habits>;
  const people = finiteInt(raw.people) ?? 0;
  let small = finiteInt(raw.small);
  let big = finiteInt(raw.big);
  if (small == null && big == null) {
    if (people < 1 || people > 8) return null;
    small = people;
    big = 0;
  } else {
    small = Math.min(8, Math.max(0, small ?? 0));
    big = Math.min(8, Math.max(0, big ?? 0));
    if (small + big < 1 || small + big > 8) return null;
  }
  if (raw.meals !== 1 && raw.meals !== 2) return null;
  if (!DIETS.has(raw.diet as Diet)) return null;
  if (!BUDGETS.has(raw.budget as Budget)) return null;
  const avoids = Array.isArray(raw.avoids)
    ? [...new Set(raw.avoids.filter((item): item is Avoid => AVOIDS.has(item as Avoid)))]
    : [];
  const allergens = Array.isArray(raw.allergens)
    ? [...new Set(raw.allergens.filter((item): item is Allergen => ALLERGEN_IDS.has(item as Allergen)))]
    : [];
  return { people: small + big, small, big, meals: raw.meals, diet: raw.diet as Diet, budget: raw.budget as Budget, avoids, allergens };
}

export function normalizeAccount(value: unknown): StoredAccount | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<StoredAccount>;
  if (typeof parsed.name !== "string" || parsed.name.trim().length < 2) return null;
  if (typeof parsed.salt !== "string" || typeof parsed.pass !== "string" || !parsed.salt || !parsed.pass) return null;
  const firstName = typeof parsed.firstName === "string" ? cleanPerson(parsed.firstName) : "";
  const lastName = typeof parsed.lastName === "string" ? cleanPerson(parsed.lastName) : "";
  const email = typeof parsed.email === "string" && emailLooksValid(parsed.email) ? normalizeEmail(parsed.email) : "";
  const id = typeof parsed.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id) ? parsed.id : "";
  return {
    ...(id ? { id } : {}),
    name: cleanPerson(parsed.name),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(email ? { email } : {}),
    salt: parsed.salt,
    pass: parsed.pass,
    ...(parsed.algo === "sha256" ? { algo: "sha256" as const } : {}),
    habits: normalizeHabits(parsed.habits),
    notebook: normalizeNotebook(parsed.notebook),
    memory: normalizeMemory(parsed.memory),
    archive: normalizeArchive(parsed.archive),
  };
}

function readLegacy(): StoredAccount | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return normalizeAccount(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function readBook(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const accounts = Array.isArray(parsed) ? parsed.flatMap((item) => {
      const account = normalizeAccount(item);
      return account ? [account] : [];
    }) : [];
    const legacy = readLegacy();
    if (!legacy) return accounts;
    localStorage.removeItem(LEGACY_KEY);
    if (accounts.some((item) => sameName(item.name, legacy.name))) return accounts;
    const next = [...accounts, legacy];
    localStorage.setItem(BOOK_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function writeBook(accounts: StoredAccount[]) {
  localStorage.setItem(BOOK_KEY, JSON.stringify(accounts));
}

export function findAccount(accounts: StoredAccount[], identifier: string) {
  const typed = identifier.trim();
  const email = normalizeEmail(typed);
  return accounts.find((item) => item.email && item.email === email)
    ?? accounts.find((item) => !item.email && sameName(item.name, typed))
    ?? null;
}

export function upsertAccount(accounts: StoredAccount[], account: StoredAccount) {
  const key = accountKey(account);
  const index = accounts.findIndex((item) => accountKey(item) === key);
  if (index < 0) return [...accounts, account];
  return accounts.map((item, position) => (position === index ? account : item));
}

export function readSession() {
  try {
    const name = localStorage.getItem(SESSION_KEY);
    if (!name) return null;
    const account = readBook().find((item) => accountKey(item) === name || sameName(item.name, name));
    if (!account) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return accountKey(account);
  } catch {
    return null;
  }
}

export function writeSession(name: string | null) {
  if (!name) localStorage.removeItem(SESSION_KEY);
  else {
    localStorage.setItem(SESSION_KEY, name);
    localStorage.setItem(LAST_KEY, name);
  }
}

export function readLastName() {
  try {
    return localStorage.getItem(LAST_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function createAccount(
  draft: AccountDraft,
): Promise<{ ok: true; account: StoredAccount } | { ok: false; error: string }> {
  const firstName = cleanPerson(draft.firstName);
  const lastName = cleanPerson(draft.lastName);
  const email = normalizeEmail(draft.email);
  if (lastName.length < 2) return { ok: false, error: "Indiquez un nom d’au moins 2 lettres." };
  if (firstName.length < 2) return { ok: false, error: "Indiquez un prénom d’au moins 2 lettres." };
  if (!emailLooksValid(email)) return { ok: false, error: "Indiquez une adresse courriel valide." };
  if (draft.password.length < 4) return { ok: false, error: "Le mot de passe doit avoir au moins 4 caractères." };
  if (draft.password !== draft.confirm) return { ok: false, error: "Les deux mots de passe ne correspondent pas." };
  const salt = randomSalt();
  const pass = await hashPassword(draft.password, salt);
  return {
    ok: true,
    account: {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email,
      salt,
      pass,
      algo: pass.length === 64 ? "sha256" : undefined,
      habits: null,
      notebook: emptyNotebook(),
      memory: emptyMemory(),
      archive: emptyArchive(),
    },
  };
}

export async function checkPassword(account: StoredAccount, password: string) {
  if (account.algo === "sha256") return (await hashPassword(password, account.salt)) === account.pass;
  return hashPasswordFnv(password, account.salt) === account.pass;
}

export async function changePassword(account: StoredAccount, current: string, next: string, confirm: string) {
  if (!(await checkPassword(account, current))) return { ok: false as const, error: "Mot de passe actuel incorrect." };
  if (next.length < 4) return { ok: false as const, error: "Le nouveau mot de passe doit avoir au moins 4 caractères." };
  if (next !== confirm) return { ok: false as const, error: "Les deux mots de passe ne correspondent pas." };
  const salt = randomSalt();
  const pass = await hashPassword(next, salt);
  const updated: StoredAccount = { ...account, salt, pass, algo: pass.length === 64 ? "sha256" : undefined };
  return { ok: true as const, account: updated };
}

function parseList(value: unknown): ListEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const id = (entry as { id?: unknown }).id;
    const qty = (entry as { qty?: unknown }).qty;
    if (typeof id !== "string" || typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return [];
    return [{ id, qty: Math.min(99, Math.round(qty)) }];
  });
}

export function portableOf(account: StoredAccount, list: ListEntry[]): PortableAccount {
  return { version: 1, account, list };
}

export function parsePortable(raw: string): { ok: true; portable: PortableAccount } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as Partial<PortableAccount>;
    if (parsed.version !== 1) return { ok: false, error: "Ce fichier ne vient pas d’un compte Comparo." };
    const account = normalizeAccount(parsed.account);
    if (!account) return { ok: false, error: "Le compte dans ce fichier est illisible." };
    return { ok: true, portable: { version: 1, account, list: parseList(parsed.list) } };
  } catch {
    return { ok: false, error: "Ce fichier ne se lit pas." };
  }
}
