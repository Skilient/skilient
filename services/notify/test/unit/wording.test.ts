import { describe, expect, it } from "vitest";
import * as WebDescribe from "../../../../apps/web/supabase/functions/_shared/notify/describe.ts";
import * as WebEmail from "../../../../apps/web/supabase/functions/_shared/notify/email.ts";
import { describeNotification } from "../../src/domain/describe";
import { digestEmail, instantEmail, opsAlertEmail, recordClaimEmail, universityLaunchEmail } from "../../src/domain/email";
import { NOTICE_EVENTS } from "../../src/domain/notices";

const TYPES = [
  "friend_request", "friend_accepted", "application_received", "application_decided", "application_withdrawn", "invite_received", "invite_answered",
  "ownership_transferred", "member_left", "member_removed", "venture_completed", "venture_abandoned", "comment_received", "comment_reply", "comment_mention",
  "chat_message", "endorsement_received", "endorse_teammates", "code_check_ready", "code_check_graded", "credential_reviewed", "credential_expired",
  "cv_refreshed", "cv_revoked", "task_done", "task_review_offer", "task_needs_changes", "swap_request", "swap_accepted", "swap_declined", "swap_closed",
  "swap_session_proposed", "swap_session_accepted", "swap_session_reminder", "swap_session_ask", "swap_note", "ranking_formula", "society_decided",
  "society_invite", "society_invite_answered", "society_join_request", "society_joined", "term_ended", "induction_published", "induction_applied",
  "induction_decided", "event_published", "event_changed", "event_cancelled", "event_registration", "event_promoted", "event_decided", "hold_expired",
  "event_reminder", "event_cohost", "event_staff_added", "event_message", "payment_review", "payment_decided", "refund_requested", "refund_sent",
  "refund_answered", "payment_details_proposed", "payment_details_confirmed", "record_entry", "record_revoked", "record_confirm", "record_mistake",
  "record_mistake_declined",
];
const DATA: Record<string, unknown>[] = [
  {},
  { venture_title: "Plover Map", venture_id: "99c00000-0000-4000-8000-000000000001", status: "accepted", role: "old_owner" },
  { status: "closed", excerpt: "x".repeat(130), post_id: "99c00000-0000-4000-8000-000000000002", event: "Dawn Count", society: "Plover Club", slug: "plover", accepted: true, paid: true, approved: false, reason: "blurry", skill: "TypeScript", when: "Sat 06 Dec, 05:30", title: "Census lead", passed: true, count: 2, code: "ABCDEFGHJK", version: 3 },
];

describe("notify's wording is web's wording, verbatim", () => {
  it("every type, with empty, partial and full data, says and links the same", () => {
    for (const type of TYPES)
      for (const data of DATA)
        for (const actorName of [null, "Bilal Plover"]) {
          const n = { type, actorName, entityType: "post", entityId: "99c00000-0000-4000-8000-000000000003", data };
          expect(describeNotification(n), type).toEqual(WebDescribe.describeNotification(n));
        }
  });

  it("the email templates make the same messages", () => {
    const item = { subject: "S", text: "T <b>", href: "/x" };
    expect(instantEmail("a@notify-a.test", "https://app.test", item)).toEqual(WebEmail.instantEmail("a@notify-a.test", "https://app.test", item));
    const lines = [{ text: "one", href: "/1" }, { text: "two & three", href: "/2" }];
    expect(digestEmail("a@notify-a.test", "https://app.test", lines, 3)).toEqual(WebEmail.digestEmail("a@notify-a.test", "https://app.test", lines, 3));
    expect(universityLaunchEmail("a@notify-a.test", "https://app.test", "Plover U")).toEqual(WebEmail.universityLaunchEmail("a@notify-a.test", "https://app.test", "Plover U"));
    expect(recordClaimEmail("a@notify-a.test", "https://app.test", "Dawn Count", "Plover Club")).toEqual(WebEmail.recordClaimEmail("a@notify-a.test", "https://app.test", "Dawn Count", "Plover Club"));
    const alert = { state: "firing" as const, title: "Queue", detail: "stuck", since: "2026-11-28T10:00:00Z" };
    expect(opsAlertEmail("ops@notify-a.test", "https://app.test", alert)).toEqual(WebEmail.opsAlertEmail("ops@notify-a.test", "https://app.test", alert));
  });

  it("every handled event names one owning role", () => {
    for (const [type, owner] of Object.entries(NOTICE_EVENTS)) expect(owner, type).toMatch(/^svc_[a-z]+(\|svc_[a-z]+)?$/);
  });
});
