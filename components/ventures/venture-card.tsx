import { VentureStatusBadge } from "@/components/ventures/status-badge";
import { SkillChip, VentureCard as VentureModule } from "@/components/ui";
import type { VentureRow } from "@/lib/data/ventures";
import { STAGE_OPTIONS, TYPE_LABELS } from "@/lib/ventures/labels";

/**
 * A venture in a list (screen spec "Venture row", phase 14): the venture module with its byline,
 * the team tray (the lead in front, the rest counted, open roles as pressed holes), the skills it
 * needs, and the university. Projects wear signal, startups jute: one colour per domain.
 */
export function VentureCard({ venture }: { venture: VentureRow }) {
  const stage = STAGE_OPTIONS.find((s) => s.value === venture.stage)?.label;
  return (
    <VentureModule
      title={venture.title}
      href={`/ventures/${venture.id}`}
      kind={[TYPE_LABELS[venture.type].one, stage].filter(Boolean).join(" · ")}
      tone={venture.type === "startup" ? "jute" : "signal"}
      status={<VentureStatusBadge status={venture.status} />}
      members={[{ name: venture.owner.name, role: "Lead" }]}
      extra={Math.max(venture.members - 1, 0)}
      open={venture.openSlots}
      highlight={venture.summary ? <span className="line-clamp-2">{venture.summary}</span> : undefined}
      lastActive={venture.universityName}
      action={
        venture.skills.length ? (
          <ul className="flex flex-wrap justify-end gap-1.5" aria-label="Skills">
            {venture.skills.slice(0, 3).map((s) => (
              <li key={s.id}>
                <SkillChip name={s.name} />
              </li>
            ))}
          </ul>
        ) : null
      }
    />
  );
}
