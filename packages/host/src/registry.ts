import type { ServiceModule } from "@skilient/platform";
import content from "@skilient/content";
import identity from "@skilient/identity";
import messaging from "@skilient/messaging";
import people from "@skilient/people";
import realtime from "@skilient/realtime";
import sample from "@skilient/sample";
import sampleRelay from "@skilient/sample-relay";
import work from "@skilient/work";

/** Every service the image can host. A new service adds one line here. */
export const registry: Readonly<Record<string, ServiceModule>> = {
  [content.name]: content as unknown as ServiceModule,
  [identity.name]: identity as unknown as ServiceModule,
  [messaging.name]: messaging as unknown as ServiceModule,
  [people.name]: people as unknown as ServiceModule,
  [realtime.name]: realtime as unknown as ServiceModule,
  [sample.name]: sample as unknown as ServiceModule,
  [sampleRelay.name]: sampleRelay as unknown as ServiceModule,
  [work.name]: work as unknown as ServiceModule,
};
