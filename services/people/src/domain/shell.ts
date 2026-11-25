import { z } from "zod";

/**
 * The page shell's cross-service facts (decisions 2026-11-25, advisor, W2 Q1 and Q8). Each key has exactly
 * one producing role; people drops a key from any other producer and any value its schema refuses. Until a
 * producer's workstream exists, its keys are absent and read as 0 or false. docs/azure/people-function-bins.md,
 * "Event contracts", lists the same table for the owners.
 *
 * A `*_label` value may only carry catalogue text that staff curate (skills, paths, tiers); anything a user
 * typed travels as an id and is resolved through its owner's batch read.
 */

/** `badge.count_changed {user_id, key, count}`: absolute counts, newest event wins. */
export const COUNT_KEYS = {
  notifications: "svc_notify", // unread notifications (nav badge)
  chat: "svc_messaging", // unread chat threads (nav badge)
  "ventures.applications": "svc_work", // pending applications to ventures the user owns
  "ventures.invites": "svc_work", // pending venture invites to the user
  "todo.confirm": "svc_work", // teammates' manual contributions waiting for the user's confirmation
  "todo.endorse": "svc_work", // completed ventures where the user has endorsed no one yet
  openings: "svc_market", // new openings since the user last looked (at most 99)
} as const;
export type CountKey = keyof typeof COUNT_KEYS;

/** `milestone.reached` / `milestone.cleared {user_id, key}`. */
export const MILESTONE_KEYS = {
  "github.connected": "svc_work",
  "skills.l2": "svc_work", // a skill at level 2 or more
  "venture.member": "svc_work", // a member of any venture
  "contribution.logged": "svc_work", // logged a contribution that corrects nothing
  "endorsement.received": "svc_work", // an endorsement that is not hidden
  "cv.built": "svc_credentials", // a CV record exists
} as const;
export type MilestoneKey = keyof typeof MILESTONE_KEYS;

const Need = z.object({ key: z.string().regex(/^[a-z_]{1,40}$/), need: z.number(), have: z.number() });

/** `fact.value_changed {user_id, key, value}`: structured values, each with its own schema. */
export const FACT_SCHEMAS = {
  // ranking's next_tier_requirements(user): the next tier and what it still needs.
  "tier.next": {
    owner: "svc_ranking",
    schema: z.object({
      next: z.enum(["raw", "spark", "flare", "shine", "radiant", "luminary"]).nullable(),
      current: z.string().max(20).nullable().optional(),
      needs: z.array(Need).max(20),
    }),
  },
  // The ranking formula's points for the checklist (the same for everyone; published per user for simplicity).
  "tier.points": {
    owner: "svc_ranking",
    schema: z.object({ l2: z.number().nullable(), venture: z.number().nullable(), endorsement: z.number().nullable() }),
  },
  // work's next square on the first path the user follows.
  "paths.next": {
    owner: "svc_work",
    schema: z.object({
      role: z.string().regex(/^[a-z0-9_-]{1,40}$/),
      path_label: z.string().min(1).max(80),
      skill_id: z.string().regex(/^[a-z0-9_.+#-]{1,80}$/),
      skill_label: z.string().min(1).max(80),
    }),
  },
} as const;
export type FactKey = keyof typeof FACT_SCHEMAS;
export type Facts = { [K in FactKey]?: z.infer<(typeof FACT_SCHEMAS)[K]["schema"]> };

/** What the shell reads for one user, from people's own tables and the copies. */
export interface ShellInputs {
  friendRequests: number;
  counts: Partial<Record<CountKey, number>>;
  milestones: ReadonlySet<MilestoneKey>;
  facts: Facts;
  /** bio and avatar both set. */
  profileFinished: boolean;
}

const count = (i: ShellInputs, k: CountKey) => i.counts[k] ?? 0;

/** `nav_badges` */
export function navBadges(i: ShellInputs) {
  return {
    chat: count(i, "chat"),
    notifications: count(i, "notifications"),
    friends: i.friendRequests,
    ventures: count(i, "ventures.applications") + count(i, "ventures.invites"),
    openings: Math.min(99, count(i, "openings")),
  };
}

/** `todo_counts` */
export function todoCounts(i: ShellInputs) {
  const requests = i.friendRequests;
  const applications = count(i, "ventures.applications");
  const invites = count(i, "ventures.invites");
  const confirm = count(i, "todo.confirm");
  const endorse = count(i, "todo.endorse");
  return { total: requests + applications + invites + confirm + endorse, requests, applications, invites, confirm, endorse };
}

export interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  points: number | null;
  note: string | null;
  done: boolean;
}

/** `getting_started` */
export function gettingStarted(i: ShellInputs): { items: ChecklistItem[]; done: number; total: number } {
  const pts = i.facts["tier.points"];
  const items: ChecklistItem[] = [
    { key: "profile", label: "Finish your profile", href: "/settings/profile", points: null, note: null, done: i.profileFinished },
    { key: "github", label: "Connect GitHub", href: "/settings/github", points: null, note: null, done: i.milestones.has("github.connected") },
    { key: "l2", label: "Reach your first L2 skill", href: "/me/skills", points: pts?.l2 ?? null, note: null, done: i.milestones.has("skills.l2") },
    { key: "venture", label: "Join or start a venture", href: "/ventures", points: pts?.venture ?? null, note: "when it completes", done: i.milestones.has("venture.member") },
    {
      key: "endorsement",
      label: "Get your first endorsement",
      href: "/me/work?tab=endorsements",
      points: pts?.endorsement ?? null,
      note: null,
      done: i.milestones.has("endorsement.received"),
    },
    { key: "cv", label: "Build your CV", href: "/me/cv", points: null, note: null, done: i.milestones.has("cv.built") },
  ];
  return { items, done: items.filter((x) => x.done).length, total: items.length };
}

export interface Action {
  key: string;
  title: string;
  body: string;
  href: string;
}

/**
 * Until ranking publishes `tier.next` for a user (W6), people assumes what ranking's
 * next_tier_requirements returns for someone with no score yet: unranked, needing one peer-verified entry
 * (recorded in packages/testing/test/golden/people/shell.json, `inputs.next_tier`).
 */
export const UNRANKED = { next: "raw" as const, needs: [{ key: "peer_verified_entries", need: 1, have: 0 }] };

const initcap = (s: string) => s.toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

/** `next_best_action` (the paths step first, then `next_best_action_base`). */
export function nextBestAction(i: ShellInputs): Action {
  const path = i.facts["paths.next"];
  if (path)
    return {
      key: "path_next",
      title: `Next on your ${path.path_label} path: ${path.skill_label}`,
      body: "Start a proof task for it, or ask a senior through a skill swap.",
      href: `/me/paths?role=${path.role}&skill=${path.skill_id}`,
    };
  const r = i.facts["tier.next"] ?? UNRANKED;
  const next = r.next;
  const first = r.needs[0];
  const target = next == null ? "" : next === "raw" ? "get ranked" : `reach ${initcap(next)}`;
  const pending = todoCounts(i).total;
  if (next == null)
    return { key: "top", title: "You're at the top tier", body: "Keep your momentum up: posting, helping your teams and staying active.", href: "/me/score" };
  if (!first) return { key: "waiting", title: `You meet every requirement to ${target}`, body: "It shows after tonight's ranking run.", href: "/me/score" };
  switch (first.key) {
    case "peer_verified_entries":
      if (!i.milestones.has("venture.member"))
        return { key: "join_venture", title: "Join or start a venture", body: "Verified work starts with a team project. Find one to join or start your own.", href: "/ventures" };
      if (!i.milestones.has("contribution.logged"))
        return { key: "log_contribution", title: "Log your first contribution", body: "Write what you did on your venture, then ask a teammate to confirm it.", href: "/ventures" };
      return { key: "get_confirmed", title: `Get 1 teammate to confirm a contribution to ${target}`, body: "A teammate's confirmation turns your entry into verified work.", href: "/ventures" };
    case "points":
      return { key: "points", title: `Earn ${Math.ceil(first.need - first.have)} more points to ${target}`, body: "See where your points come from and what would add the most.", href: "/me/score" };
    case "active_ventures":
      return { key: "active_ventures", title: `Get a confirmed contribution in ${first.need} ventures`, body: "Log work on each venture and ask a teammate to confirm it.", href: "/ventures" };
    case "counting_endorsements":
      return { key: "endorsements", title: `Get ${first.need} endorsements to ${target}`, body: "Teammates can vouch for your skills from the Team tab of your venture.", href: "/me/work?tab=endorsements" };
    case "completed_ventures":
      return { key: "complete_venture", title: `Complete a venture to ${target}`, body: "Finished ventures count most toward your rank.", href: "/ventures" };
    case "max_level":
      return { key: "skill_level", title: `Reach L${first.need} in a skill`, body: "A merged pull request or a confirmed contribution tagged with the skill gets you there.", href: "/me/skills" };
    default:
      if (pending > 0)
        return { key: "todo", title: `You have ${pending} thing${pending === 1 ? "" : "s"} waiting`, body: "Requests, contributions to confirm and endorsements.", href: "/requests" };
      return { key: "keep_going", title: `Keep building toward ${initcap(next)}`, body: "Your score page shows exactly what is left.", href: "/me/score" };
  }
}
