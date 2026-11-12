import { useEffect, useRef, useState } from "react";
import {
  accountKey,
  changePassword,
  checkPassword,
  cleanPerson,
  createAccount,
  emailLooksValid,
  findAccount,
  normalizeEmail,
  normalizeHabits,
  parsePortable,
  readBook,
  readLastName,
  readSession,
  sameName,
  upsertAccount,
  writeBook,
  writeSession,
  type AccountDraft,
  type StoredAccount,
} from "./account";
import { emptyArchive, rememberList, rememberSaving, rememberScan, type ArchivedLine } from "./archive";
import { authMessage, cloudEnabled, flushCloud, loadCloudAccount, scheduleProfileSave, supabase } from "./cloud";
import type { User } from "@supabase/supabase-js";
import type { Habits, Notebook } from "./meals";
import { rememberBuy, setUsualStore, toggleLike, togglePass, type MarkKind, type UsualStore } from "./memory";
import { writeList } from "./useList";
import { forgetVisit, queueVisit } from "./visit";

export function useAccount() {
  const local = useLocalAccount();
  const cloud = useCloudAccount();
  return cloudEnabled ? cloud : local;
}

function useLocalAccount() {
  const [accounts, setAccounts] = useState<StoredAccount[]>(readBook);
  const [openName, setOpenName] = useState(() => readSession() ?? "");
  const [open, setOpen] = useState(() => Boolean(readSession()));
  const account = accounts.find((item) => accountKey(item) === openName || sameName(item.name, openName)) ?? null;

  function enter(next: StoredAccount, book = accounts) {
    const saved = upsertAccount(book, next);
    writeBook(saved);
    writeSession(accountKey(next));
    setAccounts(saved);
    setOpenName(accountKey(next));
    setOpen(true);
  }

  function update(change: (current: StoredAccount) => StoredAccount) {
    setAccounts((currentBook) => {
      const current = currentBook.find((item) => accountKey(item) === openName || sameName(item.name, openName));
      if (!current) return currentBook;
      const next = change(current);
      if (next === current) return currentBook;
      const saved = upsertAccount(currentBook, next);
      writeBook(saved);
      writeSession(accountKey(next));
      return saved;
    });
  }

  async function register(draft: AccountDraft) {
    const email = normalizeEmail(draft.email);
    if (accounts.some((item) => item.email === email)) return "Un compte existe déjà avec ce courriel. Connectez-vous.";
    const result = await createAccount(draft);
    if (!result.ok) return result.error;
    queueVisit(accountKey(result.account));
    enter(result.account);
    return null;
  }

  async function login(identifier: string, password: string) {
    const found = findAccount(accounts, identifier);
    if (!found) return identifier.includes("@") ? "Aucun compte avec ce courriel sur cet appareil." : "Aucun compte à ce prénom sur cet appareil.";
    if (!(await checkPassword(found, password))) return "Mot de passe incorrect.";
    writeSession(accountKey(found));
    setOpenName(accountKey(found));
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

  function noteList(lines: ArchivedLine[], total: number, saved: number) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberList(previous, lines, total, saved, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
  }

  function noteScan(id: string, name: string) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberScan(previous, id, name, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
  }

  function noteSaving(amount: number) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberSaving(previous, amount, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
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
    const saved = accounts.filter((item) => accountKey(item) !== accountKey(account));
    forgetVisit(accountKey(account));
    writeBook(saved);
    writeList(accountKey(account), []);
    writeSession(null);
    setAccounts(saved);
    setOpen(false);
    return null;
  }

  async function restore(raw: string, password: string) {
    const parsed = parsePortable(raw);
    if (!parsed.ok) return parsed.error;
    if (!(await checkPassword(parsed.portable.account, password))) return "Mot de passe incorrect pour ce fichier.";
    writeList(accountKey(parsed.portable.account), parsed.portable.list);
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
    noteList,
    noteScan,
    noteSaving,
    replacePassword,
    removeAccount,
    restore,
    booting: false,
    notice: null,
  };
}

function useCloudAccount() {
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [booting, setBooting] = useState(cloudEnabled);
  const [notice, setNotice] = useState<string | null>(null);
  const accountRef = useRef<StoredAccount | null>(null);
  const ticketRef = useRef(0);

  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    const client = supabase;
    async function openSession(user: User | null) {
      const ticket = ++ticketRef.current;
      if (!user) {
        accountRef.current = null;
        setAccount(null);
        setBooting(false);
        return;
      }
      if (accountRef.current?.id === user.id) {
        setBooting(false);
        return;
      }
      try {
        const loaded = await loadCloudAccount(user);
        if (ticket !== ticketRef.current) return;
        writeList(loaded.account.id ?? user.id, loaded.list);
        accountRef.current = loaded.account;
        setAccount(loaded.account);
        setNotice(null);
      } catch (error) {
        if (ticket !== ticketRef.current) return;
        const detail = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
        setNotice(detail.includes("schema cache") ? "Les tables du compte ne sont pas encore créées dans Supabase." : "Le compte est reconnu, mais ses données n’ont pas pu être lues.");
        await client.auth.signOut();
      } finally {
        if (ticket === ticketRef.current) setBooting(false);
      }
    }
    function onHide() {
      void flushCloud();
    }
    window.addEventListener("pagehide", onHide);
    void client.auth.getSession().then(({ data: sessionData }) => {
      void openSession(sessionData.session?.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        accountRef.current = null;
        setAccount(null);
        setBooting(false);
        return;
      }
      void openSession(session?.user ?? null);
    });
    return () => {
      window.removeEventListener("pagehide", onHide);
      data.subscription.unsubscribe();
    };
  }, []);

  function update(change: (current: StoredAccount) => StoredAccount) {
    setAccount((current) => {
      if (!current) return current;
      const next = change(current);
      if (next === current) return current;
      accountRef.current = next;
      scheduleProfileSave(next);
      return next;
    });
  }

  async function register(draft: AccountDraft) {
    if (!supabase) return "Le serveur de comptes n’est pas configuré.";
    const firstName = cleanPerson(draft.firstName);
    const lastName = cleanPerson(draft.lastName);
    const email = normalizeEmail(draft.email);
    if (lastName.length < 2) return "Indiquez un nom d’au moins 2 lettres.";
    if (firstName.length < 2) return "Indiquez un prénom d’au moins 2 lettres.";
    if (!emailLooksValid(email)) return "Indiquez une adresse courriel valide.";
    if (draft.password.length < 6) return "Le mot de passe doit avoir au moins 6 caractères.";
    if (draft.password !== draft.confirm) return "Les deux mots de passe ne correspondent pas.";
    const { data, error } = await supabase.auth.signUp({
      email,
      password: draft.password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    if (error) return authMessage(error.message);
    if (data.user && (data.user.identities?.length ?? 0) === 0) return "Un compte existe déjà avec ce courriel. Connectez-vous.";
    if (data.user) queueVisit(data.user.id);
    if (!data.session) return "Un courriel de confirmation est parti. Ouvrez-le, puis revenez vous connecter.";
    return null;
  }

  async function login(identifier: string, password: string) {
    if (!supabase) return "Le serveur de comptes n’est pas configuré.";
    const email = normalizeEmail(identifier);
    if (!emailLooksValid(email)) return "Indiquez le courriel du compte.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return authMessage(error.message);
    return null;
  }

  async function logout() {
    await flushCloud();
    await supabase?.auth.signOut();
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

  function noteList(lines: ArchivedLine[], total: number, saved: number) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberList(previous, lines, total, saved, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
  }

  function noteScan(id: string, name: string) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberScan(previous, id, name, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
  }

  function noteSaving(amount: number) {
    update((current) => {
      const previous = current.archive ?? emptyArchive();
      const archive = rememberSaving(previous, amount, new Date().toISOString());
      if (archive === previous) return current;
      return { ...current, archive };
    });
  }

  async function replacePassword(current: string, next: string, confirm: string) {
    if (!supabase || !account?.email) return "Ouvrez d’abord le compte.";
    if (next.length < 6) return "Le nouveau mot de passe doit avoir au moins 6 caractères.";
    if (next !== confirm) return "Les deux mots de passe ne correspondent pas.";
    const check = await supabase.auth.signInWithPassword({ email: account.email, password: current });
    if (check.error) return "Mot de passe actuel incorrect.";
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return authMessage(error.message);
    return null;
  }

  async function removeAccount(password: string) {
    if (!supabase || !account?.email || !account.id) return "Ouvrez d’abord le compte.";
    const check = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (check.error) return "Mot de passe incorrect.";
    const { error } = await supabase.rpc("delete_account");
    if (error) return "Le compte n’a pas pu être effacé.";
    forgetVisit(account.id);
    writeList(account.id, []);
    accountRef.current = null;
    await supabase.auth.signOut();
    return null;
  }

  async function restore(raw: string, password: string) {
    if (!supabase || !account?.email || !account.id) return "Ouvrez d’abord le compte.";
    const parsed = parsePortable(raw);
    if (!parsed.ok) return parsed.error;
    const check = await supabase.auth.signInWithPassword({ email: account.email, password });
    if (check.error) return "Mot de passe incorrect.";
    const next: StoredAccount = {
      ...account,
      habits: parsed.portable.account.habits,
      notebook: parsed.portable.account.notebook,
      memory: parsed.portable.account.memory,
      archive: parsed.portable.account.archive,
    };
    accountRef.current = next;
    setAccount(next);
    scheduleProfileSave(next);
    writeList(account.id, parsed.portable.list);
    await flushCloud();
    return null;
  }

  return {
    account,
    names: account ? [account.name] : [],
    lastName: "",
    ready: Boolean(account),
    booting,
    notice,
    register,
    login,
    logout,
    saveHabits,
    saveNotebook,
    saveStore,
    like,
    pass,
    remember,
    noteList,
    noteScan,
    noteSaving,
    replacePassword,
    removeAccount,
    restore,
  };
}
