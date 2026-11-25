import { ConnectError } from "@connectrpc/connect";
import { refusalCodes, type RefusalKind } from "@skilient/platform";

/**
 * The goldens were recorded on Postgres, where a refusal is a SQLSTATE. The port refuses with a typed
 * kind and the same message. This is the one mapping between the two, used by every replay.
 */
const SQLSTATE: Record<RefusalKind, string> = {
  invalid_input: "22023",
  not_allowed: "42501",
  not_signed_in: "42501",
  not_found: "P0002",
  precondition: "55000",
  conflict: "23505",
  too_many: "54000",
  unavailable: "57P03",
};

export type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };

export async function outcome(run: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof ConnectError) {
      const kind = (Object.entries(refusalCodes) as [RefusalKind, number][]).find(([, c]) => c === error.code)?.[0];
      return { ok: false, code: kind ? SQLSTATE[kind] : String(error.code), message: error.rawMessage };
    }
    throw error;
  }
}
