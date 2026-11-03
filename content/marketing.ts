import type { Route } from "next";

/**
 * Marketing copy (PRD 5.1: copy edits don't touch components). Rules from
 * docs/marketing-design-plan.md: plain sentences, no em-dashes, no hype verbs, only live
 * features, every number with a source. Prices never live here; they come from `plans`.
 */

export interface NavLink {
  label: string;
  href: Route;
}

/**
 * Marketing pages that exist so far. Phase 12 ships in slices and main deploys to production,
 * so nav and footer links to a page appear only once it is built (each slice adds its pages).
 */
export const BUILT_PAGES: ReadonlySet<string> = new Set(["/verify", "/recruiters", "/universities", "/faculty", "/features", "/about", "/terms", "/privacy"]);
/** Built but kept out of search. Empty: the legal pages are public so Google can read the privacy notice. */
export const NOINDEX_PAGES: ReadonlySet<string> = new Set<string>();
export const isBuilt = (href: string) => BUILT_PAGES.has(href);

export const nav: { links: NavLink[]; signIn: NavLink; join: NavLink; open: string } = {
  links: [
    { label: "For recruiters", href: "/recruiters" as Route },
    { label: "For universities", href: "/universities" as Route },
    { label: "For faculty", href: "/faculty" as Route },
    { label: "Features", href: "/features" as Route },
    { label: "Verify a CV", href: "/verify" as Route },
  ],
  signIn: { label: "Sign in", href: "/signin" as Route },
  join: { label: "Join", href: "/signup" as Route },
  open: "Open Skilient",
};

export const hero = {
  headline: "Join Pakistan's first social media platform exclusively for university students.",
  /** The words set in italic (the headline's turn); must end the headline. */
  headlineTurn: "exclusively for university students.",
  subline: "Build with classmates, prove your skills with real work, and get recognised by recruiters. No more rejected CVs.",
  /** The proof objects orbiting the headline (Blender renders in public/marketing/objects/). */
  orbitAlt: "Proof objects around the headline: the verified seal, a Flare tier medallion, a commit, an endorsement and a university email.",
};

/** The university email field (hero and final CTA). `{name}` is the university. */
export const emailField = {
  label: "University email",
  placeholder: "you@university.edu.pk",
  submit: "Join",
  live: "{name} is on Skilient.",
  liveShared: "Your university is on Skilient.",
  personal: "Use your university email.",
  invalid: "Enter a valid email address.",
  notLive: "{name} isn't on Skilient yet.",
  unknown: "We don't recognise this university.",
  request: "Request it",
  signedIn: "Open Skilient",
};

export const requestUniversity = {
  title: "Request your university",
  intro: "Tell us where you study. We count every request, and when your university joins we email you once.",
  email: "University email",
  universityName: "University name",
  universityNameHelp: "We'll match it to the HEC list.",
  consent: "Email me when my university joins.",
  submit: "Send request",
  sent: "Request sent. Check your inbox to confirm your email address.",
  already: "You've already asked for {name}. We'll email you when it joins.",
  rateLimited: "Too many requests from this network. Try again in an hour.",
  confirmed: "Thanks. Your request for {name} is confirmed. We'll email you once, when it joins.",
  unsubscribed: "Done. We won't email you about your university.",
  unsubscribeTitle: "Stop emails about your university",
  unsubscribeIntro: "We'll keep counting your request but won't email you when your university joins.",
  unsubscribeSubmit: "Stop emails",
  badLink: "That link has expired or was already used. Send a new request below.",
};

export const liveAt = {
  heading: "Live at",
  numbers: {
    verified_students: "verified students",
    ventures: "ventures",
    shipped_ventures: "ventures shipped",
  },
};

export const footer = {
  columns: [
    {
      heading: "Skilient",
      links: [
        { label: "About", href: "/about" as Route },
        { label: "Features", href: "/features" as Route },
        { label: "Verify a CV", href: "/verify" as Route },
      ],
    },
    {
      heading: "For organisations",
      links: [
        { label: "For recruiters", href: "/recruiters" as Route },
        { label: "For universities", href: "/universities" as Route },
        { label: "For faculty", href: "/faculty" as Route },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Terms", href: "/terms" as Route },
        { label: "Privacy", href: "/privacy" as Route },
      ],
    },
  ],
  /** Hidden until Ahmed confirms the address (decisions 2026-10-02). */
  contactEmail: null as string | null,
  /** Hidden until Ahmed gives the accounts. */
  social: [] as { label: string; href: string; network: "linkedin" | "instagram" | "x" | "facebook" }[],
  theme: "Theme",
  copyright: "© Skilient",
};

/** Section 3. Each figure was checked against its source on 2026-10-02; recheck before launch. */
export const trustGap = {
  heading: "Anyone can write “React” on a CV.",
  closing: "Skilient shows the work behind every skill, so a recruiter can check it instead of taking it on trust.",
  lead: {
    figure: "70%",
    text: "of workers admit they have lied on their CVs.",
    source: "ResumeLab survey of 1,900 US workers, August 2023, reported by SHRM",
    href: "https://www.shrm.org/in/topics-tools/news/talent-acquisition/are-your-candidates-lying-to-get-the-job",
  },
  rest: [
    {
      figure: "5,000 of 25,000",
      text: "IT graduates a year are hired by Pakistan’s leading IT companies.",
      source: "Gallup Pakistan study, reported by ProPakistani, 15 July 2020",
      href: "https://propakistani.pk/2020/07/15/only-10-of-it-graduates-are-employable-in-pakistan-gallup/",
    },
    {
      figure: "23.9%",
      text: "of women with a master’s degree or higher are unemployed. The national rate is 7.1%.",
      source: "Pakistan Bureau of Statistics, Labour Force Survey 2024-25",
      href: "https://www.pbs.gov.pk/wp-content/uploads/2020/07/LFS-2024-25-Annual-Report.pdf",
    },
  ],
};

/** Section 6. */
export const ventures = {
  heading: "Build in teams of up to six.",
  body: "Every venture lists the roles it needs and the skills for each. Classmates apply with their verified skills, and when the work ships the team posts it as Shipped.",
  alt: "A venture page (sample content): Lab booking for CS students, 4 of 6 members, with open roles for a backend developer and QA.",
  points: [
    { term: "Up to 6 people", detail: "A small team where every contribution is visible." },
    { term: "Open roles", detail: "Each role names the skills it needs, and anyone can apply." },
    { term: "Shipped", detail: "The post that marks the work as done, for everyone to see." },
  ],
};

/** Section 7. Meanings follow PRD 9.3; evidence levels are not explained here (decisions 2026-09-25). */
export const tiers = {
  heading: "Skills you’ve proven, not skills you’ve typed.",
  body: "Your rank comes from verified work alone. Six tiers take you from your first day to an exceptional record.",
  ladder: [
    { id: "raw", name: "Raw", meaning: "Identity verified, no contributions yet" },
    { id: "spark", name: "Spark", meaning: "Your first verified contribution" },
    { id: "flare", name: "Flare", meaning: "Active across projects, endorsements building" },
    { id: "shine", name: "Shine", meaning: "Consistent output, recruiter interest" },
    { id: "radiant", name: "Radiant", meaning: "Top 10% of verified contributors" },
    { id: "luminary", name: "Luminary", meaning: "An exceptional verified record" },
  ] as const,
};

/** Section 8. */
export const verifiedCv = {
  heading: "A CV anyone can check.",
  body: "Every Skilient CV is signed. A recruiter enters its code at skilient.com/verify and sees exactly what we verified, and when.",
  status: "Verified by Skilient",
  caption: "A sample CV. Every real one carries a code like this.",
  alt: "A sample Skilient CV for Ayesha Khan: her tier, a summary, and each verified skill with its evidence.",
  sampleCode: "7KQ2M9XB4D",
  link: "Verify a CV",
};

/** Section 9. */
export const opportunities = {
  heading: "Opportunities come to you.",
  cells: {
    jobs: { title: "Jobs and internships", text: "Every post shows its pay range.", alt: "The Jobs tab (sample posts): a frontend internship and a junior backend role, each with its pay." },
    requests: { title: "Contact requests", text: "Recruiters ask first. You accept or decline.", alt: "A contact request (sample) from a verified company, with Accept and Decline." },
    competitions: { title: "Competitions and hackathons", text: "Company competitions and university hackathons, judged on the work." },
    fairs: { title: "Job fairs", text: "Digital fairs run by your university, with company booths and queues." },
  },
};

/**
 * The landing story (decisions 2026-10-31): Ayesha, the sample student, from day one to a CV she shares.
 * The chapters are her story; the finale speaks to "you". Every number on her record is the
 * sample CV's (lib/cv/sample.ts), and she is labelled a sample wherever her record shows.
 */
export const story = {
  sample: "Sample student",
  sampleNote: "Ayesha Khan is a sample student. Her record is the sample CV.",
  prologue: {
    kicker: "Prologue",
    bridge: "So every CV gets read as a claim. This is the story of one that isn’t.",
  },
  person: {
    name: "Ayesha Khan",
    initials: "AK",
    context: "National University of Technology · Computer Science · 2027",
  },
  chapters: [
    {
      id: "day-one",
      kicker: "Day one",
      title: "Ayesha signs up with her university email.",
      body: "Only students and faculty with a university email get in, so everyone here is who they say they are. Her record opens at Raw: identity verified, nothing claimed yet.",
      proof: "Checked · university domain",
    },
    {
      id: "first-commit",
      kicker: "First commit",
      title: "She links GitHub, and her code starts to count.",
      body: "Ayesha picks the repositories she works in. Her own commits become evidence for each skill she uses, counted from the code and never typed into a box. Her first verified contribution makes her Spark.",
      proof: "Counted · React, 8 repositories, 40 active days",
    },
    {
      id: "team",
      kicker: "The team",
      title: "She builds with classmates, in a team of up to six.",
      body: "Ayesha starts Campus Timetable Planner and lists the roles it needs, with the skills for each. Classmates apply with their verified skills. When the work ships, the team posts it and readers tick whether it was informative. There are no likes.",
      proof: "Team of 3 · 3 places open",
    },
    {
      id: "proof",
      kicker: "Proof",
      title: "Her teammates confirm the work. Faculty can too.",
      body: "Bilal confirms the parser she built and endorses her React: “Built the whole parser in a week.” Faculty can review a project and confirm contributions as well. Confirmed work and endorsements make her Flare, in the top 18% of students.",
      proof: "Endorsed · React, by Bilal Ahmed",
    },
  ],
  record: {
    tiers: [
      { id: "raw", name: "Raw", line: "Identity verified" },
      { id: "spark", name: "Spark", line: "First verified contribution" },
      { id: "flare", name: "Flare", line: "Top 18% of students" },
    ] as const,
    skills: [
      { name: "React", evidence: "8 repos · 40 active days" },
      { name: "TypeScript", evidence: "7 repos · 39 active days" },
    ],
    project: { title: "Campus Timetable Planner", line: "Team lead · Team of 3 · Jun – Sep 2026" },
    endorsement: { line: "Bilal Ahmed endorsed React", meta: "Campus Timetable Planner · 20 Sep 2026" },
    signed: "Signed 1 Oct 2026 · 09:00 PKT",
    post: { title: "Shipped: Campus Timetable Planner", informative: "Informative", count: "11 → 12" },
  },
  climb: {
    kicker: "The climb",
    title: "Six tiers. Only verified work moves you up.",
    body: "Rank, tiers, leaderboards and recruiter search never use payment. Ayesha is at Flare, with three tiers still ahead of her.",
    here: "Ayesha is here",
    ahead: "Ahead",
    alt: "Six clay terraces rising left to right, each topped with its tier finish, a marker standing on the third, Flare.",
  },
  signed: {
    kicker: "Signed",
    title: "Skilient signs her CV.",
    body: "Every Skilient CV is signed. A recruiter enters its code at skilient.com/verify and sees exactly what was verified, and when. It refreshes on the 1st of each month as she proves more.",
    chips: ["Ed25519 signature", "Issued 1 Oct 2026", "QR + 10-character code"],
    link: "Verify a CV",
  },
  // Chapter 7 claims only what is live (decisions 2026-11-03): the recruiter portal is off, so
  // Ayesha shares her signed CV herself, with a link that expires.
  shared: {
    kicker: "Shared",
    title: "She sends a link. Anyone can check it.",
    body: "Ayesha applies for an internship and a scholarship. With each application she sends a link to her signed CV that expires in 30 days and that she can revoke at any time. Whoever opens it sees the CV, checks its code at skilient.com/verify, and sees the evidence behind every item. She sees how many times each link was opened.",
    link: {
      label: "Share link",
      title: "Internship application",
      line: "Signed CV · expires in 30 days",
      url: "skilient.com/cv/ayeshakhan?t=…",
      signed: "Signed",
      copy: "Copy link",
      copied: "Copied · 14:32",
      revoke: "Revoke",
    },
    chips: ["Links that expire", "Revoke any time", "A view count on every link"],
  },
  finale: {
    kicker: "Your turn",
    body: "Ayesha’s record is a sample. Yours starts with your university email.",
  },
  epilogue: "For organisations, pricing and questions",
};

/**
 * The Record on the landing story (phase 16, PRD 5.30): Ayesha's co-curricular transcript. Every
 * line here is live: verified societies issue at close-out, terms are confirmed by a second
 * officer, each entry has a code at /verify, and the transcript is one signed PDF. Sample entries.
 */
export const theRecord = {
  kicker: "The Record",
  title: "Her society work is signed too.",
  body: "When Ayesha checks in at the CS Society’s workshop, the society issues her entry through Skilient: no Canva certificate to fake. Her term as General Secretary is confirmed by a second officer. Each entry has a code anyone can check, and her whole Record prints as one signed transcript next to the academic one.",
  chips: ["Issued by verified societies", "A code on every entry", "Transcript PDF with a QR"],
  rule: "Office terms, results and volunteer hours move rank a little. Attendance never does, and a paid ticket buys a seat, not rank.",
  link: "Verify an entry",
  heading: "Ayesha’s Record",
  year: "2026–27",
  entries: [
    { issuer: "CS Society", title: "Office bearer: General Secretary", date: "30 Jun 2026", line: "General Secretary · Sep 2025 – Jun 2026", code: "7RCD0-K2M4P" },
    { issuer: "CS Society", title: "Result: Campus Hackathon", date: "15 Nov 2026", line: "2nd of 14 teams", code: "7RCD0-Q8T1W" },
    { issuer: "CS Society", title: "Attended: Build with React", date: "12 Nov 2026", line: "Checked in 10:04", code: "7RCD0-H3V9N" },
  ],
};

/** Section 10. */
export const rules = {
  heading: "Our rules",
  lines: ["Rank can’t be bought.", "Proof is free.", "No ads.", "We never sell your data."],
};

/** Section 11. Until an organisation page ships, its row goes to that audience's signup. */
export const forOrgs = {
  heading: "For organisations",
  rows: [
    { label: "Recruiters", text: "Search verified skills and contact students who choose to be found.", page: "/recruiters" as Route, fallback: "/recruiters#talk" as Route },
    { label: "Universities", text: "Run your campus on Skilient: dashboards, fairs, hackathons and sponsored Pro.", page: "/universities" as Route, fallback: "/universities#talk" as Route },
    { label: "Faculty", text: "Supervise ventures and confirm your students’ work. Free for faculty.", page: "/faculty" as Route, fallback: "/signup?role=faculty" as Route },
  ],
};

/** Section 12. The price comes from `plans`. */
export const pricingTeaser = {
  heading: "Free is enough to prove yourself.",
  body: "Verification, your rank and tier, and your verified CV are free, always.",
  pro: "Student Pro",
  perks: ["Refresh your CV any time", "ATS-ready PDF export and more layouts", "See who viewed your CV"],
  sponsored: "Conveniences only: Student Pro never changes rank or who finds you.",
  link: "See every feature",
};

/** Section 13. */
export const faq = {
  heading: "Questions",
  items: [
    {
      q: "Who can join?",
      a: "Students and faculty with an email address from a university on Skilient. Recruiters join with a company email, and their company is verified before they can contact anyone.",
    },
    {
      q: "Is it free?",
      a: "Yes. Proving your skills, your rank and tier, your verified CV and being found by recruiters are free. Student Pro adds conveniences such as PDF export and more CV layouts. It never changes your rank.",
    },
    {
      q: "What do you read from my GitHub?",
      a: "Only the repositories you choose when you install the Skilient GitHub App. We read their languages and your own commits and merged pull requests to find the skills you’ve used. For private repositories we never store the code, only commit IDs, file paths and line counts, and the name shows only to you. Disconnecting deletes the repository and commit data.",
    },
    {
      q: "Can my university see my activity?",
      a: "Yes, if your university is on a Growth or Campus plan: its staff can open your student record. Every view is logged, and with Student Pro you can see who viewed it and when. On other plans it never sees individual records; the Basic plan shows only totals for groups of five or more.",
    },
    {
      q: "What happens when I graduate?",
      a: "Your account becomes a graduate account. You keep your profile, CV, skills and evidence, chat and friends, stay visible to recruiters and can still apply to jobs. You can no longer post in your university feed or join university-only ventures.",
    },
    {
      q: "How do recruiters contact me?",
      a: "Through a contact request that names the company and the role. You accept or decline. Only after you accept do they see your name, and you talk in a chat labelled with the company. You choose in Settings whether recruiters can find you at all.",
    },
  ],
};

/** Section 14. */
export const finalCta = {
  heading: "Prove it. Don’t claim it.",
  body: "Join with your university email.",
};

// ---------------------------------------------------------------------------------------------
// Organisation pages, pricing and about (slice 3). Plan names, prices and limits come from
// `plans` and `platform_config`; the copy below never repeats a number billing enforces.
// ---------------------------------------------------------------------------------------------

/** /recruiters (PRD 5.1, 5.20). */
export const recruitersPage = {
  title: "For recruiters",
  description: "Search Pakistani university students by verified skills, see the evidence behind each one, and contact the ones who choose to be found.",
  headline: "Hire on evidence you can check.",
  intro: "Every skill on Skilient comes with its proof: the code a student wrote, the teammates who confirmed it, the faculty who reviewed the work. Search by what students have done, not what they claim.",
  cta: { label: "Talk to us", href: "#talk" },
  signedIn: "Open dashboard",
  see: {
    heading: "What you see",
    items: [
      { title: "Verified skills with their evidence", text: "Each skill shows its level and what proves it: commits and merged pull requests, teammate confirmations, code checks, credentials." },
      { title: "Ventures reviewed by faculty", text: "Projects list the team, each person’s role, and a “Reviewed by faculty” badge when a teacher has scored the work." },
      { title: "A CV that verifies itself", text: "Every CV is signed. Enter its code at skilient.com/verify to see exactly what we checked, and when." },
    ],
    ventureAlt: "A venture’s team (sample content): four members, each with their role, and two open roles.",
  },
  contact: {
    heading: "How contact works",
    steps: [
      { title: "You send a contact request", text: "It names your company and a real role or opportunity. One request uses one credit." },
      { title: "The student decides", text: "They see your company page first, then accept or decline. Requests expire after 14 days." },
      { title: "You talk in a labelled chat", text: "Only after they accept do you see their name. The chat carries your company’s name, and the student can close it any time." },
    ],
    rules: "After a decline you can’t contact the same student again for 90 days. Students choose whether recruiters can find them at all.",
    alt: "A contact request as a student sees it (sample): a verified company, the role, and Accept or Decline.",
  },
  jobs: {
    heading: "Job posts and job fairs",
    text: "Post jobs and internships that students see in Opportunities. Every post shows its pay range; posts without one aren’t accepted. Universities run digital job fairs where your company takes a booth and meets students in a queue.",
    alt: "The Jobs tab (sample posts): a frontend internship and a junior backend role, each with its pay.",
  },
  verification: {
    heading: "Every company is verified",
    text: "Sign up with your work email and turn on two-factor. We check your company before you can see any student, and your email domain must match your website. Students see that you are verified before they answer.",
  },
  plans: {
    heading: "Recruiter plans",
    text: "Start free with names hidden. Paid plans open full profiles, contact requests and team seats.",
    link: "Compare every plan",
  },
  /** Phase 14: recruiter accounts aren't open yet, so the page ends on a sales conversation. */
  talk: {
    heading: "Talk to us",
    text: "Recruiter accounts aren’t open yet. Tell us what you hire for and we’ll reply by email, and bring you in first when they open.",
    name: "Your name",
    role: "Your role",
    roleHelp: "For example, Head of Talent.",
    organisation: "Company",
    email: "Work email",
    message: "Which roles do you hire students for?",
    submit: "Send",
    sent: "Thank you. We have your message and will reply by email.",
    rateLimited: "Too many messages from this network. Try again in an hour.",
  },
  /** The story (decisions 2026-11-01): the reader is a recruiter at Indus Softworks, the sample company, meeting Ayesha's record. */
  orbitAlt: "Proof objects around the headline: a loupe over a record card, a company letter sealed in ink, the verified seal and an endorsement.",
  chapters: [
    {
      id: "search",
      kicker: "Search",
      title: "You search for React. You get proof, not keywords.",
      body: "Search students by verified skill, tier, university and batch. Every result shows what proves each skill. Names stay hidden until a student accepts your request.",
      proof: "Searched · React, Flare and above",
    },
    {
      id: "evidence",
      kicker: "Evidence",
      title: "Open a skill and see the work behind it.",
      body: "Each skill opens on its proof: commits and merged pull requests, teammate confirmations, code checks and credentials. Ventures list the team, each person’s role, and a “Reviewed by faculty” badge when a teacher has scored the work.",
      proof: "React · 8 repositories, 40 active days",
    },
    {
      id: "contact",
      kicker: "Contact",
      title: "You ask first. She decides.",
      body: "Your contact request names your company and a real role, and uses one credit. Ayesha sees your company page first, then accepts or declines. Only after she accepts do you see her name, in a chat labelled with your company that she can close any time.",
      proof: "Requests expire after 14 days",
    },
    {
      id: "hire",
      kicker: "Hire",
      title: "Post the job. Meet her at the fair.",
      body: "Jobs and internships reach students in Opportunities, and every post shows its pay range; posts without one aren’t accepted. Universities run digital job fairs where your company takes a booth and meets students in a queue.",
      proof: "Every post shows its pay",
    },
    {
      id: "trust",
      kicker: "Trust",
      title: "Every company is verified.",
      body: "Sign up with your work email and turn on two-factor. We check your company before you can see any student, and your email domain must match your website. Students see that you are verified before they answer.",
      proof: "Verified company",
    },
  ],
  rules: {
    heading: "The rules of contact",
    lines: ["You ask before you contact.", "She decides, and can close the chat.", "A decline holds for 90 days.", "Students choose whether they can be found."],
  },
  stage: {
    sample: "Sample",
    search: { query: "React", filters: ["Flare and above", "Computer Science", "2027"], results: 12, hidden: "Name hidden until accepted" },
    candidate: { context: "National University of Technology · CS 2027", tier: "Flare", skills: [{ name: "React", level: "Level 4", evidence: "8 repos · 40 active days" }, { name: "TypeScript", level: "Level 4", evidence: "7 repos · 39 active days" }] },
    evidence: { skill: "React", items: ["8 repositories · 40 active days", "Confirmed by Bilal Ahmed, teammate", "Campus Timetable Planner · Team lead", "Endorsed: “Built the whole parser in a week.”"] },
    company: { name: "Indus Softworks", meta: "Software · 51–200 people · Islamabad", verified: "Verified company", domain: "Email domain matches the website" },
  },
};

/** /universities (PRD 5.1, 5.23). */
export const universitiesPage = {
  title: "For universities",
  description: "Run your campus on Skilient: a customisable ecosphere, dashboards, job fairs, hackathons and Student Pro for your students.",
  headline: "Your campus, with proof of what students can do.",
  intro: "Every university on Skilient gets its own ecosphere for free: a university feed, announcements, rankings, faculty and exam calendars. A licence adds dashboards, student records, fairs, hackathons and Student Pro for your students.",
  cta: { label: "Talk to us", href: "#talk" },
  sections: [
    {
      id: "ecosphere",
      heading: "An ecosphere in your colours",
      text: "Your university’s own space inside Skilient: branded pages, modules you switch on and off, announcements pinned for your students, and your exam periods, during which rank doesn’t decay. Free for every university.",
    },
    {
      id: "dashboards",
      heading: "Dashboards built on verified work",
      text: "See which skills your students have proven, by department and batch. Figures cover groups of five or more students only. Basic shows a summary; Growth adds the full dashboard with skills gaps and CSV and PDF exports; Campus adds accreditation reports.",
    },
    {
      id: "records",
      heading: "Individual student records, logged",
      text: "On Growth and Campus your staff can open your own students’ records. Every view is logged, and students on Student Pro see who viewed theirs and when. We say this plainly to students when they sign up.",
    },
    {
      id: "events",
      heading: "Job fairs, hackathons and events",
      text: "Run digital job fairs with company booths and queues, hackathons judged on the work, and campus events with check-in. Fairs and hackathons come with Growth and Campus.",
    },
    {
      id: "pro",
      heading: "Student Pro for your students",
      text: "Growth sponsors Student Pro for final-year students, Campus for everyone. Ability to pay never decides who has a polished CV.",
    },
  ] as const,
  plans: {
    heading: "University licences",
    text: "Licences are yearly, invoiced, and paid by bank transfer or a payment link.",
  },
  /** The story (decisions 2026-11-01): the reader runs careers at National University of Technology, Ayesha's university (a sample). */
  orbitAlt: "Proof objects around the headline: a clay campus with an orange pennant, a job-fair booth with a queue and an event ticket.",
  kickers: { ecosphere: "Your ecosphere", dashboards: "Dashboards", records: "Records", events: "Fairs and events", pro: "Student Pro" },
  titles: {
    ecosphere: "An ecosphere in your colours.",
    dashboards: "See what your students have proven.",
    records: "Open a record. Every view is logged.",
    events: "Run the fair. Fill the queue.",
    pro: "Polish for every final-year student.",
  },
  proofs: {
    ecosphere: "Free for every university",
    dashboards: "Groups of five or more only",
    records: "Logged · seen by the student on Pro",
    events: "Growth and Campus",
    pro: "Ability to pay never decides",
  },
  stage: {
    sample: "Sample",
    name: "National University of Technology",
    modules: ["University feed", "Announcements", "Rankings", "Faculty", "Exam periods"],
    dashboard: { heading: "Proven skills · Computer Science", rows: [{ skill: "React", students: 41 }, { skill: "Python", students: 36 }, { skill: "PostgreSQL", students: 22 }, { skill: "Figma", students: 9 }], hidden: "Groups under 5 are not shown" },
    record: { person: "Ayesha Khan", viewer: "Career Services", when: "2 Nov 2026 · 10:14 PKT", note: "View logged" },
    fair: { heading: "Autumn job fair", booths: [{ name: "Indus Softworks", queue: "3 ahead" }, { name: "Booth 11", queue: "Slot 14:30" }, { name: "Booth 07", queue: "You’re next" }] },
    pro: { line: "Student Pro, sponsored", who: "Final-year students · Growth licence" },
  },
  talk: {
    heading: "Talk to us",
    text: "University accounts aren’t open yet. Tell us about your university and what you need, and we’ll reply by email.",
    name: "Your name",
    role: "Your role",
    roleHelp: "For example, Director of Career Services.",
    organisation: "University",
    email: "Work email",
    message: "What would you like to do with Skilient?",
    submit: "Send",
    sent: "Thank you. We have your message and will reply by email.",
    rateLimited: "Too many messages from this network. Try again in an hour.",
  },
};

/** /faculty (PRD 5.1, 5.21). */
export const facultyPage = {
  title: "For faculty",
  description: "Supervise ventures, confirm your students’ work, post project ideas and grade code checks. Free for faculty.",
  headline: "Your judgement, on the record.",
  intro: "Faculty add the most trusted signal to a student’s proof. What you confirm and review shows on their verified CV, with your name on it. Skilient is free for faculty, and you are never ranked.",
  cta: { label: "Join as faculty", href: "/signup?role=faculty" as Route },
  free: "Free for faculty",
  features: [
    { icon: "ideas", title: "Post project ideas", text: "Write a brief with the skills, team size and deliverables. Students start ventures from it, and the idea closes when its teams are full." },
    { icon: "supervise", title: "Supervise ventures", text: "Follow a team’s contributions and deliverables and comment in a supervisor thread that is separate from the team’s chat." },
    { icon: "confirm", title: "Confirm contributions", text: "Contributions you confirm are marked faculty-confirmed and show on the student’s CV." },
    { icon: "review", title: "Review the work", text: "Score a venture on five criteria with a comment on each. The project then carries a “Reviewed by faculty” badge." },
    { icon: "endorse", title: "Endorse skills", text: "Endorse members of ventures you reviewed or supervised, on the skills they used there." },
    { icon: "grade", title: "Grade code checks", text: "Opt in, choose your skills and a weekly limit, and grade short explanations of real code from your own university." },
  ] as const,
  join: {
    heading: "How you join",
    text: "Sign up with your university email and ask for the faculty role with your department and title. Your university approves it, or we check your university’s public faculty page.",
  },
  /** The story (decisions 2026-11-01): the reader teaches at Ayesha's university and posts the idea behind Library Seat Finder (a sample venture on her CV). */
  orbitAlt: "Proof objects around the headline: a fountain pen, a glowing light bulb for project ideas, a page of code marked up in orange and the verified seal.",
  chapters: [
    { id: "ideas", feature: "ideas", kicker: "Ideas", title: "Post an idea. Teams form around it.", proof: "Library Seat Finder · team of 5" },
    { id: "supervise", feature: "supervise", kicker: "Supervise", title: "Follow the work in its own thread.", proof: "Separate from the team’s chat" },
    { id: "confirm", feature: "confirm", kicker: "Confirm", title: "Confirm what each student did.", proof: "Faculty-confirmed · on her CV" },
    { id: "review", feature: "review", kicker: "Review", title: "Score the work on five criteria.", proof: "Reviewed by faculty" },
    { id: "endorse", feature: "endorse", kicker: "Endorse and grade", title: "Endorse the skills you saw. Grade real code.", proof: "Never ranked yourself" },
  ] as const,
  stage: {
    sample: "Sample",
    idea: { title: "Library Seat Finder", skills: ["React", "Figma"], team: "Teams of 3 to 5", deliverables: "3 deliverables" },
    thread: [
      { who: "You", text: "Does the seat map update when someone leaves?" },
      { who: "Ayesha Khan", text: "Every 30 seconds. The sensor feed is in the repo." },
    ],
    confirm: { line: "Designed the seat map", who: "Ayesha Khan", action: "Confirm", done: "Faculty-confirmed" },
    rubric: ["Problem and scope", "Technical quality", "Collaboration", "Documentation", "Outcome"],
    endorse: { line: "You endorsed Ayesha’s Figma", meta: "Library Seat Finder" },
    grade: { line: "Code check · React", meta: "Explain this hook · graded" },
  },
};

/** /pricing (PRD 4a). Prices and limits come from `plans`. */
export const pricingPage = {
  title: "Pricing",
  description: "Proof is free for every student. Student Pro, recruiter plans and university licences, in PKR.",
  headline: "Proof is free. Polish is optional.",
  intro: "Verification, rank, tiers, your verified CV and being found by recruiters are free for every student, always. Money never buys rank or visibility.",
  audiences: [
    { id: "students", label: "Students" },
    { id: "recruiters", label: "Recruiters" },
    { id: "universities", label: "Universities" },
  ],
  monthly: "Monthly",
  yearly: "Yearly",
  billing: "Billing period",
  free: "Free",
  custom: "Custom",
  perMonth: "a month",
  perYear: "a year",
  trial: "{days}-day free trial",
  students: {
    heading: "Students",
    freeLabel: "Every student",
    freeItems: ["Verified skills, rank, tier and leaderboards", "Your verified CV, refreshed on the 1st of each month", "Share your CV link from Spark tier", "Be found by recruiters, if you choose"],
    sponsored: "Free through your university on a Growth or Campus licence.",
  },
  recruiters: {
    heading: "Recruiters",
    explore: { label: "Explore", items: ["Browse students by tier, skill and university, names hidden", "One job post"] },
    addOns: "Add-ons on every plan",
    sponsoredPost: "Sponsored job post: {price} for {days} days. Labelled “Sponsored” and never ranked above other results in talent search.",
    credits: "Extra contact credits: {price} each.",
    hireFee: "Hiring fee per recorded hire: {intern} for an intern, {fullTime} for a full-time hire. Waived on Growth and Enterprise.",
  },
  universities: {
    heading: "Universities",
    free: { label: "Every university", items: ["Your ecosphere: feed, announcements, rankings, faculty, exam periods", "One admin seat"] },
    note: "Licences are yearly and invoiced.",
  },
  faq: [
    { q: "Does paying change my rank?", a: "No. Rank, tiers, leaderboards and recruiter search never use payment. Student Pro adds conveniences such as PDF export, more CV layouts and seeing who viewed your CV." },
    { q: "How do I pay?", a: "In PKR by card, JazzCash or Easypaisa. University licences are invoiced and paid by bank transfer or a payment link." },
    { q: "Can I cancel?", a: "Yes, any time from Settings. You keep the plan until the end of the period you paid for." },
  ],
};

/**
 * /features (phase 14, decisions 2026-11-02): what students, Student Pro, faculty and organisations
 * get, with no prices. /pricing redirects here.
 */
export const featuresPage = {
  title: "Features",
  description: "What Skilient gives students, faculty and organisations. Proof is free for every student, and money never buys rank.",
  headline: "Proof is free. Everything else is a convenience.",
  intro: "Every student gets verified skills, rank, tiers and a signed CV for free, always. Student Pro adds conveniences and never touches rank or visibility.",
  audiences: [
    { id: "students", label: "Students" },
    { id: "pro", label: "Student Pro" },
    { id: "faculty", label: "Faculty" },
    { id: "organisations", label: "Organisations" },
  ],
  students: {
    heading: "For every student, free",
    items: [
      { title: "Skills proved by your work", text: "Connect GitHub and your commits and merged pull requests level each skill. Teammates and faculty confirm the rest.", proof: "GitHub · teammates · faculty" },
      { title: "Ventures with classmates", text: "Start a project or a startup, recruit a team by role, and finish it together. Completed work stays on your record.", proof: "Roles · team · completion" },
      { title: "Rank, tiers and leaderboards", text: "Six tiers from Raw to Luminary, earned only by verified work. Leaderboards for your university, department and batch.", proof: "Raw → Luminary" },
      { title: "A CV that verifies itself", text: "Your CV is signed and refreshed every month. Anyone can check its code at skilient.com/verify.", proof: "Signed · Ed25519" },
      { title: "The Record", text: "Every society event you attend, office you hold, result you place and hour you volunteer, signed by the society through Skilient. Print it as a transcript next to your academic one.", proof: "Verified societies · a code per entry" },
      { title: "Your campus, in one place", text: "A university feed, chat with friends and teammates, events and the people in your batch.", proof: "Feed · chat · events" },
    ],
  },
  pro: {
    heading: "Student Pro",
    text: "Conveniences for the CV you already earned. It never changes rank, tiers, leaderboards or who finds you.",
    items: ["PDF export of your verified CV", "More CV layouts", "See who viewed your CV, and when", "Insights on your posts"],
    note: "Start Student Pro from Settings → Billing once you have an account. Some universities sponsor it for their students.",
  },
  faculty: {
    heading: "For faculty, free",
    items: ["Supervise ventures and review the work", "Confirm what each student contributed", "Grade code checks", "Post project ideas students can start from", "Endorse the skills you have seen"],
    cta: { label: "Join as faculty", href: "/signup?role=faculty" as Route },
  },
  organisations: {
    heading: "For organisations",
    text: "Recruiter and university accounts aren’t open yet. Tell us what you need and we’ll reply by email.",
    rows: [
      { id: "recruiters", title: "Recruiters", text: "Search students by verified skill and see the evidence behind each one.", href: "/recruiters#talk" as Route },
      { id: "universities", title: "Universities", text: "Dashboards on verified work, student records and events for your campus.", href: "/universities#talk" as Route },
    ],
    cta: "Talk to us",
  },
  faq: [
    { q: "Does paying change my rank?", a: "No. Rank, tiers, leaderboards and search never use payment. Student Pro adds conveniences such as PDF export, more CV layouts and seeing who viewed your CV." },
    { q: "Is Skilient free for students?", a: "Yes. Verification, rank, tiers, leaderboards, ventures and your verified CV are free for every student, always." },
    { q: "Who can join?", a: "Students and faculty at a Pakistani university that is live on Skilient, with their university email." },
  ],
};

/** /about (PRD 5.1). Team and incubation from Ahmed (2026-10-03); portraits are two-colour traces in public/marketing/team/. */
export const aboutPage = {
  title: "About",
  description: "Why Skilient exists: a CV should show the work behind it.",
  headline: "A CV should show the work behind it.",
  story: [
    "In Pakistan, thousands of students graduate every year with CVs that look the same. A recruiter can’t tell who has built something and who has only listed it, so good students are passed over and companies hire on guesswork.",
    "Skilient is a place where students build with classmates and prove what they can do with real work. Code, teammates and faculty confirm each skill, and the proof travels with the student as a signed CV anyone can check.",
  ],
  team: {
    heading: "The team",
    people: [
      { slug: "huzaifa-khan", name: "Huzaifa Khan", role: "CEO and Founder" },
      { slug: "ahmed-mursileen", name: "Ahmed Mursileen", role: "CTO and Co-Founder" },
      { slug: "laiba-owais", name: "Laiba Owais", role: "CHRO and Social Media Manager" },
    ],
  },
  incubation: { label: "Incubated at", name: "NEIC", full: "NUTECH Entrepreneurial and Incubation Center" },
  /** The story (decisions 2026-11-01): the manifesto lights a sentence at a time; the roll call and values follow. */
  sceneAlt: "Two cups of chai on a woven charpai, the dhaba table where conversations about work start.",
  manifesto: "Why we built it",
  values: {
    heading: "What we hold to",
    items: [
      { term: "Proof is free", detail: "Verification, rank and your verified CV never cost a student anything." },
      { term: "Rank can’t be bought", detail: "No payment touches rank, tiers, leaderboards or search." },
      { term: "Students decide", detail: "Recruiters ask before they contact anyone, and students choose whether they can be found." },
      { term: "No ads, no data sales", detail: "We earn from organisations’ plans, never from selling students’ attention or data." },
    ],
  },
};

/** /terms (the user agreement) and /privacy (the privacy notice) are both parts of the published agreement text (PRD 5.1). */
export const legalPages = {
  terms: {
    title: "User agreement",
    description: "The Skilient user agreement every account accepts at signup.",
    unavailable: "The user agreement couldn't be loaded. Try again in a minute.",
  },
  privacy: {
    title: "Privacy notice",
    description: "What Skilient collects, how we use and share it, including Google user data, and how to delete it.",
    unavailable: "The privacy notice couldn't be loaded. Try again in a minute.",
  },
};
