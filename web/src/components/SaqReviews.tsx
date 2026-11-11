import { useEffect, useState, type FormEvent } from "react";
import type { Review } from "../lib/reviews";
import { SaqNote } from "./SaqNote";

type Props = {
  sku: string;
  reviews: Review[];
  author: string;
  average: number | null;
  onPublish: (sku: string, author: string, stars: number, text: string) => Promise<string>;
};

export function SaqReviews({ sku, reviews, author, average, onPublish }: Props) {
  const mine = reviews.find((review) => review.author.localeCompare(author, "fr", { sensitivity: "accent" }) === 0);
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [text, setText] = useState(mine?.text ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!mine) return;
    setStars((current) => current || mine.stars);
    setText((current) => current || mine.text);
  }, [mine]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const message = await onPublish(sku, author, stars, text);
    setError(message);
    setPending(false);
  }

  return (
    <div className="mt-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Avis Comparo</p>
      <div className="mt-2">
        <SaqNote average={average} count={reviews.length} />
      </div>
      {reviews.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {reviews.map((review) => (
            <li key={`${review.author}-${review.at}`} className="rounded-2xl border border-line bg-card px-3 py-2">
              <p className="text-sm font-medium">
                {review.author}
                <span className="ml-2 text-pine" aria-label={`${review.stars} sur 5`}>
                  {"★".repeat(review.stars)}
                  {"☆".repeat(5 - review.stars)}
                </span>
              </p>
              <p className="mt-1 text-sm">{review.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3">
        <p className="text-sm font-medium">{mine ? "Modifier votre avis" : "Votre avis"}</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
              onClick={() => setStars(value)}
              className={`grid h-10 w-10 place-items-center rounded-full border text-lg ${stars >= value ? "border-pine bg-moss text-pine" : "border-line"}`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="mt-2 block text-sm" htmlFor={`avis-${sku}`}>
          Commentaire
          <textarea
            id={`avis-${sku}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={400}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm"
            placeholder="Ce que vous en avez pensé"
          />
        </label>
        {error && <p className="mt-2 text-sm text-iga">{error}</p>}
        <button type="submit" disabled={pending} className="btn-solid mt-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50">
          {mine ? "Mettre à jour" : "Publier"}
        </button>
      </form>
    </div>
  );
}
