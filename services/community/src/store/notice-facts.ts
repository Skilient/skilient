import type postgres from "postgres";

type Db = postgres.Sql | postgres.TransactionSql;
type Row = Record<string, unknown>;

export interface NoticeQuery {
  societyIds: string[];
  eventIds: string[];
  roundIds: string[];
  applicationIds: string[];
  paymentIds: string[];
  messageIds: string[];
  inviteIds: string[];
  registrationIds: string[];
  officerSocietyIds: string[];
  audienceSocietyIds: string[];
  registrantEventIds: string[];
  termIds: string[];
}

/**
 * What notify's society and event notices snapshot (W9), as the stack's notify calls read it: names and slugs
 * (societies of the events asked for come too), titles, reasons, reference codes, message bodies (300 characters),
 * officers (president and officers), audiences (followers and members) and active registrants (confirmed, held,
 * pending, waitlisted; who holds a priced ticket). One database trip.
 */
export async function noticeFacts(db: Db, q: NoticeQuery) {
  const societies = [...new Set([...q.societyIds])];
  const [r] = await db<Record<string, Row[]>[]>`
    with ev as (select * from community.events where id = any(${q.eventIds}::uuid[]))
    select
      coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'status_reason', coalesce(s.status_reason, '')))
                  from community.societies s where s.id = any(${societies}::uuid[]) or s.id in (select society_id from ev)), '[]') as societies,
      coalesce((select json_agg(json_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'cancel_reason', coalesce(e.cancel_reason, ''), 'society_id', e.society_id)) from ev e), '[]') as events,
      coalesce((select json_agg(json_build_object('id', x.id, 'title', x.title, 'deadline', x.deadline)) from community.induction_rounds x where x.id = any(${q.roundIds}::uuid[])), '[]') as rounds,
      coalesce((select json_agg(json_build_object('id', a.id, 'team', coalesce(ro.title, ''), 'note', coalesce(nullif(btrim(coalesce(a.note, '')), ''), '')))
                  from community.induction_applications a left join community.induction_roles ro on ro.id = a.role_id
                 where a.id = any(${q.applicationIds}::uuid[])), '[]') as applications,
      coalesce((select json_agg(json_build_object('id', p.id, 'reference_code', p.reference_code, 'reject_reason', coalesce(p.reject_reason, '')))
                  from community.event_payments p where p.id = any(${q.paymentIds}::uuid[])), '[]') as payments,
      coalesce((select json_agg(json_build_object('id', m.id, 'text', left(btrim(m.body), 300))) from community.event_messages m where m.id = any(${q.messageIds}::uuid[])), '[]') as messages,
      coalesce((select json_agg(json_build_object('id', i.id, 'text', coalesce(btrim(i.title), ''))) from community.society_invites i where i.id = any(${q.inviteIds}::uuid[])), '[]') as invites,
      coalesce((select json_agg(json_build_object('id', t.id, 'text', t.title)) from community.society_terms t where t.id = any(${q.termIds}::uuid[])), '[]') as terms,
      coalesce((select json_agg(json_build_object('id', g.id, 'paid', exists (select 1 from community.event_ticket_types tt where tt.id = g.ticket_type_id and tt.price_pkr is not null),
                                                  'waitlist_position', coalesce(g.waitlist_position, 0)))
                  from community.event_registrations g where g.id = any(${q.registrationIds}::uuid[])), '[]') as registrations,
      coalesce((select json_agg(json_build_object('society_id', o.sid, 'user_ids', o.ids))
                  from (select m.society_id as sid, json_agg(m.user_id order by m.user_id) as ids from community.society_members m
                         where m.society_id = any(${q.officerSocietyIds}::uuid[]) and m.role in ('president', 'officer') group by m.society_id) o), '[]') as officers,
      coalesce((select json_agg(json_build_object('society_id', a.sid, 'user_ids', a.ids))
                  from (select x.sid, json_agg(distinct x.uid) as ids
                          from (select f.society_id as sid, f.user_id as uid from community.society_follows f where f.society_id = any(${q.audienceSocietyIds}::uuid[])
                                union select m.society_id, m.user_id from community.society_members m where m.society_id = any(${q.audienceSocietyIds}::uuid[])) x
                         group by x.sid) a), '[]') as audiences,
      coalesce((select json_agg(json_build_object('event_id', z.eid, 'user_ids', z.ids, 'paid_user_ids', z.paid))
                  from (select g.event_id as eid, json_agg(g.user_id order by g.user_id) as ids,
                               coalesce(json_agg(g.user_id order by g.user_id) filter (where tt.price_pkr is not null), '[]') as paid
                          from community.event_registrations g left join community.event_ticket_types tt on tt.id = g.ticket_type_id
                         where g.event_id = any(${q.registrantEventIds}::uuid[]) and g.status in ('confirmed', 'held', 'pending', 'waitlisted') and g.user_id is not null
                         group by g.event_id) z), '[]') as registrants`;
  const s = (v: unknown) => String(v ?? "");
  const ids = (v: unknown) => ((v as string[] | null) ?? []).map(String);
  const x = r!;
  return {
    societies: x["societies"]!.map((o) => ({ id: s(o["id"]), name: s(o["name"]), slug: s(o["slug"]), statusReason: s(o["status_reason"]) })),
    events: x["events"]!.map((o) => ({ id: s(o["id"]), title: s(o["title"]), startsAt: new Date(s(o["starts_at"])).toISOString(), cancelReason: s(o["cancel_reason"]), societyId: s(o["society_id"]) })),
    rounds: x["rounds"]!.map((o) => ({ id: s(o["id"]), title: s(o["title"]), deadline: new Date(s(o["deadline"])).toISOString() })),
    applications: x["applications"]!.map((o) => ({ id: s(o["id"]), team: s(o["team"]), note: s(o["note"]) })),
    payments: x["payments"]!.map((o) => ({ id: s(o["id"]), referenceCode: s(o["reference_code"]), rejectReason: s(o["reject_reason"]) })),
    messages: x["messages"]!.map((o) => ({ id: s(o["id"]), text: s(o["text"]) })),
    invites: x["invites"]!.map((o) => ({ id: s(o["id"]), text: s(o["text"]) })),
    terms: x["terms"]!.map((o) => ({ id: s(o["id"]), text: s(o["text"]) })),
    registrations: x["registrations"]!.map((o) => ({ id: s(o["id"]), paid: o["paid"] === true, waitlistPosition: Number(o["waitlist_position"] ?? 0) })),
    officers: x["officers"]!.map((o) => ({ societyId: s(o["society_id"]), userIds: ids(o["user_ids"]) })),
    audiences: x["audiences"]!.map((o) => ({ societyId: s(o["society_id"]), userIds: ids(o["user_ids"]) })),
    registrants: x["registrants"]!.map((o) => ({ eventId: s(o["event_id"]), userIds: ids(o["user_ids"]), paidUserIds: ids(o["paid_user_ids"]) })),
  };
}
