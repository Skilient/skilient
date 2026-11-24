import "server-only";
import { cache } from "react";
import { DEFAULT_PORTALS, type Portals } from "@/lib/auth/gate";
import { createClient } from "@/lib/supabase/server";

/**
 * Which portals are open (platform_config `portals.enabled`, phase 14). Student pages hide the
 * parts of a closed portal: jobs, contact requests, applications and recruiter visibility with the
 * recruiter portal; job fairs and university record viewers with the university portal.
 * One read per request; a failed read keeps the student-first default (closed).
 */
export const getPortals = cache(async (): Promise<Portals> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portals_state");
  if (error || !data || typeof data !== "object") return DEFAULT_PORTALS;
  const flag = data as Partial<Portals>;
  return {
    recruiter: flag.recruiter === true,
    university: flag.university === true,
    faculty: flag.faculty !== false,
  };
});
