import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import type { SocietyCard as Card } from "@/lib/data/societies";
import { categoryLabel } from "@/lib/societies/constants";

/** A society in the directory (screen spec 3.14 "Societies"): logo, name, category, members, open rounds. */
export function SocietyCard({ s, following, member }: { s: Card; following?: boolean; member?: boolean }) {
  return (
    <article className="neu-card flex flex-col gap-3 p-4" data-testid="society-card">
      <div className="flex items-start gap-3">
        <Avatar name={s.name} src={s.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-h4">
            <Link href={`/societies/${s.slug}` as Route} className="underline-offset-4 hover:underline">
              {s.name}
            </Link>
          </h3>
          <p className="text-caption text-text-secondary">
            {categoryLabel(s.category)} · {s.university}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-body-sm text-text-secondary">{s.about}</p>
      <p className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        <span className="neu-mono inline-flex items-center gap-1">
          <UsersThree aria-hidden weight="bold" className="size-3.5" />
          {s.members} {s.members === 1 ? "member" : "members"}
        </span>
        {s.openRounds > 0 ? <Badge tone="info">Inductions open</Badge> : null}
        {member ? <Badge tone="success">Member</Badge> : following ? <Badge tone="neutral">Following</Badge> : null}
      </p>
    </article>
  );
}
