/** Mailpit reader for the local stack (as tests/e2e/support.ts latestEmail, with the arrival time). */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(MAILPIT)) throw new Error("ux-pilot: Mailpit must be local");
export async function latest(address: string, since = 0, waitMs = 30_000): Promise<{ subject: string; html: string; text: string; receivedAt: number }> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
      const fresh = messages.filter((m) => new Date(m.Created).getTime() >= since).sort((a, b) => b.Created.localeCompare(a.Created));
      if (fresh.length) {
        const d = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()) as { Subject: string; HTML: string; Text: string };
        return { subject: d.Subject, html: d.HTML, text: d.Text, receivedAt: new Date(fresh[0].Created).getTime() };
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${address}`);
}
export function codeFrom(s: string): string {
  const c = /\b(\d{6})\b/.exec(s)?.[1];
  if (!c) throw new Error(`no code in ${s.slice(0, 80)}`);
  return c;
}
