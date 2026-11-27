/**
 * Names are people's (CLAUDE.md, "Never": community keeps ids only). Community's page documents are built in SQL
 * with placeholders where the stack joined profiles and universities: `$name:<user>`, `$username:<user>`,
 * `$avatar:<user>`, `$department:<user>`, `$batch:<user>` and `$university:<university>`, alone or inside a
 * string ("For students at $university:<id> only."). The handler fills them from people's ProfileCards and
 * ListUniversities in one batch call each (`fill`); the golden replays fill them from the fixture. A placeholder
 * that stands alone becomes the value (a number for a batch; null when people has no such person); one inside a
 * string becomes its text ("" when unknown).
 */
export interface PersonFacts {
  name: string | null;
  username: string | null;
  avatar_path: string | null;
  department: string | null;
  batch: number | null;
}

export interface Lookup {
  person(id: string): PersonFacts | undefined;
  university(id: string): string | undefined;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ONE = new RegExp(`^\\$(name|username|avatar|department|batch|university):(${UUID})$`);
const ANY = new RegExp(`\\$(name|username|avatar|department|batch|university):(${UUID})`, "g");

export const ph = {
  name: (id: string | null) => (id ? `$name:${id}` : null),
};

/** The user and university ids a document asks for. */
export function wanted(doc: unknown): { users: string[]; universities: string[] } {
  const users = new Set<string>();
  const universities = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      for (const m of v.matchAll(ANY)) (m[1] === "university" ? universities : users).add(m[2]!);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(doc);
  return { users: [...users], universities: [...universities] };
}

function value(kind: string, id: string, lookup: Lookup): string | number | null {
  if (kind === "university") return lookup.university(id) ?? null;
  const p = lookup.person(id);
  if (!p) return null;
  switch (kind) {
    case "name":
      return p.name;
    case "username":
      return p.username;
    case "avatar":
      return p.avatar_path;
    case "department":
      return p.department;
    default:
      return p.batch;
  }
}

/** Fills every placeholder in a document. */
export function fill<T>(doc: T, lookup: Lookup): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const one = ONE.exec(v);
      if (one) return value(one[1]!, one[2]!, lookup);
      return v.includes("$") ? v.replace(ANY, (_m, kind: string, id: string) => String(value(kind, id, lookup) ?? "")) : v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(doc) as T;
}
