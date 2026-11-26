import { COPY_EVENTS } from "./store/copies";

/**
 * What work publishes and handles. Every type is listed in packages/contracts/events.json, and
 * tools/lint/test/events.test.ts keeps the two in step with the code.
 */
export const events = {
  publishes: [
    "venture.updated",
    "group.member_changed",
    "venture.follow_changed",
    "venture.completed",
    "application.changed",
    "venture.invite_changed",
    "conversation.allowed",
    "badge.count_changed",
    "milestone.reached",
    "milestone.cleared",
    "fact.value_changed",
    "skill.changed",
    "endorsement.given",
    "endorsement.hidden",
    "credential.changed",
    "code_check.changed",
    "task.completed",
    "task_review.changed",
    "swap.changed",
    "swap.closed",
    "swap.flagged",
    "audit.recorded",
    "user.deletion_confirmed",
    "contribution.logged",
    "contribution.confirmed",
    "pull_request.recorded",
  ],
  handles: [...COPY_EVENTS],
} as const;
