import type { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import type { CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls every
 * reader-facing method (the reader comes from the token). CanListen is realtime's; the contact-DM methods are
 * market's (W11).
 */
export const callers: CallerPolicy<typeof MessagingService> = {
  getOrCreateDm: WEB,
  myThreads: WEB,
  unreadChatCount: WEB,
  ventureChat: WEB,
  threadPeople: WEB,
  muteThread: WEB,
  markThreadRead: WEB,
  dmReceipt: WEB,
  sendMessage: WEB,
  editMessage: WEB,
  deleteMessage: WEB,
  threadMessages: WEB,
  toggleReaction: WEB,
  pinMessage: WEB,
  threadPins: WEB,
  searchChats: WEB,
  shareTargets: WEB,
  sharePost: WEB,
  undoShare: WEB,
  canListen: ["realtime"],
  messageExcerpts: ["notify"],
  openContactThread: ["market"],
  closeThread: ["market"],
};
