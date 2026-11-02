"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react/dist/ssr";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "info" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** request_id from the server, shown as "Ref: 7f3a…" so reports map to a log line (PRD 10). */
  requestId?: string;
  /** The brief: toasts carry a time and an undo. */
  undo?: { label?: string; onUndo: () => void };
  /** When it happened; defaults to when the toast was shown. */
  at?: Date;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const toneIcon = {
  info: <Info aria-hidden weight="bold" className="size-5 text-info" />,
  success: <CheckCircle aria-hidden weight="bold" className="size-5 text-success" />,
  error: <WarningCircle aria-hidden weight="bold" className="size-5 text-error" />,
} satisfies Record<ToastTone, ReactNode>;

const timeLabel = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

export function ToastCard({ title, description, tone = "info", requestId, undo, at, className, ...props }: ToastInput & ToastPrimitive.ToastProps) {
  return (
    <ToastPrimitive.Root
      type={tone === "error" ? "foreground" : "background"}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border border-[var(--card-border)] bg-bg-elevated p-4 shadow-3",
        className,
      )}
      {...props}
    >
      <span className="mt-0.5 shrink-0">{toneIcon[tone]}</span>
      <div className="min-w-0 flex-1">
        <ToastPrimitive.Title className="text-body font-semibold text-text-primary">{title}</ToastPrimitive.Title>
        {description ? (
          <ToastPrimitive.Description className="mt-1 text-body-sm text-text-secondary">{description}</ToastPrimitive.Description>
        ) : null}
        <p className="neu-mono mt-1 text-text-secondary">
          {at ? <time dateTime={at.toISOString()}>{timeLabel(at)}</time> : null}
          {requestId ? <span>{at ? " · " : ""}Ref: {requestId.slice(0, 8)}</span> : null}
        </p>
        {undo ? (
          <ToastPrimitive.Action altText={undo.label ?? "Undo"} asChild>
            <button type="button" onClick={undo.onUndo} className="neu-btn-3 mt-2 min-h-10 text-body-sm">
              {undo.label ?? "Undo"}
            </button>
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label="Dismiss"
        className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
      >
        <X aria-hidden className="size-4" weight="bold" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastViewport({ className }: { className?: string }) {
  return (
    <ToastPrimitive.Viewport
      className={cn("fixed right-0 bottom-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none", className)}
    />
  );
}

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((toast: ToastInput) => {
    setItems((prev) => [...prev, { at: new Date(), ...toast, id: Date.now() + Math.random() }]);
  }, []);
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map(({ id, ...toast }) => (
          <ToastCard
            key={id}
            {...toast}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== id));
            }}
          />
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}
