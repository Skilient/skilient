import { z } from "zod";

/**
 * Content's settings: the platform_config keys its SQL read (feed.*, survey.*), with the values the current
 * stack holds today as launch defaults. trust's config.changed (W10) writes a newer value into content.config;
 * a stored value is checked by its key's schema and merged over the default (absent fields keep theirs).
 */
const num = z.number();
const int = z.number().int();

export const CONFIG_SCHEMAS = {
  "feed.diversity": z.object({ seen: num, page_size: int, same_author_page: num }).partial(),
  "feed.placement": z.object({ demoted: num, global_boost: num, shipped_boost: num, shipped_boost_hours: int, limited_outside_seed: num }).partial(),
  "feed.relevance": z.object({ cap: num, friend: num, same_batch: num, skills_max: num, skills_step: num, same_program: num, follows_venture: num }).partial(),
  "feed.score": z
    .object({
      base: num,
      bayes_k: num,
      gravity: num,
      conversation: num,
      platform_mean: num,
      friend_commenter: num,
      min_comment_chars: int,
      credible_penalty_max: num,
      credible_penalty_factor: num,
    })
    .partial(),
  "feed.stages": z
    .object({
      seed_hours: int,
      seed_views: int,
      full_answers: int,
      held_reports: int,
      boost_answers: int,
      full_positive: num,
      boost_positive: num,
      demote_answers: int,
      full_commenters: int,
      boost_commenters: int,
      demote_hide_rate: num,
      demote_min_views: int,
      boost_universities: int,
      demote_credible_negative: num,
    })
    .partial(),
  "feed.window": z
    .object({ candidates: int, score_pool: int, max_age_days: int, session_minutes: int, shipped_age_days: int, exploration_every: int, exploration_max_hours: int })
    .partial(),
  "survey.shares": z.object({ rest: num, informative: num, interesting: num }).partial(),
  "survey.weights": z.object({ new_account: num, straight_liner: num, new_account_days: int, friend_or_teammate: num, straight_liner_min: int }).partial(),
  "survey.public_min": int,
  "survey.change_minutes": int,
  "survey.min_latency_ms": int,
  "survey.appropriate_flag_min": int,
} as const;

export const DEFAULTS = {
  "feed.diversity": { seen: 0.3, page_size: 20, same_author_page: 0.5 },
  "feed.placement": { demoted: 0.3, global_boost: 1.5, shipped_boost: 1.5, shipped_boost_hours: 24, limited_outside_seed: 0.4 },
  "feed.relevance": { cap: 2.0, friend: 1.4, same_batch: 1.1, skills_max: 1.3, skills_step: 0.1, same_program: 1.2, follows_venture: 1.4 },
  "feed.score": {
    base: 0.15,
    bayes_k: 10,
    gravity: 1.5,
    conversation: 0.5,
    platform_mean: 0.6,
    friend_commenter: 0.5,
    min_comment_chars: 10,
    credible_penalty_max: 0.8,
    credible_penalty_factor: 2,
  },
  "feed.stages": {
    seed_hours: 2,
    seed_views: 30,
    full_answers: 5,
    held_reports: 3,
    boost_answers: 10,
    full_positive: 0.4,
    boost_positive: 0.5,
    demote_answers: 10,
    full_commenters: 3,
    boost_commenters: 5,
    demote_hide_rate: 0.3,
    demote_min_views: 10,
    boost_universities: 2,
    demote_credible_negative: 0.3,
  },
  "feed.window": { candidates: 300, score_pool: 1000, max_age_days: 7, session_minutes: 10, shipped_age_days: 14, exploration_every: 5, exploration_max_hours: 2 },
  "survey.shares": { rest: 0.5, informative: 0.25, interesting: 0.25 },
  "survey.weights": { new_account: 0.5, straight_liner: 0.3, new_account_days: 3, friend_or_teammate: 0.5, straight_liner_min: 20 },
  "survey.public_min": 3,
  "survey.change_minutes": 10,
  "survey.min_latency_ms": 800,
  "survey.appropriate_flag_min": 3,
} as const;

export type ConfigKey = keyof typeof DEFAULTS;
export type Config = { -readonly [K in ConfigKey]: (typeof DEFAULTS)[K] extends number ? number : { -readonly [F in keyof (typeof DEFAULTS)[K]]: number } };

/** Merges stored values (key → value) over the defaults; a value its schema rejects is ignored. */
export function resolveConfig(stored: Readonly<Record<string, unknown>>): Config {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULTS) as ConfigKey[]) {
    const base = DEFAULTS[key];
    const parsed = key in stored ? CONFIG_SCHEMAS[key].safeParse(stored[key]) : undefined;
    if (!parsed?.success) out[key] = typeof base === "number" ? base : { ...base };
    else out[key] = typeof base === "number" ? parsed.data : { ...base, ...(parsed.data as object) };
  }
  return out as Config;
}

export const isConfigKey = (key: string): key is ConfigKey => key in DEFAULTS;
