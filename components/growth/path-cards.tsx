import type { Route } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/societies/action-button";
import { Badge } from "@/components/ui";
import { followPath } from "@/lib/actions/growth";
import { cn } from "@/lib/cn";
import type { PathCard } from "@/lib/data/growth";
import { Pictogram } from "./pictogram";

/** The role cards on /me/paths: pictogram, source ("Based on 48 seniors' records" or Starter path), progress, follow. */
export function PathCards({ roles, current, maxFollows }: { roles: PathCard[]; current: string | null; maxFollows: number }) {
  const following = roles.filter((r) => r.following).length;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="path-cards">
      {roles.map((r) => (
        <li key={r.role} className={cn("neu-card flex flex-col gap-3 p-4", r.role === current && "ring-2 ring-[var(--focus-ring)]")} data-testid="path-card" data-role={r.role}>
          <div className="flex items-start gap-3">
            <span className="neu-icon-btn size-11 shrink-0 text-text-primary">
              <Pictogram name={r.pictogram} className="size-6" />
            </span>
            <div className="min-w-0">
              <h3 className="text-h4">
                <Link href={`/me/paths?role=${r.role}` as Route} className="underline-offset-4 hover:underline" aria-current={r.role === current ? "page" : undefined}>
                  {r.name}
                </Link>
              </h3>
              <p className="text-caption text-text-secondary">{r.source === "data" ? `Based on ${r.seniors} seniors' records` : "Starter path"}</p>
            </div>
          </div>
          <p className="neu-mono text-text-secondary">
            {r.proved} of {r.total} proved{r.nextName ? ` · next: ${r.nextName}` : ""}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {r.following ? <Badge tone="verified">Following</Badge> : null}
            {r.following ? (
              <ActionButton action={followPath} args={{ role: r.role, follow: false }} variant="ghost" testId={`unfollow-${r.role}`}>
                Unfollow
              </ActionButton>
            ) : following < maxFollows ? (
              <ActionButton action={followPath} args={{ role: r.role, follow: true }} testId={`follow-${r.role}`}>
                Follow
              </ActionButton>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
