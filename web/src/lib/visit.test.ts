import { beforeEach, describe, expect, it, vi } from "vitest";
import { finishVisit, forgetVisit, hasSeenVisit, queueVisit, visitPending } from "./visit";

describe("visite guidée", () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    const storage = {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
  });

  it("attend la visite juste après l’inscription", () => {
    queueVisit("Léa");
    expect(visitPending("Léa")).toBe(true);
    expect(visitPending("Emma")).toBe(false);
  });

  it("ne la représente pas une fois terminée", () => {
    queueVisit("Léa");
    finishVisit("Léa");
    expect(hasSeenVisit("Léa")).toBe(true);
    expect(visitPending("Léa")).toBe(false);
    queueVisit("Léa");
    expect(visitPending("Léa")).toBe(false);
  });

  it("peut recommencer si le compte est effacé", () => {
    finishVisit("Léa");
    forgetVisit("Léa");
    queueVisit("Léa");
    expect(visitPending("Léa")).toBe(true);
  });
});
