import { assertLocalStack } from "../../../../packages/testing/src/golden";

/** Golden recordings run against the local stack only: refuse anything else before a browser starts. */
export default function globalSetup(): void {
  assertLocalStack(process.env["E2E_BASE_URL"]);
}
