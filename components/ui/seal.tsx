import { cn } from "@/lib/cn";

/** 18 points, notched: the outer radius alternates with a shallow inner one. */
const SEAL_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i < 36; i++) {
    const r = i % 2 === 0 ? 12 : 10.6;
    const a = (Math.PI * i) / 18 - Math.PI / 2;
    points.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

/**
 * The verified seal (the brief §3): an 18-point notched seal in ink with a light check. Full size on
 * profiles and certificates; 18–28 px on avatars and fields. Decorative unless `label` is given.
 */
export function Seal({ size = 28, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={cn("neu-seal", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={SEAL_PATH} fill="var(--ink)" />
        <path d="M7.6 12.3l2.9 2.9 5.9-6" fill="none" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
