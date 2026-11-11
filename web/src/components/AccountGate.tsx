import { useEffect, useState, type FormEvent } from "react";
import type { Product, SaqProduct } from "../types";
import { PreviewExamples } from "./PreviewExamples";

type Props = {
  names: string[];
  lastName: string;
  spotlight: Product | null;
  basket: Product[];
  wine: SaqProduct | null;
  onCreate: (name: string, password: string, confirm: string) => Promise<string | null> | string | null;
  onLogin: (name: string, password: string) => Promise<string | null> | string | null;
};

const GUIDE_KEY = "comparo-guide-v1";

const STEPS = [
  {
    title: "Un gros écart, en vrai",
    text: "L’aperçu montre un article vendu au Maxi et à l’IGA, avec les deux prix. Le cadre vert est le moins cher. Le catalogue s’ouvre avec votre compte, sur cet appareil.",
  },
  {
    title: "Une liste, deux arrêts",
    text: "Une petite liste de courses est déjà séparée : une colonne pour le Maxi de Laflèche, une pour l’IGA de la rue de Bretagne.",
  },
  {
    title: "Un vin aux deux SAQ",
    text: "Une bouteille en stock à Laflèche et à Lasalle, avec sa photo. Les accords et le reste du rayon arrivent avec le compte.",
  },
  {
    title: "La carte des stations",
    text: "La carte est interactive. Le vert est le plein le moins cher à Baie-Comeau. Touchez une station pour la centrer.",
  },
];

function seenGuide() {
  try {
    return localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function markGuide() {
  try {
    localStorage.setItem(GUIDE_KEY, "1");
  } catch {
    /* le guide pourra se rouvrir */
  }
}

export function AccountGate({ names, lastName, spotlight, basket, wine, onCreate, onLogin }: Props) {
  const known = names.length > 0;
  const [mode, setMode] = useState<"creer" | "entrer">(known ? "entrer" : "creer");
  const [chosen, setChosen] = useState(() => (names.includes(lastName) ? lastName : names[0] ?? ""));
  const [person, setPerson] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState(() => !known && !seenGuide());
  const [step, setStep] = useState(0);

  function closeGuide() {
    markGuide();
    setGuide(false);
  }

  function openGuide() {
    setStep(0);
    setGuide(true);
  }

  useEffect(() => {
    if (!guide) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeGuide();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guide]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = mode === "creer" ? await onCreate(person, password, confirm) : await onLogin(chosen, password);
    setError(message);
    if (message) setPassword("");
  }

  const current = STEPS[step] ?? STEPS[0];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-paper/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-pine-ink">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M5 15c2-5 4.2-7.5 7-7.5S17 10 19 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="8.2" r="1.3" fill="currentColor" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-xl tracking-tight">Comparo</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted">Baie-Comeau</span>
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openGuide} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
              Guide
            </button>
            <a href="#compte" className="rounded-full bg-pine px-3 py-1.5 text-sm font-semibold text-pine-ink">
              {known && mode === "entrer" ? "Entrer" : "Créer un compte"}
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section>
            <p className="text-sm text-pine">Aperçu · quatre exemples réels</p>
            <h1 className="mt-2 max-w-xl font-serif text-4xl tracking-tight md:text-5xl">Voyez qui est moins cher avant de prendre la voiture.</h1>
            <p className="mt-4 max-w-xl text-muted">
              Un gros écart, une liste déjà séparée, un vin aux deux SAQ et la carte des stations. Le compte ouvre ensuite le catalogue, les repas, et se souvient de ce que vous aimez.
            </p>
            <div className="mt-8">
              <PreviewExamples spotlight={spotlight} basket={basket} wine={wine} />
            </div>
          </section>

          <form id="compte" onSubmit={submit} className="rounded-3xl border border-line bg-card p-6 shadow-[var(--shadow)] lg:sticky lg:top-6 md:p-8">
          <h2 className="font-serif text-3xl tracking-tight">{mode === "creer" ? "Créer un compte" : `Bonjour ${chosen}`}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {mode === "creer"
              ? "Chaque prénom a sa liste, ses repas et ses goûts. Le compte reste dans ce navigateur. Un fichier peut l’emporter sur un autre appareil."
              : "Entrez le mot de passe pour retrouver les prix, la liste, les repas et ce que vous aimez."}
          </p>

          {mode === "entrer" && names.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {names.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={item === chosen}
                  onClick={() => {
                    setChosen(item);
                    setError(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm ${item === chosen ? "border-pine bg-moss" : "border-line"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {mode === "creer" && (
            <label className="mt-6 block text-sm" htmlFor="prenom">
              Prénom
              <input
                id="prenom"
                required
                autoComplete="nickname"
                value={person}
                onChange={(event) => setPerson(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3"
              />
            </label>
          )}

          <label className="mt-4 block text-sm" htmlFor="motdepasse">
            Mot de passe
            <input
              id="motdepasse"
              required
              type="password"
              autoComplete={mode === "creer" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3"
            />
          </label>

          {mode === "creer" && (
            <label className="mt-4 block text-sm" htmlFor="confirmer">
              Confirmer le mot de passe
              <input
                id="confirmer"
                required
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-3"
              />
            </label>
          )}

          {error && <p className="mt-4 rounded-2xl border border-iga/30 bg-iga/10 px-3 py-2 text-sm">{error}</p>}

          <button type="submit" className="mt-6 w-full rounded-full bg-pine px-5 py-3 text-sm font-semibold text-pine-ink">
            {mode === "creer" ? "Créer le compte" : "Entrer"}
          </button>

          {known && mode === "entrer" && (
            <button
              type="button"
              onClick={() => {
                setMode("creer");
                setError(null);
              }}
              className="mt-3 w-full text-sm text-muted underline-offset-2 hover:underline"
            >
              Une autre personne
            </button>
          )}
          {mode === "creer" && known && (
            <button
              type="button"
              onClick={() => {
                setMode("entrer");
                setError(null);
              }}
              className="mt-3 w-full text-sm text-muted underline-offset-2 hover:underline"
            >
              J’ai déjà un compte ici
            </button>
          )}
        </form>
        </div>
      </main>

      {guide && current && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 px-4" role="presentation" onMouseDown={closeGuide}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-titre"
            className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-[var(--shadow)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-pine">
                Guide {step + 1} / {STEPS.length}
              </p>
              <button type="button" onClick={closeGuide} className="rounded-full px-2 py-1 text-sm text-muted">
                Passer
              </button>
            </div>
            <h2 id="guide-titre" className="mt-3 font-serif text-3xl tracking-tight">
              {current.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{current.text}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="rounded-full px-3 py-2 text-sm text-muted disabled:opacity-40">
                Retour
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep((value) => value + 1)} className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
                  Suivant
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeGuide();
                    document.getElementById("prenom")?.focus();
                  }}
                  className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink"
                >
                  Créer mon compte
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
