import { appendEvents } from "@skilient/platform";
import { refused } from "../refusals";
import { requireOnboarded } from "./profiles";
import type { Db, Tx } from "./publish";

/**
 * The learning layer (ported from 20261010000000_student_portal.sql: set_ui_state, tour_state, save_tour,
 * restart_tour, see_tip). Tour endings publish `tour.ended {user_id, tour, outcome, step}` for analytics
 * forwarding (today's analytics_tour trigger; trust forwards it in W10).
 */
export const UI_KEYS = ["progress_card_dismissed_on", "checklist_dismissed", "uni_questions_dismissed"] as const;
export const TOURS = ["student", "faculty", "recruiter", "uni_admin"] as const;
export const TIPS = ["opportunities", "venture", "cv", "score", "privacy"] as const;
const NO_TOUR = { started: false, step: 0, completed: false, skipped: false };

/** `set_ui_state`: one of three keys, a JSON value of at most 100 characters (as Postgres prints it). */
export async function setUiState(tx: Tx, me: string | null, key: string | null, valueJson: string | null): Promise<void> {
  const user = await requireOnboarded(tx, me);
  if (key == null || !(UI_KEYS as readonly string[]).includes(key)) throw refused("unknown_setting");
  if (valueJson == null) throw refused("value_too_long");
  let parsed: unknown;
  try {
    parsed = JSON.parse(valueJson);
  } catch {
    throw refused("invalid_input");
  }
  const [row] = await tx<{ n: number }[]>`select char_length(${JSON.stringify(parsed)}::text::jsonb::text)::int as n`;
  if (row!.n > 100) throw refused("value_too_long");
  await tx`
    insert into people.ui_state (user_id, key, value) values (${user}, ${key}, ${JSON.stringify(parsed)}::text::jsonb)
    on conflict (user_id, key) do update set value = excluded.value, updated_at = now()`;
}

/** `tour_state` */
export async function tourState(db: Db, me: string | null, tour: string | null) {
  const user = await requireOnboarded(db, me);
  const [t] = await db<{ step: number; completed: boolean; skipped: boolean }[]>`
    select step, completed_at is not null as completed, skipped_at is not null as skipped from people.tour_progress
     where user_id = ${user} and tour_id = ${tour ?? ""}`;
  return t ? { started: true, step: t.step, completed: t.completed, skipped: t.skipped } : NO_TOUR;
}

/** `save_tour`: the step moves freely; completed and skipped are set once and kept. */
export async function saveTour(tx: Tx, me: string | null, tour: string | null, step: number | null, outcome: string | null): Promise<void> {
  const user = await requireOnboarded(tx, me);
  if (tour == null || !(TOURS as readonly string[]).includes(tour)) throw refused("unknown_tour");
  if (outcome == null || !["progress", "completed", "skipped"].includes(outcome)) throw refused("unknown_outcome");
  if (step == null || !Number.isInteger(step) || step < 0 || step > 50) throw refused("unknown_step");
  const [r] = await tx<{ completed_now: boolean; skipped_now: boolean }[]>`
    with prev as (select completed_at, skipped_at from people.tour_progress where user_id = ${user} and tour_id = ${tour})
    insert into people.tour_progress (user_id, tour_id, step, completed_at, skipped_at)
    values (${user}, ${tour}, ${step}, case when ${outcome} = 'completed' then now() end, case when ${outcome} = 'skipped' then now() end)
    on conflict (user_id, tour_id) do update
      set step = excluded.step,
          completed_at = coalesce(people.tour_progress.completed_at, excluded.completed_at),
          skipped_at = coalesce(people.tour_progress.skipped_at, excluded.skipped_at),
          updated_at = now()
    returning (completed_at is not null and not exists (select 1 from prev where prev.completed_at is not null)) as completed_now,
              (skipped_at is not null and not exists (select 1 from prev where prev.skipped_at is not null)) as skipped_now`;
  if (r!.completed_now || r!.skipped_now)
    await appendEvents(tx, [{ type: "tour.ended", subjects: [user], payload: { user_id: user, tour, outcome: r!.completed_now ? "completed" : "skipped", step } }]);
}

/** `restart_tour` */
export async function restartTour(tx: Tx, me: string | null, tour: string | null): Promise<void> {
  const user = await requireOnboarded(tx, me);
  await tx`delete from people.tour_progress where user_id = ${user} and tour_id = ${tour ?? ""}`;
}

/** `see_tip` */
export async function seeTip(tx: Tx, me: string | null, tip: string | null): Promise<void> {
  const user = await requireOnboarded(tx, me);
  if (tip == null || !(TIPS as readonly string[]).includes(tip)) throw refused("unknown_tip");
  await tx`insert into people.tips_seen (user_id, tip_id) values (${user}, ${tip}) on conflict do nothing`;
}

/** LearnState: the app read ui_state and tips_seen directly, and tour_state through a call; one trip here. */
export async function learnState(db: Db, me: string | null, tour: string) {
  if (!me) throw refused("not_signed_in_plain");
  const [row] = await db<{ onboarded: boolean | null; ui: { key: string; value: unknown }[]; tips: string[]; tour: { step: number; completed: boolean; skipped: boolean } | null }[]>`
    select (select onboarding_complete from people.profiles where user_id = ${me}) as onboarded,
           coalesce((select json_agg(json_build_object('key', key, 'value', value) order by key) from people.ui_state where user_id = ${me}), '[]') as ui,
           coalesce((select array_agg(tip_id order by tip_id) from people.tips_seen where user_id = ${me}), '{}') as tips,
           (select json_build_object('step', step, 'completed', completed_at is not null, 'skipped', skipped_at is not null)
              from people.tour_progress where user_id = ${me} and tour_id = ${tour}) as tour`;
  if (!row?.onboarded) throw refused("finish_onboarding");
  return { ui: row.ui, tips: row.tips, tour: row.tour ? { started: true, ...row.tour } : NO_TOUR };
}
