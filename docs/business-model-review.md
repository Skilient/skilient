# Business model review (2026-10-17)

A critical read of Skilient's business model as it stands: PRD 4a and 4b, the feature sections that carry money (5.18 CV, 5.20 recruiters, 5.21 faculty, 5.23 universities, 5.29 alumni), the phase 10 decisions, the plans and config actually seeded in `supabase/migrations/20261023000000_billing_core.sql`, the user agreement, and the marketing copy in `content/marketing.ts`. External facts are cited at the end. Where a point is my judgement rather than a fact, it says so.

## Verdict

The billing machinery is far ahead of the business model it serves. Entitlements, quotas, invoices, sponsorship and downgrades are built carefully. The model on top of them is unvalidated and has six structural flaws:

1. The PDF CV, the one artefact that would carry Skilient to recruiters who aren't on it yet, is behind the paywall, and the 7-day free trial leaks it anyway: PDFs exported during the trial keep verifying afterwards.
2. Students can't opt out of university access to their record, and they have to pay to see who looked at it.
3. The hiring fee is charged on the same self-reported event that the outcome layer, the Luminary tier and the university dashboards need. Charging for reporting a hire means hires go unreported.
4. The sponsored job post sells a label and nothing else.
5. Only software skills can be proven (all 158 taxonomy skills are languages, frameworks, libraries, platforms, tools and practices), but the pitch, the 700K-user target and the university licences are priced as if every student benefits.
6. There is no cost side at all: no infrastructure, gateway or staffing costs, no unit economics, no runway.

On top of that, both payment rails are unconfirmed (Paddle for a Pakistani seller; Safepay recurring charges), there are no commercial terms for organisations, and nobody on a three-person team is named as the seller.

---

## Part 1. Structural flaws to fix before launch

### 1.1 Student Pro paywalls the growth loop and contradicts "your verified CV is free"

- Free students get a web CV only. Sharing a link needs Spark tier (100 points plus a peer-verified contribution, PRD 5.13), and the PDF needs Pro (PRD 4a, 5.18). A Raw student can't show their CV to anyone outside Skilient.
- The pricing page and FAQ say "your verified CV ... free, always". That is true only in a narrow sense, and students will notice the gap the first time they try to attach their CV to an application.
- A PDF with a QR code and a `/verify` link is the cheapest recruiter acquisition channel you have. Every PDF a student attaches on Rozee, LinkedIn or by email puts Skilient in front of a hiring manager who isn't a customer yet. Paywalling it throttles the B2B funnel to protect a small B2C stream (see 2.2).
- **The paywall leaks anyway.** A trial grants full Pro for 7 days with no card (`start_trial` creates a `student_pro_monthly` subscription), and PRD 4b.6 says "issued PDFs stay valid" after downgrade. A student can trial once, export PDFs in every layout, and keep sending them. They stay authentic: `/verify` shows Valid until a later monthly snapshot marks them Superseded, and Outdated after 12 months. A student hunting for a job in one season doesn't need more than that.
- The equity promise runs backwards. Hard rule 3 says ability to pay never decides who has a CV, but only Growth (final-years) and Campus universities sponsor Pro. Students at well-funded universities get Pro free; students at the lesser-known universities the problem statement is about (PRD 2) pay or go without.

**Recommendation:** make the standard-layout PDF free, with the verify QR as its built-in "watermark". Keep Pro for the extra layouts, on-demand refresh, company names in "who viewed", and insights. Let any student with at least one L2 skill create a share link, not only Spark and above.

### 1.2 Charging students to see who viewed their own record

- On Growth and Campus, university staff can open any student's individual record and students cannot opt out (PRD 5.23, agreement heading 6). The access log is visible only on Student Pro (`privacy.record_viewers`).
- Telling students "your university can read your record, and you can pay us to see who did" is the story a journalist or a student union would tell. It also sits badly with data-access norms: Pakistan's Personal Data Protection Bill (2023 draft, still pending when last checked) would give people a right to know who received their data.

**Recommendation:** make the access log free for every student. It costs nothing and removes the worst headline the product could get.

### 1.3 The hiring fee taxes the signal the platform needs

- The fee (PKR 10,000 intern, 30,000 full-time) is created only when a recruiter on Explore or Starter moves a candidate to **hired** (PRD 4b.9). Growth and Enterprise are waived.
- The same event feeds the 90-day outcome question (the "Outcome trust" layer in PRD 2), the Luminary tier ("a completed recruiter hire", PRD 5.13), university outcome dashboards (a Growth and Campus selling point), and fair reports. Paying for honesty guarantees under-reporting from exactly the small recruiters who are most likely to hire a first-job student.
- Leakage is easy: accepting a contact request opens a chat, the student can share an email or phone number, and the hire happens off-platform. The "student says hired at X" trigger isn't built (decisions 2026-10-05, organisations), so the only check is the 45-day offer follow-up.
- An intern fee of PKR 10,000 is large next to many Pakistani internship stipends. It pushes recruiters away from posting internships, which are what first- and second-year students need most.
- There are no organisation terms that define a hire. One user agreement covers everyone, and heading 9 only describes disputes. Agencies close this gap with an introduction clause: a fee is owed if a candidate first met through the platform is hired within N months, whether or not anyone marked them.

**Recommendation (pick one):** (a) drop the intern fee entirely and keep the full-time fee only with commercial terms that define a hire, an attribution window (for example 12 months from first contact or application) and a duty to report; or (b) drop the hiring fee and price that value into Starter and Growth instead. Either way, ask the student to confirm a hire, so the outcome data doesn't depend on the payer.

### 1.4 The sponsored job post sells a label

- `job_posts.sponsored_until` drives only a "Sponsored" label on the Jobs tab. pgTAP 39 asserts that no ORDER BY in `opportunities()` mentions sponsorship (decisions 2026-10-05, sponsored posts). For PKR 5,000 a recruiter gets a badge that may make students trust the post less.
- The pricing copy ("never ranked above other results in talent search") is confusing, because job posts never appear in talent search, which lists students.
- Hard rule 1 protects the rank and visibility of students. Whether it also covers job posts is a decision nobody has made.

**Recommendation:** decide whether rule 1 covers jobs. If it doesn't, give the add-on something real, such as a separate, labelled slot at the top of the Jobs tab or one email to matching opted-in students. If it does, remove the add-on rather than sell an empty one.

### 1.5 The proof engine covers software only

- The skill taxonomy (`lib/github/taxonomy/skills.yaml`) has 158 skills: 47 libraries, 34 frameworks, 30 languages, 22 platforms, 20 tools and 5 practices. A business, law, medicine, engineering or social-science student has no path to an L2+ skill, so their CV and tier stay nearly empty.
- The pitch ("Pakistan's first social media platform exclusively for university students"), the 700K-users-by-2028 target and Campus ("Student Pro for all students", flat PKR 2M) all assume the whole campus benefits. A university that pays will see value land mostly in its CS and IT departments.
- For scale: HEC oversees roughly 240 to 270 universities with about one million students, and only a minority of them study computing. A 700K target would mean most of Pakistan's university students, which isn't credible for a code-only proof engine. That's an investor-credibility risk.

**Recommendation:** either position Skilient honestly as the verified tech-talent network and price licences by computing department or by CS/IT enrolment, or put non-code evidence (portfolios, case competitions, faculty-graded briefs) on a dated roadmap before selling campus-wide licences.

### 1.6 No cost side, no unit economics

Nothing in the PRD, decisions or setup checklist estimates what a student, recruiter or university costs to serve. What's missing:

- **Infrastructure:** Vercel Pro (required, because Hobby forbids commercial use), Supabase Pro and compute, Brevo, Sentry, PostHog, Axiom, and the cost of headless-Chromium PDF renders. Pro gives unlimited exports and up to 10 on-demand refreshes a day.
- **Payment fees:** Paddle reportedly charges 5% + 50¢ (secondary source; confirm); Safepay's rates aren't recorded.
- **Human operations, which "no AI anywhere" makes unavoidable:** organisation verification within 2 working days, moderation within 48 h, credential reviews, code checks that fall to Skilient staff after 48 h unclaimed, the monthly L2 precision audit, competition brief reviews, hire-fee disputes, university claims, 45-day follow-ups, feedback, appeals and alumni recovery cases. These costs grow with the number of students, while most revenue comes from organisations.
- **Faculty labour:** the most trusted signals (confirmations, reviews, code-check grading) rely on unpaid faculty. The only incentive is a dashboard panel. If faculty don't take part, the work falls to paid staff or doesn't get done.

**Recommendation:** a one-page cost model with a cost per verified student per year, break-even customer counts for each stream, and months of runway at current spend.

### 1.7 A global 60-a-day email cap undermines paid contact requests

`DAILY_CAP = 60` in `supabase/functions/_shared/notify/worker.ts` caps notification emails for the whole platform per UTC day; only ops alerts bypass it. A contact request costs a credit (about PKR 600 on Starter), expires after 14 days and is never refunded (PRD 5.20). Contact requests default to in-app plus the daily digest. At an all-HEC launch, recruiters will pay for requests that students never hear about. This is an operations setting, but the cost lands on the business model: either lift or tier the cap before charging, or return credits on expiry.

---

## Part 2. Pricing problems

### 2.1 Student pricing doesn't fit the payment rails

- Until Safepay's saved cards are confirmed, every PKR plan is a prepaid period with reminders (decisions 2026-10-05, gateways as built). Monthly Pro means twelve manual payments a year. Credit cards are scarce in Pakistan compared with debit cards and wallets, so card-based auto-renewal reaches few students anyway.
- Students need polish in bursts: internship season, final-year hiring, graduation in September.

**Recommendation:** sell Pro as time-boxed passes that match the prepaid rails, such as a semester pass or a 3-month job-hunt pass, alongside the yearly plan. Drop monthly if renewals stay manual.

### 2.2 Student revenue is small next to its trust cost

An illustration only, with made-up but plausible year-two numbers to show the shape, not a forecast:

| Stream | Assumption | PKR/year |
| --- | --- | --- |
| Student Pro | 50,000 active students, 3% pay the yearly price (3,499) | 5.2M |
| Recruiter Starter | 60 orgs on yearly (150,000) | 9.0M |
| Recruiter Growth | 15 orgs on yearly (450,000) | 6.8M |
| University Basic / Growth / Campus | 5 / 8 / 2 licences | 12.7M |
| Hiring fees | 150 reported hires at an average of 20,000 | 3.0M |
| **Total** | | **≈ 36.7M (≈ USD 131K at 280)** |

Under almost any assumptions, students bring in the smallest share of revenue but the largest reputational risk ("they charge students"). That's another reason to make the PDF and the record access log free (1.1, 1.2).

### 2.3 Recruiter credits are priced the wrong way round

- Credits included in a plan work out to PKR 600 each on Starter (15,000 ÷ 25) and PKR 450 on Growth (45,000 ÷ 100). A purchased add-on credit costs PKR 300. Top-ups are cheaper than the bundle, which tells recruiters the plan is overpriced.
- Credits aren't refunded on decline or expiry. Visibility is opt-in, requests expire in 14 days, and emails are capped (1.7), so recruiters will feel cheated. There is market precedent for response-contingent credits: LinkedIn returns InMail credits that get a response.

**Recommendation:** price add-on credits above the plan rate, and return credits for requests that expire unanswered.

### 2.4 Hiring is seasonal; monthly plans will churn

Pakistani recruiting peaks around internships and graduation. A company that hires twice a year will subscribe for a month and cancel. Offer quarterly or campaign plans, or credit packs that don't need a subscription.

### 2.5 USD prices are just PKR ÷ 280

- Starter at $55 a month and Growth at $160 were converted, not priced (decisions 2026-10-05). Foreign companies hiring Pakistani engineers remotely are the buyers most willing to pay, and recruiter tools abroad commonly cost well over $100 per seat per month. A PKR 30,000 (about $107) full-time hiring fee is tiny compared with what they pay to source remote talent elsewhere.
- Hiring fees (`billing.hire_fees`) exist in PKR only, so a USD organisation that hires gets a PKR invoice it may have no easy way to pay.
- Paddle's acceptable-use policy rejects human services that aren't related to a software offering. A placement success fee may not be sellable through Paddle at all. Confirm this before relying on it.

**Recommendation:** a separate international price book (subscriptions and any hiring fee), and a non-Paddle way to collect from foreign companies (wire invoicing, or another merchant of record).

### 2.6 University pricing ignores size and has an empty tier

- Prices are flat whatever the enrolment (Basic PKR 300K, Growth 900K, Campus 2M a year). A 15,000-student university and a 2,000-student one pay the same, which is too much for small private universities and too little for large ones. Comparable products price by number of students; Superset, for example, charges colleges by student count.
- Campus sponsors Pro for every student. At 10,000 students that's PKR 35M of retail Pro for PKR 2M, so Skilient undercuts its own student plan by more than 90%.
- Basic buys a summary dashboard and one extra admin seat over the free level, which already includes the full customisable ecosphere. It's hard to see who buys Basic.
- Campus's headline feature, accreditation report templates, is deferred and not built (decisions 2026-10-05, deferred). It's on sale at the top price without its reason to exist.
- Public universities buy through PPRA or provincial procurement rules (tenders, vendor registration, quotations) on a July-to-June budget year, and many are short of money. The PRD's licence flow (PO number, 30-day terms) assumes a private-sector buyer.

**Recommendation:** enrolment bands (or a per-student rate with a floor), a Basic that includes something a career office actually needs (exports or one job fair) or no Basic at all, no Campus sales until the accreditation reports exist, and a written public-sector procurement path.

### 2.7 "Placeholders to validate" are live and unvalidated

- PRD 4a says every price is a placeholder to validate through 10 to 15 recruiter and student interviews. The repo has no record of those interviews, the prices are live on `/pricing`, and the "Prices may change" note was removed (decisions, phase 12 slice 4).
- The validation plan leaves out universities, the buyers with the largest contracts, and faculty, whose unpaid work the trust layer depends on.

---

## Part 3. What the business model is missing

### A. Market and customers

- [ ] **Market sizing:** students (total, and CS/IT within that), universities by public/private and size, number of hiring companies, and foreign remote employers. The repo seeds 283 universities, but there is no sizing.
- [ ] **Ideal customer profiles and the actual signer for each buyer:** software houses, startups, MNCs, banks' tech teams, foreign remote employers; for universities, the CDC director, ORIC, QEC, Registrar or VC.
- [ ] **Competitor analysis (none in the repo):** Rozee.pk (featured job listings reportedly cost about PKR 24,000 for three a month; the article is undated), LinkedIn, Indeed, university CDC portals and in-person job fairs, employer traineeship programmes, hackathon platforms. Also the international models: Handshake (universities pay, about 98% of employers use the core free, premium for large employers) and Superset (colleges pay by size).
- [ ] **Why a recruiter switches:** today's cost per hire and time to hire for an entry-level developer, against Skilient's.
- [ ] **Validation evidence:** interview notes, letters of intent, and the NUTECH pilot's results written down.

### B. Revenue model

- [ ] Revenue targets by stream and by quarter after launch, and one north-star metric.
- [ ] A value metric for each plan (seats, credits, hires or students) and why it was chosen.
- [ ] **Launch-partner pricing policy:** 4b.11 gives "Growth free for 6 months for the 20 launch partners" only as an example. Who gets free terms, for how long, and what turns them into paying customers?
- [ ] **Discount rules:** annual, startups, NGOs, public universities, multi-campus universities, consortium or HEC-wide deals.
- [ ] **Enterprise:** a floor price, standard terms, and what "custom" means.
- [ ] **Price-change and grandfathering policy** beyond the 30 days' notice in the agreement.
- [ ] **The post-launch revenue document:** 4a says pay-per-competition, ambassador assessments, mentorship and advertising are "kept in a separate document". No such document is in the repo.
- [ ] **Contradictions to resolve:**
  - 4a lists advertising as a post-launch stream, PRD says "no ads at launch", and the landing page says plainly "No ads."
  - Section 3 lists alumni and mentor accounts as non-goals, while 5.29 proposes alumni accounts with mentoring and 4a lists mentorship as a revenue stream.
- [ ] **Define "selling student data".** Can aggregated, anonymised skills-gap reports be sold or licensed to HEC, provincial higher-education departments, PSEB, industry bodies or development partners? That is a plausible government or donor revenue stream, and it's missing. The hard rule needs a precise definition before anyone is tempted.
- [ ] **Alumni:** graduates are the full-time and job-switching pool recruiters pay for most, but 4a says nothing about them. 5.29 keeps every core alumni feature free, which is fine, but recruiter plans and Pro should say how alumni count. CVs go "Outdated" after 12 months, so alumni need a refresh path.

### C. Go-to-market

- [ ] **Who sells.** The About page lists three people (CEO, CTO, CHRO and social media). Licences and recruiter plans need a named owner, a sales cycle, a pipeline target and a CRM. `/ops/leads` is an inbox, not a CRM.
- [ ] **Acquisition channels and CAC** for each side: campus ambassadors, societies, career offices, P@SHA, and their budgets.
- [ ] **Supply at launch.** Public launch opens every HEC university at once, but only NUTECH has had a beta. Recruiters searching any other university will find mostly "not ranked yet" students. Charging recruiters before supply exists invites churn, so the launch plan needs a recruiter-conversion step after supply exists.
- [ ] **Supply metrics recruiters pay for:** the share of students who opt in to recruiter visibility, and students with at least one L2 skill, per university. Neither is in section 3 or 5.20.
- [ ] **Customer success:** the PRD targets licence renewal of at least 80% and promises an account manager for Enterprise, but no one does either job.

### D. Operations

- [ ] A staffing plan for every `/ops` queue against its SLA, with a cost per review.
- [ ] Faculty incentives with substance: paid grading, grading time included in the university licence, or formal recognition through the university.
- [ ] **Support for paying customers:** there's no help centre at launch, only a feedback centre. A recruiter paying PKR 45,000 a month needs a support channel with a response time.
- [ ] **The SLA promise:** Enterprise promises 99.9% uptime. Check whether Supabase and Vercel give a matching SLA on the plans Skilient will use (normally only on their enterprise tiers), and define service credits.
- [ ] Infrastructure cost scaling (PDF renders, Realtime, storage) at 10K, 100K and 700K students.

### E. Legal, tax and finance

- [ ] **Organisation terms (MSA) for recruiters and universities,** separate from the student agreement: the definition of a hire and its attribution window, a duty to report, audit rights, payment terms and late fees, data processing roles (university as controller of student records, recruiters as independent controllers), confidentiality, non-solicitation and the SLA.
- [ ] **A university licence or MoU template,** and a procurement pack for public universities (NTN/STRN certificates, vendor registration, tender responses).
- [ ] **Withholding tax.** Pakistani companies and universities withhold income tax on payments for services, so invoices are paid net. Billing has no withholding-tax handling (no WHT field, no partial-payment reconciliation and no certificate tracking), so a correctly paid invoice will look short-paid.
- [ ] **Sales tax registration.** The company is in Islamabad. Under the Finance Act 2025, ICT IT services reportedly get a reduced 5% rate without input-tax adjustment, or 15% standard; verify this. Billing taxes by the customer's province, which implies registering with PRA, SRB, KPRA or BRA where customers are. That's a decision for the accountant, and the build already assumes an answer. Student prices "include tax", but which tax isn't recorded.
- [ ] **IT export treatment for USD revenue:** PSEB registration, the export-proceeds tax regime, and ICT's sales-tax exemption for exported IT services.
- [ ] **FX policy:** USD prices are fixed at ÷ 280, with no rule for revaluing them and no rule for converting payouts.
- [ ] **Payment rails, still unconfirmed:** Paddle onboarding of a Pakistan-registered seller and its payouts (the setup checklist still says "first confirm"); Safepay saved cards, wallets on hosted checkout and refunds (all marked `CONFIRM` in code); B6 real transactions deferred. A fallback for each (the PayFast adapter is deferred).
- [ ] **Data protection readiness:** no-opt-out university records rest on consent bundled into signup, and the PDPB draft would require consent to be freely given. Hosting is in Mumbai, so check any data-localisation clause in the final law, and how public universities feel about student data stored in India.
- [ ] **Placement abroad:** if foreign employers hire students to work outside Pakistan, ask counsel whether a success fee makes Skilient an overseas employment promoter under the Emigration Ordinance 1979. Remote work probably doesn't, but get it checked.
- [ ] **Revenue recognition:** annual plans and licences are paid up front, so deferred revenue needs handling, and MRR has to say whether it includes licences.

### F. Metrics

- [ ] Section 3's success metrics are all engagement. Add business KPIs: ARR by stream, paying organisations, Explore → paid (already 10% in 5.20), trial → Pro, Pro churn, licence renewal, net revenue retention, recorded hires per month, recruiter cost per hire, CAC and payback, gross margin.
- [ ] Replace "700K users by 2028" with a target derived from the market sizing (A).

---

## Part 4. What to keep

- The hard rules are a real differentiator in a market of pay-to-boost job boards. No paid rank, proof stays free, no data sales, no protected attributes in search.
- Entitlements are fail-closed and checked in SQL, quotas are race-safe, and paid data is also gated in RLS.
- Downgrades never delete data, invoices are immutable with credit notes, and every staff billing action is audited before and after.
- Sponsorship as a mechanism is right. Only who qualifies for it is wrong (1.1).
- Free ecospheres for every university are a good growth lever, as long as the paid tiers give career offices a real reason to pay (2.6).

## Part 5. Decisions for Ahmed, with recommendations

1. **Free standard PDF CV and free record-access log for every student?** Recommended: yes for both.
2. **Hiring fee:** drop the intern fee and define a hire with an attribution window in new organisation terms, or remove the fee and raise plan prices. Recommended: drop the intern fee, keep the full-time fee under written terms, and ask students to confirm hires.
3. **Sponsored job post:** real labelled placement, or remove it. Recommended: a labelled top slot on the Jobs tab, once you confirm that rule 1 is about students.
4. **Positioning:** "verified tech talent" now, or non-code evidence before campus-wide licences. Recommended: tech talent now, with licences priced by CS/IT enrolment.
5. **University pricing by enrolment band, Basic reworked or dropped, Campus held back until accreditation reports exist?** Recommended: yes.
6. **Student Pro as semester and job-hunt passes plus yearly?** Recommended: yes, while renewals are manual.
7. **Credits:** add-ons priced above the plan rate, and credits returned on unanswered expiry? Recommended: yes.
8. **International price book for USD buyers, with a non-Paddle way to collect hiring fees?** Recommended: yes.
9. **Before launch:** commission the cost model, organisation terms, withholding-tax handling and the sales-tax registration decision. Recommended: these block taking real money.
10. **Run the pricing interviews, adding universities and faculty, and record them in `docs/`.** Recommended: before public launch.

## Sources

- HEC scale: [Erasmus+ Pakistan policy review 2024](https://erasmus-networks.ec.europa.eu/system/files/2025-01/Pakistan%20Policy%20review%202024_0.pdf), [QAA: insights into Pakistan](https://www.qaa.ac.uk/news-events/news/insights-into-pakistan), [The News: higher education antinomies](https://www.thenews.pk/print/1375364-higher-education-antinomies)
- Comparable models: [Handshake business model (Handshake UK)](https://joinhandshake.co.uk/blog/careers-services/about-handshake-discover-our-business-model-and-why-we-are-trusted-by-over-1500-universities-worldwide), [Sacra on Handshake](https://sacra.com/research/handshake), [Superset (The News Minute)](https://www.thenewsminute.com/article/b-luru-startup-has-evolved-novel-approach-campus-placement-using-cloud-tech-95835), [Rozee.pk featured jobs (ProPakistani)](https://propakistani.pk/?p=86653)
- Paddle: [supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales), [acceptable use policy](https://paddle.com/support/aup), [fee claim (secondary)](https://learnwithhasan.com/payment-gateways/country/pakistan/)
- Payments in Pakistan: [Simpaisa on recurring billing](https://www.simpaisa.com/blogs/recurring-billing-pakistan-subscription-businesses-failed-renewals)
- Tax: [ICT lowers tax on IT services in FY26 (PKRevenue)](https://pkrevenue.com/islamabad-lowers-tax-on-software-it-services-in-fy26/), [ICT (Tax on Services) Ordinance 2001](https://icmainternational.com/downloads/TechnicalSupport/IslamabadCapitalTerritory(TaxOnServices)Ordinance2001.pdf), [PwC Pakistan other taxes](https://taxsummaries.pwc.com/pakistan/corporate/other-taxes)
- Data protection: [Law Over Borders: Pakistan (Feb 2025)](https://www.globallegalpost.com/lawoverborders/data-protection-law-guide-1072382791/pakistan-1623790143)
- Procurement: [Punjab Procurement Rules 2014](https://pbit.punjab.gov.pk/system/files/Punjab%20Procurement%20Rules.pdf)
