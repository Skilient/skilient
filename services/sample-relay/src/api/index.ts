import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import { from, type ServiceDeps } from "@skilient/platform";
import { SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { RelayResponseSchema, type SampleRelayService } from "@skilient/contracts/sample_relay/v1/sample_relay_pb";

export function createApi(deps: ServiceDeps): ServiceImpl<typeof SampleRelayService> {
  const sample = deps.clients.client(SampleService);
  return {
    async relay(req, ctx) {
      const echo = await sample.echo({ message: req.message }, from(ctx));
      return create(RelayResponseSchema, {
        message: echo.message,
        echoServedBy: echo.servedBy,
        relayServedBy: deps.instance,
        transport: deps.clients.transportOf(SampleService),
      });
    },
  };
}
