import type { ServiceModule } from "@skilient/platform";
import community from "@skilient/community";
import content from "@skilient/content";
import credentials from "@skilient/credentials";
import identity from "@skilient/identity";
import media from "@skilient/media";
import messaging from "@skilient/messaging";
import notify from "@skilient/notify";
import people from "@skilient/people";
import ranking from "@skilient/ranking";
import realtime from "@skilient/realtime";
import sample from "@skilient/sample";
import sampleRelay from "@skilient/sample-relay";
import work from "@skilient/work";

/** Every service the image can host. A new service adds one line here. */
export const registry: Readonly<Record<string, ServiceModule>> = {
  [community.name]: community as unknown as ServiceModule,
  [content.name]: content as unknown as ServiceModule,
  [credentials.name]: credentials as unknown as ServiceModule,
  [identity.name]: identity as unknown as ServiceModule,
  [media.name]: media as unknown as ServiceModule,
  [messaging.name]: messaging as unknown as ServiceModule,
  [notify.name]: notify as unknown as ServiceModule,
  [people.name]: people as unknown as ServiceModule,
  [ranking.name]: ranking as unknown as ServiceModule,
  [realtime.name]: realtime as unknown as ServiceModule,
  [sample.name]: sample as unknown as ServiceModule,
  [sampleRelay.name]: sampleRelay as unknown as ServiceModule,
  [work.name]: work as unknown as ServiceModule,
};
