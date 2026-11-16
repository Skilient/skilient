"use client";

import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  ready(callback: () => void): void;
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
  if (window.turnstile) return new Promise((resolve) => window.turnstile!.ready(resolve));
  // Loaded by our own (nonce-trusted) bundle, so CSP 'strict-dynamic' allows it.
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      scriptPromise = null;
      reject(new Error("turnstile_load_failed"));
    };
    const timeout = window.setTimeout(fail, 15000);
    script.src = SCRIPT_SRC;
    script.async = true;
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.onload = () => {
      if (!window.turnstile) return fail();
      window.turnstile.ready(() => {
        window.clearTimeout(timeout);
        resolve();
      });
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile (PRD 10): visible verification with loading and retry feedback. Calls onToken with
 * a fresh token, or null when it expires or fails. Change `resetKey` to get a new token
 * after a submit (tokens are single-use).
 */
export function Turnstile({
  siteKey,
  onToken,
  resetKey = 0,
  action,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
  action?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [status, setStatus] = useState<"pending" | "verified" | "error">("pending");
  const [attempt, setAttempt] = useState(0);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    let verificationTimeout: number | undefined;
    const pending = () => {
      if (cancelled) return;
      callback.current(null);
      setStatus("pending");
      window.clearTimeout(verificationTimeout);
      verificationTimeout = window.setTimeout(failed, 20000);
    };
    const failed = () => {
      if (cancelled) return;
      window.clearTimeout(verificationTimeout);
      callback.current(null);
      setStatus("error");
    };
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        pending();
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          appearance: "always",
          size: "flexible",
          theme: "auto",
          callback: (token: string) => {
            if (cancelled) return;
            window.clearTimeout(verificationTimeout);
            setStatus("verified");
            callback.current(token);
          },
          "before-interactive-callback": () => window.clearTimeout(verificationTimeout),
          "expired-callback": pending,
          "timeout-callback": failed,
          "unsupported-callback": failed,
          "error-callback": failed,
        });
      })
      .catch(failed);
    return () => {
      cancelled = true;
      window.clearTimeout(verificationTimeout);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, resetKey, attempt]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={container} className="min-h-[65px]" data-testid="turnstile" />
      <p role="status" className="text-body-sm text-text-secondary">
        {status === "verified"
          ? "Human verification complete."
          : status === "error"
            ? "The human check couldn't finish. Retry, or allow challenges.cloudflare.com in your browser and reload this page."
            : "Checking you're human. Complete the check above if prompted."}
      </p>
      {status === "error" ? (
        <button
          type="button"
          className="self-start text-body-sm font-semibold text-text-primary underline underline-offset-4"
          onClick={() => {
            callback.current(null);
            setStatus("pending");
            setAttempt((value) => value + 1);
          }}
        >
          Retry human check
        </button>
      ) : null}
    </div>
  );
}
