"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-[6px]" />
  );
}

function CloseButton() {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className="neu-icon-btn absolute top-4 right-4 size-11 text-text-secondary hover:text-text-primary"
    >
      <X aria-hidden className="size-4" weight="bold" />
    </DialogPrimitive.Close>
  );
}

interface ContentProps extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> {
  title: ReactNode;
  description?: ReactNode;
}

export function DialogContent({ title, description, className, children, ...props }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-[var(--card-border)] bg-bg-elevated p-6 shadow-4",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="pr-12 font-display text-h3 text-text-primary">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-body text-text-secondary">{description}</DialogPrimitive.Description>
        ) : null}
        <div className="mt-5">{children}</div>
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mt-6 flex flex-wrap justify-end gap-3", className)} {...props} />;
}

/** Bottom sheet (radius xl) on phones; same Radix dialog behaviour. */
export function SheetContent({ title, description, className, children, ...props }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto",
          "rounded-t-xl border border-b-0 border-[var(--card-border)] bg-bg-elevated p-6 shadow-4",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="neu-hole mx-auto -mt-2 mb-4 h-1.5 w-12" />
        <DialogPrimitive.Title className="pr-12 text-h3 text-text-primary">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-body text-text-secondary">{description}</DialogPrimitive.Description>
        ) : null}
        <div className="mt-5">{children}</div>
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Side sheet: full height on the right from tablet up, full screen on phones (e.g. the agreement). */
export function SideSheetContent({ title, description, className, children, ...props }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--card-border)] bg-bg-elevated shadow-4 sm:max-w-xl sm:rounded-l-xl",
          className,
        )}
        {...props}
      >
        <div className="border-b border-border-muted px-6 pt-6 pb-4">
          <DialogPrimitive.Title className="pr-12 font-display text-h3 text-text-primary">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-body-sm text-text-secondary">{description}</DialogPrimitive.Description>
          ) : null}
        </div>
        {/* Focusable so keyboard users can scroll it even when it holds no links (axe scrollable-region-focusable). */}
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring">
          {children}
        </div>
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
