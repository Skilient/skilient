/**
 * Golden replay: github.json, identity's half. `work` owns the GitHub account, tokens, installations, tickets
 * and the link result ("linked", "clash", ...); identity records the security event when work tells it a link
 * or unlink happened. The cases where work refuses (expired ticket, clash, other account, not linked) never
 * reach identity, so their identity half is empty and is checked as such.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordGithubEvent } from "../../src/store/github";
import { call, PEER, startWorld, step, STUDENT, type Tx } from "./replay";
import { identityHalf, replayHalf } from "./staff-half";

type Case = Record<string, { changes?: unknown } | unknown>;
/** identity's half of each named case: its changes to identity's tables (work's result is work's). */
const changesOnly = (names: string[]) => (recordedCase: unknown) =>
  Object.fromEntries(names.map((n) => [n, { changes: (identityHalf((recordedCase as Case)[n]) as { changes: unknown }).changes }]));

const connected = (userId: string, login: string) => (sp: Tx) => recordGithubEvent(sp, { userId, login, kind: "github_connected" });
const disconnected = (userId: string, login: string) => (sp: Tx) => recordGithubEvent(sp, { userId, login, kind: "github_disconnected" });
const changes = async (tx: Tx, run: (sp: Tx) => unknown) => ({ changes: (await step(tx, run)).changes });
const nothing = async (tx: Tx) => ({ changes: (await step(tx, () => undefined)).changes });

describe("github.json (identity's half)", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("complete_github_link", () =>
    replayHalf(
      sql,
      "github",
      "complete_github_link",
      async (tx) => ({
        linked: await changes(tx, connected(STUDENT, "golden-octo")),
        ticket_used_again: await nothing(tx),
        ticket_expired: await nothing(tx),
        ticket_unknown: await nothing(tx),
        clash_with_another_account: await nothing(tx),
      }),
      changesOnly(["linked", "ticket_used_again", "ticket_expired", "ticket_unknown", "clash_with_another_account"]),
    ));

  it("complete_github_link: relink and other account", () =>
    replayHalf(
      sql,
      "github",
      "complete_github_link_relink",
      async (tx) => {
        await connected(STUDENT, "golden-octo")(tx);
        return {
          same_github_account_new_login: await changes(tx, connected(STUDENT, "golden-octo-renamed")),
          different_github_account: await nothing(tx),
        };
      },
      changesOnly(["same_github_account_new_login", "different_github_account"]),
    ));

  it("disconnect_github", () =>
    replayHalf(
      sql,
      "github",
      "disconnect_github",
      async (tx) => {
        await connected(STUDENT, "golden-octo")(tx);
        return {
          disconnected: await changes(tx, disconnected(STUDENT, "golden-octo")),
          not_linked: await nothing(tx),
        };
      },
      changesOnly(["disconnected", "not_linked"]),
    ));

  it("refuses an unknown account and a malformed login", async () => {
    await sql
      .begin(async (tx) => {
        expect(await call(tx, connected("9b000000-0000-4000-8000-0000000000ff", "golden-octo"))).toEqual({ ok: false, code: "P0002", message: "account not found" });
        expect(await call(tx, connected(PEER, "-bad-"))).toEqual({ ok: false, code: "22023", message: "invalid GitHub login" });
        throw new Error("rollback");
      })
      .catch((e: unknown) => {
        if (!(e instanceof Error && e.message === "rollback")) throw e;
      });
  });
});
