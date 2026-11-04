/** Kept free of imports: next.config.ts loads it. */
/** Old /opportunities/* paths and their new homes (next.config.ts, 308). */
export const OPPORTUNITY_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/opportunities", destination: "/openings" },
  { source: "/opportunities/for_you", destination: "/openings" },
  { source: "/opportunities/contact_requests", destination: "/openings/contact-requests" },
  { source: "/opportunities/job_fairs", destination: "/openings/job-fairs" },
  { source: "/opportunities/:path*", destination: "/openings/:path*" },
];
