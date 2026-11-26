import type { Formula } from "../domain/score";
import type { Db } from "./db";

/** `ranking_formula()`: the version in force (the newest whose effective_at has passed) and its value. */
export async function formulaInForce(db: Db): Promise<{ version: number; value: Formula }> {
  const [f] = await db<{ version: number; value: Formula }[]>`
    select version, value from ranking.formulas where effective_at <= now() order by effective_at desc, version desc limit 1`;
  if (!f) throw new Error("ranking.formula is not set");
  return f;
}

export async function formulaVersion(db: Db, version: number): Promise<Formula | null> {
  const [f] = await db<{ value: Formula }[]>`select value from ranking.formulas where version = ${version}`;
  return f?.value ?? null;
}

/** A config value ranking copies (feed.score, teacher.limits). */
export async function configValue(db: Db, key: string): Promise<Record<string, number>> {
  const [c] = await db<{ value: Record<string, number> }[]>`select value from ranking.config where key = ${key}`;
  return c?.value ?? {};
}
