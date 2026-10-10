import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import type { TierKey } from "@/lib/recruit/constants";

export interface Note {
  id: string;
  body: string;
  created_at: string;
  author: string | null;
  mine: boolean;
}
export const getNotes = async (studentId: string): Promise<Note[]> => rpcJson<Note[]>("notes_for", { p_student: studentId });

export interface ShortlistSummary {
  id: string;
  name: string;
  count: number;
  created_at: string;
}
export const getShortlists = async (): Promise<ShortlistSummary[]> => rpcJson<ShortlistSummary[]>("shortlists_list");

export interface ShortlistItem {
  id: string;
  visible: boolean;
  student_id: string | null;
  name: string | null;
  university: string | null;
  department: string | null;
  tier: TierKey | null;
  notes: number | null;
  added_by: string | null;
  added_at: string;
}
export const getShortlist = async (id: string): Promise<{ id: string; name: string; items: ShortlistItem[] }> =>
  rpcJson("shortlist_get", { p_list: id });
