import type { TourDefinition } from "@/lib/tours/types";

/**
 * The student tour (PRD 5.27, remade 2026-11-15): a spotlight that walks through Home, looks
 * inside Openings and Me, and ends back on Home with one thing to do. Steps whose anchor isn't on
 * screen at this size are skipped (`media` says so up front, so "Step x of y" counts only what the
 * person will see). The saved step is the index in this list: add new steps at the end of a page's
 * run, and never reorder lightly (a tour in progress resumes by index).
 */
export const studentTour: TourDefinition = {
  id: "student",
  startPath: "/feed",
  steps: [
    { anchor: "nav-home", path: "/feed", title: "Home", body: "Your university's feed, with your progress beside it. You always land here." },
    { anchor: "nav-explore", title: "Search, or jump anywhere", body: "Find people, ventures and skills, or press Ctrl K to go straight to any page." },
    { anchor: "feed-tabs", path: "/feed", title: "Two feeds", body: "University Feed is your campus. Global Feed is every university on Skilient." },
    { anchor: "composer", path: "/feed", title: "Share what you're building", body: "Post an update, a question or a poll. Posts get comments and one honest question, never likes." },
    { anchor: "progress", path: "/feed", title: "Your progress", body: "Your tier, the one next step worth taking, and a getting-started checklist. Only you see your points." },
    { anchor: "nav-openings", title: "Openings", body: "Everything you can join or apply to. Let's look inside." },
    { anchor: "openings-this-week", path: "/openings", title: "This week", body: "The posts people found most useful, upcoming events and new teams at your university." },
    { anchor: "openings-card", path: "/openings", title: "One card per kind", body: "Venture roles, project ideas, inductions, events, paths and skill swaps. Each card shows its newest opening; open one for the full list." },
    { anchor: "nav-ventures", title: "Ventures", body: "Projects you build with others. Finished ventures count most toward your rank." },
    { anchor: "nav-chat", title: "Chat", body: "Messages with friends and your venture teams." },
    { anchor: "nav-me", title: "Me", body: "Your profile, Record, skills, CV and score: everything you have proved, in one place." },
    {
      anchor: "sidebar-levels",
      path: "/me",
      media: "(min-width: 1024px)",
      title: "Your proof, in one place",
      body: "Record and Credentials hold your proof. CV turns it into a signed document. Score shows exactly how your rank is worked out.",
    },
    { anchor: "nav-notifications", title: "Notifications", body: "Requests, endorsements and replies, in the app and by email as you choose." },
    { anchor: "account-menu", title: "Your account", body: "Settings, feedback and sign out. You can replay this tour from Settings." },
    {
      anchor: "composer",
      path: "/feed",
      title: "You're set",
      body: "That's everything. Your next step is waiting in Your progress, and the quickest way to be seen is your first post.",
      cta: { label: "Write your first post", focus: "composer" },
    },
  ],
};
