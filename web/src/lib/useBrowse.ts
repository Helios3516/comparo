import { useCallback, useEffect, useRef, useState } from "react";
import { browsePath, readBrowse, type BrowseState } from "./browse";

export function useBrowse() {
  const [state, setState] = useState<BrowseState>(() => readBrowse(window.location.search));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPop = () => {
      const next = readBrowse(window.location.search);
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const patch = useCallback((partial: Partial<BrowseState>, mode: "push" | "replace") => {
    const current = stateRef.current;
    const next: BrowseState = { ...current, ...partial };
    const resetsPage =
      partial.page === undefined &&
      (partial.query !== undefined ||
        partial.category !== undefined ||
        partial.subcategory !== undefined ||
        partial.store !== undefined ||
        partial.sort !== undefined ||
        partial.view !== undefined ||
        partial.both !== undefined ||
        partial.where !== undefined);
    if (partial.category !== undefined && partial.subcategory === undefined) next.subcategory = "all";
    if (resetsPage) next.page = 0;
    stateRef.current = next;
    setState(next);
    const url = browsePath(next);
    const here = `${window.location.pathname}${window.location.search}`;
    if (here === url) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  return { state, patch };
}
