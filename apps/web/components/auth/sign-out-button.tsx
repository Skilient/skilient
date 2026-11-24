"use client";

import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { deletePushSubscription } from "@/lib/actions/community";
import { clearClientState, hardNavigate, postAuthMessage } from "@/lib/auth/channel";
import { currentSubscription } from "@/lib/pwa/client";

/**
 * PRD 5.2 sign-out: the server action ends the session, then this tab (and every other tab,
 * via the broadcast) clears client state and hard-navigates to "/", so nothing of this user
 * is left in memory or storage.
 */
export function SignOutButton({
  label = "Sign out",
  variant = "secondary",
  size = "md",
  className,
  icon = false,
}: {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  icon?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          // This device stops getting the account's pushes (PRD 5.34) before the session ends.
          const sub = await currentSubscription().catch(() => null);
          if (sub) {
            await deletePushSubscription({ endpoint: sub.endpoint }).catch(() => undefined);
            await sub.unsubscribe().catch(() => undefined);
          }
          await signOut();
          postAuthMessage("signed-out");
          clearClientState();
          hardNavigate("/");
        })
      }
    >
      {icon && !pending ? <SignOut aria-hidden weight="bold" className="size-4" /> : null}
      {label}
    </Button>
  );
}
