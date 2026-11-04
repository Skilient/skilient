"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "@phosphor-icons/react/dist/ssr";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Unchecked: a small pressed well. Checked: a raised ink box with a light check (the brief §3). */
export const Checkbox = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer relative inline-flex size-6 shrink-0 items-center justify-center rounded-[7px] border border-[var(--control-border)] bg-bg-surface shadow-[var(--pressed-s)]",
        "transition-[box-shadow,background-color] duration-[140ms] ease-out",
        "data-[state=checked]:bg-accent data-[state=checked]:text-text-on-accent data-[state=checked]:shadow-[var(--raised-s)]",
        "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-text-on-accent data-[state=indeterminate]:shadow-[var(--raised-s)]",
        "disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-text-disabled disabled:shadow-none",
        "aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-offset-2 aria-[invalid=true]:outline-error",
        // A 44 px hit area (Fitts).
        "before:absolute before:-inset-2.5 before:content-['']",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group">
        <Check aria-hidden weight="bold" className="size-4 group-data-[state=indeterminate]:hidden" />
        <Minus aria-hidden weight="bold" className="hidden size-4 group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
