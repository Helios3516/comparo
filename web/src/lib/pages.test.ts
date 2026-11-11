import { describe, expect, it } from "vitest";
import { pageWindow } from "./pages";

describe("pageWindow", () => {
  it("montre toutes les pages quand il y en a peu", () => {
    expect(pageWindow(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it("coupe la liste autour de la page courante", () => {
    expect(pageWindow(10, 50)).toEqual([0, "gap", 9, 10, 11, "gap", 49]);
  });
});
