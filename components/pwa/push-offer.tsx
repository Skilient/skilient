"use client";

import { BellRinging } from "@phosphor-icons/react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { getPushKey, savePushSubscription } from "@/lib/actions/community";
import { currentSubscription, pushSupported, subscribeThisDevice } from "@/lib/pwa/client";

const DISMISSED = "skilient.push-offer.dismissed";

/**
 * "Get reminded on your phone?" (PRD 5.34): offered after a first meaningful action (registering for
 * an event, sending a message), never on first load. Shown only when the browser supports push, the
 * person hasn't decided yet, and they haven't said "Not now" on this device.
 */
export function PushOffer({ reason }: { reason: string }) {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!pushSupported() || Notification.permission !== "default") return;
      try {
        if (window.localStorage.getItem(DISMISSED)) return;
      } catch {
        // Storage unavailable: still offer.
      }
      if (await currentSubscription()) return;
      if (alive) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;
  return (
    <aside className="neu-card flex flex-col gap-3 p-4" aria-labelledby="push-offer-h" data-testid="push-offer">
      <div className="flex items-start gap-3">
        <BellRinging aria-hidden weight="bold" className="mt-0.5 size-5 shrink-0 text-[var(--signal-ink)]" />
        <div>
          <h2 id="push-offer-h" className="text-h4">
            Get reminded on your phone?
          </h2>
          <p className="text-body-sm text-text-secondary">{reason} You choose which kinds in Settings, Notifications.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const key = await getPushKey();
              if (!key.ok) {
                setMessage(key.message);
                return;
              }
              const sub = await subscribeThisDevice(key.data);
              if (sub === "denied") {
                setMessage("Your browser blocked notifications. You can allow them in its site settings.");
                return;
              }
              if (sub === "unsupported") {
                setMessage("This browser can't show notifications.");
                return;
              }
              const saved = await savePushSubscription({ ...sub, userAgent: navigator.userAgent.slice(0, 200) });
              if (saved.ok) setShow(false);
              else setMessage(saved.message);
            })
          }
        >
          Turn on
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISSED, "1");
            } catch {
              // Storage unavailable: it just shows again next time.
            }
            setShow(false);
          }}
        >
          Not now
        </Button>
      </div>
      {message ? (
        <p role="alert" className="text-body-sm text-text-error">
          {message}
        </p>
      ) : null}
    </aside>
  );
}
