import "server-only";

import type { JobStatus, JobType, Stage, TierKey } from "@/lib/recruit/constants";
import { rpcJson } from "@/lib/data/rpc-json";

export interface PublicJob {
  id: string;
  title: string;
  type: JobType;
  location: string | null;
  remote: boolean;
  salary_min: number;
  salary_max: number;
  currency: "PKR" | "USD";
  pay_period: "month" | "year";
  openings: number;
  deadline: string;
  description: string;
  status: JobStatus;
  min_tier: TierKey | null;
  requirements: { name: string; min_level: number }[];
  unmet: string[];
  org: { id: string; name: string; slug: string; city: string };
  application: { id: string; stage: Stage } | null;
  invited: boolean;
}
export const getPublicJob = async (id: string): Promise<PublicJob> => rpcJson<PublicJob>("job_public", { p_id: id });

export interface CompanyPage {
  id: string;
  slug: string;
  name: string;
  about: string | null;
  website: string;
  industry: string;
  size: string;
  city: string;
  locations: string[];
  status: string;
  is_member: boolean;
  blocked: boolean;
  roles: { id: string; title: string; type: JobType; location: string | null; remote: boolean; deadline: string }[];
}
export const getCompanyPage = async (slug: string): Promise<CompanyPage> => rpcJson<CompanyPage>("company_page", { p_slug: slug });
