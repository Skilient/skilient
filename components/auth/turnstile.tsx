"use client";

import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  // Loaded by our own (nonce-trusted) bundle, so CSP 'strict-dynamic' allows it.
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    const fail = (reason: string) => {
      scriptPromise = null;
      script.remove();
      reject(new Error(reason));
    };
    script.onload = () => (window.turnstile ? resolve() : fail("turnstile_missing"));
    script.onerror = () => fail("turnstile_load_failed");
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Where the human check is: waiting for a token, holding one, or unable to run (script or widget failed). */
export type TurnstileStatus = "pending" | "verified" | "failed";

/**
 * Why a form with a human check may not submit yet, or null when it may. A form without a site key
 * (local, CI) never waits; the server skips the check there too (lib/security/turnstile.ts).
 */
export function humanCheckBlock(siteKey: string | null, token: string | null, status: TurnstileStatus): string | null {
  if (!siteKey || token) return null;
  return status === "failed"
    ? "The check that you're human didn't load. Use Try again under the form, then submit."
    : "Wait a moment for the check that you're human to finish, then try again.";
}

/**
 * Cloudflare Turnstile (PRD 10). Calls onToken with a fresh token, or null when it expires, is used
 * or fails, and onStatus as it changes. Change `resetKey` to get a new token after a submit (tokens are
 * single-use). If the script or the widget fails it says so in the form and offers Try again, which loads
 * the script and renders the widget afresh.
 */
export function Turnstile({
  siteKey,
  onToken,
  onStatus,
  resetKey = 0,
  action,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onStatus?: (status: TurnstileStatus) => void;
  resetKey?: number;
  action?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onStatus });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    callbacks.current = { onToken, onStatus };
  }, [onToken, onStatus]);

  useEffect(() => {
    let cancelled = false;
    const report = (token: string | null, status: TurnstileStatus) => {
      if (cancelled) return;
      setFailed(status === "failed");
      callbacks.current.onToken(token);
      callbacks.current.onStatus?.(status);
    };
    report(null, "pending");
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          appearance: "always",
          theme: "auto",
          callback: (token: string) => report(token, "verified"),
          // Cloudflare refreshes an expired widget by itself; until then there is no token to send.
          "expired-callback": () => report(null, "pending"),
          "error-callback": () => report(null, "failed"),
        });
      })
      .catch(() => report(null, "failed"));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, attempt]);

  useEffect(() => {
    if (resetKey && widgetId.current && window.turnstile) {
      callbacks.current.onToken(null);
      callbacks.current.onStatus?.("pending");
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={container} className="min-h-0 empty:hidden" data-testid="turnstile" />
      {failed ? (
        <p role="alert" className="text-body-sm text-text-error" data-testid="turnstile-failed">
          We couldn&apos;t run the check that you&apos;re human. Check your connection, or allow challenges.cloudflare.com if
          something blocks it.{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
