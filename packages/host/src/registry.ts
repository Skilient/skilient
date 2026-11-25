import type { ServiceModule } from "@skilient/platform";
import identity from "@skilient/identity";
import people from "@skilient/people";
import sample from "@skilient/sample";
import sampleRelay from "@skilient/sample-relay";

/** Every service the image can host. A new service adds one line here. */
export const registry: Readonly<Record<string, ServiceModule>> = {
  [identity.name]: identity as unknown as ServiceModule,
  [people.name]: people as unknown as ServiceModule,
  [sample.name]: sample as unknown as ServiceModule,
  [sampleRelay.name]: sampleRelay as unknown as ServiceModule,
};
