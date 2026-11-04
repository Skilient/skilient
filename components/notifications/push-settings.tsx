"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Button, FieldError, Switch } from "@/components/ui";
import { deletePushSubscription, getPushKey, savePushSubscription, setPushPref } from "@/lib/actions/community";
import { currentSubscription, pushSupported, subscribeThisDevice } from "@/lib/pwa/client";

/**
 * Phone and browser notifications (PRD 5.34), next to instant email and digest: turn push on or off
 * for this device, and choose which kinds are pushed (chat messages, event reminders and changes,
 * Record entries, induction results, swap requests and reminders, yearbook notes).
 */
export function PushSettings({ devices, categories }: { devices: number; categories: { category: string; label: string; push: boolean }[] }) {
  const router = useRouter();
  const id = useId();
  const [device, setDevice] = useState<"unknown" | "on" | "off" | "unsupported" | "blocked">("unknown");
  const [prefs, setPrefs] = useState(categories);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      if (!pushSupported()) return setDevice("unsupported");
      if (Notification.permission === "denied") return setDevice("blocked");
      setDevice((await currentSubscription()) ? "on" : "off");
    })();
  }, []);

  const turnOn = () =>
    startTransition(async () => {
      setError(null);
      const key = await getPushKey();
      if (!key.ok) return setError(key.message);
      const sub = await subscribeThisDevice(key.data);
      if (sub === "denied") return setDevice("blocked");
      if (sub === "unsupported") return setDevice("unsupported");
      const r = await savePushSubscription({ ...sub, userAgent: navigator.userAgent.slice(0, 200) });
      if (r.ok) {
        setDevice("on");
        router.refresh();
      } else setError(r.message);
    });

  const turnOff = () =>
    startTransition(async () => {
      setError(null);
      const sub = await currentSubscription();
      const r = await deletePushSubscription({ endpoint: sub?.endpoint ?? null });
      if (!r.ok) return setError(r.message);
      await sub?.unsubscribe().catch(() => undefined);
      setDevice("off");
      router.refresh();
    });

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-5" data-testid="push-settings">
      <div>
        <h2 id={`${id}-h`} className="text-h3">
          Phone notifications
        </h2>
        <p className="text-body-sm text-text-secondary">
          Pushes to this phone or browser, for things that can&apos;t wait.{" "}
          {devices ? `${devices} ${devices === 1 ? "device gets" : "devices get"} them now.` : "No device gets them yet."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3" data-testid="push-device" data-state={device}>
        {device === "on" ? (
          <>
            <p className="text-body-sm">On for this device.</p>
            <Button size="sm" variant="secondary" onClick={turnOff} loading={pending}>
              Turn off on this device
            </Button>
          </>
        ) : device === "off" ? (
          <Button size="sm" onClick={turnOn} loading={pending}>
            Turn on for this device
          </Button>
        ) : device === "blocked" ? (
          <p className="text-body-sm text-text-secondary">Your browser blocks notifications from Skilient. Allow them in its site settings, then come back.</p>
        ) : device === "unsupported" ? (
          <p className="text-body-sm text-text-secondary">This browser can&apos;t show notifications. On iPhone, add Skilient to your Home Screen first.</p>
        ) : (
          <p role="status" className="text-body-sm text-text-secondary">
            Checking this device…
          </p>
        )}
      </div>
      <ul className="divide-y divide-border-muted">
        {prefs.map((c) => {
          const sid = `${id}-${c.category}`;
          return (
            <li key={c.category} className="flex items-center justify-between gap-4 py-3">
              <label htmlFor={sid} className="text-body">
                {c.label}
              </label>
              <Switch
                id={sid}
                checked={c.push}
                disabled={pending}
                data-testid={`push-pref-${c.category}`}
                onCheckedChange={(on) =>
                  startTransition(async () => {
                    setError(null);
                    const r = await setPushPref({ category: c.category, on });
                    if (r.ok) setPrefs((list) => list.map((x) => (x.category === c.category ? { ...x, push: on } : x)));
                    else setError(r.message);
                  })
                }
              />
            </li>
          );
        })}
      </ul>
      {error ? <FieldError>{error}</FieldError> : null}
    </section>
  );
}
