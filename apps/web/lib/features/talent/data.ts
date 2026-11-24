import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { rpcJson } from "@/lib/data/rpc-json";
import type { OrgPlan } from "@/lib/features/organizations/data";
import type { ContactStatus, TalentFilters, TierKey } from "@/lib/recruit/constants";
import { createClient } from "@/lib/supabase/server";

export interface TalentSkill {
  name: string;
  level: number;
  code_check: boolean;
  /** Mostly written with an AI coding agent (decisions 2026-10-03); absent in older index rows. */
  ai_assisted?: boolean;
}
export interface TalentRow {
  /** Present only in full results. */
  id?: string;
  name?: string;
  username?: string | null;
  avatar_path?: string | null;
  contacted?: boolean;
  tier: TierKey | null;
  skills: TalentSkill[];
  university: string;
  department: string | null;
  batch: number | null;
  activity: string;
  why: string;
}
export interface TalentPage {
  total: number;
  results: TalentRow[];
  full_access: boolean;
}

export const exploreTalent = async (filters: TalentFilters, offset = 0): Promise<TalentPage> =>
  rpcJson<TalentPage>("talent_explore", { p_filters: filters, p_offset: offset });
export const searchTalent = async (filters: TalentFilters, offset = 0): Promise<TalentPage> =>
  rpcJson<TalentPage>("search_talent", { p_filters: filters, p_offset: offset });

export interface TalentFacets {
  universities: { id: string; name: string }[];
  departments: string[];
  skills: { id: string; name: string }[];
}
export const getTalentFacets = cache(async (): Promise<TalentFacets> => rpcJson<TalentFacets>("talent_facets"));

export interface Candidate {
  access: "search" | "contact" | "application";
  person: {
    id: string;
    name: string;
    username: string | null;
    avatar_path: string | null;
    university: string;
    department: string | null;
    batch: number | null;
    looking_for: string[];
    availability: string[];
    city: string | null;
    remote_ok: boolean;
    status: string;
  };
  cv: import("@/lib/cv/types").CvSnapshotV1 | null;
  verify_code: string | null;
  tier: TierKey | null;
  last_contact: {
    status: ContactStatus;
    role_title: string;
    at: string;
    by_name: string | null;
    retry_after: string | null;
    thread_id: string | null;
  } | null;
  shortlists: { id: string; name: string }[];
}
export const getCandidate = async (id: string): Promise<Candidate> => rpcJson<Candidate>("recruit_candidate", { p_student: id });

export interface ActivityItem {
  kind: "viewed" | "contact_sent" | "shortlisted" | "noted" | "invited_to_apply" | "hired";
  at: string;
  actor: string | null;
  student_id: string | null;
  student_name: string | null;
}
export const getOrgActivity = async (): Promise<ActivityItem[]> => rpcJson<ActivityItem[]>("org_activity", { p_limit: 30 });

export interface Analytics {
  locked: boolean;
  days?: number;
  plan: OrgPlan;
  funnel?: { views: number; contacts: number; accepted: number; applied: number; hired: number };
  median_first_response_hours?: number | null;
  median_days_to_hire?: number | null;
  skills_demand?: { skill: string; searches: number }[];
}
export const getAnalytics = async (days: number): Promise<Analytics> => rpcJson<Analytics>("org_analytics", { p_days: days });

/** On /verify/[code]: the candidate's id when the signed-in recruiter's organisation may open them. */
export async function getCandidateForCode(code: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.role !== "recruiter") return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("recruit_candidate_for_code", { p_code: code });
  return typeof data === "string" ? data : null;
}
