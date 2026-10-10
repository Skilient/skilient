import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";

export interface HireRow {
  id: string;
  hired_at: string;
  kind: "intern" | "full_time";
  job_title: string | null;
  student_name: string | null;
  asked: boolean;
  answer: "yes" | "partly" | "no" | "left" | null;
  answered_at: string | null;
  due: boolean;
}
export const getHires = async (): Promise<HireRow[]> => rpcJson<HireRow[]>("hires_list");
