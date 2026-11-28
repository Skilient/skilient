/**
 * The notify golden world as data, so the same facts are built twice: on the current stack by
 * packages/testing/test/notify.golden.test.ts (rows in its tables, the stack's functions and triggers) and in
 * notify's own schema by services/notify/test/golden (the owners' events and batch reads). Ids are fixed and
 * RFC 4122 (version 4 bits); domains end in `.test`; names are distinctive and nobody's.
 *
 * Two universities. At A: Amna (who posts), Bilal, Chen and Eman; Dua studies at B and keeps her profile to her
 * university, so Amna sees her name but not her username or photo. Every student is onboarded.
 *
 * Push keys and endpoints here are shapes only (never a real subscription): the recorder needs values the stack's
 * checks accept, the replays the same.
 */
const pad = (i: number, n = 2) => String(i).padStart(n, "0");
const U = (i: number) => `99b00000-0000-4000-8000-0000000000${pad(i)}`;

export const UNI_A = "99a00000-0000-4000-8000-00000000000a";
export const UNI_B = "99a00000-0000-4000-8000-00000000000b";
export const UNIVERSITIES = [
  { id: UNI_A, name: "Notify Golden University A", slug: "notify-golden-a", domain: "notify-a.test" },
  { id: UNI_B, name: "Notify Golden University B", slug: "notify-golden-b", domain: "notify-b.test" },
];

export const AMNA = U(1);
export const BILAL = U(2);
export const CHEN = U(3);
export const DUA = U(4);
export const EMAN = U(5);
export const USERS = [AMNA, BILAL, CHEN, DUA, EMAN];

export const UNI_OF: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, u === DUA ? UNI_B : UNI_A]));
export const NAME: Record<string, string> = {
  [AMNA]: "Amna Plover",
  [BILAL]: "Bilal Plover",
  [CHEN]: "Chen Plover",
  [DUA]: "Dua Lapwing",
  [EMAN]: "Eman Plover",
};
export const USERNAME: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, `nt_${NAME[u]!.split(" ")[0]!.toLowerCase()}`]));
export const EMAIL: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, `${USERNAME[u]!.slice(3)}@${u === DUA ? "notify-b.test" : "notify-a.test"}`]));
/** Dua shows her profile to her own university only; everyone else is global. */
export const VISIBILITY: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, u === DUA ? "university" : "global"]));
export const AVATAR: Record<string, string> = Object.fromEntries(USERS.map((u) => [u, `${u}/99d00000-0000-4000-8000-0000000000${pad(USERS.indexOf(u) + 1)}.webp`]));

export const POST = "99c00000-0000-4000-8000-000000000001";
export const POST_BODY = "Our plover census starts at dawn on Saturday: bring binoculars.";
/** Chen's comment mentions Bilal (who can see the post). */
export const COMMENT_BODY = "Count me in, and @nt_bilal is bringing the spare tripod for the long lens.";

/** Push subscription shapes the stack's checks accept (not a real device). */
export const ENDPOINT = "https://fcm.googleapis.com/fcm/send/notify-golden-endpoint-0001";
export const ENDPOINT_BAD = "https://push.example.test/notify-golden";
export const P256DH = "B" + "A".repeat(86);
export const AUTH = "notifygoldenauth1234";
export const USER_AGENT = "Golden Browser 1.0";

/**
 * Moves notices made in the same transaction apart (the recorder and the replays alike): oldest first in the
 * order of this list of (user, type, actor), a minute apart, so ordering never depends on ties.
 */
export const ORDER: [string, string, string][] = [
  [AMNA, "friend_request", BILAL],
  [BILAL, "friend_accepted", AMNA],
  [AMNA, "comment_received", CHEN],
  [BILAL, "comment_mention", CHEN],
  [AMNA, "friend_request", DUA],
];

/** SQL that moves the notices apart, for a table with user_id, type, actor_id and created_at. */
export const apartSql = (table: string) =>
  ORDER.map(([u, t, a], i) => `update ${table} set created_at = now() - interval '${ORDER.length - i} minutes' where user_id = '${u}' and type = '${t}' and actor_id = '${a}';`).join("\n");
