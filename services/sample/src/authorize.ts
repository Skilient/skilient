import type { CallerPolicy } from "@skilient/platform";
import type { SampleService } from "@skilient/contracts/sample/v1/sample_pb";

/**
 * Who may do what. The platform's gate checks `callers` before the body is
 * read; per-user rules go in functions here, called by the handlers. The sample
 * has none: any verified caller on the list may echo.
 */
export const callers: CallerPolicy<typeof SampleService> = {
  echo: ["web", "sample-relay"],
  whoAmI: ["web", "sample-relay"],
};
