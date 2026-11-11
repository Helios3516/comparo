import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cleanPerson, normalizeEmail, normalizeHabits, type StoredAccount } from "./account";
import { emptyArchive, normalizeArchive } from "./archive";
import { emptyNotebook, normalizeNotebook } from "./meals";
import { emptyMemory, normalizeMemory } from "./memory";
import type { ListEntry } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url, anonKey) : null;

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  habits: unknown;
  notebook: unknown;
  memory: unknown;
  archive: unknown;
};

export function accountFromRow(row: ProfileRow): StoredAccount {
  const firstName = cleanPerson(row.first_name ?? "");
  const lastName = cleanPerson(row.last_name ?? "");
  const email = row.email ? normalizeEmail(row.email) : "";
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || email || "Compte";
  return {
    id: row.id,
    name,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(email ? { email } : {}),
    salt: "supabase",
    pass: "cloud",
    habits: normalizeHabits(row.habits),
    notebook: normalizeNotebook(row.notebook),
    memory: normalizeMemory(row.memory),
    archive: normalizeArchive(row.archive),
  };
}

function listEntries(value: unknown): ListEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const id = (entry as { id?: unknown }).id;
    const qty = (entry as { qty?: unknown }).qty;
    if (typeof id !== "string" || typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return [];
    return [{ id, qty: Math.min(99, Math.round(qty)) }];
  });
}

export function authMessage(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) return "Courriel ou mot de passe incorrect.";
  if (text.includes("email not confirmed")) return "Confirmez d’abord le courriel, puis reconnectez-vous.";
  if (text.includes("already registered") || text.includes("already been registered")) return "Un compte existe déjà avec ce courriel. Connectez-vous.";
  if (text.includes("password")) return "Le mot de passe doit avoir au moins 6 caractères.";
  if (text.includes("rate limit")) return "Trop d’essais. Réessayez dans une minute.";
  return "Le compte n’a pas répondu. Réessayez.";
}

export async function loadCloudAccount(user: User) {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const profile = await supabase.from("profiles").select("id, email, first_name, last_name, habits, notebook, memory, archive").eq("id", user.id).maybeSingle();
  if (profile.error) throw profile.error;
  let row = profile.data as ProfileRow | null;
  if (!row) {
    const meta = user.user_metadata ?? {};
    const inserted = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ?? "",
        first_name: typeof meta.first_name === "string" ? meta.first_name : "",
        last_name: typeof meta.last_name === "string" ? meta.last_name : "",
      })
      .select("id, email, first_name, last_name, habits, notebook, memory, archive")
      .single();
    if (inserted.error) throw inserted.error;
    row = inserted.data as ProfileRow;
  }
  const list = await supabase.from("lists").select("entries").eq("user_id", user.id).maybeSingle();
  if (list.error) throw list.error;
  return { account: accountFromRow(row), list: listEntries(list.data?.entries) };
}

function profilePayload(account: StoredAccount) {
  return {
    first_name: account.firstName ?? "",
    last_name: account.lastName ?? "",
    email: account.email ?? "",
    habits: account.habits,
    notebook: account.notebook ?? emptyNotebook(),
    memory: account.memory ?? emptyMemory(),
    archive: account.archive ?? emptyArchive(),
    updated_at: new Date().toISOString(),
  };
}

let profileTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProfile: StoredAccount | null = null;
let listTimer: ReturnType<typeof setTimeout> | null = null;
let pendingList: { owner: string; items: ListEntry[] } | null = null;

async function persistProfile(account: StoredAccount) {
  if (!supabase || !account.id) return;
  await supabase.from("profiles").update(profilePayload(account)).eq("id", account.id);
}

async function persistList(owner: string, items: ListEntry[]) {
  if (!supabase) return;
  await supabase.from("lists").upsert({ user_id: owner, entries: items, updated_at: new Date().toISOString() });
}

export function scheduleProfileSave(account: StoredAccount) {
  if (!cloudEnabled || !account.id) return;
  pendingProfile = account;
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    const next = pendingProfile;
    pendingProfile = null;
    profileTimer = null;
    if (next) void persistProfile(next);
  }, 500);
}

export function scheduleListSave(owner: string, items: ListEntry[]) {
  if (!cloudEnabled || !/^[0-9a-f-]{36}$/i.test(owner)) return;
  pendingList = { owner, items };
  if (listTimer) clearTimeout(listTimer);
  listTimer = setTimeout(() => {
    const next = pendingList;
    pendingList = null;
    listTimer = null;
    if (next) void persistList(next.owner, next.items);
  }, 400);
}

export async function flushCloud() {
  const profile = pendingProfile;
  const list = pendingList;
  pendingProfile = null;
  pendingList = null;
  if (profileTimer) clearTimeout(profileTimer);
  if (listTimer) clearTimeout(listTimer);
  profileTimer = null;
  listTimer = null;
  if (profile) await persistProfile(profile);
  if (list) await persistList(list.owner, list.items);
}
