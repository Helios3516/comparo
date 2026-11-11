import { useState } from "react";
import {
  changePassword,
  checkPassword,
  createAccount,
  normalizeHabits,
  parsePortable,
  readBook,
  readLastName,
  readSession,
  sameName,
  upsertAccount,
  writeBook,
  writeSession,
  type StoredAccount,
} from "./account";
import type { Habits, Notebook } from "./meals";
import { rememberBuy, setUsualStore, toggleLike, togglePass, type MarkKind, type UsualStore } from "./memory";
import { writeList } from "./useList";

export function useAccount() {
  const [accounts, setAccounts] = useState<StoredAccount[]>(readBook);
  const [openName, setOpenName] = useState(() => readSession() ?? "");
  const [open, setOpen] = useState(() => Boolean(readSession()));
  const account = accounts.find((item) => sameName(item.name, openName)) ?? null;

  function enter(next: StoredAccount, book = accounts) {
    const saved = upsertAccount(book, next);
    writeBook(saved);
    writeSession(next.name);
    setAccounts(saved);
    setOpenName(next.name);
    setOpen(true);
  }

  function update(change: (current: StoredAccount) => StoredAccount) {
    setAccounts((currentBook) => {
      const current = currentBook.find((item) => sameName(item.name, openName));
      if (!current) return currentBook;
      const next = change(current);
      const saved = upsertAccount(currentBook, next);
      writeBook(saved);
      writeSession(next.name);
      return saved;
    });
  }

  async function register(name: string, password: string, confirm: string) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (accounts.some((item) => sameName(item.name, clean))) return "Ce prénom a déjà un compte sur cet appareil. Entrez avec son mot de passe.";
    const result = await createAccount(name, password, confirm);
    if (!result.ok) return result.error;
    enter(result.account);
    return null;
  }

  async function login(name: string, password: string) {
    const found = accounts.find((item) => sameName(item.name, name));
    if (!found) return "Aucun compte à ce prénom sur cet appareil.";
    if (!(await checkPassword(found, password))) return "Mot de passe incorrect.";
    writeSession(found.name);
    setOpenName(found.name);
    setOpen(true);
    return null;
  }

  function logout() {
    writeSession(null);
    setOpen(false);
  }

  function saveHabits(habits: Habits) {
    const clean = normalizeHabits(habits);
    if (!clean) return;
    update((current) => ({ ...current, habits: clean }));
  }

  function saveNotebook(notebook: Notebook) {
    update((current) => ({ ...current, notebook }));
  }

  function saveStore(store: UsualStore) {
    update((current) => ({ ...current, memory: setUsualStore(current.memory, store) }));
  }

  function like(id: string, name: string, kind: MarkKind = "epicerie") {
    update((current) => ({ ...current, memory: toggleLike(current.memory, { id, name, kind }, new Date().toISOString()) }));
  }

  function pass(id: string, name: string, kind: MarkKind = "epicerie") {
    update((current) => ({ ...current, memory: togglePass(current.memory, { id, name, kind }, new Date().toISOString()) }));
  }

  function remember(id: string, name: string, kind: MarkKind = "epicerie") {
    update((current) => ({ ...current, memory: rememberBuy(current.memory, { id, name, kind }, new Date().toISOString()) }));
  }

  async function replacePassword(current: string, next: string, confirm: string) {
    if (!account) return "Ouvrez d’abord le compte.";
    const result = await changePassword(account, current, next, confirm);
    if (!result.ok) return result.error;
    enter(result.account);
    return null;
  }

  async function removeAccount(password: string) {
    if (!account) return "Ouvrez d’abord le compte.";
    if (!(await checkPassword(account, password))) return "Mot de passe incorrect.";
    const saved = accounts.filter((item) => !sameName(item.name, account.name));
    writeBook(saved);
    writeList(account.name, []);
    writeSession(null);
    setAccounts(saved);
    setOpen(false);
    return null;
  }

  async function restore(raw: string, password: string) {
    const parsed = parsePortable(raw);
    if (!parsed.ok) return parsed.error;
    if (!(await checkPassword(parsed.portable.account, password))) return "Mot de passe incorrect pour ce fichier.";
    writeList(parsed.portable.account.name, parsed.portable.list);
    enter(parsed.portable.account);
    return null;
  }

  return {
    account,
    names: accounts.map((item) => item.name),
    lastName: readLastName(),
    ready: Boolean(open && account),
    register,
    login,
    logout,
    saveHabits,
    saveNotebook,
    saveStore,
    like,
    pass,
    remember,
    replacePassword,
    removeAccount,
    restore,
  };
}
