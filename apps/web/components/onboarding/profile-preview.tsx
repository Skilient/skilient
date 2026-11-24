"use client";

import { Buildings, Check, GithubLogo, MagnifyingGlass, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar, SkillChip } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface PreviewData {
  fullName: string;
  avatarUrl: string | null;
  university: string | null;
  department: string | null;
  programme: string | null;
  graduationYear: number | null;
  username: string | null;
  bio: string | null;
  githubLogin: string | null;
  skills: { name: string; level: 1 | 2 | 3 | 4 }[];
  lookingFor: string[];
}

/** Fields the wizard's forms carry that the preview shows as they are typed. */
const LIVE = ["username", "bio", "programme", "department", "graduationYear"] as const;
type Live = (typeof LIVE)[number];

/** One part of the profile: filled in, or a quiet line saying which step fills it. */
function Part({ icon, filled, children, later }: { icon: ReactNode; filled: boolean; children: ReactNode; later: string }) {
  return (
    <li className="flex items-start gap-3" data-filled={filled}>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full",
          filled ? "bg-primary text-text-on-primary" : "neu-well-s text-text-muted",
        )}
      >
        {filled ? <Check weight="bold" className="size-4" /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-body-sm">{filled ? children : <span className="text-text-secondary">{later}</span>}</span>
    </li>
  );
}

/**
 * The profile taking shape beside the onboarding wizard (2026-11-15): what the student has given
 * so far, shown the way classmates will see it, and what each later step adds. It listens to the
 * step's own form fields (by name), so the handle and intro appear as they are typed, with no
 * wiring between the forms and this card. Nothing here is saved: the steps' actions do that.
 */
export function ProfilePreview({ data, className }: { data: PreviewData; className?: string }) {
  const [draft, setDraft] = useState<Partial<Record<Live, string>>>({});
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!el || !(LIVE as readonly string[]).includes(el.name)) return;
      setDraft((d) => ({ ...d, [el.name]: el.value }));
    };
    document.addEventListener("input", onInput);
    document.addEventListener("change", onInput);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("change", onInput);
    };
  }, []);

  const username = (draft.username ?? data.username ?? "").trim();
  const bio = (draft.bio ?? data.bio ?? "").trim();
  const department = (draft.department ?? data.department ?? "").trim();
  const programme = (draft.programme ?? data.programme ?? "").trim();
  const year = (draft.graduationYear ?? (data.graduationYear ? String(data.graduationYear) : "")).trim();
  const study = [programme || department, year ? `Class of ${year}` : null].filter(Boolean).join(" · ");
  const parts = [Boolean(data.university && study), Boolean(username), Boolean(data.githubLogin), data.skills.length > 0, data.lookingFor.length > 0];
  const filled = parts.filter(Boolean).length;

  return (
    <section aria-label="Your profile so far" className={cn("neu-flat flex flex-col gap-4 p-4", className)} data-testid="profile-preview">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-text-secondary uppercase">Your profile so far</p>
        <p className="font-mono text-caption text-text-secondary tabular-nums" data-testid="preview-count">
          {filled} of {parts.length}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Avatar name={data.fullName} src={data.avatarUrl} size="lg" decorative />
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-h4 text-text-primary">{data.fullName}</p>
          <p className="truncate font-mono text-caption text-text-secondary" data-testid="preview-username">
            {username ? `@${username}` : "@your-handle"}
          </p>
        </div>
      </div>
      {bio ? (
        <p className="text-body-sm break-words text-text-primary" data-testid="preview-bio">
          {bio}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        <Part icon={<Buildings weight="bold" className="size-4" />} filled={parts[0]!} later="Step 1 adds your university, programme and batch.">
          <span className="font-semibold text-text-primary">{data.university}</span>
          <span className="text-text-secondary">{study}</span>
        </Part>
        <Part icon={<GithubLogo weight="bold" className="size-4" />} filled={parts[2]!} later="Step 3 connects GitHub, so your code becomes proof.">
          <span className="text-text-primary">
            GitHub connected as <span className="font-mono">@{data.githubLogin}</span>
          </span>
        </Part>
        <Part icon={<Sparkle weight="bold" className="size-4" />} filled={parts[3]!} later="Verified skills appear here, each with its level.">
          <span className="flex flex-wrap gap-1.5">
            {data.skills.slice(0, 6).map((s) => (
              <SkillChip key={s.name} name={s.name} level={s.level} verified />
            ))}
          </span>
        </Part>
        <Part icon={<MagnifyingGlass weight="bold" className="size-4" />} filled={parts[4]!} later="Step 5 says what you are looking for.">
          <span className="text-text-primary">Looking for: {data.lookingFor.join(", ").toLowerCase()}</span>
        </Part>
      </ul>
    </section>
  );
}
