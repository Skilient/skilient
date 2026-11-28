import type { MediaService } from "@skilient/contracts/media/v1/media_pb";
import type { CallerPolicy } from "@skilient/platform";

/** The services that attach or serve files: they check files before attaching them and get links for readers they allow. */
const OWNERS = ["people", "content", "messaging", "work", "community", "credentials", "trust", "market"] as const;

/**
 * Which callers may use each method. Web makes upload links and reads its user's own files (public buckets: anyone);
 * only services check files and store bytes, and they may sign links to any file for readers they have authorised.
 */
export const callers: CallerPolicy<typeof MediaService> = {
  createUpload: ["web"],
  putFile: ["credentials"],
  checkFiles: OWNERS,
  downloadLinks: ["web", ...OWNERS],
  storageUsage: ["web"],
};
