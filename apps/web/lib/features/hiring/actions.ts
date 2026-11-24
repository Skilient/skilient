"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";

export async function answerHireOutcome(hireId: string, answer: "yes" | "partly" | "no" | "left"): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.hire_outcome",
    schema: z.object({ hireId: z.uuid(), answer: z.enum(["yes", "partly", "no", "left"]) }),
    input: { hireId, answer },
    fn: "answer_hire_outcome",
    args: (v) => ({ p_hire: v.hireId, p_answer: v.answer }),
    revalidate: ["/recruit", "/recruit/analytics"],
  });
}
