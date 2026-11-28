// The web's signing code (apps/web/supabase/functions/_shared/cv/), imported by the cross-check tests, names two DOM
// types; Node's Web Crypto has the same shapes.
type BufferSource = ArrayBufferView | ArrayBuffer;
type CryptoKeyPair = import("node:crypto").webcrypto.CryptoKeyPair;
