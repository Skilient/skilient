import type { Db } from "./db";

/**
 * RecordFacts (credentials, W8): what the Record's entries need that event.closed and society.term_changed don't
 * carry. Event titles, term titles, each result's label (a team's label goes to every confirmed member, as
 * issue_event_record read it), walk-ins' addresses (for identity's account check and the claim email) and
 * societies' names, slugs, logos and status. One query.
 */
export async function recordFacts(db: Db, q: { eventIds: string[]; termIds: string[]; attendeeIds: string[]; societyIds: string[] }) {
  const [r] = await db<{ v: { events: Ev[]; terms: Ev[]; labels: Label[]; walk_ins: WalkIn[]; societies: Soc[] } }[]>`
    select jsonb_build_object(
      'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'society_id', e.society_id))
                            from community.events e where e.id = any (${q.eventIds}::uuid[]) and e.society_id is not null), '[]'::jsonb),
      'terms', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'society_id', t.society_id))
                           from community.society_terms t where t.id = any (${q.termIds}::uuid[])), '[]'::jsonb),
      'labels', coalesce((select jsonb_agg(jsonb_build_object('event_id', x.event_id, 'user_id', coalesce(g.user_id, x.user_id), 'label', x.label))
                            from community.event_results x
                            left join community.event_registrations g on x.team_id is not null and g.event_id = x.event_id and g.team_id = x.team_id and g.status = 'confirmed'
                           where x.event_id = any (${q.eventIds}::uuid[]) and x.label is not null and coalesce(g.user_id, x.user_id) is not null), '[]'::jsonb),
      'walk_ins', coalesce((select jsonb_agg(jsonb_build_object('attendee_id', a.id, 'email', a.email))
                              from community.event_email_attendees a where a.id = any (${q.attendeeIds}::uuid[])), '[]'::jsonb),
      'societies', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'logo_path', s.logo_path, 'status', s.status))
                               from community.societies s
                              where s.id = any (${q.societyIds}::uuid[])
                                 or s.id in (select e.society_id from community.events e where e.id = any (${q.eventIds}::uuid[]))
                                 or s.id in (select t.society_id from community.society_terms t where t.id = any (${q.termIds}::uuid[]))), '[]'::jsonb)) as v`;
  const v = r!.v;
  return {
    events: v.events.map((e) => ({ id: e.id, title: e.title, societyId: e.society_id })),
    terms: v.terms.map((t) => ({ id: t.id, title: t.title, societyId: t.society_id })),
    labels: v.labels.map((l) => ({ eventId: l.event_id, userId: l.user_id, label: l.label })),
    walkIns: v.walk_ins.map((w) => ({ attendeeId: w.attendee_id, email: w.email })),
    societies: v.societies.map((s) => ({ id: s.id, name: s.name, slug: s.slug, logoPath: s.logo_path ?? "", status: s.status })),
  };
}

interface Ev {
  id: string;
  title: string;
  society_id: string;
}
interface Label {
  event_id: string;
  user_id: string;
  label: string;
}
interface WalkIn {
  attendee_id: string;
  email: string;
}
interface Soc {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  status: string;
}
