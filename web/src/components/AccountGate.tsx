import { useEffect, useState, type FormEvent } from "react";
import type { AccountDraft } from "../lib/account";
import { cloudEnabled } from "../lib/cloud";
import type { Product, SaqProduct } from "../types";
import { PreviewExamples } from "./PreviewExamples";

type Props = {
  spotlight: Product | null;
  basket: Product[];
  wine: SaqProduct | null;
  notice?: string | null;
  onCreate: (draft: AccountDraft) => Promise<string | null> | string | null;
  onLogin: (email: string, password: string) => Promise<string | null> | string | null;
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
    title: "Une bouteille, même au restaurant",
    text: "Le relevé montre le stock à Laflèche et à Lasalle. Avec le compte, le scan lit la bouteille chez un ami ou au restaurant, et vous la retenez pour l’acheter plus tard.",
  },
  {
    title: "La semaine qui prépare la liste",
    text: "Vous indiquez les convives, les soupers et le budget. Comparo compose les recettes, puis envoie chaque ingrédient au magasin le moins cher.",
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

export function AccountGate({ spotlight, basket, wine, notice, onCreate, onLogin }: Props) {
  const [mode, setMode] = useState<"creer" | "entrer">("creer");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState(() => !seenGuide());
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState(false);

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
    const message = mode === "creer"
      ? await onCreate({ lastName, firstName, email, password, confirm })
      : await onLogin(email, password);
    setError(message);
    if (message) setPassword("");
  }

  function choose(next: "creer" | "entrer") {
    setMode(next);
    setError(null);
  }

  function openAccount(next: "creer" | "entrer") {
    choose(next);
    setSheet(true);
    window.setTimeout(() => document.getElementById(next === "creer" ? "prenom" : "courriel")?.focus(), 40);
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
            <button type="button" onClick={() => choose("entrer")} className={`hidden rounded-full px-3 py-1.5 text-sm lg:inline ${mode === "entrer" ? "bg-pine font-semibold text-pine-ink" : "border border-line bg-card"}`}>
              Connexion
            </button>
            <button type="button" onClick={() => choose("creer")} className={`hidden rounded-full px-3 py-1.5 text-sm lg:inline ${mode === "creer" ? "bg-pine font-semibold text-pine-ink" : "border border-line bg-card"}`}>
              Inscription
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-3 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 lg:pb-8 lg:pt-6">
        <section className="min-w-0">
          <h1 className="sr-only">Comparo, les prix à Baie-Comeau</h1>
          <PreviewExamples spotlight={spotlight} basket={basket} wine={wine} />
        </section>

        <div
          className={sheet ? "fixed inset-0 z-30 flex items-end bg-ink/40 lg:static lg:inset-auto lg:z-auto lg:block lg:bg-transparent" : "hidden lg:block"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSheet(false);
          }}
        >
          <form id="compte" onSubmit={submit} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card p-4 shadow-[var(--shadow)] lg:sticky lg:top-4 lg:max-h-none lg:overflow-visible lg:rounded-3xl lg:p-5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between lg:hidden">
              <p className="text-sm font-medium">{mode === "creer" ? "Inscription" : "Connexion"}</p>
              <button type="button" onClick={() => setSheet(false)} className="rounded-full px-3 py-1.5 text-sm text-muted">
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1">
              <button type="button" onClick={() => choose("creer")} className={`rounded-full px-3 py-1.5 text-sm ${mode === "creer" ? "bg-card font-semibold shadow-[var(--shadow)]" : "text-muted"}`}>
                Inscription
              </button>
              <button type="button" onClick={() => choose("entrer")} className={`rounded-full px-3 py-1.5 text-sm ${mode === "entrer" ? "bg-card font-semibold shadow-[var(--shadow)]" : "text-muted"}`}>
                Connexion
              </button>
            </div>
            <h2 className="mt-3 font-serif text-2xl tracking-tight">{mode === "creer" ? "Créer un compte" : "Bon retour"}</h2>
            <p className="mt-1 text-sm leading-snug text-muted">
              {mode === "creer"
                ? cloudEnabled
                  ? "Le compte est gardé en ligne. Le même courriel retrouve vos listes sur un autre appareil."
                  : "Ces informations restent sur cet appareil. La connexion retrouve ensuite vos listes."
                : cloudEnabled
                  ? "Courriel et mot de passe du compte Comparo."
                  : "Courriel et mot de passe. Un ancien compte peut encore entrer avec son prénom."}
            </p>

            {mode === "creer" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-sm" htmlFor="nom">
                  Nom
                  <input id="nom" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" />
                </label>
                <label className="block text-sm" htmlFor="prenom">
                  Prénom
                  <input id="prenom" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" />
                </label>
              </div>
            )}

            <label className="mt-3 block text-sm" htmlFor="courriel">
              {mode === "creer" ? "Adresse courriel" : "Courriel ou prénom"}
              <input
                id="courriel"
                required
                type={mode === "creer" ? "email" : "text"}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
              />
            </label>

            <label className="mt-3 block text-sm" htmlFor="motdepasse">
              Mot de passe
              <input
                id="motdepasse"
                required
                type="password"
                autoComplete={mode === "creer" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
              />
            </label>

            {mode === "creer" && (
              <label className="mt-3 block text-sm" htmlFor="confirmer">
                Confirmer le mot de passe
                <input
                  id="confirmer"
                  required
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
                />
              </label>
            )}

            {notice && <p className="mt-3 rounded-xl border border-iga/30 bg-iga/10 px-3 py-2 text-sm">{notice}</p>}
            {error && <p className="mt-3 rounded-xl border border-iga/30 bg-iga/10 px-3 py-2 text-sm">{error}</p>}

            <button type="submit" className="mt-4 w-full rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
              {mode === "creer" ? "Créer le compte" : "Se connecter"}
            </button>
          </form>
        </div>
      </main>

      <div className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden ${sheet ? "hidden" : ""}`}>
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button type="button" onClick={() => openAccount("entrer")} className="rounded-full border border-line bg-card px-4 py-3 text-sm font-medium">
            Connexion
          </button>
          <button type="button" onClick={() => openAccount("creer")} className="rounded-full bg-pine px-4 py-3 text-sm font-semibold text-pine-ink">
            Inscription
          </button>
        </div>
      </div>

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
                    openAccount("creer");
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
