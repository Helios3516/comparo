import { useEffect, useMemo, useState } from "react";
import { money } from "../lib/format";
import {
  ALLERGENS,
  adjustEaters,
  buildWeek,
  eaters,
  fadedDeals,
  needsReview,
  parseRemark,
  rememberWeek,
  reviseWeek,
  withEaters,
  type Avoid,
  type Budget,
  type Diet,
  type DishVerdict,
  type Habits,
  type Notebook,
} from "../lib/meals";
import type { Product, SaqProduct } from "../types";

type Props = {
  habits: Habits | null;
  notebook: Notebook;
  products: Product[];
  wines: SaqProduct[];
  onSave: (habits: Habits) => void;
  onNotebook: (notebook: Notebook) => void;
  onAdd: (lines: { id: string; qty: number }[]) => void;
  onList: () => void;
};

const DIET_LABEL: Record<Diet, string> = {
  tout: "De tout",
  peu: "Peu de viande",
  poisson: "Poisson",
  vege: "Végétarien",
};

const DIETS: { id: Diet; label: string; text: string }[] = [
  { id: "tout", label: "De tout", text: "Viande, poisson et légumes" },
  { id: "peu", label: "Peu de viande", text: "Surtout poisson et légumes" },
  { id: "poisson", label: "Poisson", text: "Pas de viande" },
  { id: "vege", label: "Végétarien", text: "Œufs et légumes" },
];

const BUDGETS: { id: Budget; label: string }[] = [
  { id: "serre", label: "Serré" },
  { id: "habituel", label: "Habituel" },
  { id: "large", label: "Plus large" },
];

const AVOIDS: { id: Avoid; label: string }[] = [
  { id: "porc", label: "Porc" },
  { id: "boeuf", label: "Bœuf" },
  { id: "lactose", label: "Lactose" },
];

function emptyHabits(current: Habits | null): Habits {
  return withEaters(current ?? { people: 2, small: 2, big: 0, meals: 1, diet: "tout", budget: "habituel", avoids: [], allergens: [] });
}

function tableCopy(habits: Habits) {
  const table = eaters(habits);
  const parts = [
    table.small > 0 ? `${table.small} petit${table.small > 1 ? "s" : ""} mangeur${table.small > 1 ? "s" : ""}` : "",
    table.big > 0 ? `${table.big} gros mangeur${table.big > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function MealsView({ habits, notebook, products, onSave, onNotebook, onAdd, onList }: Props) {
  const [draft, setDraft] = useState<Habits>(() => emptyHabits(habits));
  const shown = emptyHabits(draft);
  const [editing, setEditing] = useState(habits == null);
  const [seed, setSeed] = useState(0);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [otherOpen, setOtherOpen] = useState(() => emptyHabits(habits).allergens.length > 0);
  const [remark, setRemark] = useState(notebook.weekNote);
  const [remarkError, setRemarkError] = useState("");
  const review = asking || needsReview(notebook);
  const never = notebook.opinions.filter((item) => item.verdict === "jamais").map((item) => item.dishId);
  const prefer = notebook.opinions.filter((item) => item.verdict === "refaire").map((item) => item.dishId);
  const recent = notebook.lastDishes.map((item) => item.dishId);

  useEffect(() => {
    setRemark(notebook.weekNote);
  }, [notebook.weekNote]);

  const plan = useMemo(() => {
    if (!habits) return null;
    const pantry = notebook.pantry.map((item) => item.id);
    const built = buildWeek(products, habits, { seed, recent, never, prefer, pantry });
    const parsed = parseRemark(notebook.weekNote);
    if (!parsed.active) return { ...built, changes: [] as string[] };
    const revised = reviseWeek(products, habits, built, parsed, pantry, { never });
    return { ...revised.plan, changes: revised.changes };
  }, [products, habits, seed, recent, never, prefer, notebook.pantry, notebook.weekNote]);
  const faded = useMemo(() => fadedDeals(notebook, products), [notebook, products]);

  function toggleAvoid(id: Avoid) {
    setDraft((current) => ({
      ...current,
      avoids: current.avoids.includes(id) ? current.avoids.filter((item) => item !== id) : [...current.avoids, id],
    }));
  }

  function save() {
    onSave(shown);
    if (notebook.weekNote) onNotebook({ ...notebook, weekNote: "" });
    setEditing(false);
    setSeed(0);
    setAdded(false);
    setRemark("");
    setRemarkError("");
  }

  function applyRemark() {
    const parsed = parseRemark(remark);
    if (!parsed.active) {
      setRemarkError("Citez un plat à changer, par exemple : pas de pâtes, trop de poulet, ou je veux plus de poisson vendredi.");
      return;
    }
    setRemarkError("");
    onNotebook({ ...notebook, weekNote: remark.trim() });
  }

  function judge(dishId: string, title: string, verdict: DishVerdict) {
    onNotebook({
      ...notebook,
      opinions: [...notebook.opinions.filter((item) => item.dishId !== dishId), { dishId, title, verdict }],
    });
  }

  function togglePantry(id: string, name: string) {
    const exists = notebook.pantry.some((item) => item.id === id);
    onNotebook({
      ...notebook,
      pantry: exists ? notebook.pantry.filter((item) => item.id !== id) : [...notebook.pantry, { id, name }],
    });
  }

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="text-sm text-pine">La maison · les repas · l’économie</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">La semaine, et où chaque ingrédient coûte moins cher.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Les soupers sont composés avec tout le catalogue Maxi et tout le catalogue IGA. Chaque plat a sa recette. Le carnet reste sur cet appareil.
        </p>
      </section>

      {review && notebook.lastDishes.length > 0 && (
        <section className="max-w-3xl space-y-4 rounded-3xl border border-line bg-card p-5 md:p-6">
          <div>
            <h2 className="font-serif text-2xl">La semaine dernière</h2>
            <p className="mt-1 text-sm text-muted">On ne ressert pas tout de suite ce qui vient de passer. Dites ce qu’il faut en garder.</p>
          </div>
          {notebook.lastDishes.map((dish) => {
            const verdict = notebook.opinions.find((item) => item.dishId === dish.dishId)?.verdict;
            return (
              <div key={dish.dishId} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="font-medium">{dish.title}</p>
                <div className="flex flex-wrap gap-2">
                  <Choice pressed={verdict === "refaire"} onClick={() => judge(dish.dishId, dish.title, "refaire")}>
                    On le refait
                  </Choice>
                  <Choice pressed={verdict === "plus-tard"} onClick={() => judge(dish.dishId, dish.title, "plus-tard")}>
                    Pas tout de suite
                  </Choice>
                  <Choice pressed={verdict === "jamais"} onClick={() => judge(dish.dishId, dish.title, "jamais")}>
                    Plus jamais
                  </Choice>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => { onNotebook({ ...notebook, reviewed: true }); setAsking(false); }} className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
            Préparer la suivante
          </button>
        </section>
      )}

      {editing || !habits ? (
        <form
          className="max-w-3xl space-y-6 rounded-3xl border border-line bg-card p-5 md:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div>
            <p className="text-sm font-medium">Qui est à table ?</p>
            <p className="mt-1 text-sm text-muted">Un gros mangeur compte environ une portion et demie. Huit personnes au maximum.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-3">
                <span className="text-sm">Petits mangeurs</span>
                <span className="flex items-center gap-3">
                  <button type="button" aria-label="Un petit mangeur de moins" onClick={() => setDraft((current) => adjustEaters(current, "small", -1))} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                    −
                  </button>
                  <span className="w-6 text-center font-serif text-3xl tabular-nums">{shown.small}</span>
                  <button type="button" aria-label="Un petit mangeur de plus" onClick={() => setDraft((current) => adjustEaters(current, "small", 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                    +
                  </button>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-3">
                <span className="text-sm">Gros mangeurs</span>
                <span className="flex items-center gap-3">
                  <button type="button" aria-label="Un gros mangeur de moins" onClick={() => setDraft((current) => adjustEaters(current, "big", -1))} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                    −
                  </button>
                  <span className="w-6 text-center font-serif text-3xl tabular-nums">{shown.big}</span>
                  <button type="button" aria-label="Un gros mangeur de plus" onClick={() => setDraft((current) => adjustEaters(current, "big", 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                    +
                  </button>
                </span>
              </div>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Quels repas faut-il couvrir ?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              <Choice pressed={draft.meals === 1} onClick={() => setDraft((current) => ({ ...current, meals: 1 }))}>
                Soupers seulement
              </Choice>
              <Choice pressed={draft.meals === 2} onClick={() => setDraft((current) => ({ ...current, meals: 2 }))}>
                Midi et souper
              </Choice>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Habitudes</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DIETS.map((diet) => (
                <button
                  key={diet.id}
                  type="button"
                  aria-pressed={draft.diet === diet.id}
                  onClick={() => setDraft((current) => ({ ...current, diet: diet.id }))}
                  className={`rounded-2xl border px-4 py-3 text-left ${draft.diet === diet.id ? "border-pine bg-moss" : "border-line bg-paper"}`}
                >
                  <span className="block text-sm font-medium">{diet.label}</span>
                  <span className="mt-1 block text-xs text-muted">{diet.text}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Budget vin</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {BUDGETS.map((budget) => (
                <Choice key={budget.id} pressed={draft.budget === budget.id} onClick={() => setDraft((current) => ({ ...current, budget: budget.id }))}>
                  {budget.label}
                </Choice>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">À éviter</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {AVOIDS.map((item) => (
                <Choice key={item.id} pressed={draft.avoids.includes(item.id)} onClick={() => toggleAvoid(item.id)}>
                  {item.label}
                </Choice>
              ))}
              <Choice
                pressed={otherOpen || shown.allergens.length > 0}
                onClick={() => {
                  if (otherOpen || shown.allergens.length > 0) {
                    setOtherOpen(false);
                    setDraft((current) => ({ ...current, allergens: [] }));
                  } else {
                    setOtherOpen(true);
                  }
                }}
              >
                Autre
              </Choice>
            </div>
            {(otherOpen || shown.allergens.length > 0) && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-line bg-paper p-2" role="group" aria-label="Allergènes">
                {ALLERGENS.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={shown.allergens.includes(item.id)}
                      onChange={() =>
                        setDraft((current) => {
                          const currentAllergens = current.allergens ?? [];
                          const allergens = currentAllergens.includes(item.id)
                            ? currentAllergens.filter((id) => id !== item.id)
                            : [...currentAllergens, item.id];
                          return { ...current, allergens };
                        })
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
              Créer ma semaine
            </button>
            {habits && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-2.5 text-sm text-muted">
                Annuler
              </button>
            )}
          </div>
        </form>
      ) : (
        plan && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Sept soupers</h2>
                <p className="mt-1 text-sm text-muted">
                  {DIET_LABEL[habits.diet]} · {tableCopy(habits)} · {habits.meals === 2 ? "midi et souper" : "soupers"} · panier environ {money(plan.total)}
                </p>
                <p className="mt-1 text-xs text-muted">Le repère et les calories décrivent une assiette maison. Ce n’est pas une analyse de laboratoire.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setDraft(withEaters(habits));
                    setOtherOpen((habits.allergens ?? []).length > 0);
                  }}
                  className="rounded-full border border-line bg-card px-4 py-2 text-sm"
                >
                  Modifier les réponses
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSeed((current) => current + 1);
                    setAdded(false);
                    setRecipeId(null);
                    setRemark("");
                    setRemarkError("");
                    if (notebook.weekNote) onNotebook({ ...notebook, weekNote: "" });
                  }}
                  className="rounded-full border border-line bg-card px-4 py-2 text-sm"
                >
                  Autre semaine
                </button>
                {notebook.lastDishes.length > 0 && !review && (
                  <button type="button" onClick={() => setAsking(true)} className="rounded-full border border-line bg-card px-4 py-2 text-sm">
                    Avis sur la semaine passée
                  </button>
                )}
              </div>
            </div>

            <form
              className="rounded-3xl border border-line bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                applyRemark();
              }}
            >
              <h3 className="font-serif text-2xl">Qu’en pensez-vous ?</h3>
              <p className="mt-1 text-sm text-muted">
                Écrivez ce qui ne va pas. La semaine change tout de suite. Par exemple : pas de pâtes, trop de poulet, je veux plus de poisson vendredi, sans gluten.
              </p>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                maxLength={400}
                rows={3}
                placeholder="Pas de pâtes, et plus de poisson vendredi."
                className="mt-3 w-full rounded-2xl border border-line bg-paper px-3 py-2 text-sm"
              />
              {remarkError && <p className="mt-2 text-sm text-muted">{remarkError}</p>}
              {plan.changes.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {plan.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              )}
              {notebook.weekNote && plan.changes.length === 0 && !remarkError && (
                <p className="mt-2 text-sm text-muted">La semaine respecte déjà cette remarque.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink">
                  Appliquer à cette semaine
                </button>
                {notebook.weekNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setRemark("");
                      setRemarkError("");
                      onNotebook({ ...notebook, weekNote: "" });
                    }}
                    className="rounded-full px-3 py-2.5 text-sm text-muted"
                  >
                    Annuler la remarque
                  </button>
                )}
              </div>
            </form>

            <div className="grid gap-3 lg:grid-cols-2">
              {plan.days.map((day) => (
                <article key={day.id} className="rounded-3xl border border-line bg-card p-4">
                  <div className="flex gap-3">
                    {day.image ? (
                      <img src={day.image} alt="" className="h-24 w-24 shrink-0 rounded-2xl bg-paper object-contain" />
                    ) : (
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-paper text-xs text-muted">Photo</div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-pine">{day.day}</p>
                      <h3 className="mt-1 font-serif text-2xl">{day.title}</h3>
                      <p className="mt-1 text-sm">
                        {Number.isFinite(day.kcal)
                          ? `Repère ${day.letter} · environ ${Math.round(day.kcal)} kcal${eaters(habits).big > 0 ? ` · ${Math.round(day.kcal * 1.35)} kcal pour un gros mangeur` : ""}`
                          : `Repère ${day.letter}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">{day.note}</p>
                  <ul className="mt-3 space-y-2">
                    {day.lines.map((line) => (
                      <li key={line.id} className="text-sm">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate">
                            {line.qty > 1 ? `${line.qty} × ` : ""}
                            {line.name}
                            {line.deal ? <span className="ml-2 text-xs text-pine">promo</span> : null}
                          </span>
                          <span className="shrink-0 tabular-nums">{money(line.price)}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-pine">{line.where}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    aria-expanded={recipeId === day.id}
                    onClick={() => setRecipeId((current) => (current === day.id ? null : day.id))}
                    className="mt-3 text-sm font-medium text-pine underline-offset-2 hover:underline"
                  >
                    {recipeId === day.id ? "Fermer la recette" : "Voir la recette"}
                  </button>
                  {recipeId === day.id && (
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                      {day.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-2 text-xs text-muted">La photo est celle du produit principal trouvé dans le catalogue Maxi ou IGA.</p>
                </article>
              ))}
            </div>

            {faded.length > 0 && (
              <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
                Le rabais a disparu depuis la semaine dernière : {faded.map((line) => line.name).join(", ")}. Le prix affiché est celui d’aujourd’hui, au magasin le moins cher.
              </p>
            )}

            {notebook.pantry.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {notebook.pantry.map((item) => (
                  <button key={item.id} type="button" onClick={() => togglePantry(item.id, item.name)} className="rounded-full border border-pine bg-moss px-3 py-1 text-sm">
                    {item.name} · encore à la maison
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onAdd(plan.basket.map((line) => ({ id: line.id, qty: line.qty })));
                  onNotebook(rememberWeek(notebook, plan));
                  setAdded(true);
                  setAsking(false);
                }}
                className="rounded-full bg-pine px-5 py-2.5 text-sm font-semibold text-pine-ink"
              >
                {added ? "Panier ajouté" : "Mettre les ingrédients dans ma liste"}
              </button>
              {added && (
                <button type="button" onClick={onList} className="text-sm font-medium text-pine underline-offset-2 hover:underline">
                  Voir ma liste
                </button>
              )}
            </div>
          </section>
        )
      )}

    </div>
  );
}

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`rounded-full border px-4 py-2 text-sm ${pressed ? "border-pine bg-moss" : "border-line bg-paper"}`}>
      {children}
    </button>
  );
}
