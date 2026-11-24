import { ArrowRight, CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Seal } from "@/components/marketing/neu";
import { Section, SectionHeading } from "@/components/marketing/sections/section";
import { Orbit, type OrbitItem } from "@/components/marketing/story/orbit";
import { featuresPage as copy, nav } from "@/content/marketing";
import { getViewer } from "@/lib/data/marketing";

const ORBIT: OrbitItem[] = [
  { name: "seal", x: 14, y: 16, w: 50, d: 1, r: -6, eager: true },
  { name: "commit", x: 58, y: 48, w: 34, d: 0.6, r: 10 },
];

export const metadata: Metadata = { title: copy.title, description: copy.description, alternates: { canonical: "/features" } };

/**
 * /features (phase 14, decisions 2026-11-02 "Marketing routes"): what students, Student Pro, faculty
 * and organisations get, with no prices. /pricing redirects here (308). Organisations end on
 * "Talk to us" while their portals are off. No JavaScript.
 */
export default async function FeaturesPage() {
  const viewer = await getViewer();
  return (
    <>
      <section aria-labelledby="page-title" className="hero">
        <div className="mx-auto grid max-w-page gap-8 px-[var(--page-gutter)] pt-10 pb-4 sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-6">
          <div className="hero-copy flex flex-col gap-6 lg:col-span-8">
            <h1 id="page-title" className="text-hero max-w-[18ch] text-text-primary">
              {copy.headline}
            </h1>
            <p className="max-w-[60ch] text-body-lg text-text-secondary">{copy.intro}</p>
            <nav aria-label="Features for" className="neu-well flex flex-wrap gap-2 self-start rounded-full p-1.5">
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
            <Orbit id="features-orbit" items={ORBIT} alt="The verified seal and a commit: the proof every student gets for free." className="orbit-calm" />
          </div>
        </div>
      </section>

      <Section id="students" labelledBy="students-title" className="scroll-mt-4 epilogue" step="01 · Students">
        <SectionHeading id="students-title">{copy.students.heading}</SectionHeading>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="features-students">
          {copy.students.items.map((item) => (
            <li key={item.title} className="neu-tile flex flex-col gap-3 p-6">
              <h3 className="text-h4">{item.title}</h3>
              <p className="text-body text-text-secondary">{item.text}</p>
              <p className="proof-line neu-mono mt-auto text-text-secondary">
                <Seal size={18} />
                {item.proof}
              </p>
            </li>
          ))}
        </ul>
        {viewer ? null : (
          <Link href="/signup" className="neu-btn mt-10 self-start text-body-lg">
            {nav.join.label}
            <ArrowRight aria-hidden weight="bold" className="cta-arrow size-5" />
          </Link>
        )}
      </Section>

      <Section id="pro" labelledBy="pro-title" className="scroll-mt-4 epilogue" step="02 · Student Pro">
        <div className="grid gap-8 md:grid-cols-12 md:gap-6">
          <div className="flex flex-col gap-4 md:col-span-5">
            <SectionHeading id="pro-title">{copy.pro.heading}</SectionHeading>
            <p className="text-body-lg text-text-secondary">{copy.pro.text}</p>
          </div>
          <div className="neu-ink flex flex-col gap-4 p-7 md:col-span-6 md:col-start-7" data-testid="features-pro">
            <ul className="flex flex-col gap-3">
              {copy.pro.items.map((line) => (
                <li key={line} className="flex items-start gap-3 text-body">
                  <Check aria-hidden weight="bold" className="mt-1 size-4 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="text-body-sm text-text-secondary">{copy.pro.note}</p>
          </div>
        </div>
      </Section>

      <Section id="faculty" labelledBy="faculty-title" className="scroll-mt-4 epilogue" step="03 · Faculty">
        <div className="grid gap-8 md:grid-cols-12 md:gap-6">
          <SectionHeading id="faculty-title" className="md:col-span-4">
            {copy.faculty.heading}
          </SectionHeading>
          <div className="flex flex-col gap-6 md:col-span-7 md:col-start-6">
            <ul className="neu-well flex flex-col gap-3 p-6">
              {copy.faculty.items.map((line) => (
                <li key={line} className="flex items-start gap-3 text-body">
                  <Check aria-hidden weight="bold" className="mt-1 size-4 shrink-0 text-[var(--signal-ink)]" />
                  {line}
                </li>
              ))}
            </ul>
            <Link href={copy.faculty.cta.href} className="neu-btn-2 self-start text-body">
              {copy.faculty.cta.label}
              <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
            </Link>
          </div>
        </div>
      </Section>

      <Section id="organisations" labelledBy="organisations-title" className="scroll-mt-4 epilogue" step="04 · Organisations">
        <div className="flex flex-col gap-3">
          <SectionHeading id="organisations-title">{copy.organisations.heading}</SectionHeading>
          <p className="max-w-[62ch] text-body-lg text-text-secondary">{copy.organisations.text}</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-2" data-testid="features-orgs">
          {copy.organisations.rows.map((row) => (
            <li key={row.id} className="neu-tile flex flex-col gap-4 p-6">
              <h3 className="text-h3">{row.title}</h3>
              <p className="text-body text-text-secondary">{row.text}</p>
              <Link href={row.href} className="neu-btn-2 self-start text-body" data-track="org_cta_click" data-track-cta={`talk_to_us_${row.id}`}>
                {copy.organisations.cta}
                <ArrowRight aria-hidden weight="bold" className="cta-arrow size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="features-faq-title" className="epilogue">
        <div className="grid gap-8 md:grid-cols-12 md:gap-6">
          <SectionHeading id="features-faq-title" className="md:col-span-3">
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
