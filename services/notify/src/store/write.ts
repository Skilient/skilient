import { enqueue, publishRealtime, uuidv7 } from "@skilient/platform";
import type { Op } from "../domain/notices";
import { blockedBetween, CHANNEL, PUSHED, publishCounts, type Tx } from "./db";

/**
 * `private.notify(user, actor, type, entity_type, entity_id, data)`: the one place notifications are made. Skips a
 * notice to the actor themselves and pairs with a block between them; queues an instant email when the recipient's
 * channel for the type is instant, and a push when the type is pushed, their choice for the category is on and they
 * have a device. Returns the new id, or null when skipped.
 */
export async function notify(tx: Tx, n: { user: string; actor: string | null; type: string; entityType: string; entityId: string; data: Record<string, unknown> }): Promise<string | null> {
  if (n.user === n.actor) return null;
  const id = uuidv7();
  const [r] = await tx<{ id: string; channel: string; pushed: boolean }[]>`
    with t as (select * from notify.types where type = ${n.type})
    insert into notify.notifications (id, user_id, actor_id, type, entity_type, entity_id, data)
    select ${id}, ${n.user}, ${n.actor}, ${n.type}, ${n.entityType}, ${n.entityId}, ${JSON.stringify(n.data)}::text::jsonb
     where exists (select 1 from t)
       and ${n.actor ? tx`not ${blockedBetween(tx, n.user, n.actor)}` : tx`true`}
    returning id::text,
      (select ${tx.unsafe(CHANNEL)} from notify.types t join notify.categories c on c.category = t.category
         left join notify.prefs p on p.user_id = ${n.user} and p.category = t.category where t.type = ${n.type}) as channel,
      (select ${tx.unsafe(PUSHED)} from notify.types t join notify.categories c on c.category = t.category
         left join notify.push_prefs pp on pp.user_id = ${n.user} and pp.category = t.category where t.type = ${n.type})
        and exists (select 1 from notify.push_subscriptions s where s.user_id = ${n.user}) as pushed`;
  if (!r) return null;
  if (r.channel === "instant_email") await tx`insert into notify.email_queue (kind, payload) values ('instant', ${JSON.stringify({ notification_id: id })}::text::jsonb)`;
  if (r.pushed) await tx`insert into notify.push_queue (notification_id) values (${id})`;
  await publishRealtime(tx, { topic: `user:${n.user}`, event: "notification", payload: { id } });
  return id;
}

/** Applies one event's operations; publishes the new unread counts of everyone it touched. */
export async function apply(tx: Tx, ops: readonly Op[]): Promise<{ made: number }> {
  const touched = new Set<string>();
  let made = 0;
  let mail = false;
  let push = false;
  for (const op of ops) {
    switch (op.op) {
      case "notify": {
        if (await notify(tx, op)) {
          made++;
          touched.add(op.user);
        }
        break;
      }
      case "chat": {
        // notify_chat_message: one unread chat notice per thread, refreshed by each new message.
        const updated = await tx<{ id: string }[]>`
          update notify.notifications n set actor_id = ${op.actor}, data = ${JSON.stringify(op.data)}::text::jsonb, created_at = now()
           where n.user_id = ${op.user} and n.type = 'chat_message' and n.entity_id = ${op.threadId} and n.read_at is null
             and not ${blockedBetween(tx, op.user, op.actor)}
          returning id::text`;
        if (updated[0]) {
          // A collapsed chat notice still pushes the new message (the device replaces it by thread).
          const [on] = await tx<{ on: boolean }[]>`
            select ${tx.unsafe(PUSHED)} and exists (select 1 from notify.push_subscriptions s where s.user_id = ${op.user}) as on
              from notify.types t join notify.categories c on c.category = t.category
              left join notify.push_prefs pp on pp.user_id = ${op.user} and pp.category = t.category
             where t.type = 'chat_message'`;
          if (on?.on) {
            await tx`insert into notify.push_queue (notification_id) values (${updated[0].id})`;
            push = true;
          }
          touched.add(op.user);
        } else if (await notify(tx, { user: op.user, actor: op.actor, type: "chat_message", entityType: "chat_thread", entityId: op.threadId, data: op.data })) {
          made++;
          touched.add(op.user);
        }
        break;
      }
      case "retract": {
        const gone = await tx<{ user_id: string }[]>`
          delete from notify.notifications n
           where n.entity_type = ${op.entityType} and n.entity_id = ${op.entityId} and n.read_at is null
             and (${op.type ?? null}::text is null or n.type = ${op.type ?? null})
             and (${op.actor ?? null}::uuid is null or n.actor_id = ${op.actor ?? null})
             and (${op.since ?? null}::timestamptz is null or n.created_at > ${op.since ?? null}::timestamptz - interval '15 seconds')
          returning user_id::text`;
        for (const g of gone) touched.add(g.user_id);
        break;
      }
      case "read_thread": {
        const r = await tx`update notify.notifications set read_at = now()
                            where user_id = ${op.user} and type = 'chat_message' and entity_id = ${op.threadId} and read_at is null`;
        if (r.count) touched.add(op.user);
        break;
      }
      case "email":
        await tx`insert into notify.email_queue (kind, payload) values (${op.kind}, ${JSON.stringify(op.payload)}::text::jsonb)`;
        mail = true;
        break;
      case "job":
        await enqueue(tx, { kind: op.kind, payload: op.payload, dedupeKey: op.dedupe });
        break;
    }
  }
  if (made || mail || push) {
    // Wake the drains: one run per newest queued row (a finished run keeps its key, so the key must move on with
    // the queue); the minute schedule is the fallback.
    const [q] = await tx<{ mail: string | null; push: string | null }[]>`
      select (select max(id)::text from notify.email_queue where not_before <= now()) as mail, (select max(id)::text from notify.push_queue where not_before <= now()) as push`;
    if (q!.mail) await enqueue(tx, { kind: "email-drain", dedupeKey: `email-drain:${q!.mail}` });
    if (q!.push) await enqueue(tx, { kind: "push-drain", dedupeKey: `push-drain:${q!.push}` });
  }
  await publishCounts(tx, touched);
  return { made };
}
