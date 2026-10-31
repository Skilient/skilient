import { List, X } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { isBuilt, nav } from "@/content/marketing";
import { Wordmark } from "./wordmark";

const linkClass =
  "inline-flex h-11 items-center rounded-full px-3.5 text-body font-medium text-text-secondary transition-[color,box-shadow] duration-[140ms] ease-out hover:text-text-primary hover:shadow-[var(--raised-s)] active:shadow-[var(--pressed-s)]";
const joinClass =
  "neu-btn min-h-11 px-5 text-body";

/**
 * Marketing top navigation (PRD 5.1): wordmark, organisation pages, Pricing, Verify a CV,
 * Sign in and Join. Below 1024 px the links move into a menu sheet built on the Popover API,
 * so it opens without JavaScript; Join stays in the bar. Signed in: "Open Skilient".
 */
export function MarketingNav({ home }: { home: string | null }) {
  const links = nav.links.filter((l) => isBuilt(l.href));
  const primary = home ? (
    <Link href={home as Route} className={joinClass} data-testid="nav-open">
      {nav.open}
    </Link>
  ) : (
    <Link href={nav.join.href} className={joinClass} data-testid="nav-join">
      {nav.join.label}
    </Link>
  );
  return (
    <header className="relative z-20 px-[var(--page-gutter)] pt-4">
      <nav aria-label="Main" className="neu-card mx-auto flex h-16 max-w-[calc(var(--page-max)-2*var(--page-gutter))] items-center gap-4 rounded-full pr-2.5 pl-5">
        <Link href="/" aria-label="Skilient home" className="mr-auto shrink-0 rounded-sm">
          <Wordmark className="h-7 w-auto" />
        </Link>
        <ul className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkClass}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          {home ? null : (
            <Link href={nav.signIn.href} className={`${linkClass} whitespace-nowrap max-sm:hidden`}>
              {nav.signIn.label}
            </Link>
          )}
          {primary}
          <button
            type="button"
            popoverTarget="site-menu"
            className="neu-icon-btn lg:hidden"
            aria-label="Menu"
          >
            <List aria-hidden weight="bold" className="size-5" />
          </button>
        </div>
      </nav>
      <div
        id="site-menu"
        popover="auto"
        className="site-menu m-0 ml-auto h-dvh max-h-none w-[min(22rem,100vw)] rounded-l-[var(--r-card)] bg-bg-elevated p-0 text-text-primary"
      >
        <div className="flex h-16 items-center justify-between px-[var(--page-gutter)]">
          <span className="text-h4">Menu</span>
          <button
            type="button"
            popoverTarget="site-menu"
            popoverTargetAction="hide"
            className="neu-icon-btn"
            aria-label="Close menu"
          >
            <X aria-hidden weight="bold" className="size-5" />
          </button>
        </div>
        <ul className="flex flex-col gap-3 px-[var(--page-gutter)] pb-8">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="neu-chip flex h-12 items-center px-5 text-h4 active:shadow-[var(--pressed-s)]">
                {l.label}
              </Link>
            </li>
          ))}
          {home ? null : (
            <li>
              <Link href={nav.signIn.href} className="neu-btn-3 h-12 w-full px-5 text-h4">
                {nav.signIn.label}
              </Link>
            </li>
          )}
        </ul>
      </div>
    </header>
  );
}
