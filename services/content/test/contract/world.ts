/**
 * The contract world for content: Postgres 17 with identity's, people's and content's schemas, each under its
 * own role, all three co-hosted (content calls people for names and usernames and identity for staff roles).
 * Users are made with people's own test helpers (people's world, which drives identity's), and content learns
 * about them only from the events identity and people publish, through content's copies consumer, as in
 * production. One world per transport.
 */
import { join } from "node:path";
import { appendEvents } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { peopleWorld, student as peopleStudent, stopWorlds as stopPeople, type PeopleWorld, type TestUser } from "../../../people/test/contract/world";
import { copiesConsumer, COPIES_CONSUMER, type ShippedNames } from "../../src/store/copies";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { NU, NUTECH } from "../../../people/test/contract/world";
export type { TestUser };

export interface ContentWorld extends PeopleWorld {
  content: postgres.Sql;
}

export function contentWorld(onWorld: (w: ContentWorld) => void, worlds: ContentWorld[] = []): () => Promise<TransportOptions> {
  process.env["CONTENT_JOBS"] = "off";
  // Tests move posts' stages and ages directly; a held pool would hide that (the budget test holds it).
  process.env["CONTENT_FEED_POOL_MS"] ??= "0";
  let base: PeopleWorld | undefined;
  const start = peopleWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const content = await base!.pg.service("content", MIGRATIONS);
    const w: ContentWorld = { ...base!, content };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return { ...o, database: (s: string) => (s === "content" ? content : db(s)) };
  };
}

export const stopWorlds = (worlds: ContentWorld[]) => stopPeople(worlds);

let names: ShippedNames = { owners: new Map(), titles: new Map() };
/** The names a venture.completed batch needs, as people and work would return them (tests set them). */
export const setShippedNames = (n: ShippedNames) => (names = n);

/** Runs content's copies consumer until it has read every event of the types it handles written so far. */
export async function drainCopies(w: ContentWorld): Promise<void> {
  const c = copiesConsumer({ sql: w.content, names: async () => names });
  for (let i = 0; i < 100; i++) {
    const [pending] = await w.content`
      select count(*)::int as n from platform.events e
       where e.type in ('user.created', 'user.deleted', 'profile.updated', 'friendship.changed', 'block.changed', 'mute.changed', 'group.member_changed',
                        'venture.updated', 'venture.follow_changed', 'venture.completed', 'skill.changed', 'society.status_changed',
                        'university_seat.changed', 'university_hide.changed', 'entitlement.changed', 'config.changed',
                        'moderation.removed', 'moderation.restored', 'post.reports_changed')
         and not exists (select 1 from platform.applied_events a where a.consumer = ${COPIES_CONSUMER} and a.event_id = e.id)`;
    if (pending!.n === 0) return;
    await c.runOnce();
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("content's copies consumer did not catch up");
}

/** An onboarded student (people's helper), with content's copy of them caught up. */
export async function student(w: ContentWorld, opts: Parameters<typeof peopleStudent>[1] = {}): Promise<TestUser> {
  const u = await peopleStudent(w, opts);
  await drainCopies(w);
  return u;
}

/** Publishes an event as another service would, from that service's own role (another schema's role). */
export async function publishAs(role: postgres.Sql, type: string, subjects: string[], payload: Record<string, unknown>): Promise<void> {
  await role.begin((tx) => appendEvents(tx, [{ type, subjects, payload }]));
}
