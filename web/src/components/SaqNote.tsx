type Props = {
  average?: number | null;
  count?: number;
  compact?: boolean;
};

export function SaqNote({ average, count = 0, compact = false }: Props) {
  if (average == null || count <= 0) {
    return compact ? null : <p className="text-sm text-muted">Aucune note Comparo pour l’instant.</p>;
  }
  const full = Math.max(0, Math.min(5, Math.round(average)));
  const label = `${average.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 5, ${count} avis`;
  return (
    <p className={compact ? "text-xs" : "text-sm"} aria-label={label}>
      <span className="tracking-tight text-pine" aria-hidden="true">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>
      <span className="ml-1 tabular-nums">{average.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="text-muted"> · {count.toLocaleString("fr-CA")} avis</span>
    </p>
  );
}
