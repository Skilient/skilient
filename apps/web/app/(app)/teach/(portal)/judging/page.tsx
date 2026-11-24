import type { Metadata, Route } from "next";
import { Trophy } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { DataTable, PageTitle } from "@/components/uni/page-parts";
import { getMyJudging } from "@/lib/data/uni";
import { eventTime } from "@/lib/format/time";

export const metadata: Metadata = { title: "Judging" };

/** /teach/judging (PRD 5.23): university hackathons you judge; score entries after the deadline. */
export default async function JudgingPage() {
  const items = await getMyJudging();
  return (
    <main className="flex flex-col gap-6">
      <PageTitle title="Judging">Your university asked you to judge these hackathons. Each entry&apos;s score is the average of its judges.</PageTitle>
      {items.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden className="size-8" />}
          title="Nothing to judge"
          description="When your university asks you to judge a hackathon, it appears here with its closing time."
        />
      ) : (
        <DataTable head={["Hackathon", "Closes", "Status"]}
          rows={items.map((h) => [<Link key="t" className="font-semibold underline" href={`/teach/judging/${h.id}` as Route}>{h.title}</Link>, eventTime(h.ends_at), h.status])} />
      )}
    </main>
  );
}
