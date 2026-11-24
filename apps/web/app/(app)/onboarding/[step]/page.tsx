import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilePreview, type PreviewData } from "@/components/onboarding/profile-preview";
import { WizardFrame } from "@/components/onboarding/wizard-frame";
import { onboardingStepNumber } from "@/lib/auth/gate";
import type { UniversityRef } from "@/lib/auth/email-domain";
import { emailDomain } from "@/lib/auth/email-domain";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getGithubOverview, GITHUB_OUTCOMES } from "@/lib/data/github";
import { getClassmates } from "@/lib/data/profiles";
import { getPortals } from "@/lib/data/portals";
import { githubApp } from "@/lib/github/config";
import { getGithubLogin, getProfileSkills } from "@/lib/data/skills";
import { LOOKING_FOR, type LookingFor } from "@/lib/profile/options";
import { createClient } from "@/lib/supabase/server";
import { GithubStep, LookingForStep, PeopleStep, ProfileStep, SkillsStep, UniversityStep } from "./steps";

export const metadata: Metadata = { title: "Set up your profile" };

/**
 * What each step gives the student, then why it's asked. Rewritten 2026-11-15 from PRD 5.27's
 * table: titles lead with the benefit, and the "why" lines no longer mention recruiters or job
 * fairs while those portals are off (docs/decisions.md).
 */
const STEPS = {
  1: { title: "Join your university", why: "Puts you in your university feed, leaderboards and events." },
  2: { title: "Get recognised by classmates", why: "Your handle and photo are how classmates and teammates find you." },
  3: { title: "Turn your code into proof", why: "Connect GitHub and your code becomes verified skill evidence." },
  4: { title: "See how proof works", why: "Every skill here carries a level and the evidence behind it, from day one." },
  5: { title: "Get matched to what you want", why: "Drives the openings you see first." },
  6: { title: "Find your people", why: "So your feed isn't empty." },
} as const;

export default async function OnboardingStepPage({ params, searchParams }: PageProps<"/onboarding/[step]">) {
  const { step: slug } = await params;
  const query = await searchParams;
  const step = onboardingStepNumber(slug) as keyof typeof STEPS | null;
  if (!step) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("university_id, department, programme, graduation_year, campus, username, bio, looking_for, recruiter_visible")
    .eq("user_id", user.id)
    .single();

  // The profile so far, shown beside every step (and the skills step lists what GitHub found).
  const [githubLogin, skills] = await Promise.all([getGithubLogin(user.id), getProfileSkills(user.id, true).catch(() => [])]);

  let body: React.ReactNode = null;
  if (step === 1) {
    // Universities that own this student's email domain (usually one; a shared domain gives a choice).
    const { data: owners } = await supabase
      .from("university_domains")
      .select("universities!inner(id, name)")
      .eq("domain", emailDomain(user.email) ?? "")
      .in("kind", ["student", "both"]);
    const choices: UniversityRef[] = (owners ?? [])
      .map((o) => ({ id: o.universities.id, name: o.universities.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const current = choices.find((c) => c.id === profile?.university_id) ?? null;
    const { data: own } = await supabase.from("departments").select("name").eq("university_id", current?.id ?? profile?.university_id ?? "").order("name");
    body = (
      <UniversityStep
        university={current}
        choices={choices}
        department={profile?.department ?? null}
        programme={profile?.programme ?? null}
        graduationYear={profile?.graduation_year ?? null}
        campus={profile?.campus ?? null}
        departments={(own ?? []).map((d) => d.name)}
      />
    );
  } else if (step === 2) {
    body = <ProfileStep fullName={user.fullName} username={profile?.username ?? null} bio={profile?.bio ?? null} avatarUrl={user.avatarUrl} />;
  } else if (step === 3) {
    const { account, sync } = await getGithubOverview(user.id, false);
    const outcome = typeof query.github === "string" ? (GITHUB_OUTCOMES[query.github] ?? null) : null;
    body = <GithubStep configured={githubApp() !== null} account={account} sync={sync} outcome={outcome} />;
  } else if (step === 4) {
    body = <SkillsStep skills={skills.slice(0, 12).map((k) => ({ name: k.name, level: k.level }))} githubConnected={githubLogin !== null} />;
  } else if (step === 5) {
    body = (
      <LookingForStep
        lookingFor={(profile?.looking_for ?? []) as LookingFor[]}
        recruiterVisible={profile?.recruiter_visible ?? false}
        recruiterPortal={(await getPortals()).recruiter}
      />
    );
  } else {
    body = <PeopleStep classmates={await getClassmates()} universityName={user.universityName} />;
  }

  const preview: PreviewData = {
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    university: user.universityName,
    department: profile?.department ?? null,
    programme: profile?.programme ?? null,
    graduationYear: profile?.graduation_year ?? null,
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
    githubLogin,
    skills: skills.slice(0, 6).map((k) => ({ name: k.name, level: k.level })),
    lookingFor: LOOKING_FOR.filter((o) => ((profile?.looking_for ?? []) as LookingFor[]).includes(o.value)).map((o) => o.label),
  };

  return (
    <WizardFrame step={step} title={STEPS[step].title} why={STEPS[step].why} preview={<ProfilePreview data={preview} />}>
      {body}
    </WizardFrame>
  );
}
