import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Typed refusals. A handler throws `refuse(kind, reason)`; the client sees the
 * Connect code for the kind and `reason` (a short snake_case code, never user
 * content) as the message and in the `x-refusal` metadata.
 */
export const refusalCodes = {
  invalid_input: Code.InvalidArgument,
  not_signed_in: Code.Unauthenticated,
  not_allowed: Code.PermissionDenied,
  not_found: Code.NotFound,
  conflict: Code.AlreadyExists,
  precondition: Code.FailedPrecondition,
  too_many: Code.ResourceExhausted,
  unavailable: Code.Unavailable,
} as const satisfies Record<string, Code>;

export type RefusalKind = keyof typeof refusalCodes;

/** Keeps the name "ConnectError": ConnectRPC recognises its errors by name (Symbol.hasInstance). */
export class Refusal extends ConnectError {
  constructor(
    readonly kind: RefusalKind,
    readonly reason: string,
  ) {
    super(reason, refusalCodes[kind], { "x-refusal": reason });
  }
}

export function refuse(kind: RefusalKind, reason: string): Refusal {
  return new Refusal(kind, reason);
}

/** The refusal reason a client received, or null for any other error. */
export function refusalReason(error: unknown): string | null {
  if (!(error instanceof ConnectError)) return null;
  return error.metadata.get("x-refusal");
}

/** Throws unless a write touched exactly the expected number of rows. */
export function expectRows(actual: number | bigint, expected: number, reason: string): void {
  if (Number(actual) !== expected) throw refuse("conflict", reason);
}
