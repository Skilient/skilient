/**
 * The installable app and web push in the browser (PRD 5.34). Client-only helpers: register the
 * service worker, subscribe this device with the VAPID public key from the server, and forget the
 * device at sign-out. Nothing here is sent anywhere except our own server actions.
 */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** base64url (the VAPID public key) to the bytes PushManager wants. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function bytesToUrlBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let s = "";
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission (only ever after a click) and subscribes this device. */
export async function subscribeThisDevice(publicKey: string): Promise<{ endpoint: string; p256dh: string; auth: string } | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
  return { endpoint: sub.endpoint, p256dh: bytesToUrlBase64(sub.getKey("p256dh")), auth: bytesToUrlBase64(sub.getKey("auth")) };
}

/** Sign-out: tickets cached on this device go. */
export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      for (const key of await caches.keys()) if (key.startsWith("skilient-tickets")) await caches.delete(key);
    }
  } catch {
    // Cache storage can be unavailable (private mode).
  }
}
