import { brandMark } from "../lib/stationServices";

export function BrandMark({ brand }: { brand: string }) {
  const mark = brandMark(brand);
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold tracking-tight"
      style={{ background: mark.bg, color: mark.fg }}
    >
      {mark.letters}
    </span>
  );
}
