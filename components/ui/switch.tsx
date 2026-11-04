"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** An inset track with a raised knob; the track turns orange when on (colour pairs with position). */
export const Switch = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[var(--control-border)] bg-bg-surface p-1 shadow-[var(--pressed-s)]",
        "transition-colors duration-[200ms] ease-standard",
        "data-[state=checked]:bg-primary data-[state=checked]:shadow-[var(--pressed-signal)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        // A 44 px hit area around the 28 px track (Fitts).
        "before:absolute before:-inset-2 before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-5 rounded-full bg-[var(--surface-hi)] shadow-[var(--raised-s)] transition-transform duration-[200ms] ease-standard",
          "data-[state=checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  );
});
