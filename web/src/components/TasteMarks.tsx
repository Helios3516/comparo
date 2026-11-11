type Props = {
  name: string;
  liked: boolean;
  passed: boolean;
  onLike: () => void;
  onPass: () => void;
  className?: string;
};

export function TasteMarks({ name, liked, passed, onLike, onPass, className = "absolute right-1.5 top-1.5" }: Props) {
  return (
    <div className={`${className} z-10 flex gap-1`}>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? `Retirer ${name} de ce que vous aimez` : `Retenir ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          onLike();
        }}
        className={`grid h-8 w-8 place-items-center rounded-full border text-sm ${liked ? "border-pine bg-pine text-pine-ink" : "border-line bg-paper/90"}`}
      >
        ♥
      </button>
      <button
        type="button"
        aria-pressed={passed}
        aria-label={passed ? `Revoir ${name}` : `Écarter ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          onPass();
        }}
        className={`grid h-8 w-8 place-items-center rounded-full border text-sm ${passed ? "border-iga bg-iga text-iga-ink" : "border-line bg-paper/90"}`}
      >
        ×
      </button>
    </div>
  );
}
