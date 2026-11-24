import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import { callOf, refuse, type ServiceDeps } from "@skilient/platform";
import { EchoResponseSchema, WhoAmIResponseSchema, type SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { echoInput } from "../domain/echo";

export function createApi(deps: ServiceDeps): ServiceImpl<typeof SampleService> {
  return {
    echo(req, ctx) {
      const call = callOf(ctx);
      const input = echoInput.safeParse({ message: req.message });
      if (!input.success) throw refuse("invalid_input", input.error.issues[0]?.message ?? "invalid");
      return create(EchoResponseSchema, { message: input.data.message, servedBy: deps.instance, depth: call.depth });
    },
    whoAmI(_req, ctx) {
      const call = callOf(ctx);
      return create(WhoAmIResponseSchema, { caller: call.caller, signedIn: call.user !== null, userId: call.user?.id ?? "" });
    },
  };
}
