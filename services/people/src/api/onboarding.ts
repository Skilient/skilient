import { create, type DescMessage, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  CompleteOnboardingRequestSchema,
  CompleteOnboardingResponseSchema,
  PeopleService,
  SaveGithubStepRequestSchema,
  SaveGithubStepResponseSchema,
  SaveLookingForStepRequestSchema,
  SaveLookingForStepResponseSchema,
  SaveProfileStepRequestSchema,
  SaveProfileStepResponseSchema,
  SaveSkillsStepRequestSchema,
  SaveSkillsStepResponseSchema,
  SaveUniversityStepRequestSchema,
  SaveUniversityStepResponseSchema,
  SetMyUniversityRequestSchema,
  SetMyUniversityResponseSchema,
} from "@skilient/contracts/people/v1/people_pb";
import type postgres from "postgres";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import {
  classmates,
  completeOnboarding,
  departmentOptions,
  getOnboarding,
  saveGithubStep,
  saveLookingForStep,
  saveProfileStep,
  saveSkillsStep,
  saveUniversityStep,
  setMyUniversity,
} from "../store/onboarding";
import { myProfileMessage } from "./profiles";
import { meOf, parse, text, write } from "./util";

/** The onboarding wizard (PRD 5.27); the step forms' validation is apps/web lib/profile/schema.ts, ported. */
const Department = z.string().trim().min(2).max(80);
const Programme = z.string().trim().max(80);
const Campus = z.string().trim().max(60);
const Year = z.number().int().min(1980).max(2100);
const Bio = z.string().trim().max(280);

export function onboardingApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const { sql } = deps;
  const step = <I extends DescMessage, O extends DescMessage>(ctx: HandlerContext, input: I, output: O, req: MessageShape<I>, run: (tx: postgres.TransactionSql) => Promise<number>) =>
    write(deps, ctx, input, output, req, async (tx) => create(output, { nextStep: await run(tx) } as never));
  return {
    async getOnboarding(_req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const o = await getOnboarding(sql, me);
      return {
        step: o.step,
        dataJson: JSON.stringify(o.data),
        completed: o.completed,
        profile: myProfileMessage(o.profile),
        universities: o.universities,
        ownList: o.own_list,
        departments: o.departments,
      };
    },

    async departmentOptions(_req, ctx) {
      const v = await departmentOptions(sql, meOf(ctx));
      return { ownList: v?.own_list ?? false, departmentId: v?.department_id ?? "", departments: v?.departments ?? [] };
    },

    async classmates(req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const rows = await classmates(sql, me, req.limit);
      return {
        people: rows.map((r) => ({ userId: r.user_id, username: r.username, fullName: r.full_name, avatarPath: r.avatar_path ?? "", department: r.department ?? "", graduationYear: r.graduation_year ?? 0 })),
      };
    },

    async setMyUniversity(req, ctx) {
      const id = parse(z.uuid(), req.universityId);
      return write(deps, ctx, SetMyUniversityRequestSchema, SetMyUniversityResponseSchema, req, async (tx) =>
        create(SetMyUniversityResponseSchema, { set: await setMyUniversity(tx, meOf(ctx), id) }),
      );
    },

    async saveUniversityStep(req, ctx) {
      const r = parse(
        z.object({ universityId: z.union([z.uuid(), z.literal("")]), department: Department, programme: Programme, graduationYear: Year, campus: Campus }),
        req,
      );
      return step(ctx, SaveUniversityStepRequestSchema, SaveUniversityStepResponseSchema, req, (tx) =>
        saveUniversityStep(tx, meOf(ctx), {
          universityId: r.universityId || null,
          department: r.department,
          programme: text(r.programme),
          graduationYear: r.graduationYear,
          campus: text(r.campus),
        }),
      );
    },

    async saveProfileStep(req, ctx) {
      const r = parse(z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/), bio: Bio }), req);
      return step(ctx, SaveProfileStepRequestSchema, SaveProfileStepResponseSchema, req, (tx) => saveProfileStep(tx, meOf(ctx), { username: r.username, bio: text(r.bio) }));
    },

    async saveGithubStep(req, ctx) {
      const choice = parse(z.string().max(20), req.choice);
      return step(ctx, SaveGithubStepRequestSchema, SaveGithubStepResponseSchema, req, (tx) => saveGithubStep(tx, meOf(ctx), choice));
    },

    async saveSkillsStep(req, ctx) {
      return step(ctx, SaveSkillsStepRequestSchema, SaveSkillsStepResponseSchema, req, (tx) => saveSkillsStep(tx, meOf(ctx)));
    },

    async saveLookingForStep(req, ctx) {
      const r = parse(z.object({ lookingFor: z.array(z.enum(["internship", "job", "teammates", "project", "mentorship"])).max(5), recruiterVisible: z.boolean() }), req);
      return step(ctx, SaveLookingForStepRequestSchema, SaveLookingForStepResponseSchema, req, (tx) =>
        saveLookingForStep(tx, meOf(ctx), { lookingFor: [...new Set(r.lookingFor)], recruiterVisible: r.recruiterVisible }),
      );
    },

    async completeOnboarding(req, ctx) {
      return write(deps, ctx, CompleteOnboardingRequestSchema, CompleteOnboardingResponseSchema, req, async (tx) =>
        create(CompleteOnboardingResponseSchema, { completed: await completeOnboarding(tx, meOf(ctx)) }),
      );
    },
  };
}

