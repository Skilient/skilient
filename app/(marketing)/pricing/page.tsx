import { ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/marketing/org-parts";
import { PlanTable } from "@/components/marketing/plan-table";
import { Orbit, type OrbitItem } from "@/components/marketing/story/orbit";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import { nav, pricingPage as copy, recruitersPage, universitiesPage } from "@/content/marketing";
import { getPricingExtras, getPublicPlans, getViewer } from "@/lib/data/marketing";
import { pkr } from "@/lib/marketing/plan-lines";

const ORBIT: OrbitItem[] = [
  { name: "seal", x: 14, y: 16, w: 50, d: 1, r: -6, eager: true },
  { name: "commit", x: 58, y: 48, w: 34, d: 0.6, r: 10 },
];

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/pricing" } };

const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

/**
 * /pricing (PRD 4a; docs/marketing-design-plan.md B7): one section per audience, every price and
 * limit from `plans` and the add-ons, hiring fees and trial from platform_config, PKR only.
 * Monthly/yearly is a CSS radio pair; the audience links are anchors. No JavaScript.
 */
export default async function PricingPage() {
  const [viewer, plans, extras] = await Promise.all([getViewer(), getPublicPlans(), getPricingExtras()]);
  const by = (a: string) => plans.filter((p) => p.audience === a);
  const sponsored = extras.add_ons?.sponsored_post;
  const credit = extras.add_ons?.contact_credits?.pkr;
  const fees = extras.hire_fees;
  const addOns = [
    sponsored ? fill(copy.recruiters.sponsoredPost, { price: pkr(sponsored.pkr), days: String(sponsored.days) }) : null,
    credit ? fill(copy.recruiters.credits, { price: pkr(credit) }) : null,
    fees?.intern && fees.full_time ? fill(copy.recruiters.hireFee, { intern: pkr(fees.intern), fullTime: pkr(fees.full_time) }) : null,
  ].filter((l): l is string => l !== null);
  const trial = extras.trial_days ? fill(copy.trial, { days: String(extras.trial_days) }) : null;

  return (
    <>
      <section aria-labelledby="page-title" className="hero">
        <div className="mx-auto grid max-w-page gap-8 px-[var(--page-gutter)] pt-10 pb-4 sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-6">
        <div className="hero-copy flex flex-col gap-6 lg:col-span-8">
          <h1 id="page-title" className="text-hero max-w-[18ch] text-text-primary">
            {copy.headline}
          </h1>
          <p className="max-w-[60ch] text-body-lg text-text-secondary">{copy.intro}</p>
          <nav aria-label="Plans for" className="neu-well flex flex-wrap gap-2 self-start rounded-full p-1.5">
            {copy.audiences.map((a) => (
              <a
                key={a.id}
                href={`#${a.id}`}
                className="inline-flex h-11 items-center rounded-full px-5 text-body font-semibold transition-shadow duration-[140ms] ease-out hover:shadow-[var(--raised-s)]"
              >
                {a.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="lg:col-span-4">
          {/* Proof is free: the seal and the commit, never a tier (rank is never sold). */}
          <Orbit id="pricing-orbit" items={ORBIT} alt="The verified seal and a commit: the proof every student gets for free." className="orbit-calm" />
        </div>
        </div>
      </section>

      <Section id="students" labelledBy="students-title" className="scroll-mt-4 epilogue">
        <SectionHeading id="students-title">{copy.students.heading}</SectionHeading>
        <div className="mt-10">
          <PlanTable
            id="students"
            plans={by("user")}
            pinned="pro"
            free={{ label: copy.students.freeLabel, items: copy.students.freeItems }}
            notes={{ pro: [trial ? `${trial}.` : null, copy.students.sponsored].filter(Boolean).join(" ") }}
            extra={{
              pro: viewer ? null : (
                <Link href="/signup" className="neu-btn mt-2 self-start text-body">
                  {nav.join.label}
                  <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
                </Link>
              ),
            }}
          />
        </div>
      </Section>

      <Section id="recruiters" labelledBy="recruiters-title" className="scroll-mt-4 epilogue">
        <SectionHeading id="recruiters-title">{copy.recruiters.heading}</SectionHeading>
        <div className="mt-10">
          <PlanTable id="recruiters" plans={by("org")} free={copy.recruiters.explore} pinned="growth" />
        </div>
        {addOns.length ? (
          <div className="neu-well mt-12 flex max-w-[72ch] flex-col gap-3 p-6" data-testid="pricing-add-ons">
            <h3 className="text-h3">{copy.recruiters.addOns}</h3>
            <ul className="flex flex-col gap-2">
              {addOns.map((line) => (
                <li key={line} className="text-body text-text-secondary">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-10">
          <CtaLink href={viewer ? viewer.home : recruitersPage.cta.href} track={viewer ? "open_app" : "recruiter_signup"}>{viewer ? nav.open : recruitersPage.cta.label}</CtaLink>
        </div>
      </Section>

      <Section id="universities" labelledBy="universities-title" className="scroll-mt-4 epilogue">
        <SectionHeading id="universities-title">{copy.universities.heading}</SectionHeading>
        <div className="mt-10">
          <PlanTable id="universities" plans={by("university")} free={copy.universities.free} pinned="growth" />
        </div>
        <p className="mt-10 text-body text-text-secondary">{copy.universities.note}</p>
        <div className="mt-6">
          <CtaLink href={"/universities#talk" as Route} track="talk_to_us">{universitiesPage.talk.heading}</CtaLink>
        </div>
      </Section>

      <Section labelledBy="pricing-faq-title" className="epilogue">
        <div className="grid gap-8 md:grid-cols-12 md:gap-6">
          <SectionHeading id="pricing-faq-title" className="md:col-span-3">
            Questions
          </SectionHeading>
          <div className="flex flex-col gap-4 md:col-span-8 md:col-start-5">
            {copy.faq.map((item) => (
              <details key={item.q} className="faq-item group px-6">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-h4 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <CaretDown aria-hidden weight="bold" className="faq-caret size-5 shrink-0 text-[var(--signal-ink)]" />
                </summary>
                <p className="max-w-[64ch] pb-6 text-body-lg text-text-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
