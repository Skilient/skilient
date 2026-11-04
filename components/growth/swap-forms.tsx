"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  Button,
  controlBase,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  FieldError,
  HelperText,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { confirmSwapSession, proposeSwapSession, requestSwap, saveSwapWant } from "@/lib/actions/growth";
import { cn } from "@/lib/cn";
import { NO_SHOW_REASONS } from "@/lib/growth/constants";

function useSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.message ?? "That didn't work.");
      after?.();
      router.refresh();
    });
  return { error, pending, run };
}

/** "I want to learn": any skill. */
export function WantForm({ skills }: { skills: { id: string; name: string }[] }) {
  const uid = useId();
  const [skill, setSkill] = useState("");
  const { error, pending, run } = useSubmit();
  return (
    <form
      method="post"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSwapWant({ skill, on: true }), () => setSkill(""));
      }}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor={`${uid}-skill`}>I want to learn</Label>
        <select id={`${uid}-skill`} className={cn(controlBase, "h-11")} value={skill} onChange={(e) => setSkill(e.target.value)} required data-testid="want-skill">
          <option value="">Choose a skill</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" loading={pending} disabled={!skill} data-testid="want-add">
        Add
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  );
}

/** "Ask Ayesha to teach SQL": a note, preferred times and optionally a skill offered back. */
export function RequestSwapButton({
  teacher,
  teacherName,
  skill,
  skillName,
  offerable,
}: {
  teacher: string;
  teacherName: string;
  skill: string;
  skillName: string;
  offerable: { id: string; name: string }[];
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [times, setTimes] = useState("");
  const [offer, setOffer] = useState("");
  const { error, pending, run } = useSubmit();
  const first = teacherName.split(/\s+/)[0] ?? teacherName;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="swap-ask">
          Ask {first}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Ask ${first} to teach ${skillName}`} description="They have 7 days to accept. Once they do, a chat opens between you.">
        <form
          method="post"
          id={`${uid}-f`}
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => requestSwap({ teacher, skill, note, times, offer }), () => setOpen(false));
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-note`}>What do you want to learn?</Label>
            <Textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} data-testid="swap-note" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-times`}>Times that suit you</Label>
            <Input id={`${uid}-times`} value={times} onChange={(e) => setTimes(e.target.value)} maxLength={200} placeholder="Weekday evenings, Saturday mornings" />
          </div>
          {offerable.length ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${uid}-offer`}>Offer a skill back (optional)</Label>
              <select id={`${uid}-offer`} className={cn(controlBase, "h-11")} value={offer} onChange={(e) => setOffer(e.target.value)} aria-describedby={`${uid}-offer-h`}>
                <option value="">No, just this</option>
                {offerable.filter((o) => o.id !== skill).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <HelperText id={`${uid}-offer-h`}>A mutual swap: you teach it back, and each of you can earn a Taught entry.</HelperText>
            </div>
          ) : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={`${uid}-f`} loading={pending} data-testid="swap-send">
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Either side proposes a session: date and time (Pakistan time), length, and a place or link. */
export function ProposeSessionForm({ swapId }: { swapId: string }) {
  const uid = useId();
  const [startsAt, setStartsAt] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [place, setPlace] = useState("");
  const { error, pending, run } = useSubmit();
  return (
    <form
      method="post"
      className="grid gap-3 sm:grid-cols-3"
      aria-labelledby={`${uid}-h`}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => proposeSwapSession({ swapId, startsAt, minutes, place }), () => {
          setStartsAt("");
          setPlace("");
        });
      }}
    >
      <h3 id={`${uid}-h`} className="text-h4 sm:col-span-3">
        Propose a session
      </h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-at`}>When</Label>
        <Input id={`${uid}-at`} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required data-testid="session-at" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-len`}>Length</Label>
        <select id={`${uid}-len`} className={cn(controlBase, "h-11")} value={minutes} onChange={(e) => setMinutes(e.target.value)}>
          {[30, 45, 60, 90, 120, 180].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${uid}-place`}>Where</Label>
        <Input id={`${uid}-place`} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder="Library, or a call link" required data-testid="session-place" />
      </div>
      {error ? <FieldError className="sm:col-span-3">{error}</FieldError> : null}
      <Button type="submit" loading={pending} className="justify-self-start" data-testid="session-propose">
        Propose
      </Button>
    </form>
  );
}

/** "Did your session with Ayesha happen?" Yes (length, optional thank-you note) or No (a reason). */
export function ConfirmSessionForm({ sessionId, teacher, minutes }: { sessionId: string; teacher: string; minutes: number }) {
  const uid = useId();
  const [happened, setHappened] = useState<"yes" | "no">("yes");
  const [length, setLength] = useState(String(minutes));
  const [reason, setReason] = useState<string>("teacher_absent");
  const [note, setNote] = useState("");
  const { error, pending, run } = useSubmit();
  return (
    <form
      method="post"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          confirmSwapSession(
            happened === "yes" ? { sessionId, happened: true, minutes: length, note } : { sessionId, happened: false, reason },
          ),
        );
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Did your session with {teacher} happen?</legend>
        <div className="flex gap-4">
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className="inline-flex items-center gap-2">
              <input type="radio" name={`${uid}-h`} value={v} checked={happened === v} onChange={() => setHappened(v)} className="size-5 accent-[var(--primary)]" />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </fieldset>
      {happened === "yes" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-len`}>How long was it? (minutes)</Label>
            <Input id={`${uid}-len`} type="number" min={15} max={240} step={5} value={length} onChange={(e) => setLength(e.target.value)} className="w-32" data-testid="confirm-minutes" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-note`}>A thank-you note (optional)</Label>
            <Textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} aria-describedby={`${uid}-note-h`} data-testid="confirm-note" />
            <HelperText id={`${uid}-note-h`}>Up to 280 characters. It shows on {teacher}&apos;s profile once they approve it. No ratings, no stars.</HelperText>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-why`}>What happened?</Label>
          <select id={`${uid}-why`} className={cn(controlBase, "h-11")} value={reason} onChange={(e) => setReason(e.target.value)}>
            {NO_SHOW_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" loading={pending} className="self-start" data-testid="confirm-session">
        Save
      </Button>
    </form>
  );
}
