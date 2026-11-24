"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { buttonClass } from "@/components/ui";
import { saveTourProgress } from "@/lib/actions/learn";
import { track } from "@/lib/analytics/client";
import { markTourEnded } from "@/lib/tours/active";

/** How long the film runs before everything is in place (welcome.css's last delay plus its rise). */
const FILM_MS = 6200;
/** The clouds closing before Home opens (welcome.css `w-close`). */
const CLOSE_MS = 450;
/**
 * Per account in this browser: a later visit shows the end state straight away. A convenience, not
 * account state, so it isn't in the database; keyed by account so the next student on a shared
 * computer still gets their welcome.
 */
const seenKey = (userId: string) => `skilient:welcome-seen:${userId}`;

const WelcomeContext = createContext<{ start: () => void } | null>(null);

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The welcome screen's root and its few behaviours: jump to the end state (Skip intro, any key, a
 * tap, a return visit), give focus to "Start the tour" when the film ends, and close the clouds
 * before the tour opens. The film itself is CSS (welcome.css); this only sets `data-*` on the root,
 * so the page needs no re-render and works the same before hydration.
 */
export function WelcomeRoot({ replay, children }: { replay: boolean; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const router = useRouter();
  const userId = useCurrentUser()?.id ?? "";
  /** Whether this account had seen the welcome before this visit: read once, so an effect that runs twice (React's development check) doesn't take its own first write for an earlier visit. */
  const seenBefore = useRef<boolean | null>(null);

  const finish = useCallback((skipped: boolean) => {
    const el = root.current;
    if (!el || el.dataset.done !== undefined) return;
    if (skipped) el.dataset.skip = "";
    el.dataset.done = "";
    // Hand the keyboard to the way in, unless the person is already somewhere of their own choosing.
    const cta = el.querySelector<HTMLElement>("[data-welcome-cta]");
    if (cta && (document.activeElement === document.body || el.querySelector(".welcome-skip")?.contains(document.activeElement))) cta.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (seenBefore.current === null) {
      seenBefore.current = false;
      try {
        seenBefore.current = window.localStorage.getItem(seenKey(userId)) === "1";
        window.localStorage.setItem(seenKey(userId), "1");
      } catch {
        // Private windows and blocked storage: the film simply plays each time.
      }
      track("welcome_viewed", { replay });
    }
    if ((seenBefore.current && !replay) || reducedMotion()) {
      finish(true);
      return;
    }
    const timer = window.setTimeout(() => finish(false), FILM_MS);
    const skip = () => finish(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [finish, replay, userId]);

  const start = useCallback(() => {
    track("welcome_tour_started", { replay });
    const el = root.current;
    if (!el || reducedMotion()) return router.push("/feed?tour=1");
    el.dataset.closing = "";
    window.setTimeout(() => router.push("/feed?tour=1"), CLOSE_MS);
  }, [replay, router]);

  return (
    <main ref={root} className="welcome" data-testid="welcome">
      <button type="button" className={buttonClass("ghost", "sm", "welcome-skip")} onClick={() => finish(true)} data-testid="welcome-skip-intro">
        Skip intro
      </button>
      <WelcomeContext.Provider value={{ start }}>{children}</WelcomeContext.Provider>
    </main>
  );
}

/**
 * The way in: "Start the tour" (the clouds close, then Home opens with the tour), and "Skip to
 * Home", which records the tour as skipped so it doesn't start by itself; Settings can replay it.
 * Both are real links, so they work before hydration.
 */
export function WelcomeActions({ delay }: { delay: number }) {
  const welcome = useContext(WelcomeContext);
  const router = useRouter();
  const userId = useCurrentUser()?.id ?? "";
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
      <Link
        href="/feed?tour=1"
        data-welcome-cta
        data-testid="start-tour"
        className={buttonClass("primary", "lg", "welcome-cta")}
        style={{ "--d": `${delay}s` } as React.CSSProperties}
        onClick={(e) => {
          if (!welcome || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          welcome.start();
        }}
      >
        Start the tour <ArrowRight aria-hidden weight="bold" className="size-5" />
      </Link>
      <Link
        href="/feed"
        data-in
        data-testid="skip-to-home"
        aria-busy={pending || undefined}
        className={buttonClass("ghost", "lg")}
        style={{ "--d": `${delay + 0.15}s` } as React.CSSProperties}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          track("welcome_skipped", {});
          startTransition(async () => {
            await saveTourProgress({ tour: "student", step: 0, outcome: "skipped" });
            // The shell read the tour's state before this click: the tab remembers it is over.
            if (userId) markTourEnded(userId);
            router.push("/feed");
          });
        }}
      >
        Skip to Home
      </Link>
    </div>
  );
}
