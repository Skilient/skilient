"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";
import { TIERS } from "@/lib/recruit/constants";

const uuid = z.uuid();
const skillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label}: at least ${min} characters.`).max(max, `${label}: at most ${max} characters.`);
const tier = z.enum(TIERS);

const competitionSchema = z.object({
  title: text(3, 100, "Title"),
  role: text(2, 80, "Role"),
  skills: z.array(z.object({ skill: skillId, min_level: z.number().int().min(1).max(4) })).min(1, "Add the skills the brief tests.").max(10),
  brief: z.string().trim().min(100, "The brief is at least 100 characters.").max(6000, "Keep the brief under 6,000 characters."),
  briefTemplate: z.string().max(40),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the start date."),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the end date."),
  teamSize: z.number().int().min(1, "Teams are 1 to 3 people.").max(3, "Teams are 1 to 3 people."),
  universities: z.array(uuid).max(50),
  minTier: z.union([tier, z.literal("")]),
  prize: text(3, 300, "Prize"),
  rubric: z
    .array(z.object({ criterion: text(2, 80, "Criterion"), weight: z.number().int().min(1).max(100) }))
    .min(2, "Add 2 to 6 criteria.")
    .max(6, "Add 2 to 6 criteria.")
    .refine((r) => r.reduce((n, c) => n + c.weight, 0) === 100, { message: "The weights must add up to 100." }),
});
export type CompetitionInput = z.input<typeof competitionSchema>;
export async function saveCompetition(id: string | null, input: CompetitionInput): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ id: z.ZodNullable<z.ZodUUID>; v: typeof competitionSchema }>, string>({
    name: "recruit.save_competition", entitlement: "competitions.run",
    unwrap: "v",
    schema: z.object({ id: uuid.nullable(), v: competitionSchema }),
    input: { id, v: input },
    fn: "save_competition",
    args: ({ id: cid, v }) => ({
      p_id: cid,
      p: {
        title: v.title,
        role: v.role,
        skills: v.skills,
        brief: v.brief,
        brief_template: v.briefTemplate,
        starts_on: v.startsOn,
        ends_on: v.endsOn,
        team_size: v.teamSize,
        eligible_universities: v.universities,
        min_tier: v.minTier,
        prize: v.prize,
        rubric: v.rubric,
      },
    }),
    revalidate: ["/recruit/competitions"],
  });
}
export async function submitCompetition(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.submit_competition", schema: uuid, input: id, fn: "submit_competition", args: (v) => ({ p_id: v }), revalidate: ["/recruit/competitions", `/recruit/competitions/${id}`] });
}
export async function scoreTeam(competitionId: string, teamId: string, scores: Record<string, number>, feedback: string): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.score_team",
    schema: z.object({ teamId: uuid, scores: z.record(z.string().max(80), z.number().min(0).max(10)), feedback: z.string().trim().max(2000) }),
    input: { teamId, scores, feedback },
    fn: "score_team",
    args: (v) => ({ p_team: v.teamId, p_scores: v.scores, p_feedback: v.feedback }),
    revalidate: [`/recruit/competitions/${competitionId}`],
  });
}
export async function finishCompetition(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.finish_competition", schema: uuid, input: id, fn: "finish_competition", args: (v) => ({ p_id: v }), revalidate: ["/recruit/competitions", `/recruit/competitions/${id}`] });
}

const teamName = z.string().trim().min(2, "Name your team (2 to 60 characters).").max(60, "Name your team (2 to 60 characters).");
export async function createTeam(competitionId: string, name: string): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ competitionId: z.ZodUUID; name: typeof teamName }>, string>({
    name: "student.create_team",
    schema: z.object({ competitionId: uuid, name: teamName }),
    input: { competitionId, name },
    fn: "create_team",
    args: (v) => ({ p_competition: v.competitionId, p_name: v.name }),
    revalidate: [`/competitions/${competitionId}`],
  });
}
export async function inviteTeamMember(competitionId: string, teamId: string, username: string): Promise<ActionResult> {
  return rpcAction({
    name: "student.invite_team_member",
    schema: z.object({ teamId: uuid, username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Enter a username.") }),
    input: { teamId, username: username.replace(/^@/, "") },
    fn: "invite_team_member",
    args: (v) => ({ p_team: v.teamId, p_username: v.username }),
    revalidate: [`/competitions/${competitionId}`],
  });
}
export async function respondTeamInvite(competitionId: string, teamId: string, accept: boolean): Promise<ActionResult> {
  return rpcAction({
    name: "student.respond_team_invite",
    schema: z.object({ teamId: uuid, accept: z.boolean() }),
    input: { teamId, accept },
    fn: "respond_team_invite",
    args: (v) => ({ p_team: v.teamId, p_accept: v.accept }),
    revalidate: [`/competitions/${competitionId}`, "/opportunities/competitions"],
  });
}
export async function submitRepo(competitionId: string, teamId: string, url: string): Promise<ActionResult> {
  return rpcAction({
    name: "student.submit_repo",
    schema: z.object({ teamId: uuid, url: z.string().trim().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/, "Paste the repository address, like https://github.com/team/project.") }),
    input: { teamId, url },
    fn: "submit_repo",
    args: (v) => ({ p_team: v.teamId, p_url: v.url }),
    revalidate: [`/competitions/${competitionId}`],
  });
}
