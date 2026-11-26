import { refuse, type RefusalKind, type Refusal } from "@skilient/platform";

/**
 * Every refusal messaging gives: a short reason (sent in x-refusal), its kind (the Connect code), today's
 * wording (for web, which shows the user the message; W13), and the SQLSTATE the current stack raised for it
 * (for the golden replays). No user content in any reason.
 */
export const REFUSALS = {
  not_signed_in: { kind: "not_signed_in", text: "sign in first", sqlstate: "42501" },
  not_signed_in_plain: { kind: "not_signed_in", text: "not signed in", sqlstate: "42501" },
  finish_onboarding: { kind: "not_allowed", text: "finish onboarding first", sqlstate: "42501" },
  invalid_input: { kind: "invalid_input", text: "invalid input", sqlstate: "22023" },
  no_such_user: { kind: "not_found", text: "no one has that username", sqlstate: "P0002" },
  self_message: { kind: "invalid_input", text: "you can't message yourself", sqlstate: "22023" },
  dm_not_allowed: { kind: "not_allowed", text: "you can message friends, or the people on an application or skill swap you share", sqlstate: "42501" },
  not_in_chat: { kind: "not_allowed", text: "you're not in this chat", sqlstate: "42501" },
  conversation_closed: { kind: "not_allowed", text: "this conversation is closed", sqlstate: "42501" },
  message_length: { kind: "invalid_input", text: "messages are up to 10,000 characters", sqlstate: "23514" },
  empty_message: { kind: "invalid_input", text: "write a message or add an image", sqlstate: "23514" },
  post_unavailable: { kind: "invalid_input", text: "that post isn't available to share", sqlstate: "22023" },
  reply_gone: { kind: "invalid_input", text: "that message is no longer here to reply to", sqlstate: "22023" },
  image_missing: { kind: "invalid_input", text: "the image is missing; attach it again", sqlstate: "22023" },
  chat_rate_limited: { kind: "too_many", text: "you're sending messages too fast", sqlstate: "54000" },
  edit_own_only: { kind: "not_allowed", text: "you can only edit your own messages", sqlstate: "42501" },
  delete_own_only: { kind: "not_allowed", text: "you can only delete your own messages", sqlstate: "42501" },
  message_unavailable: { kind: "not_allowed", text: "that message isn't available", sqlstate: "42501" },
  reaction_choice: { kind: "invalid_input", text: "pick one of the six reactions", sqlstate: "22023" },
  reaction_rate_limited: { kind: "too_many", text: "you're reacting too fast", sqlstate: "54000" },
  pin_owner_only: { kind: "not_allowed", text: "only the venture owner can pin messages in the team chat", sqlstate: "42501" },
  pins_full: { kind: "invalid_input", text: "up to 3 messages can be pinned; unpin one first", sqlstate: "23514" },
  share_unavailable: { kind: "not_found", text: "that post isn't available to share", sqlstate: "P0002" },
  pick_chat: { kind: "invalid_input", text: "pick a chat", sqlstate: "22023" },
  share_max: { kind: "invalid_input", text: "share to up to 5 chats at once", sqlstate: "23514" },
  note_length: { kind: "invalid_input", text: "notes are up to 1,000 characters", sqlstate: "23514" },
  share_where: { kind: "not_allowed", text: "you can share into DMs and venture chats", sqlstate: "42501" },
  undo_late: { kind: "precondition", text: "too late to undo", sqlstate: "55000" },
} as const satisfies Record<string, { kind: RefusalKind; text: string; sqlstate: string }>;

export type RefusalReason = keyof typeof REFUSALS;

/** A typed refusal with messaging's reason code. */
export function refused(reason: RefusalReason): Refusal {
  return refuse(REFUSALS[reason].kind, reason);
}
