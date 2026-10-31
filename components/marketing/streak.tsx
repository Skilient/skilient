/**
 * A decorative contribution grid (the "streaks" motif, app/(marketing)/CLAUDE.md): weeks as
 * columns, days as rows, busier toward the present (Momentum). Deterministic, so server and
 * client agree; aria-hidden, so it never reads as a claim.
 */
function streakCells(weeks: number, seed: number): number[] {
  let x = seed;
  const cells: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const heat = 0.15 + (0.7 * w) / weeks;
    for (let d = 0; d < 7; d++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      const r = x / 2147483648;
      cells.push(r < heat * 0.25 ? 3 : r < heat * 0.55 ? 2 : r < heat ? 1 : 0);
    }
  }
  return cells;
}

export function Streak({ weeks = 22, seed = 7, className }: { weeks?: number; seed?: number; className?: string }) {
  const cells = streakCells(weeks, seed);
  return (
    <div aria-hidden className={className}>
      <div className="streak">
        {cells.map((l, i) => (
          <i key={i} data-l={l || undefined} />
        ))}
      </div>
    </div>
  );
}
