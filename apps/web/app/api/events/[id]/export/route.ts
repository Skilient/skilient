import { NextResponse, type NextRequest } from "next/server";
import { logger, requestIdFrom } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/uni/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Raw = Record<string, unknown>;

function answer(a: unknown): string {
  if (typeof a !== "string") return "";
  if (!a.startsWith("[")) return a;
  try {
    return (JSON.parse(a) as string[]).join("; ");
  } catch {
    return a;
  }
}

/**
 * GET /api/events/[id]/export (PRD 5.31): the host's registrations as CSV, for its officers only
 * (event_manage and event_attendees_rows check that in SQL). Every cell is quoted and formula-escaped.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/events/[id]/export">) {
  const requestId = requestIdFrom(req.headers);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const [manage, rows] = await Promise.all([
    supabase.rpc("event_manage" as never, { p_event: id } as never),
    supabase.rpc("event_attendees_rows" as never, { p_event: id } as never),
  ]);
  if (manage.error || rows.error) {
    logger.info("events.export", { request_id: requestId, user_id: user.id, outcome: "refused", error_code: manage.error?.code ?? rows.error?.code });
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const m = manage.data as unknown as Raw;
  const questions = (m.questions ?? []) as string[];
  const data = (rows.data ?? []) as unknown as Raw[];
  const csv = toCsv([
    ["Name", "Username", "Department", "Batch", "Status", "Ticket", "Team", "Registered at", "Sessions checked in", ...questions],
    ...data.map((r) => [
      r.name,
      r.username,
      r.department,
      r.batch,
      r.status,
      r.ticket,
      r.team,
      r.registered_at,
      r.checked_in_sessions,
      ...questions.map((_, i) => answer(((r.answers ?? []) as unknown[])[i])),
    ]),
  ]);
  logger.info("events.export", { request_id: requestId, user_id: user.id, outcome: "ok", rows: data.length });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="skilient-event-${id.slice(0, 8)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
