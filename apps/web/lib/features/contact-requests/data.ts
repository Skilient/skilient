import "server-only";

import type { ContactStatus } from "@/lib/recruit/constants";
import { rpcJson } from "@/lib/data/rpc-json";

// The database returns only requests visible to the signed-in student or organisation.
export interface MyContactRequest {
  id: string;
  status: ContactStatus;
  role_title: string;
  message: string;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  closed: boolean;
  thread_id: string | null;
  org: { id: string; name: string; slug: string; industry: string; size: string; city: string; verified: boolean; blocked: boolean };
}

export interface OrgContact {
  id: string;
  status: ContactStatus;
  role_title: string;
  created_at: string;
  decided_at: string | null;
  by_name: string | null;
  student_id: string | null;
  student_name: string | null;
  thread_id: string | null;
}

export const getMyContactRequests = async (): Promise<MyContactRequest[]> => rpcJson<MyContactRequest[]>("my_contact_requests");
export const getOrgContacts = async (): Promise<OrgContact[]> => rpcJson<OrgContact[]>("org_contact_requests");
