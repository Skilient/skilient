/**
 * Numbers as Postgres `numeric` gave them: rounding half away from zero at a fixed scale (118.125 → 118.13),
 * without binary-fraction noise (157.5 × 0.75 must not print 118.12499999). `clean` drops that noise from a
 * value that was exact in numeric (1 − 0.02 × 6 = 0.88).
 */
export function clean(x: number): number {
  if (!Number.isFinite(x)) return x;
  return Number(x.toPrecision(15));
}

export function round(x: number, places: number): number {
  const n = clean(Math.abs(x));
  const r = Number(`${Math.round(Number(`${n}e${places}`))}e-${places}`);
  return x < 0 ? (r === 0 ? 0 : -r) : r;
}

export const round2 = (x: number) => round(x, 2);

/** The PKT (UTC+5, no daylight saving) calendar date of an instant, as YYYY-MM-DD. */
export function pktDate(d: Date): string {
  return new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

/** Days from date a to date b (YYYY-MM-DD), as Postgres `date - date`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday (YYYY-MM-DD) of the ISO week of a PKT instant: `date_trunc('week', t at time zone 'Asia/Karachi')`. */
export function pktWeek(d: Date): string {
  const day = pktDate(d);
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday 0
  return addDays(day, -dow);
}

/** ISO day of week of a date (Monday 1 … Sunday 7). */
export function isoDow(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
