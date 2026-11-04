// Prints a fresh VAPID key pair for web push (PRD 5.34) as two base64url values on one line:
// "<public key: 65-byte uncompressed P-256 point> <private key: 32-byte scalar>".
// Used by the restore drill (a scratch project gets its own keys) and by docs/setup-checklist.md.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
process.stdout.write(`${raw.toString("base64url")} ${priv.d}\n`);
