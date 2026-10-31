"use client";

import { useEffect } from "react";

/**
 * Pointer parallax for the hero orbit: sets `--px`/`--py` (-1..1) on the orbit as the pointer
 * moves, once per frame; CSS turns them into depth-scaled shifts. Nothing runs for touch-only
 * devices or under reduced motion, and the orbit stays put without JavaScript.
 */
export function OrbitParallax({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      x = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1));
      y = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return null;
}
