"use client";

import { Plus, X } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button, Checkbox, FieldError, HelperText, Input, Label, Stepper, Textarea } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { publishEvent, saveSocietyEvent, uploadEventCover } from "@/lib/actions/events";
import { useMounted } from "@/lib/hooks/use-mounted";
import { cn } from "@/lib/cn";
import { EVENT_TYPES, eventTypeLabel, pkr, QUESTION_KINDS, RECORD_KINDS } from "@/lib/societies/constants";

const STEPS = ["Basics", "When and where", "Tickets", "Who can come", "Form", "Record", "Review"];

interface SessionDraft {
  title: string;
  startsAt: string;
  endsAt: string;
}
interface TicketDraft {
  name: string;
  capacity: number;
  paid: boolean;
  price: number;
}
interface QuestionDraft {
  label: string;
  kind: string;
  options: string;
  required: boolean;
}

export interface EventDraft {
  id?: string;
  status?: string;
  type: string;
  title: string;
  description: string;
  coverPath: string | null;
  coverUrl: string | null;
  location: string;
  link: string;
  sessions: SessionDraft[];
  tickets: TicketDraft[];
  scope: "university" | "all" | "groups";
  departments: string;
  batches: string;
  approvalMode: "automatic" | "manual";
  opensAt: string;
  closesAt: string;
  teams: boolean;
  teamMin: number;
  teamMax: number;
  questions: QuestionDraft[];
  recordKinds: string[];
  completedMin: number | null;
  volunteerHours: boolean;
  refundPolicy: "none" | "until";
  refundDays: number;
  cohosts: string;
}

/** ISO (stored in UTC) → the browser's datetime-local value. Runs only after hydration. */
function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Raw = Record<string, unknown>;

/** The saved event (edit) or a copy of one (duplicate, dates cleared) as the stepper's draft. */
function fromPayload(p: Raw | null, duplicate: boolean, coverUrl: string | null): EventDraft {
  const blank: EventDraft = {
    type: "talk",
    title: "",
    description: "",
    coverPath: null,
    coverUrl: null,
    location: "",
    link: "",
    sessions: [{ title: "", startsAt: "", endsAt: "" }],
    tickets: [{ name: "General", capacity: 50, paid: false, price: 500 }],
    scope: "university",
    departments: "",
    batches: "",
    approvalMode: "automatic",
    opensAt: "",
    closesAt: "",
    teams: false,
    teamMin: 2,
    teamMax: 4,
    questions: [],
    recordKinds: ["attended"],
    completedMin: null,
    volunteerHours: false,
    refundPolicy: "none",
    refundDays: 3,
    cohosts: "",
  };
  if (!p) return blank;
  const el = (p.eligibility ?? {}) as { scope?: string; departments?: string[]; batches?: number[] };
  const team = p.team as { min: number; max: number } | null;
  return {
    id: duplicate ? undefined : String(p.id),
    status: duplicate ? undefined : String(p.status),
    type: String(p.type),
    title: String(p.title ?? ""),
    description: String(p.description ?? ""),
    coverPath: (p.cover_path as string | null) ?? null,
    coverUrl,
    location: String(p.location ?? ""),
    link: String(p.link ?? ""),
    sessions: duplicate
      ? [{ title: "", startsAt: "", endsAt: "" }]
      : ((p.sessions ?? []) as Raw[]).map((s) => ({ title: String(s.title ?? ""), startsAt: toLocal(String(s.starts_at)), endsAt: toLocal(String(s.ends_at)) })),
    tickets: ((p.ticket_types ?? []) as Raw[]).map((t) => ({
      name: String(t.name),
      capacity: Number(t.capacity),
      paid: t.price_pkr != null,
      price: t.price_pkr != null ? Number(t.price_pkr) : 500,
    })),
    scope: (el.scope as EventDraft["scope"]) ?? "university",
    departments: (el.departments ?? []).join(", "),
    batches: (el.batches ?? []).join(", "),
    approvalMode: (p.approval_mode as EventDraft["approvalMode"]) ?? "automatic",
    opensAt: duplicate ? "" : toLocal(p.registration_opens_at as string | null),
    closesAt: duplicate ? "" : toLocal(p.registration_closes_at as string | null),
    teams: Boolean(team),
    teamMin: team?.min ?? 2,
    teamMax: team?.max ?? 4,
    questions: ((p.questions ?? []) as Raw[]).map((q) => ({
      label: String(q.label),
      kind: String(q.kind),
      options: ((q.options ?? []) as string[]).join(", "),
      required: Boolean(q.required),
    })),
    recordKinds: (p.record_kinds ?? ["attended"]) as string[],
    completedMin: p.completed_min == null ? null : Number(p.completed_min),
    volunteerHours: Boolean(p.volunteer_hours),
    refundPolicy: (p.refund_policy as EventDraft["refundPolicy"]) ?? "none",
    refundDays: p.refund_days == null ? 3 : Number(p.refund_days),
    cohosts: ((p.cohosts ?? []) as string[]).join(", "),
  };
}

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Create or edit a society event (PRD 5.31): seven steps, the remaining ones always named. Saving keeps
 * a draft; Publish posts it to the feed as the society and tells followers and members. Every rule is
 * checked again in SQL (prices PKR 100–10,000, paid tickets need confirmed payment details, eligibility
 * can't narrow after the first registration).
 */
export function EventStepper(props: { societyId: string; slug: string; payload: Raw | null; duplicate: boolean; coverUrl: string | null; hasPaymentDetails: boolean }) {
  const mounted = useMounted();
  if (!mounted) return <div aria-hidden className="neu-card h-96" data-testid="event-stepper-placeholder" />;
  return <StepperForm {...props} />;
}

function StepperForm({
  societyId,
  slug,
  payload,
  duplicate,
  coverUrl,
  hasPaymentDetails,
}: {
  societyId: string;
  slug: string;
  payload: Raw | null;
  duplicate: boolean;
  coverUrl: string | null;
  hasPaymentDetails: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [d, setD] = useState<EventDraft>(() => fromPayload(payload, duplicate, coverUrl));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const anyPaid = d.tickets.some((t) => t.paid);
  const editingLive = d.status === "published" || d.status === "live";

  function input() {
    return {
      societyId,
      id: d.id,
      type: d.type,
      title: d.title,
      description: d.description,
      coverPath: d.coverPath,
      location: d.location,
      link: d.link,
      sessions: d.sessions.map((s) => ({ title: s.title, startsAt: toIso(s.startsAt) ?? "", endsAt: toIso(s.endsAt) ?? "" })),
      ticketTypes: d.tickets.map((t) => ({ name: t.name, capacity: t.capacity, pricePkr: t.paid ? t.price : null })),
      eligibility: {
        scope: d.scope,
        departments: d.scope === "groups" ? list(d.departments) : [],
        batches: d.scope === "groups" ? list(d.batches).map(Number).filter((n) => Number.isInteger(n)) : [],
      },
      team: d.teams ? { min: d.teamMin, max: d.teamMax } : null,
      approvalMode: d.approvalMode,
      registrationOpensAt: toIso(d.opensAt),
      registrationClosesAt: toIso(d.closesAt),
      questions: d.questions.map((q) => ({ label: q.label, kind: q.kind, options: list(q.options), required: q.required })),
      recordKinds: d.recordKinds,
      completedMin: d.recordKinds.includes("completed") ? d.completedMin : null,
      volunteerHours: d.volunteerHours,
      refundPolicy: anyPaid ? d.refundPolicy : "none",
      refundDays: anyPaid && d.refundPolicy === "until" ? d.refundDays : null,
      cohosts: list(d.cohosts),
    };
  }

  function check(i: number): boolean {
    const e: Record<string, string> = {};
    if (i === 0 && d.title.trim().length < 3) e.title = "Give the event a title.";
    if (i === 1) {
      if (d.location.trim().length < 2 && !d.link.trim()) e.location = "Add a place or a link.";
      if (d.sessions.some((s) => !s.startsAt || !s.endsAt)) e.sessions = "Give every session a start and an end.";
      else if (d.sessions.some((s) => new Date(s.endsAt) <= new Date(s.startsAt))) e.sessions = "Each session ends after it starts.";
    }
    if (i === 2) {
      if (d.tickets.some((t) => t.name.trim().length < 2)) e.tickets = "Name every ticket type.";
      if (d.tickets.some((t) => t.paid && (t.price < 100 || t.price > 10000))) e.tickets = "Prices are PKR 100 to 10,000.";
    }
    if (i === 3 && d.teams && d.teamMin > d.teamMax) e.team = "The smallest team can't be bigger than the largest.";
    if (i === 4 && d.questions.some((q) => (q.kind === "single" || q.kind === "multi") && list(q.options).length < 2)) e.questions = "Choice questions need at least 2 options.";
    if (i === 5 && d.recordKinds.length === 0) e.record = "Pick at least one Record entry.";
    setFields(e);
    return Object.keys(e).length === 0;
  }

  function save(publish: boolean) {
    if (![0, 1, 2, 3, 4, 5].every((i) => check(i))) {
      setError("Some steps need fixing; they're marked.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await saveSocietyEvent(input());
      if (!r.ok) {
        setError(r.message);
        setFields(r.fields ?? {});
        return;
      }
      const eventId = r.data;
      if (publish && (!d.status || d.status === "draft")) {
        const p = await publishEvent({ eventId });
        if (!p.ok) {
          setError(`Saved as a draft, but not published: ${p.message}`);
          router.push(`/events/${eventId}/manage` as Route);
          return;
        }
      }
      router.push(`/events/${eventId}/manage` as Route);
    });
  }

  async function addCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("societyId", societyId);
    form.set("cover", file);
    const r = await uploadEventCover(form);
    setUploading(false);
    if (!r.ok) return setFields({ cover: r.message });
    setD((x) => ({ ...x, coverPath: r.data.path, coverUrl: URL.createObjectURL(file) }));
  }

  const field = (name: string) => (fields[name] ? <FieldError>{fields[name]}</FieldError> : null);

  return (
    <form method="post" noValidate className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} aria-label="Event" data-testid="event-stepper">
      <Stepper steps={STEPS} current={step} />
      {error ? <FormAlert>{error}</FormAlert> : null}
      {editingLive ? <p className="text-body-sm text-text-secondary">This event is published. Changing the time or place tells everyone registered.</p> : null}

      {step === 0 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Basics</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-type`}>Type</Label>
            <select id={`${id}-type`} value={d.type} onChange={(e) => set("type", e.target.value)} className={cn(controlBase, "h-10")}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input id={`${id}-title`} value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} aria-invalid={Boolean(fields.title)} />
            {field("title")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-desc`}>Description</Label>
            <Textarea id={`${id}-desc`} rows={5} value={d.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cover`}>Cover image (optional)</Label>
            {d.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of the uploaded cover
              <img src={d.coverUrl} alt="" className="h-32 w-full max-w-md rounded-lg object-cover" />
            ) : null}
            <input id={`${id}-cover`} type="file" accept="image/jpeg,image/png,image/webp" className="text-body-sm" disabled={uploading} onChange={(e) => void addCover(e.target.files?.[0])} />
            {fields.cover ? <FieldError>{fields.cover}</FieldError> : <HelperText>{uploading ? "Uploading…" : "Wide images work best. JPEG, PNG or WebP up to 5 MB."}</HelperText>}
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">When and where</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-loc`}>Place</Label>
              <Input id={`${id}-loc`} value={d.location} maxLength={200} onChange={(e) => set("location", e.target.value)} placeholder="Auditorium, Block C" aria-invalid={Boolean(fields.location)} />
              {field("location")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-link`}>Or a link (online)</Label>
              <Input id={`${id}-link`} type="url" inputMode="url" placeholder="https://" value={d.link} onChange={(e) => set("link", e.target.value)} />
              {field("link")}
            </div>
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-label text-text-secondary uppercase">Sessions</legend>
            <HelperText>One session for a single talk; several for a multi-day event. Check-in counts each session.</HelperText>
            {d.sessions.map((s, i) => (
              <div key={i} className="neu-tile grid gap-2 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-s${i}-t`}>Session {i + 1} name (optional)</Label>
                  <Input id={`${id}-s${i}-t`} value={s.title} maxLength={80} onChange={(e) => set("sessions", d.sessions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-s${i}-a`}>Starts</Label>
                  <Input id={`${id}-s${i}-a`} type="datetime-local" value={s.startsAt} onChange={(e) => set("sessions", d.sessions.map((x, j) => (j === i ? { ...x, startsAt: e.target.value } : x)))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-s${i}-b`}>Ends</Label>
                  <Input id={`${id}-s${i}-b`} type="datetime-local" value={s.endsAt} onChange={(e) => set("sessions", d.sessions.map((x, j) => (j === i ? { ...x, endsAt: e.target.value } : x)))} />
                </div>
                {d.sessions.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove session ${i + 1}`} onClick={() => set("sessions", d.sessions.filter((_, j) => j !== i))}>
                    <X aria-hidden weight="bold" className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {field("sessions")}
            {d.sessions.length < 10 ? (
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set("sessions", [...d.sessions, { title: "", startsAt: "", endsAt: "" }])}>
                <Plus aria-hidden weight="bold" className="size-4" />
                Add a session
              </Button>
            ) : null}
          </fieldset>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Tickets</legend>
          {d.tickets.map((t, i) => (
            <div key={i} className="neu-tile grid gap-2 p-3 sm:grid-cols-[2fr_1fr_auto_1fr_auto] sm:items-end">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-t${i}-n`}>Ticket type {i + 1}</Label>
                <Input id={`${id}-t${i}-n`} value={t.name} maxLength={60} onChange={(e) => set("tickets", d.tickets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-t${i}-c`}>Seats</Label>
                <Input
                  id={`${id}-t${i}-c`}
                  type="number"
                  min={1}
                  max={10000}
                  value={t.capacity}
                  onChange={(e) => set("tickets", d.tickets.map((x, j) => (j === i ? { ...x, capacity: Number(e.target.value) || 1 } : x)))}
                />
              </div>
              <label className="flex h-10 items-center gap-2 text-body-sm">
                <Checkbox checked={t.paid} onCheckedChange={(v) => set("tickets", d.tickets.map((x, j) => (j === i ? { ...x, paid: v === true } : x)))} />
                Paid
              </label>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-t${i}-p`}>Price (PKR)</Label>
                <Input
                  id={`${id}-t${i}-p`}
                  type="number"
                  min={100}
                  max={10000}
                  disabled={!t.paid}
                  value={t.price}
                  onChange={(e) => set("tickets", d.tickets.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))}
                />
              </div>
              {d.tickets.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove ticket type ${i + 1}`} onClick={() => set("tickets", d.tickets.filter((_, j) => j !== i))}>
                  <X aria-hidden weight="bold" className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {field("tickets")}
          {d.tickets.length < 5 ? (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set("tickets", [...d.tickets, { name: "", capacity: 20, paid: false, price: 500 }])}>
              <Plus aria-hidden weight="bold" className="size-4" />
              Add a ticket type
            </Button>
          ) : null}
          {anyPaid ? (
            <div className="flex flex-col gap-3 border-t border-border-muted pt-3">
              <p className="text-body-sm text-text-secondary">
                Students pay the society directly and upload the receipt; an officer checks it. Skilient doesn&apos;t handle the money.
                {hasPaymentDetails ? "" : " Add and confirm the society's payment details before you publish."}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-refund`}>Refunds</Label>
                  <select id={`${id}-refund`} value={d.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value as EventDraft["refundPolicy"])} className={cn(controlBase, "h-10")}>
                    <option value="none">No refunds</option>
                    <option value="until">Refund until some days before</option>
                  </select>
                </div>
                {d.refundPolicy === "until" ? (
                  <div className="flex w-36 flex-col gap-1.5">
                    <Label htmlFor={`${id}-refund-days`}>Days before</Label>
                    <Input id={`${id}-refund-days`} type="number" min={1} max={60} value={d.refundDays} onChange={(e) => set("refundDays", Number(e.target.value) || 1)} />
                  </div>
                ) : null}
              </div>
              {field("refundDays")}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Who can come</legend>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text-secondary uppercase">Eligibility</legend>
            {(
              [
                ["university", "Students at your university"],
                ["groups", "Only some departments or batches"],
                ["all", "Students at any university on Skilient"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-body">
                <input type="radio" name={`${id}-scope`} value={v} checked={d.scope === v} onChange={() => set("scope", v)} className="size-4 accent-[var(--primary)]" />
                {label}
              </label>
            ))}
          </fieldset>
          {d.scope === "groups" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-depts`}>Departments</Label>
                <Input id={`${id}-depts`} value={d.departments} onChange={(e) => set("departments", e.target.value)} placeholder="Computer Science, Software Engineering" />
                <HelperText>Separate with commas. Leave empty for every department.</HelperText>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${id}-batches`}>Graduation years</Label>
                <Input id={`${id}-batches`} value={d.batches} onChange={(e) => set("batches", e.target.value)} placeholder="2027, 2028" />
              </div>
            </div>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text-secondary uppercase">Approval</legend>
            <label className="flex items-center gap-2 text-body">
              <input type="radio" name={`${id}-approval`} checked={d.approvalMode === "automatic"} onChange={() => set("approvalMode", "automatic")} className="size-4 accent-[var(--primary)]" />
              Automatic: first come, first served, then the waitlist
            </label>
            <label className="flex items-center gap-2 text-body">
              <input type="radio" name={`${id}-approval`} checked={d.approvalMode === "manual"} onChange={() => set("approvalMode", "manual")} className="size-4 accent-[var(--primary)]" />
              An officer approves each registration
            </label>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-opens`}>Registration opens (optional)</Label>
              <Input id={`${id}-opens`} type="datetime-local" value={d.opensAt} onChange={(e) => set("opensAt", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-closes`}>Registration closes (optional)</Label>
              <Input id={`${id}-closes`} type="datetime-local" value={d.closesAt} onChange={(e) => set("closesAt", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-body">
              <Checkbox checked={d.teams} onCheckedChange={(v) => set("teams", v === true)} />
              Students register in teams
            </label>
            {d.teams ? (
              <div className="flex flex-wrap gap-3">
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor={`${id}-tmin`}>Smallest team</Label>
                  <Input id={`${id}-tmin`} type="number" min={2} max={6} value={d.teamMin} onChange={(e) => set("teamMin", Number(e.target.value) || 2)} />
                </div>
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor={`${id}-tmax`}>Largest team</Label>
                  <Input id={`${id}-tmax`} type="number" min={2} max={6} value={d.teamMax} onChange={(e) => set("teamMax", Number(e.target.value) || 2)} />
                </div>
              </div>
            ) : null}
            {field("team")}
          </div>
        </fieldset>
      ) : null}

      {step === 4 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Registration form</legend>
          <p className="text-body-sm text-text-secondary">Up to 8 questions. Ask only what you need; answers are visible to the society&apos;s officers.</p>
          {d.questions.map((q, i) => (
            <div key={i} className="neu-tile flex flex-col gap-2 p-3">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-q${i}`}>Question {i + 1}</Label>
                  <Input id={`${id}-q${i}`} value={q.label} maxLength={200} onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-q${i}-k`}>Answer</Label>
                  <select
                    id={`${id}-q${i}-k`}
                    value={q.kind}
                    onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                    className={cn(controlBase, "h-10")}
                  >
                    {QUESTION_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove question ${i + 1}`} onClick={() => set("questions", d.questions.filter((_, j) => j !== i))}>
                  <X aria-hidden weight="bold" className="size-4" />
                </Button>
              </div>
              {q.kind === "single" || q.kind === "multi" ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${id}-q${i}-o`}>Options</Label>
                  <Input id={`${id}-q${i}-o`} value={q.options} onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} placeholder="Beginner, Intermediate, Advanced" />
                  <HelperText>Separate with commas.</HelperText>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-body-sm">
                <Checkbox checked={q.required} onCheckedChange={(v) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, required: v === true } : x)))} />
                Required
              </label>
            </div>
          ))}
          {field("questions")}
          {d.questions.length < 8 ? (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set("questions", [...d.questions, { label: "", kind: "short", options: "", required: false }])}>
              <Plus aria-hidden weight="bold" className="size-4" />
              Add a question
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      {step === 5 ? (
        <fieldset className="neu-card flex flex-col gap-4 p-5">
          <legend className="sr-only">Record</legend>
          <p className="text-body-sm text-text-secondary">What attendees can earn on their Record after close-out. Attendance never adds rank.</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text-secondary uppercase">Record entries</legend>
            {RECORD_KINDS.map((k) => (
              <label key={k.value} className="flex items-start gap-2 text-body">
                <Checkbox
                  checked={d.recordKinds.includes(k.value)}
                  onCheckedChange={(v) => set("recordKinds", v === true ? [...d.recordKinds, k.value] : d.recordKinds.filter((x) => x !== k.value))}
                />
                <span>
                  {k.label} <span className="text-body-sm text-text-secondary">{k.hint}</span>
                </span>
              </label>
            ))}
            {field("record")}
          </fieldset>
          {d.recordKinds.includes("completed") ? (
            <div className="flex w-56 flex-col gap-1.5">
              <Label htmlFor={`${id}-cmin`}>Sessions needed to complete</Label>
              <Input id={`${id}-cmin`} type="number" min={1} max={20} value={d.completedMin ?? d.sessions.length} onChange={(e) => set("completedMin", Number(e.target.value) || 1)} />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-body">
            <Checkbox checked={d.volunteerHours} onCheckedChange={(v) => set("volunteerHours", v === true)} />
            Log volunteer hours at close-out
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cohosts`}>Co-hosting societies (optional)</Label>
            <Input id={`${id}-cohosts`} value={d.cohosts} onChange={(e) => set("cohosts", e.target.value)} placeholder="their-society-handle" />
            <HelperText>Their handle from the society page address, separated by commas. Their officers accept.</HelperText>
          </div>
        </fieldset>
      ) : null}

      {step === 6 ? (
        <section className="neu-card flex flex-col gap-3 p-5" aria-label="Review">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
            <dt className="text-text-secondary">Event</dt>
            <dd className="font-semibold">
              {d.title || "Untitled"} · {eventTypeLabel(d.type)}
            </dd>
            <dt className="text-text-secondary">Where</dt>
            <dd>{d.location || d.link || "Not set"}</dd>
            <dt className="text-text-secondary">Sessions</dt>
            <dd className="neu-mono">{d.sessions.map((s) => s.startsAt.replace("T", " ")).join(" · ") || "Not set"}</dd>
            <dt className="text-text-secondary">Tickets</dt>
            <dd>{d.tickets.map((t) => `${t.name} (${t.capacity}, ${t.paid ? pkr(t.price) : "free"})`).join(" · ")}</dd>
            <dt className="text-text-secondary">Who</dt>
            <dd>
              {d.scope === "all" ? "Any university" : d.scope === "groups" ? "Some departments or batches" : "Your university"} ·{" "}
              {d.approvalMode === "manual" ? "officer approval" : "automatic"}
              {d.teams ? ` · teams of ${d.teamMin}–${d.teamMax}` : ""}
            </dd>
            <dt className="text-text-secondary">Form</dt>
            <dd>{d.questions.length ? `${d.questions.length} questions` : "No questions"}</dd>
            <dt className="text-text-secondary">Record</dt>
            <dd>{d.recordKinds.map((k) => RECORD_KINDS.find((x) => x.value === k)?.label).join(", ")}</dd>
          </dl>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => check(step) && setStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)} data-testid="save-event">
              {d.id ? "Save changes" : "Save draft"}
            </Button>
            {!d.status || d.status === "draft" ? (
              <Button type="button" loading={pending} onClick={() => save(true)} data-testid="publish-event">
                Save and publish
              </Button>
            ) : null}
          </>
        )}
      </div>
      <p className="text-caption text-text-secondary">
        Back to{" "}
        <Link href={`/societies/${slug}` as Route} className="underline underline-offset-4">
          the society
        </Link>
        . Nothing is saved until you save.
      </p>
    </form>
  );
}
