"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

/** Tabs are an inset track; the active tab is raised out of it (the brief §3). */
export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("neu-track max-w-full overflow-x-auto", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn("text-body disabled:cursor-not-allowed disabled:text-text-disabled", className)}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-5", className)} {...props} />;
}

/** A tab's count: mono, in signal ink (the brief: "its count in mono orange"). */
export function TabCount({ children }: { children: number }) {
  return <span className="neu-mono text-[var(--signal-ink)]">{children}</span>;
}
