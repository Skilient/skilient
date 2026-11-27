/**
 * The community golden world as data, so the same facts are built twice: on the current stack by
 * packages/testing/test/community.golden.test.ts (as rows in its tables) and in community's own schema by
 * services/community/test/golden (as people's events plus community's own rows). Ids are fixed and RFC 4122
 * (version 4 bits); domains end in `.test`; names are distinctive and nobody's.
 *
 * Two universities. At A: Priya presides over the verified society SOC (membership by request), Osman is its
 * officer (General Secretary) and Mehr a member; Sami is a student with no society; Nida has a pending request
 * for the society PENDING; Tariq is a trust reviewer (staff); Gul is a graduate. Ula studies at B. Every
 * student is onboarded (department Computer Science, batch 2027) unless noted.
 */
const pad = (i: number, n = 2) => String(i).padStart(n, "0");
const U = (i: number) => `97b00000-0000-4000-8000-0000000000${pad(i)}`;

export const UNI_A = "97a00000-0000-4000-8000-00000000000a";
export const UNI_B = "97a00000-0000-4000-8000-00000000000b";
export const UNIS = [UNI_A, UNI_B];
export const UNIVERSITIES = [
  { id: UNI_A, name: "Community Golden University A", slug: "community-golden-a", domain: "comm-a.test" },
  { id: UNI_B, name: "Community Golden University B", slug: "community-golden-b", domain: "comm-b.test" },
];

export const PRIYA = U(1);
export const OSMAN = U(2);
export const MEHR = U(3);
export const SAMI = U(4);
export const NIDA = U(5);
export const TARIQ = U(6);
export const GUL = U(7);
export const ULA = U(8);
export const USERS = [PRIYA, OSMAN, MEHR, SAMI, NIDA, TARIQ, GUL, ULA];

export const UNI_OF: Record<string, string> = { [PRIYA]: UNI_A, [OSMAN]: UNI_A, [MEHR]: UNI_A, [SAMI]: UNI_A, [NIDA]: UNI_A, [TARIQ]: UNI_A, [GUL]: UNI_A, [ULA]: UNI_B };
export const NAME: Record<string, string> = {
  [PRIYA]: "Priya Wren",
  [OSMAN]: "Osman Wren",
  [MEHR]: "Mehr Wren",
  [SAMI]: "Sami Wren",
  [NIDA]: "Nida Wren",
  [TARIQ]: "Tariq Wren",
  [GUL]: "Gul Wren",
  [ULA]: "Ula Finch",
};
export const USERNAME: Record<string, string> = {
  [PRIYA]: "cm_priya",
  [OSMAN]: "cm_osman",
  [MEHR]: "cm_mehr",
  [SAMI]: "cm_sami",
  [NIDA]: "cm_nida",
  [TARIQ]: "cm_tariq",
  [GUL]: "cm_gul",
  [ULA]: "cm_ula",
};
export const EMAIL: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, `${USERNAME[u]!.slice(3)}@${u === ULA ? "comm-b.test" : "comm-a.test"}`]));
export const DEPARTMENT = "Computer Science";
export const BATCH = 2027;
/** Mehr is in Electrical Engineering, batch 2028 (eligibility groups). */
export const DEPARTMENT_OF: Record<string, string> = { [MEHR]: "Electrical Engineering" };
export const BATCH_OF: Record<string, number> = { [MEHR]: 2028 };
export const GRADUATES = [GUL];

export const SOC = "97c00000-0000-4000-8000-000000000001";
export const SOC_SLUG = "wren-robotics";
export const SOC_NAME = "Wren Robotics Society";
export const SOC_KEY = "wren robotics";
export const SOC_ABOUT = "We build small robots and teach first-years to solder.";
export const PENDING = "97c00000-0000-4000-8000-000000000002";
export const PENDING_SLUG = "wren-debating";
export const PENDING_NAME = "Wren Debating Club";
export const PENDING_KEY = "wren debating";
export const PENDING_ABOUT = "Weekly debates on campus and practice for national rounds.";
/** Nida's proof document (society-documents/{user}/{uuid}.pdf). */
export const PROOF = `${NIDA}/97d00000-0000-4000-8000-000000000001.pdf`;
/** Priya's uploads into the society's media folder (logo, an event cover). */
export const LOGO = `${SOC}/97d00000-0000-4000-8000-000000000002.webp`;
export const COVER = `${SOC}/97d00000-0000-4000-8000-000000000003.webp`;
/** A second verified society at A (co-hosting), presided over by Sami. */
export const COHOST = "97c00000-0000-4000-8000-000000000003";
export const COHOST_SLUG = "wren-coders";
export const COHOST_NAME = "Wren Coders";

/** SOC's published free event two days ahead: one session, a ticket type with 2 seats, one required question. */
export const EVENT = "97e00000-0000-4000-8000-000000000001";
export const EVENT_TITLE = "Soldering basics";
export const SESSION = "97e00000-0000-4000-8000-000000000011";
export const TICKET = "97e00000-0000-4000-8000-000000000021";
export const QUESTION = "Have you soldered before?";

type Row = Record<string, unknown>;

/** Values the stack makes at random, recorded as their type (never their value). */
export function typed(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    let s = value
      .replace(/^(SKT1\.[0-9a-f-]{36}\.)[0-9a-f]{24}$/, "$1<hmac>")
      .replace(/SKL-[A-Z0-9]{4}/g, "SKL-<code>")
      .replace(/\b\d{2} [A-Z][a-z]{2} · \d{2}:\d{2}\b/g, "<pkt time>");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = "<date>";
    if (key === "token" && /^[0-9a-f]{24}$/.test(s)) s = "<token>";
    if (key === "code" && /^[A-Z2-9]{6}$/.test(s)) s = "<team code>";
    if (key === "code" && /^[0-9A-F]{8}$/.test(s)) s = "<ticket code>";
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => typed(v, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, typed(v, k)]));
  return value;
}
