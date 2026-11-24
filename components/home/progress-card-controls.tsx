"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { dismissChecklist, dismissProgressCard } from "@/lib/actions/learn";

/** "Hide for today": the card comes back tomorrow (Pakistan time). `label` shows the words (in the sheet) instead of the corner cross. */
export function DismissCardButton({ label = false }: { label?: boolean }) {
  const [pending, startTransition] = useTransition();
  const onClick = () => startTransition(async () => void (await dismissProgressCard()));
  if (label) {
    return (
      <Button variant="ghost" size="sm" loading={pending} onClick={onClick} data-testid="progress-dismiss-sheet">
        Hide until tomorrow
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      aria-label="Hide this card until tomorrow"
      title="Hide until tomorrow"
      className="-mr-2 -mt-1 size-8 shrink-0 px-0"
      onClick={onClick}
      data-testid="progress-dismiss"
    >
      <X aria-hidden weight="bold" className="size-4" />
    </Button>
  );
}

/** Hide the checklist for good. */
export function DismissChecklistButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => startTransition(async () => void (await dismissChecklist()))}>
      Hide checklist
    </Button>
  );
}
