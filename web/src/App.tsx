import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AccountGate } from "./components/AccountGate";
import { AccountView } from "./components/AccountView";
import { EssenceView } from "./components/EssenceView";
import { Filters } from "./components/Filters";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { ListView } from "./components/ListView";
import { MealsView } from "./components/MealsView";
import { ProductGrid } from "./components/ProductGrid";
import { Roadmap } from "./components/Roadmap";
import { SaqView } from "./components/SaqView";
import { Scanner } from "./components/Scanner";
import { categoryChips, selectProducts, subcategoryChips } from "./lib/browse";
import { longDate, money } from "./lib/format";
import { forYou, type Mark } from "./lib/memory";
import { summarize } from "./lib/pricing";
import { toProduct } from "./lib/saq";
import { buildSearchIndex } from "./lib/search";
import { useAccount } from "./lib/useAccount";
import { useBrowse } from "./lib/useBrowse";
import { useCatalog } from "./lib/useCatalog";
import { useList } from "./lib/useList";
import { usePreview } from "./lib/usePreview";
import { useReviews } from "./lib/useReviews";
import { useSaq } from "./lib/useSaq";
import { useTheme } from "./lib/useTheme";
import type { Product, SaqProduct, SaqStoreFilter, SortKey, StoreFilter, View } from "./types";

const PAGE_SIZE = 24;

export default function App() {
  const account = useAccount();
  const theme = useTheme();
  const { state, patch } = useBrowse();
  const { view, query, category, subcategory, store, sort, page, both } = state;
  const [roadmap, setRoadmap] = useState(false);
  const [scan, setScan] = useState(false);
  const [profile, setProfile] = useState(false);
  const needsCatalog = account.ready && view !== "saq" && (view !== "essence" || scan);
  const needsSaq = account.ready && (view === "saq" || view === "repas" || view === "liste");
  const { catalog, error } = useCatalog(needsCatalog);
  const saq = useSaq(needsSaq);
  const list = useList(account.account?.name ?? "");
  const reviews = useReviews(account.ready && Boolean(account.account));
  const preview = usePreview(!account.ready);

  const products = catalog?.products ?? [];
  const byId = useMemo(() => {
    const map = new Map(products.map((product) => [product.id, product]));
    for (const item of saq.catalog?.products ?? []) {
      const product = toProduct(item);
      map.set(product.id, product);
    }
    return map;
  }, [products, saq.catalog]);
  const summary = useMemo(() => summarize(list.items, byId), [list.items, byId]);
  const index = useMemo(() => buildSearchIndex(products), [products]);
  const saqIndex = useMemo(() => buildSearchIndex((saq.catalog?.products ?? []).map(toProduct)), [saq.catalog]);
  const deferredQuery = useDeferredValue(query);

  const comparables = useMemo(() => products.filter((product) => !product.exclusive), [products]);
  const deals = useMemo(() => comparables.filter((product) => product.dealPct >= 0.3).length, [comparables]);
  const averageGap = comparables.length ? comparables.reduce((sum, product) => sum + product.gap, 0) / comparables.length : 0;
  const pourToi = useMemo(() => (account.account ? forYou(products, account.account.memory) : []), [products, account.account]);
  const highlights = useMemo(
    () =>
      [...comparables]
        .filter((product) => product.dealPct >= 0.3)
        .sort((a, b) => b.dealPct - a.dealPct || b.gap - a.gap)
        .slice(0, 4),
    [comparables],
  );
  const updated = catalog ? longDate(catalog.generatedAt) : "";

  useEffect(() => {
    if (page === 0) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const searching = deferredQuery.trim().length >= 2;
  const visible = useMemo(
    () => selectProducts(products, index, { view, store, category, subcategory, query: deferredQuery, sort, both }),
    [products, index, view, store, category, subcategory, deferredQuery, sort, both],
  );

  const chips = useMemo(
    () => categoryChips(products, catalog?.categories ?? [], view, store, both),
    [products, catalog, view, store, both],
  );
  const subs = useMemo(
    () => subcategoryChips(products, view, store, both, category),
    [products, view, store, both, category],
  );

  function toggleBoth() {
    const exclusive = store === "exclusive-maxi" || store === "exclusive-iga";
    patch(
      {
        both: !both,
        ...(!both && exclusive ? { store: "comparables" as const } : {}),
      },
      "replace",
    );
  }

  function openView(next: View) {
    setProfile(false);
    patch(
      {
        view: next,
        ...(next !== "catalogue" && next !== "saq" ? { query: "" } : {}),
        ...(view === "saq" && next !== "saq" ? { query: "", where: "either" as const } : {}),
        ...(next === "saq" ? { query: "", category: "Alcool", subcategory: "all", sort: "alpha" as const, where: "either" as const } : {}),
        ...(next === "imbattables" ? { sort: "rabais" as const } : {}),
        ...(next === "catalogue" ? { sort: "alpha" as const } : {}),
      },
      "push",
    );
  }

  function onQuery(value: string) {
    if (view === "saq") {
      patch({ query: value }, "replace");
      return;
    }
    const jump = value.trim().length >= 2 && view !== "catalogue";
    patch({ query: value, ...(jump ? { view: "catalogue" as const } : {}) }, jump ? "push" : "replace");
  }

  function tasteKind(product: Product) {
    return product.saq ? "saq" as const : "epicerie" as const;
  }

  function rememberAdd(id: string) {
    list.add(id);
    const product = byId.get(id);
    if (product) account.remember(product.id, product.name, tasteKind(product));
  }

  function likeProduct(product: Product) {
    account.like(product.id, product.name, tasteKind(product));
  }

  function passProduct(product: Product) {
    account.pass(product.id, product.name, tasteKind(product));
  }

  function likeSaq(product: SaqProduct) {
    account.like(product.id, product.name, "saq");
  }

  function passSaq(product: SaqProduct) {
    account.pass(product.id, product.name, "saq");
  }

  function openMark(mark: Mark) {
    setProfile(false);
    if (mark.kind === "saq") {
      patch({ view: "saq", query: mark.name, category: "Alcool", subcategory: "all", sort: "alpha", where: "either" }, "push");
      return;
    }
    patch({ query: mark.name, category: "all", subcategory: "all", view: "catalogue", sort: "alpha", store: "comparables" }, "push");
  }

  function pick(product: Product) {
    if (view === "saq" || product.saq) {
      patch({ query: product.name, category: "all", view: "saq", sort: "alpha" }, "push");
      return;
    }
    patch(
      {
        query: product.name,
        category: "all",
        subcategory: "all",
        view: "catalogue",
        sort: "alpha",
        store: both || !product.exclusive ? "comparables" : product.cheaper === "maxi" ? "exclusive-maxi" : "exclusive-iga",
      },
      "push",
    );
  }

  if (!account.ready || !account.account) {
    return (
      <AccountGate
        names={account.names}
        lastName={account.lastName}
        spotlight={preview.spotlight}
        basket={preview.basket}
        wine={preview.wine}
        onCreate={account.register}
        onLogin={account.login}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-pine focus:px-4 focus:py-2 focus:text-pine-ink">
        Aller au contenu
      </a>
      <div className={roadmap ? "no-print" : undefined}>
        <Header
          view={view}
          onView={openView}
          count={list.count}
          deals={deals}
          mode={theme.mode}
          onTheme={theme.cycle}
          records={view === "saq" ? saqIndex : index}
          both={view === "saq" ? false : both}
          query={query}
          onQuery={onQuery}
          onPick={pick}
          onScan={() => setScan(true)}
          placeholder={view === "saq" ? "Vin, whisky, code SAQ…" : undefined}
          accountName={account.account.name}
          onAccount={() => setProfile(true)}
          onLogout={() => {
            setProfile(false);
            account.logout();
          }}
        />
        <main id="contenu" className="mx-auto max-w-[90rem] px-4 py-6 md:px-6 md:py-8">
          {profile && (
            <AccountView
              account={account.account}
              onStore={account.saveStore}
              onLike={(mark) => account.like(mark.id, mark.name, mark.kind)}
              onPass={(mark) => account.pass(mark.id, mark.name, mark.kind)}
              onOpen={openMark}
              onPassword={account.replacePassword}
              onRestore={account.restore}
              onDelete={account.removeAccount}
              onLogout={() => {
                setProfile(false);
                account.logout();
              }}
            />
          )}
          {!profile && error && <p className="mb-4 rounded-2xl border border-iga/30 bg-iga/10 px-4 py-3 text-sm">{error}</p>}
          {!profile && view !== "essence" && view !== "saq" && !catalog && !error && (
            <div>
              <p className="sr-only">Chargement du catalogue</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="h-56 animate-pulse rounded-2xl bg-line/70" />
                ))}
              </div>
            </div>
          )}
          {!profile && catalog && view === "accueil" && (
            <HomeView
              compared={comparables.length}
              deals={deals}
              averageGap={averageGap}
              updated={updated}
              highlights={highlights}
              pourToi={pourToi}
              store={account.account.memory.store}
              liked={(id) => account.account?.memory.likes.some((item) => item.id === id) ?? false}
              passed={(id) => account.account?.memory.passes.some((item) => item.id === id) ?? false}
              onLike={likeProduct}
              onPass={passProduct}
              qtyOf={list.qtyOf}
              onAdd={rememberAdd}
              onQty={list.setQty}
              onCatalogue={() => openView("catalogue")}
              onDeals={() => openView("imbattables")}
              onScan={() => setScan(true)}
              onEssence={() => openView("essence")}
              onSaq={() => openView("saq")}
              onMeals={() => openView("repas")}
              onSearch={onQuery}
            />
          )}
          {!profile && catalog && (view === "catalogue" || view === "imbattables") && (
            <div className="space-y-6">
              <section className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-sm text-pine">Maxi, boulevard Laflèche · IGA, rue de Bretagne</p>
                  <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">
                    {view === "imbattables" ? "Les imbattables de la semaine" : "Le cadre vert est le moins cher."}
                  </h1>
                  <p className="mt-3 max-w-xl text-muted">
                    {searching
                      ? both
                        ? "Recherche parmi les articles vendus au Maxi et à l’IGA."
                        : "Recherche dans tout le catalogue, y compris les articles d’un seul magasin."
                      : view === "imbattables"
                        ? "Au moins 30 % sous le prix régulier de l’autre magasin. Ajoutez-les à la liste pour voir l’économie."
                        : `${comparables.length.toLocaleString("fr-CA")} produits alignés. Écart moyen ${money(averageGap)} quand les deux magasins le vendent.`}
                  </p>
                  {!searching && updated && <p className="mt-2 text-xs text-muted">Prix relevés le {updated}. L’étiquette en magasin reste la référence.</p>}
                  {view === "catalogue" && !searching && (
                    <button type="button" onClick={() => openView("accueil")} className="mt-3 text-sm font-medium text-pine underline-offset-2 hover:underline">
                      Comment ça marche
                    </button>
                  )}
                </div>
                {view === "catalogue" && (
                  <button
                    type="button"
                    onClick={() => openView("imbattables")}
                    className="rounded-3xl border border-line bg-card px-5 py-4 text-left shadow-[var(--shadow)] transition hover:-translate-y-0.5"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Cette semaine</p>
                    <p className="mt-1 font-serif text-3xl">{deals}</p>
                    <p className="text-sm text-pine">imbattables à 30 % et plus</p>
                  </button>
                )}
              </section>
              <Filters
                categories={searching ? [] : chips}
                category={category}
                onCategory={(id) => patch({ category: id, subcategory: "all" }, "replace")}
                subcategories={searching ? [] : subs}
                subcategory={subcategory}
                onSubcategory={(id) => patch({ subcategory: id }, "replace")}
                store={store}
                onStore={(id: StoreFilter) => patch({ store: id }, "replace")}
                sort={sort}
                onSort={(next: SortKey) => patch({ sort: next }, "replace")}
                total={visible.length}
                showStore={view === "catalogue" && !searching}
                hideExclusive={both}
                both={both}
                onBoth={toggleBoth}
              />
              <ProductGrid
                products={visible}
                page={page}
                pageSize={PAGE_SIZE}
                onPage={(next) => patch({ page: next }, "replace")}
                qtyOf={list.qtyOf}
                liked={(id) => account.account?.memory.likes.some((item) => item.id === id) ?? false}
                passed={(id) => account.account?.memory.passes.some((item) => item.id === id) ?? false}
                onLike={likeProduct}
                onPass={passProduct}
                onAdd={rememberAdd}
                onQty={list.setQty}
                hint={
                  both
                    ? "« Les deux magasins » est activé. Désactivez-le pour voir aussi les articles d’un seul magasin."
                    : undefined
                }
              />
            </div>
          )}
          {!profile && view === "saq" && (
            <SaqView
              catalog={saq.catalog}
              error={saq.error}
              query={query}
              subcategory={subcategory}
              where={state.where}
              sort={sort}
              page={page}
              onSubcategory={(id) => patch({ subcategory: id }, "replace")}
              onWhere={(id: SaqStoreFilter) => patch({ where: id }, "replace")}
              onSort={(next: SortKey) => patch({ sort: next }, "replace")}
              onPage={(next) => patch({ page: next }, "replace")}
              onScan={() => setScan(true)}
              qtyOf={list.qtyOf}
              onAdd={rememberAdd}
              onQty={list.setQty}
              liked={(id) => account.account?.memory.likes.some((item) => item.id === id) ?? false}
              passed={(id) => account.account?.memory.passes.some((item) => item.id === id) ?? false}
              onLike={likeSaq}
              onPass={passSaq}
              author={account.account.name}
              reviewsOf={(sku) => reviews.book[sku] ?? []}
              averageOf={reviews.averageOf}
              onPublish={reviews.publish}
            />
          )}
          {!profile && view === "essence" && <EssenceView />}
          {!profile && catalog && view === "repas" && (
            <MealsView
              habits={account.account.habits}
              products={products.filter((product) => !account.account?.memory.passes.some((item) => item.id === product.id))}
              wines={saq.catalog?.products ?? []}
              notebook={account.account.notebook}
              onSave={account.saveHabits}
              onNotebook={account.saveNotebook}
              onAdd={list.addMany}
              onList={() => openView("liste")}
            />
          )}
          {!profile && catalog && view === "liste" && (
            <ListView
              summary={summary}
              onQty={list.setQty}
              onClear={list.clear}
              onBrowse={() => openView("catalogue")}
              onDeals={() => openView("imbattables")}
              onPdf={() => setRoadmap(true)}
            />
          )}
          {!profile && view !== "essence" && view !== "saq" && (
            <p className="no-print mx-auto mt-12 max-w-2xl text-center text-xs text-muted">
              Prix relevés sur maxi.ca et iga.ca pour Baie-Comeau. Le montant principal est le prix en tablette. « Carte Scène » est le prix avec la carte, quand l’offre existe. Les montants peuvent changer en magasin.
            </p>
          )}
        </main>
      </div>
      {roadmap && <Roadmap summary={summary} onClose={() => setRoadmap(false)} />}
      {scan && (view === "saq" ? (saq.catalog?.products.length ?? 0) > 0 : catalog) && (
        <Scanner
          kind={view === "saq" ? "saq" : "grocery"}
          products={view === "saq" ? (saq.catalog?.products ?? []).map(toProduct) : products}
          qtyOf={list.qtyOf}
          onAdd={rememberAdd}
          onQty={list.setQty}
          onClose={() => setScan(false)}
          author={account.account?.name ?? ""}
          reviewsOf={(sku) => reviews.book[sku] ?? []}
          averageOf={reviews.averageOf}
          onPublish={reviews.publish}
        />
      )}
    </div>
  );
}
