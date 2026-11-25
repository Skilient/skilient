import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  PeopleService,
  RestartTourRequestSchema,
  RestartTourResponseSchema,
  SaveTourRequestSchema,
  SaveTourResponseSchema,
  SeeTipRequestSchema,
  SeeTipResponseSchema,
  SetUiStateRequestSchema,
  SetUiStateResponseSchema,
} from "@skilient/contracts/people/v1/people_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { gettingStarted, nextBestAction, todoCounts } from "../domain/shell";
import { learnState, restartTour, saveTour, seeTip, setUiState } from "../store/learn";
import { getShell, shellInputs } from "../store/shell";
import { meOf, parse, write } from "./util";

const Short = z.string().max(40);

/** The page shell, progress card reads, tours, tips and small UI state. */
export function shellApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const { sql } = deps;
  return {
    async getShell(_req, ctx) {
      const s = await getShell(sql, meOf(ctx));
      return {
        me: {
          userId: s.me.user_id,
          fullName: s.me.full_name,
          username: s.me.username ?? "",
          avatarPath: s.me.avatar_path ?? "",
          universityId: s.me.university_id ?? "",
          universityName: s.me.university_name ?? "",
          role: s.me.role,
          status: s.me.status,
          onboardingComplete: s.me.onboarding_complete,
        },
        tour: s.tour ?? undefined,
        badges: s.badges ?? undefined,
      };
    },
    async todoCounts(_req, ctx) {
      return todoCounts(await shellInputs(sql, meOf(ctx)));
    },
    async nextBestAction(_req, ctx) {
      return nextBestAction(await shellInputs(sql, meOf(ctx)));
    },
    async gettingStarted(_req, ctx) {
      const g = gettingStarted(await shellInputs(sql, meOf(ctx)));
      return {
        items: g.items.map((i) => ({ key: i.key, label: i.label, href: i.href, points: i.points ?? 0, hasPoints: i.points != null, note: i.note ?? "", done: i.done })),
        done: g.done,
        total: g.total,
      };
    },
    async learnState(req, ctx) {
      const tour = parse(Short, req.tour);
      const s = await learnState(sql, meOf(ctx), tour);
      return { ui: s.ui.map((u) => ({ key: u.key, valueJson: JSON.stringify(u.value) })), tipsSeen: s.tips, tour: s.tour };
    },

    async setUiState(req, ctx) {
      const key = parse(Short, req.key);
      const value = parse(z.string().max(1000), req.valueJson);
      return write(deps, ctx, SetUiStateRequestSchema, SetUiStateResponseSchema, req, async (tx) => {
        await setUiState(tx, meOf(ctx), key, value);
        return create(SetUiStateResponseSchema);
      });
    },
    async saveTour(req, ctx) {
      const tour = parse(Short, req.tour);
      const outcome = parse(Short, req.outcome);
      return write(deps, ctx, SaveTourRequestSchema, SaveTourResponseSchema, req, async (tx) => {
        await saveTour(tx, meOf(ctx), tour, req.step, outcome);
        return create(SaveTourResponseSchema);
      });
    },
    async restartTour(req, ctx) {
      const tour = parse(Short, req.tour);
      return write(deps, ctx, RestartTourRequestSchema, RestartTourResponseSchema, req, async (tx) => {
        await restartTour(tx, meOf(ctx), tour);
        return create(RestartTourResponseSchema);
      });
    },
    async seeTip(req, ctx) {
      const tip = parse(Short, req.tip);
      return write(deps, ctx, SeeTipRequestSchema, SeeTipResponseSchema, req, async (tx) => {
        await seeTip(tx, meOf(ctx), tip);
        return create(SeeTipResponseSchema);
      });
    },
  };
}

