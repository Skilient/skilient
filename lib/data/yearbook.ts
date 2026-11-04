import "server-only";

import { rpcJson } from "@/lib/data/rpc-json";
import { dayLabel, futureTime } from "@/lib/format/time";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { YearbookState } from "@/lib/yearbook/constants";

/**
 * The digital yearbook (PRD 5.33). Each read is one SQL function that checks the caller's batch
 * (supabase/migrations/20261114000002_yearbook.sql). Yearbook photos sit in a private bucket the
 * batch can read, so they're signed here with the reader's own session; avatars are public.
 */

export type { YearbookState };

type RawPhoto = { bucket: "yearbook-photos" | "avatars"; path: string } | null;

async function photoUrls(photos: RawPhoto[]): Promise<(string | null)[]> {
  const privatePaths = photos.filter((p): p is NonNullable<RawPhoto> => p?.bucket === "yearbook-photos").map((p) => p.path);
  const signed = new Map<string, string>();
  if (privatePaths.length) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("yearbook-photos").createSignedUrls(privatePaths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  return photos.map((p) => (!p ? null : p.bucket === "avatars" ? publicImageUrl("avatars", p.path) : (signed.get(p.path) ?? null)));
}

export interface YearbookTile {
  username: string;
  name: string;
  department: string;
  photoUrl: string | null;
  quote: string | null;
  awards: string[];
  me: boolean;
}

export type YearbookHome =
  | { state: "none"; batch: number | null; opensLabel: string | null }
  | {
      state: Exclude<YearbookState, "none">;
      batch: number;
      university: string;
      voteOpensLabel: string;
      voteClosesLabel: string;
      freezesLabel: string;
      myUsername: string | null;
      myNotes: number;
      myPending: number;
      departments: { name: string; pages: YearbookTile[] }[];
    };

export async function getYearbookHome(q: string): Promise<YearbookHome> {
  const raw = await rpcJson<Record<string, unknown>>("yearbook_home", { p_q: q || null });
  if (raw.state === "none") {
    return { state: "none", batch: (raw.batch as number | null) ?? null, opensLabel: raw.opens_on ? dayLabel(raw.opens_on as string) : null };
  }
  const pages = (raw.pages as { username: string; name: string; department: string; photo: RawPhoto; quote: string | null; awards: string[]; me: boolean }[]) ?? [];
  const urls = await photoUrls(pages.map((p) => p.photo));
  const byDept = new Map<string, YearbookTile[]>();
  pages.forEach((p, i) => {
    const list = byDept.get(p.department) ?? [];
    list.push({ username: p.username, name: p.name, department: p.department, photoUrl: urls[i], quote: p.quote, awards: p.awards ?? [], me: p.me });
    byDept.set(p.department, list);
  });
  return {
    state: raw.state as Exclude<YearbookState, "none">,
    batch: raw.batch as number,
    university: (raw.university as string) ?? "",
    voteOpensLabel: dayLabel(raw.vote_opens_at as string),
    voteClosesLabel: futureTime(raw.vote_closes_at as string),
    freezesLabel: dayLabel(raw.freezes_at as string),
    myUsername: (raw.my_username as string | null) ?? null,
    myNotes: Number(raw.my_notes ?? 0),
    myPending: Number(raw.my_pending ?? 0),
    departments: [...byDept].map(([name, list]) => ({ name, pages: list })),
  };
}

export interface YearbookNote {
  id: string;
  body: string;
  writer: string;
  writerUsername: string | null;
  atLabel: string;
}

export type YearbookPage =
  | { hidden: true; state: YearbookState; name: string; username: string }
  | {
      hidden: false;
      state: YearbookState;
      id: string;
      isOwner: boolean;
      name: string;
      username: string;
      department: string | null;
      batch: number;
      university: string;
      photoUrl: string | null;
      quote: string | null;
      visible: boolean;
      highlights: { id: string; title: string; issuer: string; dateLabel: string; code: string }[];
      awards: string[];
      notes: YearbookNote[];
      canSign: boolean;
      myNote: { id: string; body: string; status: "approved" | "pending" } | null;
    };

export async function getYearbookPage(username: string): Promise<YearbookPage> {
  const raw = await rpcJson<Record<string, unknown>>("yearbook_page", { p_username: username });
  if (raw.hidden) return { hidden: true, state: raw.state as YearbookState, name: raw.name as string, username: raw.username as string };
  const [photoUrl] = await photoUrls([raw.photo as RawPhoto]);
  return {
    hidden: false,
    state: raw.state as YearbookState,
    id: raw.id as string,
    isOwner: Boolean(raw.is_owner),
    name: raw.name as string,
    username: raw.username as string,
    department: (raw.department as string | null) ?? null,
    batch: raw.batch as number,
    university: (raw.university as string) ?? "",
    photoUrl,
    quote: (raw.quote as string | null) ?? null,
    visible: Boolean(raw.visible),
    highlights: ((raw.highlights as { id: string; title: string; issuer: string; occurred_on: string; code: string }[]) ?? []).map((h) => ({
      id: h.id,
      title: h.title,
      issuer: h.issuer,
      dateLabel: dayLabel(h.occurred_on),
      code: h.code,
    })),
    awards: (raw.awards as string[]) ?? [],
    notes: ((raw.notes as { id: string; body: string; writer: string; writer_username: string | null; at: string }[]) ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      writer: n.writer,
      writerUsername: n.writer_username,
      atLabel: dayLabel(n.at),
    })),
    canSign: Boolean(raw.can_sign),
    myNote: (raw.my_note as { id: string; body: string; status: "approved" | "pending" } | null) ?? null,
  };
}

export interface MyYearbook {
  state: YearbookState;
  username: string | null;
  name: string;
  photoUrl: string | null;
  ownPhoto: boolean;
  quote: string | null;
  visible: boolean;
  removed: boolean;
  highlights: string[];
  optOut: boolean;
  limits: { quote: number; note: number; highlights: number };
  entries: { id: string; title: string; issuer: string; dateLabel: string }[];
  awards: { title: string; titleKey: string; status: "told" | "declined" | "revealed" }[];
  revealLabel: string;
  notes: (YearbookNote & { status: "approved" | "hidden" | "pending" })[];
}

export async function getMyYearbook(): Promise<MyYearbook> {
  const raw = await rpcJson<Record<string, unknown>>("yearbook_me");
  const [photoUrl] = await photoUrls([raw.photo as RawPhoto]);
  return {
    state: raw.state as YearbookState,
    username: (raw.username as string | null) ?? null,
    name: raw.name as string,
    photoUrl,
    ownPhoto: Boolean(raw.own_photo),
    quote: (raw.quote as string | null) ?? null,
    visible: Boolean(raw.visible),
    removed: Boolean(raw.removed),
    highlights: (raw.highlights as string[]) ?? [],
    optOut: Boolean(raw.opt_out),
    limits: raw.limits as MyYearbook["limits"],
    entries: ((raw.entries as { id: string; title: string; issuer: string; occurred_on: string }[]) ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      issuer: e.issuer,
      dateLabel: dayLabel(e.occurred_on),
    })),
    awards: ((raw.awards as { title: string; title_key: string; status: "told" | "declined" | "revealed" }[]) ?? []).map((a) => ({
      title: a.title,
      titleKey: a.title_key,
      status: a.status,
    })),
    revealLabel: futureTime(raw.reveal_at as string),
    notes: ((raw.notes as { id: string; body: string; writer: string; writer_username: string | null; status: "approved" | "hidden" | "pending"; at: string }[]) ?? []).map(
      (n) => ({ id: n.id, body: n.body, writer: n.writer, writerUsername: n.writer_username, status: n.status, atLabel: dayLabel(n.at) }),
    ),
  };
}

export interface Ballot {
  state: YearbookState;
  voteOpensLabel: string;
  voteClosesLabel: string;
  revealLabel: string;
  optedOut: boolean;
  department: string | null;
  titles: { key: string; title: string; vote: { username: string; name: string } | null; winners: { username: string; name: string }[] | null }[];
}

export async function getBallot(): Promise<Ballot> {
  const raw = await rpcJson<Record<string, unknown>>("yearbook_ballot");
  return {
    state: raw.state as YearbookState,
    voteOpensLabel: futureTime(raw.vote_opens_at as string),
    voteClosesLabel: futureTime(raw.vote_closes_at as string),
    revealLabel: futureTime(raw.reveal_at as string),
    optedOut: Boolean(raw.opted_out),
    department: (raw.department as string | null) ?? null,
    titles: (raw.titles as Ballot["titles"]) ?? [],
  };
}

export async function getNominees(q: string): Promise<{ username: string; name: string }[]> {
  return rpcJson<{ username: string; name: string }[]>("yearbook_nominees", { p_q: q || null });
}
