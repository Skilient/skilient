import { Brain, Browser, ChartLine, Cloud, Compass, Database, DeviceMobile, PenNib } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = {
  browser: Browser,
  database: Database,
  "device-mobile": DeviceMobile,
  "chart-line": ChartLine,
  brain: Brain,
  cloud: Cloud,
  "pen-nib": PenNib,
  compass: Compass,
};

/** A path's pictogram (paths.seed `pictogram`); decorative, the role's name says what it is. */
export function Pictogram({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Compass;
  return <I aria-hidden weight="duotone" className={className} />;
}
