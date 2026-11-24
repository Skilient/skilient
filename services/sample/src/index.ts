import { defineService } from "@skilient/platform";
import { SampleService } from "@skilient/contracts/sample/v1/sample_pb";
import { createApi } from "./api";
import { callers } from "./authorize";

/** The W0 sample service (docs/azure/prd.md, build plan W0). Owns no data. */
export default defineService({
  name: "sample",
  contract: SampleService,
  callers,
  create: createApi,
});
