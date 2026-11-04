import type { Metadata } from "next";
import { ConfigTabs } from "@/components/ops/config-tabs";
import { ProofTaskForm } from "@/components/ops/proof-task-form";
import { getProofTaskBank, getSkillOptions } from "@/lib/data/growth";
import { staffRoles } from "@/lib/data/ops-trust";

export const metadata: Metadata = { title: "Proof tasks" };

/**
 * /ops/config/tasks (PRD 5.32): the staff-written proof-task bank. Trust reviewers add and edit
 * (audited before and after); other staff read. A task is never deleted: switching it off stops
 * new starts and keeps the ones in progress.
 */
export default async function OpsProofTasksPage() {
  const [tasks, skills, roles] = await Promise.all([getProofTaskBank(), getSkillOptions(), staffRoles()]);
  const trust = roles.has("trust_reviewer");
  return (
    <main className="flex flex-col gap-5">
      <h1 className="font-display text-h1">Proof tasks</h1>
      <ConfigTabs current="/ops/config/tasks" />
      <p className="max-w-prose text-body-sm text-text-secondary">
        Each task proves one skill: a brief and 3 to 6 checks. Students verify through GitHub first, then a peer, or a code check where the skill has prompts.
      </p>
      {trust ? <ProofTaskForm skills={skills} /> : null}
      <div className="overflow-x-auto rounded-lg border border-border-default bg-bg-surface">
        <table className="w-full min-w-[720px] text-left text-body-sm" data-testid="proof-tasks-table">
          <thead className="border-b border-border-default bg-bg-subtle text-caption text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Task</th>
              <th scope="col" className="px-3 py-2 font-semibold">Skill</th>
              <th scope="col" className="px-3 py-2 font-semibold">Difficulty</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Started</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Done</th>
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {tasks.map((t) => (
              <tr key={t.id} data-testid="proof-task-row">
                <td className="px-3 py-2">
                  {trust ? (
                    <details>
                      <summary className="cursor-pointer font-semibold">{t.title}</summary>
                      <div className="mt-3">
                        <ProofTaskForm task={t} skills={skills} />
                      </div>
                    </details>
                  ) : (
                    <span className="font-semibold">{t.title}</span>
                  )}
                </td>
                <td className="px-3 py-2">{t.skill}</td>
                <td className="px-3 py-2">{t.difficulty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.started}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.done}</td>
                <td className="px-3 py-2">{t.active ? "Offered" : "Off"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
