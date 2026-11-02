import { Slot } from "@radix-ui/react-slot";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The brief's button (app/(marketing)/CLAUDE.md §3): a pill, raised at rest, inset when pressed in
 * 140 ms. One primary per view, in signal orange with ink text; secondary is a raised surface pill;
 * tertiary a 1 px hairline; accent the one ink object; danger a hairline in the error colour, kept
 * away from orange. Disabled is flat with concrete text and `aria-disabled`.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-text-on-primary shadow-[var(--button-shadow-primary)] hover:bg-primary-hover active:bg-primary-active active:shadow-[var(--button-shadow-primary-pressed)]",
  secondary:
    "border border-[var(--control-border)] bg-bg-surface text-text-primary shadow-[var(--button-shadow)] hover:bg-bg-subtle active:shadow-[var(--button-shadow-pressed)]",
  accent: "bg-accent text-text-on-accent shadow-[var(--button-shadow)] hover:bg-accent-hover active:shadow-[var(--button-shadow-pressed)]",
  ghost: "text-text-primary hover:bg-bg-subtle active:shadow-[var(--button-shadow-pressed)]",
  tertiary: "border border-border-strong text-text-primary hover:bg-bg-subtle",
  // Error styling stays away from the primary button look (PRD 9.5): outlined, not filled.
  danger: "border border-error bg-transparent text-text-error hover:bg-bg-subtle",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 px-4 text-body-sm",
  md: "h-11 gap-2 px-5 text-body",
  lg: "h-12 gap-2 px-6 text-body-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Render the child element (e.g. a Link) with button styling. */
  asChild?: boolean;
}

export const buttonClass = (variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) =>
  cn(
    "relative inline-flex select-none items-center justify-center overflow-hidden rounded-full font-sans font-semibold whitespace-nowrap",
    "transition-[box-shadow,background-color] duration-[140ms] ease-out",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-bg-surface disabled:text-text-disabled disabled:shadow-none",
    "aria-disabled:cursor-not-allowed aria-disabled:bg-bg-surface aria-disabled:text-text-disabled aria-disabled:shadow-none",
    variants[variant],
    sizes[size],
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, asChild = false, disabled, className, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass(variant, size, className), loading && "shadow-[var(--button-shadow-pressed)]")}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {/* Progress fills, never spins (the brief). */}
          {loading ? <span aria-hidden className="neu-fill absolute inset-x-3 bottom-1.5 h-[3px] rounded-full" /> : null}
        </>
      )}
    </Comp>
  );
});

/**
 * The timed variant for verify and submit: an inset track fills orange while it runs, then shows
 * "✓ Verified · 14:32" with the time it finished (Proof + Momentum).
 */
export function TimedButton({
  state,
  children,
  doneLabel,
  doneAt,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  state: "idle" | "running" | "done";
  children: ReactNode;
  doneLabel: string;
  /** When it finished; shown as HH:MM. */
  doneAt?: Date | string | null;
}) {
  const at = doneAt ? new Date(doneAt) : null;
  const time = at ? at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) : null;
  if (state === "done") {
    return (
      <span
        role="status"
        className={cn("neu-well inline-flex h-12 items-center gap-2 rounded-full px-6 text-body font-semibold text-text-primary", className)}
      >
        <Check aria-hidden weight="bold" className="size-4 text-success" />
        {doneLabel}
        {time ? <span className="neu-mono text-text-secondary">· {time}</span> : null}
      </span>
    );
  }
  const running = state === "running";
  return (
    <button
      type="submit"
      aria-busy={running || undefined}
      disabled={running || props.disabled}
      className={cn(
        "relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full px-6 font-semibold",
        running ? "neu-well text-text-primary" : buttonClass("primary", "lg"),
        className,
      )}
      {...props}
    >
      {running ? <span aria-hidden className="neu-timed-fill absolute inset-y-0 left-0 bg-primary" /> : null}
      <span className="relative">{children}</span>
    </button>
  );
}
