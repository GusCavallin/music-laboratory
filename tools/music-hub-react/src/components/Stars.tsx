interface Props {
  /** the rating shown, 0 to 5 */
  n: number;
  /** a click on a star: the rating it asks for (clicking the current rating asks to clear it); without it the stars are only shown */
  onRate?: (stars: number) => void;
}

/** Five stars, filled up to the rating. Clicking one sets that rating in iTunes itself. */
export function Stars({ n, onRate }: Props) {
  return (
    <span className="stars" role={onRate ? "group" : "img"} aria-label={onRate ? "Rating" : n ? `${n} of 5 stars` : "not rated"}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= n;
        const mark = on ? "★" : "☆";
        return onRate ? (
          <button
            key={i}
            type="button"
            className={on ? "on" : undefined}
            aria-label={`${i} ${i === 1 ? "star" : "stars"}${i === n ? ", click again to clear" : ""}`}
            title={i === n ? "Click again to clear the rating" : `Rate ${i} ${i === 1 ? "star" : "stars"} in iTunes`}
            onClick={(e) => {
              e.stopPropagation(); // not a click on the row (which would start the song)
              onRate(i);
            }}
          >
            {mark}
          </button>
        ) : (
          <span key={i} className={on ? "on" : undefined}>{mark}</span>
        );
      })}
    </span>
  );
}
