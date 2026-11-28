import type { ContentService } from "@skilient/contracts/content/v1/content_pb";
import type { CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls every
 * reader-facing method (the reader comes from the token). VisiblePosts serves the services that act on posts:
 * messaging (sharing into chats, W4), notify (W9), trust (reports, W10), market (university hides, W11).
 */
export const callers: CallerPolicy<typeof ContentService> = {
  // community makes a society event's post as the publishing officer (PublishEvent, W7).
  createPost: ["web", "community"],
  editPost: WEB,
  deletePost: WEB,
  votePoll: WEB,
  rsvpEvent: WEB,
  postCards: ["web", "messaging"],
  listPosts: WEB,
  pinnedAnnouncement: WEB,
  pinnedUniversityAnnouncement: WEB,
  addComment: WEB,
  deleteComment: WEB,
  pinComment: WEB,
  hidePost: WEB,
  postComments: WEB,
  surveyForPosts: WEB,
  answerSurvey: WEB,
  recordViews: WEB,
  postInsights: WEB,
  feedPage: WEB,
  visiblePosts: ["web", "messaging", "notify", "trust", "market"],
  linkPreviews: ["messaging"],
  queueLinkPreviews: ["messaging"],
  canListenFeed: ["realtime"],
  commentExcerpts: ["notify"],
};
