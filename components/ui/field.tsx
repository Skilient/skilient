import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Seal } from "./seal";

/**
 * Inputs are inset wells on the surface (the brief §3): label above, four distinct states.
 * Default; Focus is the 2 px synergy ring; Error is the red ring plus an icon, a plain message and
 * the time; Verified is the seal plus mono metadata. /ops (.classic) draws a PRD 9 hairline instead.
 */
export const controlBase =
  "w-full rounded-md border border-[var(--control-border)] bg-bg-surface px-4 text-body text-text-primary shadow-[var(--control-shadow)] " +
  "placeholder:text-text-secondary transition-[box-shadow,outline-color] duration-[140ms] ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-text-disabled disabled:shadow-none " +
  "aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-offset-2 aria-[invalid=true]:outline-error aria-[invalid=true]:focus-visible:outline-focus-ring";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-body-sm font-semibold text-text-primary", className)} {...props} />;
}

export function HelperText({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("text-body-sm text-text-muted", className)}>
      {children}
    </p>
  );
}

/** Error is always icon + text, never colour alone (PRD 9.5); `at` adds when it happened. */
export function FieldError({ id, children, className, at }: { id?: string; children: ReactNode; className?: string; at?: string }) {
  return (
    <p id={id} role="alert" className={cn("flex items-start gap-1.5 text-body-sm text-text-error", className)}>
      <WarningCircle aria-hidden weight="bold" className="mt-0.5 size-4 shrink-0" />
      <span>
        {children}
        {at ? <span className="neu-mono ml-1.5 text-text-secondary">{at}</span> : null}
      </span>
    </p>
  );
}

/** The Verified state: the seal plus mono metadata (source, date). */
export function FieldVerified({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("flex items-center gap-2 text-body-sm text-text-primary", className)}>
      <Seal size={18} />
      <span className="neu-mono text-text-secondary">{children}</span>
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(controlBase, "min-h-24 py-3", className)} {...props} />;
});

/** Label + control + helper/error/verified, wired with ids for assistive tech. */
export function Field({
  id,
  label,
  helper,
  error,
  verified,
  children,
}: {
  id: string;
  label: string;
  helper?: ReactNode;
  error?: ReactNode;
  /** Mono metadata for the Verified state (for example "GitHub · 12 Oct 2026"). */
  verified?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : verified ? (
        <FieldVerified id={`${id}-verified`}>{verified}</FieldVerified>
      ) : helper ? (
        <HelperText id={`${id}-helper`}>{helper}</HelperText>
      ) : null}
    </div>
  );
}
