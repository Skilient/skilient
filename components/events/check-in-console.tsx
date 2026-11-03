"use client";

import { Camera, CameraSlash, CheckCircle, MagnifyingGlass, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { controlBase } from "@/components/ui/field";
import { checkInEmail, checkInPerson, checkInScan, checkInSearch, eventHeadcount } from "@/lib/actions/events";
import { useMounted } from "@/lib/hooks/use-mounted";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

interface Result {
  result: "green" | "amber" | "red";
  name?: string;
  message?: string;
  claim?: boolean;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * The door (PRD 5.31): scan the signed ticket QR with the camera (BarcodeDetector), or type or paste
 * the code where the browser can't scan; search by name; add a student by university email (recorded
 * for a Record claim later). Each check-in is per session, and the headcount updates live over a
 * private Realtime channel only event staff can read.
 */
export function CheckInConsole({
  eventId,
  sessions,
  initial,
}: {
  eventId: string;
  sessions: { id: string; title: string | null; label: string }[];
  initial: { sessionId: string; checkedIn: number; expected: number };
}) {
  const id = useId();
  const [sessionId, setSessionId] = useState(initial.sessionId);
  const [count, setCount] = useState({ sessionId: initial.sessionId, checkedIn: initial.checkedIn });
  const [expected, setExpected] = useState(initial.expected);
  const [result, setResult] = useState<Result | null>(null);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<{ user_id: string; name: string; status: string; checked_in: boolean }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  // Decided after hydration so the server and first client render agree.
  const mounted = useMounted();
  const canScan = mounted && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
  const shown = count.sessionId === sessionId ? count.checkedIn : null;

  // Live headcount: the server broadcasts on event:{id} after every check-in.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    void supabase.realtime.setAuth().then(() => {
      if (!alive) return;
      channel = supabase
        .channel(`event:${eventId}`, { config: { private: true } })
        .on("broadcast", { event: "headcount" }, ({ payload }) => {
          const p = payload as { session_id: string; checked_in: number };
          setCount({ sessionId: p.session_id, checkedIn: p.checked_in });
        })
        .subscribe();
    });
    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [eventId]);

  const refresh = useCallback(
    (sid: string) => {
      void eventHeadcount({ eventId, sessionId: sid }).then((r) => {
        if (r.ok) {
          setCount({ sessionId: r.data.session_id, checkedIn: r.data.checked_in });
          setExpected(r.data.expected);
        }
      });
    },
    [eventId],
  );

  const show = useCallback(
    (r: { ok: true; data: Result } | { ok: false; message: string }) => {
      setResult(r.ok ? r.data : { result: "red", message: r.message });
      if (r.ok && r.data.result === "green") refresh(sessionId);
    },
    [refresh, sessionId],
  );

  const scan = useCallback(
    async (payload: string) => {
      const r = await checkInScan({ eventId, sessionId, payload });
      show(r);
    },
    [eventId, sessionId, show],
  );

  // Camera loop: one frame every 300 ms; a found code pauses for 2 seconds so it isn't read twice.
  useEffect(() => {
    if (!scanning || !window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!alive) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !busyRef.current) {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value) {
            busyRef.current = true;
            await scan(value);
            setTimeout(() => (busyRef.current = false), 2000);
          }
        } catch {
          /* a frame that can't be read */
        }
      }
      timer = setTimeout(loop, 300);
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [scanning, scan]);

  async function startCamera() {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch {
      setScanError("The camera isn't available. Type or paste the ticket code instead.");
    }
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const tone = result?.result === "green" ? "border-success" : result?.result === "amber" ? "border-warning" : "border-error";

  return (
    <div className="flex flex-col gap-6" data-testid="check-in-console">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-session`}>Session</Label>
          <select
            id={`${id}-session`}
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setResult(null);
              refresh(e.target.value);
            }}
            className={cn(controlBase, "h-10")}
          >
            {sessions.map((s, i) => (
              <option key={s.id} value={s.id}>
                {s.title ?? `Session ${i + 1}`} · {s.label}
              </option>
            ))}
          </select>
        </div>
        <p className="neu-tile px-4 py-3 text-body" aria-live="polite" data-testid="headcount">
          <span className="neu-mono text-h3 font-semibold">{shown ?? "…"}</span> checked in of <span className="neu-mono">{expected}</span>
        </p>
      </div>

      <div role="status" aria-live="assertive" className="min-h-16">
        {result ? (
          <div className={cn("neu-card flex items-center gap-3 border-l-4 p-4", tone)} data-testid="check-in-result" data-result={result.result}>
            {result.result === "green" ? (
              <CheckCircle aria-hidden weight="fill" className="size-8 text-success" />
            ) : result.result === "amber" ? (
              <WarningCircle aria-hidden weight="fill" className="size-8 text-warning" />
            ) : (
              <XCircle aria-hidden weight="fill" className="size-8 text-error" />
            )}
            <p className="text-body">
              <span className="font-semibold">{result.result === "green" ? "Checked in" : result.result === "amber" ? "Already checked in" : "Not checked in"}</span>
              {result.name ? `: ${result.name}` : ""}
              {result.message ? `. ${result.message}` : ""}
              {result.claim ? " They'll be able to claim it when they join Skilient." : ""}
            </p>
          </div>
        ) : null}
      </div>

      <section aria-labelledby={`${id}-scan-h`} className="neu-card flex flex-col gap-3 p-5">
        <h2 id={`${id}-scan-h`} className="text-h4">
          Scan a ticket
        </h2>
        {canScan ? (
          <div className="flex flex-col gap-3">
            <video ref={videoRef} muted playsInline className={cn("aspect-video w-full max-w-md rounded-lg bg-black", !scanning && "hidden")} aria-label="Camera" />
            <Button type="button" variant={scanning ? "ghost" : "accent"} className="self-start" onClick={() => (scanning ? stopCamera() : void startCamera())}>
              {scanning ? <CameraSlash aria-hidden weight="bold" className="size-4" /> : <Camera aria-hidden weight="bold" className="size-4" />}
              {scanning ? "Stop the camera" : "Start the camera"}
            </Button>
          </div>
        ) : (
          <p className="text-body-sm text-text-secondary">This browser can&apos;t scan codes. Use a handheld scanner or type the code under the QR.</p>
        )}
        {scanError ? <p className="text-body-sm text-text-error">{scanError}</p> : null}
        <form
          method="post"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = code.trim();
            if (!value) return;
            // Clear at once: a handheld scanner types the next code straight away.
            setCode("");
            startTransition(async () => {
              await scan(value);
            });
          }}
        >
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>Ticket code</Label>
            <Input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" autoComplete="off" data-testid="ticket-code" />
          </div>
          <Button type="submit" variant="secondary" loading={pending}>
            Check in
          </Button>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`${id}-search-h`} className="neu-card flex flex-col gap-3 p-5">
          <h2 id={`${id}-search-h`} className="text-h4">
            Find by name
          </h2>
          <form
            method="post"
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await checkInSearch({ eventId, query });
                setFound(r.ok ? r.data : []);
              });
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`${id}-q`}>Name or username</Label>
              <Input id={`${id}-q`} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="check-in-search" />
            </div>
            <Button type="submit" variant="secondary" loading={pending} aria-label="Search">
              <MagnifyingGlass aria-hidden weight="bold" className="size-4" />
            </Button>
          </form>
          {found ? (
            found.length ? (
              <ul className="flex flex-col gap-2">
                {found.map((f) => (
                  <li key={f.user_id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span>
                      {f.name} <span className="text-text-secondary">· {f.status}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={f.checked_in ? "ghost" : "primary"}
                      onClick={() =>
                        startTransition(async () => {
                          show(await checkInPerson({ eventId, sessionId, userId: f.user_id }));
                        })
                      }
                    >
                      Check in
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-text-secondary">Nobody registered by that name.</p>
            )
          ) : null}
        </section>
        <section aria-labelledby={`${id}-email-h`} className="neu-card flex flex-col gap-3 p-5">
          <h2 id={`${id}-email-h`} className="text-h4">
            Add by university email
          </h2>
          <p className="text-body-sm text-text-secondary">For someone who isn&apos;t registered or isn&apos;t on Skilient yet; they can claim the entry when they join.</p>
          <form
            method="post"
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = email;
              setEmail("");
              startTransition(async () => {
                show(await checkInEmail({ eventId, sessionId, email: value }));
              });
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="check-in-email" />
            </div>
            <Button type="submit" variant="secondary" loading={pending}>
              Add
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
