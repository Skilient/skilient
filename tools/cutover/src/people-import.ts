import { z } from "zod";

/**
 * Cutover, people's part (W14 obligations): parse the Supabase exports of universities, university_domains,
 * departments, programmes, profiles and onboarding_state (one JSON object per line, columns as Supabase
 * stores them), and the user ids with their emails (from auth.users, for each profile's email domain). The
 * writes are people's (`@skilient/people/store/import`), which also send the events identity's gate needs.
 *
 * Order of the whole cutover import (identity keeps profile facts only for accounts it knows):
 *   1. identity: users and password hashes, TOTP factors, Google identities, personal email domains, sanctions;
 *   2. people: universities (with domains, departments, programmes), then profiles and onboarding state;
 *   3. run identity's gate consumer until it has caught up, then compare the gate copies with people's rows.
 */
export { importProfiles, importUniversities } from "@skilient/people/store/import";

const Row = z.record(z.string(), z.unknown());
const WithUser = Row.and(z.object({ user_id: z.uuid() }));
const WithId = Row.and(z.object({ id: z.uuid() }));
const Email = z.object({ user_id: z.uuid(), email: z.string().min(3) });

function parseLines<T>(jsonl: string, schema: z.ZodType<T>, what: string): T[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${what} line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      return parsed.data;
    });
}

export const parseUniversities = (jsonl: string) => parseLines(jsonl, WithId, "universities");
export const parseDomains = (jsonl: string) => parseLines(jsonl, Row.and(z.object({ university_id: z.uuid(), domain: z.string().min(3) })), "university_domains");
export const parseDepartments = (jsonl: string) => parseLines(jsonl, WithId, "departments");
export const parseProgrammes = (jsonl: string) => parseLines(jsonl, WithId, "programmes");
export const parseProfiles = (jsonl: string) => parseLines(jsonl, WithUser, "profiles");
export const parseOnboarding = (jsonl: string) => parseLines(jsonl, WithUser, "onboarding_state");
export const parseEmails = (jsonl: string) => parseLines(jsonl, Email, "auth.users emails");
