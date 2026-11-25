/**
 * Display names come from `people`, through its batch method (decision 2026-11-25, Q1: `ops_staff` gets names
 * from people). `people` is built in W2, so identity reaches it through this port: tests pass a fake, and
 * until people's contract exists the service uses `noPeopleNames`, which knows no names (the list then
 * sorts by email). One call per list, never one per user (CLAUDE.md, "Never": no call inside a loop).
 */
export interface PeopleNames {
  /** Full names for many users in one call; a user people does not know is missing from the map. */
  namesOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

export const noPeopleNames: PeopleNames = {
  async namesOf() {
    return new Map();
  },
};

/** A fixed map, for tests. */
export function fakePeopleNames(names: Record<string, string>): PeopleNames {
  return {
    async namesOf(userIds) {
      return new Map(userIds.filter((id) => id in names).map((id) => [id, names[id]!]));
    },
  };
}
