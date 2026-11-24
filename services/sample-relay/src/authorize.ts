import type { CallerPolicy } from "@skilient/platform";
import type { SampleRelayService } from "@skilient/contracts/sample_relay/v1/sample_relay_pb";

/** Only web may ask for a relay: a service calling Relay would make the chain three deep. */
export const callers: CallerPolicy<typeof SampleRelayService> = {
  relay: ["web"],
};
