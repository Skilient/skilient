import { defineService } from "@skilient/platform";
import { SampleRelayService } from "@skilient/contracts/sample_relay/v1/sample_relay_pb";
import { createApi } from "./api";
import { callers } from "./authorize";

/** The W0 sample's caller: proves service-to-service calls in memory and over HTTP/2. Owns no data. */
export default defineService({
  name: "sample-relay",
  contract: SampleRelayService,
  callers,
  create: createApi,
});
