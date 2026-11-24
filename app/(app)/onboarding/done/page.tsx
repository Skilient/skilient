import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeActions, WelcomeRoot } from "@/components/onboarding/welcome-controls";
import { WelcomeScene } from "@/components/onboarding/welcome-scene";
import { ClaimCard } from "@/components/record/claim-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import "./welcome.css";

export const metadata: Metadata = { title: "Welcome to Skilient" };

/**
 * Welcome to Skilient (PRD 5.27's "You're in", remade 2026-11-15): where the onboarding wizard
 * ends and the tour begins. The clouds part on the logo, the wordmark and what this place is; then
 * "Start the tour". The getting-started checklist that used to be here lives in Home's progress
 * column. Settings → "Replay welcome" opens it again with `?replay=1`.
 */
export default async function WelcomePage({ searchParams }: PageProps<"/onboarding/done">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  // The tour it leads to is the student one; everyone else goes to their own home.
  if (user.role !== "student") redirect("/feed");
  const supabase = await createClient();
  const [{ data: waiting }, sp] = await Promise.all([supabase.rpc("record_waiting"), searchParams]);
  const entries = typeof waiting === "number" ? waiting : 0;
  return (
    <WelcomeRoot replay={sp.replay === "1"}>
      <WelcomeScene
        firstName={user.fullName.split(/\s+/)[0] ?? null}
        // PRD 5.30: walk-ins a society checked in by this email before they joined. Always mounted:
        // after claiming it keeps saying what was added, though nothing is waiting any more.
        claim={<ClaimCard waiting={entries} />}
        actions={<WelcomeActions delay={5.4} />}
      />
    </WelcomeRoot>
  );
}
