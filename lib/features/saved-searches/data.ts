import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import type { TalentFilters } from "@/lib/recruit/constants";

export interface SavedSearches {
  entitled: boolean;
  items: { id: string; name: string; filters: TalentFilters; frequency: "daily" | "weekly"; last_run_at: string }[];
}
export const getSavedSearches = async (): Promise<SavedSearches> => rpcJson<SavedSearches>("saved_searches_list");
