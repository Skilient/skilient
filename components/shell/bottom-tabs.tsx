"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgePill } from "@/components/shell/badge-pill";
import { useNavBadges } from "@/components/shell/nav-badges";
import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { isActive, PRIMARY_NAV } from "@/lib/nav";

/**
 * The phone dock (phase 14): Home · Openings · Ventures · Chat · Me on one raised tray. The place
 * you are in is pressed in, with a filled orange icon. Long-press shows the same tooltip as hover.
 */
export function BottomTabs() {
  const pathname = usePathname();
  const badges = useNavBadges();
  return (
    <nav aria-label="Main" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 md:hidden">
      <ul className="grid grid-cols-5 gap-1 rounded-[22px] bg-bg-surface p-1.5 shadow-[var(--raised-m)]">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item, pathname);
          const count = item.badge ? badges[item.badge] : 0;
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Tooltip label={item.label} description={item.description} placement="top" longPress className="block">
                <Link
                  href={item.href as Route}
                  aria-current={active ? "page" : undefined}
                  data-tour={`nav-${item.key}`}
                  data-testid={`tab-${item.key}`}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[0.6875rem] font-semibold",
                    active ? "bg-bg-surface text-text-primary shadow-[var(--pressed-s)]" : "text-text-secondary",
                  )}
                >
                  <Icon aria-hidden weight={active ? "fill" : "bold"} className={cn("size-6", active && "text-[var(--signal-ink)]")} />
                  {item.label}
                  {/* After the label, so the name reads "Openings 4 waiting" (WCAG 2.5.3); drawn on the icon's corner. */}
                  <BadgePill count={count} className="absolute top-0.5 left-[calc(50%+2px)]" srSuffix={item.badge === "chat" ? "unread" : "waiting"} />
                </Link>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
