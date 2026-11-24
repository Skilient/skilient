import "server-only";

import type { JobStatus, JobType, Stage, TierKey } from "@/lib/recruit/constants";
import { rpcJson } from "@/lib/data/rpc-json";

// SQL shapes and authorizes these views for the student or the recruiter's organisation.
export interface ApplicationDoc {
  id: string;
  stage: Stage;
  note: string | null;
  applied_at: string;
  reason: string | null;
  job: { id: string; title: string; type: JobType };
  org: { name: string; slug: string };
  history: { stage: Stage; at: string }[];
}

export interface Applicant {
  id: string;
  student_id: string;
  name: string;
  university: string | null;
  department: string | null;
  batch: number | null;
  tier: TierKey | null;
  note: string | null;
  stage: Stage;
  reject_reason: string | null;
  applied_at: string;
  stage_changed_at: string;
  cv_code: string | null;
  skills: { name: string; level: number }[];
}

export interface ApplicantsDoc {
  job: { id: string; title: string; status: JobStatus; type: JobType; openings: number; min_tier: TierKey | null; min_skill_levels: { skill: string; min_level: number }[] };
  applicants: Applicant[];
}

export const getApplication = async (id: string): Promise<ApplicationDoc> => rpcJson<ApplicationDoc>("application_get", { p_id: id });
export const getApplicants = async (jobId: string): Promise<ApplicantsDoc> => rpcJson<ApplicantsDoc>("job_applicants", { p_job: jobId });
