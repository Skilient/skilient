import { z } from "zod";

/** Rules for Echo: pure, no I/O. */
export const echoInput = z.object({
  message: z.string().trim().min(1, "message_empty").max(200, "message_too_long"),
});

export type EchoInput = z.infer<typeof echoInput>;
