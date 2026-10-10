import "server-only";

import { cache } from "react";
import { rpcJson } from "@/lib/data/rpc-json";

export const getBlockedCompanies = cache(async (): Promise<{ id: string; name: string; slug: string }[]> => rpcJson("my_blocked_companies"));

export interface ProfileViewers {
  companies_30d: number;
  views_30d: number;
  names_visible: boolean;
  companies: { id: string; name: string; slug: string; last_at: string }[] | null;
}
export const getProfileViewers = async (): Promise<ProfileViewers> => rpcJson<ProfileViewers>("my_profile_viewers");

export interface RecruiterPrefs {
  availability: string[];
  city: string | null;
  remote_ok: boolean;
  recruiter_visible: boolean;
  looking_for: string[];
}
export const getRecruiterPrefs = async (): Promise<RecruiterPrefs> => rpcJson<RecruiterPrefs>("my_recruiter_prefs");
