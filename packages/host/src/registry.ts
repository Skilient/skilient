import type { ServiceModule } from "@skilient/platform";
import sample from "@skilient/sample";
import sampleRelay from "@skilient/sample-relay";

/** Every service the image can host. A new service adds one line here. */
export const registry: Readonly<Record<string, ServiceModule>> = {
  [sample.name]: sample as unknown as ServiceModule,
  [sampleRelay.name]: sampleRelay as unknown as ServiceModule,
};
