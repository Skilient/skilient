"use client";

/* The arrow ref goes to Floating UI's arrow middleware, which reads it in an effect, not in render. */
/* eslint-disable react-hooks/refs */

import { arrow, autoUpdate, flip, FloatingArrow, FloatingFocusManager, FloatingPortal, offset, shift, useDismiss, useFloating, useInteractions, useRole } from "@floating-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { Button } from "@/components/ui";
import { saveTourProgress } from "@/lib/actions/learn";
import { TOURS, type TourStep } from "@/lib/tours";
import { markTourEnded, setTourActive, tourEnded, tourStep } from "@/lib/tours/active";

export interface TourInitial {
  started: boolean;
  step: number;
  completed: boolean;
  skipped: boolean;
}

/** How long a step waits for its element after the page it is on has loaded. */
const ANCHOR_WAIT_MS = 3000;

/** The first anchor with that id that is actually on screen (the sidebar and the dock both carry it). */
function findAnchor(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Whether a step exists at this screen size. */
function exists(step: TourStep): boolean {
  return !step.media || window.matchMedia(step.media).matches;
}

/**
 * The guided tour (PRD 5.27; a spotlight across pages since 2026-11-15). It starts by itself the
 * first time a verified user lands on Home, or when the welcome screen or Settings → Replay tour
 * sends them to /feed?tour=1. Each step dims the page and lights one thing; a step on another page
 * takes the person there first. Next / Back / Skip, the keyboard alone, a focus trap, Esc to
 * leave, an aria-live announcement of each step and no motion when the person prefers less.
 *
 * The saved step is the index in the tour's declared list, so a reload resumes on the right page
 * (in the same tab from anywhere; in a new session only from Home, so nobody is pulled back into
 * a tour days later). Finishing or skipping means it never starts by itself again.
 */
export function TourHost({ tourId, initial }: { tourId: keyof typeof TOURS; initial: TourInitial }) {
  const tour = TOURS[tourId];
  // The tab's own flags are kept per account (lib/tours/active.ts).
  const userId = useCurrentUser()?.id ?? "";
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  // ?tour=1 forces a start, once: the address is cleaned up right after, but the router can take a
  // moment to notice, and ending the tour in that moment must not start it again.
  const forcedParam = params.get("tour") === "1";
  const forceUsed = useRef(false);
  useEffect(() => {
    if (!forcedParam) forceUsed.current = false;
  }, [forcedParam]);
  /** The declared index of the running step, or null when no tour is running. */
  const [index, setIndex] = useState<number | null>(null);
  /** The element the running step points at, once it is on screen. */
  const [target, setTarget] = useState<{ index: number; el: HTMLElement } | null>(null);
  // A tour that ended in this tab must not restart when the person comes back to Home.
  const ended = useRef(initial.completed || initial.skipped);
  /** Which way the person is moving, so a step that can't be shown is passed in that direction. */
  const direction = useRef<1 | -1>(1);

  // Start, or resume.
  useEffect(() => {
    if (index !== null || tour.steps.length === 0) return;
    if (!userId) return;
    const forced = forcedParam && !forceUsed.current;
    if ((ended.current || tourEnded(userId)) && !forced) return;
    // The step this tab was showing before a reload, if a tour was running in it.
    const resumeAt = forced ? null : tourStep(userId);
    if (pathname !== tour.startPath && resumeAt === null) return;
    // Wait a frame so the shell's anchors are laid out.
    const frame = requestAnimationFrame(() => {
      ended.current = false;
      // Drop ?tour=1 so a reload doesn't force a restart.
      if (forced) {
        forceUsed.current = true;
        window.history.replaceState(null, "", pathname);
      }
      // The tab's own note beats the account's saved step, which may still be a request in flight.
      const at = forced ? 0 : Math.min(Math.max(resumeAt ?? initial.step, 0), tour.steps.length - 1);
      setTourActive(userId, at);
      direction.current = 1;
      setIndex(at);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, forcedParam, tour, initial.step, index, userId]);

  const finish = useCallback(
    (outcome: "completed" | "skipped", at: number, focus?: string) => {
      ended.current = true;
      setTourActive(userId, null);
      // This component remounts when the shell does (the welcome screen has none); the tab remembers.
      markTourEnded(userId);
      void saveTourProgress({ tour: tourId, step: at, outcome });
      const back = target?.el;
      setIndex(null);
      setTarget(null);
      // Give focus to the thing the last step offered, or back to the page, never to a removed button.
      requestAnimationFrame(() => {
        const wanted = focus ? findAnchor(focus) : null;
        const field = wanted?.querySelector<HTMLElement>("textarea, input:not([type=hidden]), [contenteditable=true]") ?? wanted;
        if (field) {
          field.scrollIntoView({ block: "center" });
          field.focus({ preventScroll: true });
        } else back?.focus?.();
      });
    },
    [target, tourId, userId],
  );

  const go = useCallback(
    (next: number, dir: 1 | -1) => {
      direction.current = dir;
      // Past the last step that exists at this size: the tour is done.
      let i = next;
      while (i >= 0 && i < tour.steps.length && !exists(tour.steps[i]!)) i += dir;
      if (i >= tour.steps.length) return finish("completed", tour.steps.length - 1);
      if (i < 0) return;
      setIndex(i);
      setTourActive(userId, i);
      void saveTourProgress({ tour: tourId, step: i, outcome: "progress" });
    },
    [finish, tour.steps, tourId, userId],
  );

  // Bring the running step's page and element on screen.
  useEffect(() => {
    if (index === null) return;
    const step = tour.steps[index]!;
    if (!exists(step)) {
      const frame = requestAnimationFrame(() => go(index + direction.current, direction.current));
      return () => cancelAnimationFrame(frame);
    }
    if (step.path && step.path !== pathname) {
      router.push(step.path as Route);
      return;
    }
    let done = false;
    const started = performance.now();
    const look = () => {
      if (done) return;
      const el = findAnchor(step.anchor);
      if (el) {
        done = true;
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) el.scrollIntoView({ block: rect.height > window.innerHeight * 0.7 ? "start" : "center" });
        setTarget({ index, el });
        return;
      }
      // Not on this page at this size after all: pass it, the way the person was going.
      if (performance.now() - started > ANCHOR_WAIT_MS) {
        done = true;
        const dir = index === 0 ? 1 : direction.current;
        go(index + dir, dir);
        return;
      }
      timer = window.setTimeout(look, 80);
    };
    let timer = window.setTimeout(look, 0);
    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [index, pathname, tour.steps, router, go]);

  if (index === null) return null;
  const shown = tour.steps.map((s, i) => ({ s, i })).filter(({ s }) => exists(s));
  const position = shown.findIndex(({ i }) => i === index);
  const ready = target && target.index === index;
  return (
    <>
      {/* Nothing behind the tour can be pressed by accident while it runs. */}
      <div aria-hidden className="fixed inset-0 z-[59]" data-testid="tour-shield" />
      {ready ? (
        <CoachMark
          key={index}
          step={tour.steps[index]!}
          el={target.el}
          position={position}
          total={shown.length}
          onBack={() => go(index - 1, -1)}
          onNext={() => go(index + 1, 1)}
          onSkip={() => finish("skipped", index)}
          onCta={(focus) => finish("completed", index, focus)}
        />
      ) : (
        // Between pages: the page stays dimmed, so the tour doesn't flash off and on.
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] bg-[rgb(0_0_0/0.55)]" />
      )}
    </>
  );
}

/** The lit rectangle around an element, with the element's own corner rounding. */
function useSpot(el: HTMLElement) {
  const measure = useCallback(() => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, radius: Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8, 28) };
  }, [el]);
  const [spot, setSpot] = useState(measure);
  // Keep the light on the element through scrolling, resizing and its own changes in size.
  useEffect(() => {
    const update = () => setSpot(measure());
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [el, measure]);
  return spot;
}

function CoachMark({
  step,
  el,
  position,
  total,
  onBack,
  onNext,
  onSkip,
  onCta,
}: {
  step: TourStep;
  el: HTMLElement;
  position: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onCta: (focus: string) => void;
}) {
  const arrowRef = useRef<SVGSVGElement>(null);
  const spot = useSpot(el);
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onSkip();
    },
    placement: "right",
    whileElementsMounted: autoUpdate,
    middleware: [offset(16), flip({ fallbackPlacements: ["bottom", "top", "left"] }), shift({ padding: 12, crossAxis: true }), arrow({ element: arrowRef })],
  });
  // The element is only what the card is placed against, never its "reference" for focus: given a
  // reference, the focus manager inserts a hidden span right after it, and a step that points into
  // page content React hasn't hydrated yet (after a reload mid-tour) then breaks hydration: React
  // finds a span where the next list item should be (error 418, 2026-11-16).
  useEffect(() => {
    refs.setPositionReference(el);
  }, [refs, el]);
  const dismiss = useDismiss(context, { outsidePress: false });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const isLast = position === total - 1;

  return (
    <>
      {/* The spotlight: the page dims and one thing stays lit, ringed in the accent. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[60] shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline-2 outline-offset-2 outline-primary motion-safe:transition-[top,left,width,height] motion-safe:duration-200 motion-safe:ease-out"
        style={{ top: spot.top - 6, left: spot.left - 6, width: spot.width + 12, height: spot.height + 12, borderRadius: spot.radius + 6 }}
        data-testid="tour-spotlight"
      />
      <FloatingPortal>
        <FloatingFocusManager context={context} modal initialFocus={-1} returnFocus={false}>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps({ "aria-label": "Guided tour", "aria-modal": true })}
            className="z-[61] w-[min(340px,calc(100vw-24px))] rounded-lg border border-border-strong bg-bg-elevated p-4 shadow-4"
            data-testid="tour-popover"
          >
            <FloatingArrow ref={arrowRef} context={context} className="fill-bg-elevated [&>path:first-of-type]:stroke-border-strong" />
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-caption text-text-secondary" data-testid="tour-progress">
                Step {position + 1} of {total}
              </p>
              {/* Progress fills, never spins (the brief). */}
              <span aria-hidden className="neu-well-s block h-1.5 w-20 overflow-hidden rounded-full">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${((position + 1) / total) * 100}%` }} />
              </span>
            </div>
            <h2 className="mt-2 text-h3">{step.title}</h2>
            <p className="mt-1 text-body-sm text-text-secondary">{step.body}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {isLast ? (
                <span />
              ) : (
                <Button variant="ghost" size="sm" onClick={onSkip} data-testid="tour-skip">
                  Skip tour
                </Button>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {position > 0 ? (
                  <Button variant="secondary" size="sm" onClick={onBack} data-testid="tour-back">
                    Back
                  </Button>
                ) : null}
                {step.cta ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={onNext} data-testid="tour-next">
                      Done
                    </Button>
                    <Button size="sm" onClick={() => onCta(step.cta!.focus)} autoFocus data-testid="tour-cta">
                      {step.cta.label}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={onNext} autoFocus data-testid="tour-next">
                    {isLast ? "Done" : "Next"}
                  </Button>
                )}
              </div>
            </div>
            {/* Read out by screen readers each time the step changes. */}
            <p className="sr-only" aria-live="polite" role="status">
              Step {position + 1} of {total}: {step.title}. {step.body}
            </p>
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    </>
  );
}
