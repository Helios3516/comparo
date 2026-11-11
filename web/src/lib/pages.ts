export function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 1) return [0];
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const wanted = [0, total - 1, current - 1, current, current + 1].filter((page) => page >= 0 && page < total);
  const sorted = [...new Set(wanted)].sort((a, b) => a - b);
  const window: (number | "gap")[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) window.push("gap");
    window.push(sorted[index]);
  }
  return window;
}
