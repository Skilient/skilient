import "server-only";

import type { CompetitionStatus, TierKey } from "@/lib/recruit/constants";
import { rpcJson } from "@/lib/data/rpc-json";

export interface CompetitionSummary {
  id: string;
  title: string;
  status: CompetitionStatus;
  starts_at: string;
  ends_at: string;
  teams: number;
  review_note: string | null;
}
export const getOrgCompetitions = async (): Promise<{ entitled: boolean; items: CompetitionSummary[] }> => rpcJson("competitions_for_org");

export interface CompetitionManage {
  competition: {
    id: string;
    title: string;
    role: string;
    skills: { skill: string; min_level: number }[];
    brief: string;
    starts_at: string;
    ends_at: string;
    team_size: number;
    min_tier: TierKey | null;
    prize: string;
    rubric: { criterion: string; weight: number }[];
    status: CompetitionStatus;
    review_note: string | null;
    eligible_universities: string[];
  };
  teams: {
    id: string;
    name: string;
    repo_url: string | null;
    submitted_at: string | null;
    frozen_sha: string | null;
    frozen_note: string | null;
    scores: Record<string, number> | null;
    total: number | null;
    feedback: string | null;
    placement: number | null;
    members: string[];
  }[];
}
export const getCompetitionManage = async (id: string): Promise<CompetitionManage> => rpcJson<CompetitionManage>("competition_manage", { p_id: id });

export interface PublicCompetition {
  id: string;
  title: string;
  role: string;
  brief: string;
  status: CompetitionStatus;
  prize: string;
  starts_at: string;
  ends_at: string;
  team_size: number;
  min_tier: TierKey | null;
  rubric: { criterion: string; weight: number }[];
  eligible: boolean;
  unmet: string[];
  skills: string[];
  org: { name: string; slug: string };
  team: {
    id: string;
    name: string;
    is_lead: boolean;
    repo_url: string | null;
    submitted_at: string | null;
    frozen_sha: string | null;
    total: number | null;
    placement: number | null;
    feedback: string | null;
    my_status: "invited" | "joined";
    members: { name: string; status: "invited" | "joined" }[];
  } | null;
}
export const getPublicCompetition = async (id: string): Promise<PublicCompetition> => rpcJson<PublicCompetition>("competition_public", { p_id: id });
