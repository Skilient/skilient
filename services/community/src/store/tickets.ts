import { eventCode, newSecret, openSecret, payloadMatches, sealSecret, ticketPayload, windowOf } from "../domain/ticket";
import type { Db } from "./db";

/**
 * Ticket signing with the event's sealed secret (src/domain/ticket.ts), under the Key Vault key
 * `community-ticket-key` (tests generate one and pass it through TransportOptions.secrets).
 */
export interface Tickets {
  /** Seals a fresh secret for a new event. */
  seal(eventId: string): Buffer;
  payload(db: Db, eventId: string, registrationId: string, userId: string): Promise<string>;
  matches(db: Db, eventId: string, registrationId: string, userId: string, payload: string): Promise<boolean>;
  /** The self check-in codes valid now (this window and the one before). */
  codes(db: Db, eventId: string, at?: Date): Promise<{ current: string; previous: string; changesAt: Date }>;
}

export function tickets(key: Buffer): Tickets {
  if (key.length !== 32) throw new Error("community-ticket-key must be 32 bytes");
  const secretOf = async (db: Db, eventId: string) => {
    const [r] = await db<{ sealed: Uint8Array }[]>`select sealed from community.event_secrets where event_id = ${eventId}`;
    if (!r) throw new Error("event has no ticket secret");
    return openSecret(key, r.sealed, eventId);
  };
  return {
    seal: (eventId) => sealSecret(key, newSecret(), eventId),
    payload: async (db, eventId, registrationId, userId) => ticketPayload(await secretOf(db, eventId), eventId, registrationId, userId),
    matches: async (db, eventId, registrationId, userId, payload) => payloadMatches(await secretOf(db, eventId), eventId, registrationId, userId, payload),
    codes: async (db, eventId, at = new Date()) => {
      const secret = await secretOf(db, eventId);
      const w = windowOf(at);
      return { current: eventCode(secret, eventId, w), previous: eventCode(secret, eventId, w - 1), changesAt: new Date((w + 1) * 30_000) };
    },
  };
}
