import { appendEvents, uuidv7, type NewEvent } from "@skilient/platform";
import type { Formula } from "../domain/score";
import type { Tx } from "./db";
import { flagChanged } from "./flags";

/**
 * `detect_rings(f)` (the first stage of a run): a group where every pair endorsed each other within 180 days of
 * each other is a ring only when none of the ventures they endorsed through has outside evidence
 * (`venture_outside_evidence`: completed with a deliverable, or a GitHub entry by the endorsee in it). Pairs and
 * larger groups; one flag per connected group. Endorsements a reviewer already decided stay decided; an open flag
 * follows its group as it is today; a group that is no longer a ring on its own is closed automatically.
 * Returns the number of new flags. (The teacher-concentration half waits with the faculty portal.)
 */
export async function detectRings(tx: Tx, f: Formula): Promise<number> {
  const windowSeconds = f.rings.window_days * 86_400;
  const suspicious = await tx<{ u1: string; u2: string; ids: string[] }[]>`
    with pairs as (
      select least(a.endorser_id, a.endorsee_id) as u1, greatest(a.endorser_id, a.endorsee_id) as u2
        from ranking.endorsements a
        join ranking.endorsements b on b.endorser_id = a.endorsee_id and b.endorsee_id = a.endorser_id
       where abs(extract(epoch from (a.created_at - b.created_at))) <= ${windowSeconds}
       group by 1, 2
    )
    select p.u1::text, p.u2::text, array_agg(e.id::text order by e.id) as ids
      from pairs p
      join ranking.endorsements e on (e.endorser_id = p.u1 and e.endorsee_id = p.u2) or (e.endorser_id = p.u2 and e.endorsee_id = p.u1)
     group by p.u1, p.u2
    having not bool_or(
      exists (select 1 from ranking.ventures v join ranking.venture_completions c on c.venture_id = v.venture_id
               where v.venture_id = e.venture_id and v.status = 'completed' and c.deliverables >= 1)
      or exists (select 1 from ranking.contributions c where c.venture_id = e.venture_id and c.user_id = e.endorsee_id and c.source = 'github'))
     order by 1, 2`;

  // Connected groups (union-find), each named by its smallest member, as the recursive query rooted them.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const s of suspicious) {
    const [a, b] = [find(s.u1), find(s.u2)];
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const groups = new Map<string, { members: Set<string>; ids: Set<string> }>();
  for (const s of suspicious) {
    const root = find(s.u1);
    const g = groups.get(root) ?? { members: new Set(), ids: new Set() };
    g.members.add(s.u1);
    g.members.add(s.u2);
    for (const id of s.ids) g.ids.add(id);
    groups.set(root, g);
  }

  const decided = new Set(
    (await tx<{ id: string }[]>`select distinct unnest(endorsement_ids)::text as id from ranking.anti_gaming_flags where kind = 'ring' and status in ('cleared', 'upheld')`).map((r) => r.id),
  );
  const matched: string[] = [];
  const events: NewEvent[] = [];
  let created = 0;
  for (const g of groups.values()) {
    const members = [...g.members].sort();
    const fresh = [...g.ids].filter((id) => !decided.has(id)).sort();
    if (fresh.length === 0) continue;
    const [open] = await tx<{ id: string; members: string[]; endorsement_ids: string[] }[]>`
      select id::text, members::text[], endorsement_ids::text[] from ranking.anti_gaming_flags
       where kind = 'ring' and status = 'open' and members && ${members}::uuid[] order by created_at limit 1`;
    if (open) {
      if (JSON.stringify(open.members) !== JSON.stringify(members) || JSON.stringify(open.endorsement_ids) !== JSON.stringify(fresh)) {
        await tx`update ranking.anti_gaming_flags set members = ${members}::uuid[], endorsement_ids = ${fresh}::uuid[], updated_at = now() where id = ${open.id}`;
        events.push(flagChanged({ id: open.id, kind: "ring", members, status: "open" }));
      }
      matched.push(open.id);
    } else {
      const id = uuidv7();
      await tx`
        insert into ranking.anti_gaming_flags (id, kind, members, endorsement_ids, detail)
        values (${id}, 'ring', ${members}::uuid[], ${fresh}::uuid[], ${JSON.stringify({ window_days: f.rings.window_days })}::text::jsonb)`;
      events.push(flagChanged({ id, kind: "ring", members, status: "open" }));
      matched.push(id);
      created += 1;
    }
  }
  const closed = await tx<{ id: string; members: string[] }[]>`
    update ranking.anti_gaming_flags
       set status = 'cleared', reviewed_at = now(), claimed_by = null, claimed_at = null, updated_at = now(),
           reason = 'Closed automatically: these endorsements are no longer a ring on their own'
     where kind = 'ring' and status = 'open' and not (id = any(${matched}::uuid[]))
    returning id::text, members::text[]`;
  for (const c of closed) events.push(flagChanged({ id: c.id, kind: "ring", members: c.members, status: "cleared" }));
  await appendEvents(tx, events);
  return created;
}
