import "server-only";

import { cache } from "react";
import type { OrgRole, OrgStatus } from "@/lib/recruit/constants";
import { rpcJson } from "@/lib/data/rpc-json";

export interface MyOrg {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: OrgStatus;
  status_reason: string | null;
  role: OrgRole;
  member_status: "active" | "inactive";
  website: string;
  industry: string;
  size: string;
  city: string;
  about: string | null;
  locations: string[];
  linkedin_url: string | null;
}

/** The signed-in recruiter's organisation, or null when they haven't set one up (or joined). */
export const getMyOrg = cache(async (): Promise<MyOrg | null> => rpcJson<MyOrg | null>("my_org"));

export interface OrgInvite {
  id: string;
  org_name: string;
  role: OrgRole;
  expires_at: string;
}
export const getMyOrgInvites = async (): Promise<OrgInvite[]> => rpcJson<OrgInvite[]>("my_org_invites");

export interface OrgPlan {
  seats_limit: number | null;
  seats_used: number;
  contact_credits_limit: number | null;
  contact_credits_used: number;
  active_posts_limit: number | null;
  entitlements: Record<string, boolean>;
}
export const getOrgPlan = async (): Promise<OrgPlan> => rpcJson<OrgPlan>("org_plan");

export interface OrgMembers {
  seats_limit: number | null;
  seats_used: number;
  members: { user_id: string; name: string; email: string; role: OrgRole; status: "active" | "inactive"; joined_at: string }[];
  invites: { id: string; email: string; role: OrgRole; expires_at: string; state: "pending" | "accepted" | "revoked" | "expired" }[];
}
export const getOrgMembers = async (): Promise<OrgMembers> => rpcJson<OrgMembers>("org_members_list");
