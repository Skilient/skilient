import { Tray, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { ObjectImage } from "@/components/marketing/story/object-image";
import { cn } from "@/lib/cn";
import type { ObjectName } from "@/lib/marketing/objects";

/**
 * Empty is not error (the brief §3 "Feedback"). Empty shows the first square to fill: one sentence,
 * one action, and, at an earned moment, one rendered object (never in navigation). Error says what
 * failed, when, and how to retry.
 */
export function EmptyState({
  title,
  description,
  icon,
  object,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** A 3D render from public/marketing/objects (decorative). Takes the icon's place. */
  object?: ObjectName;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("neu-well flex flex-col items-center gap-3 px-6 py-10 text-center", className)} data-empty-state="">
      {object ? (
        <span className="block w-24 sm:w-28">
          <ObjectImage name={object} sizes="112px" />
        </span>
      ) : (
        <span className="neu-icon-btn size-14 text-text-secondary">{icon ?? <Tray aria-hidden className="size-7" />}</span>
      )}
      <h3 className="text-h4 text-text-primary">{title}</h3>
      {description ? <p className="max-w-prose text-body-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Error block: icon + text, never colour alone; says when, and shows the request ref when there is one. */
export function ErrorState({
  title = "Something went wrong",
  description,
  requestId,
  at,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  requestId?: string;
  /** When it failed (shown in mono). */
  at?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-lg border border-error/40 bg-bg-surface px-6 py-10 text-center", className)}>
      <WarningCircle aria-hidden weight="bold" className="size-8 text-error" />
      <h3 className="text-h4 text-text-primary">{title}</h3>
      {description ? <p className="max-w-prose text-body-sm text-text-secondary">{description}</p> : null}
      {requestId || at ? (
        <p className="neu-mono text-text-secondary">
          {at ?? null}
          {requestId ? `${at ? " · " : ""}Ref: ${requestId.slice(0, 8)}` : null}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
