import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { LiveAt } from "@/components/marketing/live-at";
import { Faq } from "@/components/marketing/sections/faq";
import { ForOrgs } from "@/components/marketing/sections/for-orgs";
import { PricingTeaser } from "@/components/marketing/sections/pricing-teaser";
import { StoryChapters } from "@/components/marketing/story/chapters";
import { Climb } from "@/components/marketing/story/climb";
import { Finale } from "@/components/marketing/story/finale";
import { Prologue } from "@/components/marketing/story/prologue";
import { Rules } from "@/components/marketing/story/rules";
import { StorySignedFound } from "@/components/marketing/story/signed-found";
import type { InitialEmailState } from "@/components/marketing/uni-email-field";
import { hero } from "@/content/marketing";
import { getLandingStats, getPublicPlans, getViewer } from "@/lib/data/marketing";
import { turnstileSiteKey } from "@/lib/security/turnstile";

export const metadata: Metadata = {
  title: { absolute: "Skilient: prove your skills with real work" },
  description: hero.subline,
  alternates: { canonical: "/" },
};

/**
 * The landing page (PRD 5.1, decisions 2026-10-31): one story told as you scroll. The hero's proof
 * objects, a prologue on the problem, Ayesha's seven chapters (the record pins and fills on large
 * screens), the rules, the invitation in the reader's voice, then a calm epilogue for
 * organisations, pricing and questions. `?email` and `?state` come back from /join when the field
 * was sent without JavaScript.
 */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [viewer, stats, plans, sp] = await Promise.all([getViewer(), getLandingStats(), getPublicPlans(), searchParams]);
  const email = typeof sp.email === "string" ? sp.email.trim().slice(0, 254) : "";
  const state: InitialEmailState = sp.state === "personal" || sp.state === "invalid" ? sp.state : null;
  const home = viewer?.home ?? null;
  const siteKey = turnstileSiteKey();
  return (
    <>
      <Hero home={home} siteKey={siteKey} defaultEmail={email} initialState={state} />
      <LiveAt stats={stats} />
      <Prologue />
      <StoryChapters />
      <Climb />
      <StorySignedFound />
      <Rules />
      <Finale home={home} siteKey={siteKey} />
      <ForOrgs />
      <PricingTeaser plans={plans} />
      <Faq />
    </>
  );
}
