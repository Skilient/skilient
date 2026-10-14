import { describe, expect, it } from "vitest";
import {
  backupCodeUsedEmail, fairInviteEmail, mfaResetEmail, newDeviceEmail, orgInviteEmail,
  signInAttemptsEmail, uniAdminInviteEmail, universityRequestEmail,
} from "@/lib/email/templates";
import { digestEmail, instantEmail, opsAlertEmail, teacherDigestEmail, universityLaunchEmail } from "@/supabase/functions/_shared/notify/email";
import { brevoBody, notificationEmailCategory } from "@/supabase/functions/_shared/email/brevo";

describe("email category sender selection", () => {
  const to = "recipient@example.test";
  const url = "https://www.skilient.com";
  const item = { subject: "Update", text: "Update", href: "/notifications" };
  const security = [
    newDeviceEmail(to, { device: "Browser", location: null, at: new Date(), notMeUrl: url }),
    signInAttemptsEmail(to, { codeUrl: url, resetUrl: url }),
    backupCodeUsedEmail(to, url), mfaResetEmail(to, url),
    orgInviteEmail(to, { orgName: "Company", role: "admin", link: url }),
    uniAdminInviteEmail(to, { university: "University", role: "admin", link: url }),
    universityRequestEmail(to, { university: "University", confirmUrl: url, unsubscribeUrl: url }),
    instantEmail(to, url, item, "security"), digestEmail(to, url, [item], 0, "security"),
  ];
  const notifications = [
    opsAlertEmail(to, url, { state: "firing", title: "Alert", detail: "Details", since: "" }),
    fairInviteEmail(to, { university: "University", fair: "Fair", link: url }),
    instantEmail(to, url, item), digestEmail(to, url, [item], 0),
    teacherDigestEmail(to, url, { invites: 1 }), universityLaunchEmail(to, url, "University"),
  ];
  it("uses security for every access/security template, including worker messages", () => {
    for (const email of security) {
      expect(email.category).toBe("security");
      const body = brevoBody(email, "00000000-0000-4000-8000-000000000001");
      expect(body.sender).toEqual({ name: "Skilient", email: "security@skilient.com" });
      expect(body.replyTo).toEqual(body.sender);
    }
    for (const type of [
      "content_removed", "moderation_warning", "deletion_requested", "deletion_cancelled", "content_hidden_by_university",
      "account_restricted", "restriction_lifted", "org_sanctioned", "appeal_decided", "account_viewed",
    ]) expect(notificationEmailCategory(type)).toBe("security");
  });
  it("uses notify for notifications, including application-helper messages", () => {
    for (const email of notifications) {
      expect(email.category).toBe("notification");
      const body = brevoBody(email, "00000000-0000-4000-8000-000000000002");
      expect(body.sender).toEqual({ name: "Skilient", email: "notify@skilient.com" });
      expect(body.replyTo).toEqual(body.sender);
    }
    for (const type of [
      "friend_request", "application_received", "application_decided", "invite_received",
      "ownership_transferred", "member_left", "member_removed", "venture_completed",
      "venture_abandoned", "comment_received", "comment_reply", "comment_mention",
      "chat_message", "endorsement_received", "credential_reviewed", "code_check_ready",
      "code_check_graded", "cv_revoked", "feedback_update", "org_decided",
      "contact_request", "saved_search_matches", "job_application_received", "application_stage",
      "job_invite", "hire_outcome_due", "competition_decided", "competition_result",
      "uni_claim_decided", "uni_award", "uni_announcement", "fair_invite",
      "billing_payment_succeeded", "billing_payment_failed", "billing_trial_ended", "billing_renewal_reminder",
      "billing_subscription_ended", "billing_invoice_issued", "billing_hire_fee", "billing_hire_fee_overdue",
      "billing_refund", "billing_limits_applied", "billing_sponsorship_started", "billing_sponsorship_ending",
    ])
      expect(notificationEmailCategory(type)).toBe("notification");
  });
});
