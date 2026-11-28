import type { NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import type { CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls the bell, the
 * preferences and push (the reader is the token's user). Trust (W10) queues ops alerts. Notifications themselves are
 * never made by a call: they come from events.
 */
export const callers: CallerPolicy<typeof NotifyService> = {
  myNotifications: WEB,
  unreadCount: WEB,
  markRead: WEB,
  markAllRead: WEB,
  touchActivity: WEB,
  mySettings: WEB,
  setPref: WEB,
  pushPublicKey: WEB,
  myPushSettings: WEB,
  setPushPref: WEB,
  savePushSubscription: WEB,
  deletePushSubscription: WEB,
  queueOpsAlert: ["trust"],
};
