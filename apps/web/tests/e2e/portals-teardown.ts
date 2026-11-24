import { setPortals } from "./portals-setup";

export default async function globalTeardown() {
  if (process.env.E2E_PORTALS === "1") await setPortals(false);
}
