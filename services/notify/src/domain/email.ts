/**
 * Notification emails (instant, daily digest and the one-off emails): the templates of apps/web's
 * supabase/functions/_shared/notify/email.ts, ported verbatim (test/unit/wording.test.ts holds them equal).
 */

import type { EmailCategory, EmailMessage } from "./mail";
export type { EmailMessage } from "./mail";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F0EFED;color:#0E0D0B;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFED;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #DAD8D3;border-radius:12px;">
<tr><td style="padding:32px 32px 8px 32px;">
<p style="margin:0 0 24px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;">Skilient<span style="color:#C03910;">.</span></p>
<h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:32px;">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 32px 32px 32px;border-top:1px solid #ECEAE6;"><p style="margin:0;font-size:13px;line-height:20px;color:#5C5A55;">${escapeHtml(footer)}</p></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;">${escapeHtml(text)}</p>`;
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td style="border-radius:8px;background:#0E0D0B;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;

function footerFor(appUrl: string): string {
  return `You get this because of your notification settings. Change them any time: ${appUrl}/settings/notifications`;
}

/** One notification, sent straight away. */
export function instantEmail(to: string, appUrl: string, item: { subject: string; text: string; href: string }, category: EmailCategory = "notification"): EmailMessage {
  const url = `${appUrl}${item.href}`;
  const footer = footerFor(appUrl);
  return {
    category,
    to,
    subject: item.subject,
    html: layout(item.subject, p(item.text) + button(url, "Open Skilient"), footer),
    text: `${item.text}\n\nOpen Skilient: ${url}\n\n${footer}\n`,
  };
}

/** The daily digest: up to 20 unread items, then a count of the rest. Never sent empty. */
export function digestEmail(
  to: string,
  appUrl: string,
  items: { text: string; href: string }[],
  more: number,
  category: EmailCategory = "notification",
): EmailMessage {
  const total = items.length + more;
  const subject = total === 1 ? "1 thing waiting for you on Skilient" : `${total} things waiting for you on Skilient`;
  const title = "Since you were last here";
  const listHtml = `<ul style="margin:0 0 16px 0;padding-left:20px;font-size:15px;line-height:24px;">${items
    .map((i) => `<li style="margin:0 0 8px 0;"><a href="${escapeHtml(`${appUrl}${i.href}`)}" style="color:#0E0D0B;">${escapeHtml(i.text)}</a></li>`)
    .join("")}</ul>`;
  const moreLine = more > 0 ? `And ${more} more.` : null;
  const footer = footerFor(appUrl);
  return {
    category,
    to,
    subject,
    html: layout(title, listHtml + (moreLine ? p(moreLine) : "") + button(`${appUrl}/notifications`, "See all notifications"), footer),
    text: `${title}\n\n${items.map((i) => `- ${i.text} ${appUrl}${i.href}`).join("\n")}\n${moreLine ? `\n${moreLine}\n` : ""}\nSee all: ${appUrl}/notifications\n\n${footer}\n`,
  };
}

/** The one email a university requester gets (PRD 5.1): their university is now open for signup. */
export function universityLaunchEmail(to: string, appUrl: string, university: string): EmailMessage {
  const subject = `${university} is on Skilient`;
  const join = `${appUrl}/signup?email=${encodeURIComponent(to)}`;
  const footer = "You asked us to email you when your university joined. This is the only email we send about it.";
  const body = `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;">You can now join with your university email: build with classmates, prove your skills with real work, and get a CV recruiters can check.</p>`;
  return {
    category: "notification",
    to,
    subject,
    html: layout(subject, body + button(join, "Join Skilient"), footer),
    text: `${subject}\n\nYou can now join with your university email: build with classmates, prove your skills with real work, and get a CV recruiters can check.\n\nJoin Skilient: ${join}\n\n${footer}\n`,
  };
}

/**
 * A walk-in's held Record entry (PRD 5.30): the one claim email for this event. The link is a
 * plain signup page (nothing a scanner can consume); the entry joins the Record only after
 * signing up and verifying this same address.
 */
export function recordClaimEmail(to: string, appUrl: string, event: string, society: string): EmailMessage {
  const subject = `Your entry for ${event} is waiting`;
  const join = `${appUrl}/signup?email=${encodeURIComponent(to)}`;
  const footer = "You were checked in with this address. This is the only email we send about this event; the entry is held for 180 days.";
  const line = `${society} checked you in at ${event}. Your Attended entry is held for this address. Sign up with this university email to claim it onto your Record.`;
  return {
    category: "notification",
    to,
    subject,
    html: layout(subject, `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;">${escapeHtml(line)}</p>` + button(join, "Sign up to claim it"), footer),
    text: `${subject}\n\n${line}\n\nSign up to claim it: ${join}\n\n${footer}\n`,
  };
}

/** An operational alert for staff (PRD 10 "Alerts — email only"), queued by private.job_watchdog. */
export function opsAlertEmail(
  to: string,
  appUrl: string,
  alert: { state: "firing" | "resolved"; title: string; detail: string; since: string },
): EmailMessage {
  const subject = alert.state === "firing" ? `[Skilient alert] ${alert.title}` : `[Skilient resolved] ${alert.title}`;
  const since = new Date(alert.since);
  const when = Number.isNaN(since.getTime()) ? "" : since.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const lead = alert.state === "firing" ? `Since ${when}.` : `This has cleared (it started ${when}).`;
  const footer = "You get this because your address is in alerts.recipients (/ops/config). What each alert means: docs/alerts.md.";
  const body =
    `<p style="margin:0 0 12px 0;font-size:15px;line-height:24px;">${escapeHtml(alert.detail)}</p>` +
    `<p style="margin:0 0 16px 0;font-size:13px;line-height:20px;color:#5C5A55;">${escapeHtml(lead)}</p>`;
  return {
    category: "notification",
    to,
    subject,
    html: layout(subject, body + button(`${appUrl}/ops/metrics`, "Open /ops"), footer),
    text: `${subject}\n\n${alert.detail}\n${lead}\n\nOpen /ops: ${appUrl}/ops/metrics\n\n${footer}\n`,
  };
}
