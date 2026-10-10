import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";

export interface ApiSettings {
  entitled: boolean;
  tokens: { id: string; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null }[];
  webhooks: {
    id: string;
    url: string;
    events: string[];
    active: boolean;
    failures: number;
    recent: { event: string; status: string; attempt: number; http: number | null; at: string }[];
  }[];
}
export const getApiSettings = async (): Promise<ApiSettings> => rpcJson<ApiSettings>("api_settings");
