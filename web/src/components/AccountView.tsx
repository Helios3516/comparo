import { useState, type FormEvent } from "react";
import { portableOf, type StoredAccount } from "../lib/account";
import { readList } from "../lib/useList";
import type { Mark, UsualStore } from "../lib/memory";

type Props = {
  account: StoredAccount;
  onStore: (store: UsualStore) => void;
  onLike: (mark: Mark) => void;
  onPass: (mark: Mark) => void;
  onOpen: (mark: Mark) => void;
  onPassword: (current: string, next: string, confirm: string) => Promise<string | null>;
  onRestore: (raw: string, password: string) => Promise<string | null>;
  onDelete: (password: string) => Promise<string | null>;
  onLogout: () => void;
};

const STORES: { id: UsualStore; label: string }[] = [
  { id: "peu-importe", label: "Peu importe" },
  { id: "maxi", label: "Maxi Laflèche" },
  { id: "iga", label: "IGA Bretagne" },
];

function Marks({ title, empty, marks, onOpen, onRemove }: { title: string; empty: string; marks: Mark[]; onOpen: (mark: Mark) => void; onRemove: (mark: Mark) => void }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      {marks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {marks.map((mark) => (
            <li key={mark.id} className="flex items-center justify-between gap-3 py-2">
              <button type="button" onClick={() => onOpen(mark)} className="truncate text-left text-sm hover:underline">
                {mark.name}
              </button>
              <button type="button" onClick={() => onRemove(mark)} className="shrink-0 text-sm text-muted underline-offset-2 hover:underline">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AccountView({ account, onStore, onLike, onPass, onOpen, onPassword, onRestore, onDelete, onLogout }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [erase, setErase] = useState("");
  const [eraseError, setEraseError] = useState<string | null>(null);
  const repeats = account.memory.repeats.filter((item) => item.count >= 2);

  function download() {
    const payload = portableOf(account, readList(account.name));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comparo-${account.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const message = await onPassword(current, next, confirm);
    setPasswordError(message);
    setPasswordOk(!message);
    if (!message) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  async function submitRestore(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setRestoreError("Choisissez d’abord le fichier du compte.");
      return;
    }
    const raw = await file.text();
    const message = await onRestore(raw, restorePassword);
    setRestoreError(message);
    if (!message) setRestorePassword("");
  }

  async function submitErase(event: FormEvent) {
    event.preventDefault();
    const message = await onDelete(erase);
    setEraseError(message);
    if (message) setErase("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm text-pine">Compte sur cet appareil</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{account.name}</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Comparo retient votre liste, vos repas, le magasin où vous allez et ce que vous aimez. Un fichier emporte ce compte sur un autre appareil. Le mot de passe n’y est pas écrit en clair.
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Magasin habituel</h2>
        <p className="mt-2 text-sm text-muted">Les suggestions montrent d’abord les écarts de ce magasin. Les deux prix restent sur chaque article.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STORES.map((store) => {
            const active = account.memory.store === store.id;
            return (
              <button
                key={store.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStore(store.id)}
                className={`rounded-full border px-4 py-2 text-sm ${active ? "border-pine bg-moss" : "border-line bg-paper"}`}
              >
                {store.label}
              </button>
            );
          })}
        </div>
      </section>

      <Marks
        title="Ce que vous aimez"
        empty="Touchez le cœur sur un article. Comparo le garde avec ce compte."
        marks={account.memory.likes}
        onOpen={onOpen}
        onRemove={onLike}
      />
      <Marks
        title="À écarter"
        empty="La croix retire un article des suggestions et des repas."
        marks={account.memory.passes}
        onOpen={onOpen}
        onRemove={onPass}
      />

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Vous reprenez souvent</h2>
        {repeats.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Chaque article ajouté à la liste compte. Au bout de deux fois, il revient dans « Pour toi ».</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {repeats.map((mark) => (
              <li key={mark.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => onOpen(mark)} className="truncate text-left text-sm hover:underline">
                  {mark.name}
                </button>
                <span className="shrink-0 text-sm tabular-nums text-muted">{mark.count} fois</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={submitPassword} className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Mot de passe</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Actuel
            <input required type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3" />
          </label>
          <label className="text-sm">
            Nouveau
            <input required type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3" />
          </label>
          <label className="text-sm">
            Confirmer
            <input required type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3" />
          </label>
        </div>
        {passwordError && <p className="mt-3 text-sm text-iga">{passwordError}</p>}
        {passwordOk && <p className="mt-3 text-sm text-pine">Mot de passe mis à jour.</p>}
        <button type="submit" className="mt-4 rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
          Changer le mot de passe
        </button>
      </form>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Emporter le compte</h2>
        <p className="mt-2 text-sm text-muted">Le fichier contient la liste, les repas et les goûts. Sur l’autre appareil, restaurez-le avec le même mot de passe.</p>
        <button type="button" onClick={download} className="mt-4 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium">
          Télécharger le fichier
        </button>
        <form onSubmit={submitRestore} className="mt-5 border-t border-line pt-5">
          <label className="block text-sm">
            Restaurer un fichier
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <label className="mt-3 block text-sm">
            Mot de passe de ce compte
            <input required type="password" autoComplete="current-password" value={restorePassword} onChange={(event) => setRestorePassword(event.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3" />
          </label>
          {restoreError && <p className="mt-3 text-sm text-iga">{restoreError}</p>}
          <button type="submit" className="mt-4 rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
            Restaurer
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Cet appareil</h2>
        <button type="button" onClick={onLogout} className="mt-3 rounded-full border border-line px-5 py-2.5 text-sm">
          Sortir
        </button>
        <form onSubmit={submitErase} className="mt-5 border-t border-line pt-5">
          <p className="text-sm text-muted">Effacer retire {account.name}, sa liste et ses goûts de ce navigateur.</p>
          <label className="mt-3 block text-sm">
            Mot de passe pour confirmer
            <input required type="password" autoComplete="current-password" value={erase} onChange={(event) => setErase(event.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3" />
          </label>
          {eraseError && <p className="mt-3 text-sm text-iga">{eraseError}</p>}
          <button type="submit" className="mt-4 rounded-full border border-iga/40 px-5 py-2.5 text-sm text-iga">
            Effacer ce compte
          </button>
        </form>
      </section>
    </div>
  );
}
