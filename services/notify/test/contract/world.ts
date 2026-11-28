/**
 * The contract world for notify and media: credentials' world (identity, people, content, messaging, realtime, work,
 * ranking, community and credentials, each under its own role) plus media's schema with its in-memory store and the
 * file checks on (media's test/world.ts) and notify's schema with the VAPID keys made for the run
 * (test/world.ts). Background work is off: `drain` runs everyone's consumers, notify's and media's, and the cleanup.
 */
import { createClientFactory } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import { credentialsWorld, drain as drainCredentials, type CredentialsWorld } from "../../../credentials/test/contract/world";
import { settleMedia, withMedia, type MediaParts } from "../../../media/test/world";
import { settleNotify, withNotify, type NotifyParts } from "../world";

export { NU, NUTECH, stopWorlds, student } from "../../../credentials/test/contract/world";

export interface NotifyWorld extends CredentialsWorld, MediaParts, NotifyParts {}
type Host = { clientsFor(caller: string): ReturnType<typeof createClientFactory> };

export function notifyWorld(onWorld: (w: NotifyWorld) => void, worlds: NotifyWorld[] = []): () => Promise<TransportOptions> {
  let base: CredentialsWorld | undefined;
  let media: MediaParts | undefined;
  let notify: NotifyParts | undefined;
  const start = withNotify(
    withMedia(
      credentialsWorld((w) => (base = w), []),
      () => base!,
      (p) => (media = p),
    ),
    () => base!,
    (p) => (notify = p),
  );
  return async () => {
    const o = await start();
    const w: NotifyWorld = { ...base!, ...media!, ...notify! };
    worlds.push(w);
    onWorld(w);
    return o;
  };
}

/** Everyone's consumers, then notify's and media's (with the cleanup), then everyone's again (badges reach people). */
export async function drain(w: NotifyWorld, host: Host): Promise<void> {
  await drainCredentials(w, host);
  await settleNotify(w, host);
  await settleMedia(w);
  await drainCredentials(w, host);
}
