import { randomBytes, randomInt } from "node:crypto";

/**
 * `society_name_key`: "CS Society", "The CS Club" and "cs  society!" are the same name at one university.
 * Lower case, anything but a-z, 0-9 and spaces becomes a space, runs of spaces collapse, then a leading "the "
 * and trailing "society", "club" or "soc" words go.
 */
export function nameKey(name: string | null | undefined): string {
  const s = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.replace(/^(the )|( (society|club|soc))+$/g, "").trim();
}

/** `society_slug`'s base: lower case, runs of other characters become "-", trimmed, 50 at most ("society" if shorter than 3). */
export function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base.length < 3 ? "society" : base;
}

/** The slug with a random 4-hex suffix, when the base is taken. */
export const slugVariant = (base: string) => `${base}-${randomBytes(2).toString("hex")}`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (n: number) => Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** `new_team_code`: 6 characters without look-alikes. */
export const teamCode = () => code(6);
/** A payment's reference code, SKL-XXXX. */
export const referenceCode = () => `SKL-${code(4)}`;

/** A ticket's short code on the page: the first 8 hex digits of the registration id, upper case. */
export const ticketCode = (registrationId: string) => registrationId.replace(/-/g, "").slice(0, 8).toUpperCase();

/** "28 Nov · 14:00" in Pakistan time (to_char(... at time zone 'Asia/Karachi', 'DD Mon · HH24:MI')). */
export function pktShort(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts["day"]} ${parts["month"]} · ${parts["hour"]}:${parts["minute"]}`;
}
