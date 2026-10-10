import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import type { JobStatus, JobType, TierKey } from "@/lib/recruit/constants";

export interface JobSummary {
  id: string;
  title: string;
  type: JobType;
  status: JobStatus;
  deadline: string;
  location: string | null;
  remote: boolean;
  created_at: string;
  applicants: number;
  hired: number;
  openings: number;
}
export const getOrgJobs = async (): Promise<{ slots_limit: number | null; jobs: JobSummary[] }> => rpcJson("jobs_for_org");

export interface JobDoc {
  id: string;
  title: string;
  type: JobType;
  location: string | null;
  remote: boolean;
  salary_min: number;
  salary_max: number;
  currency: "PKR" | "USD";
  pay_period: "month" | "year";
  min_tier: TierKey | null;
  min_skill_levels: { skill: string; min_level: number }[];
  openings: number;
  deadline: string;
  description: string;
  status: JobStatus;
}
export const getOrgJob = async (id: string): Promise<JobDoc> => rpcJson<JobDoc>("job_get", { p_id: id });
