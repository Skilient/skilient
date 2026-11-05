import { WebSocket } from "k6/experimental/websockets";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./api.js";

/**
 * A minimal Supabase Realtime client (Phoenix protocol, vsn 1.0.0): enough to subscribe to
 * postgres_changes the way components/chat/conversation.tsx and the nav badges do, and to time
 * how long a row takes to arrive. One socket per iteration; close() before the iteration ends.
 */
export function connect() {
  const url = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${PUBLISHABLE_KEY}&vsn=1.0.0`;
  const ws = new WebSocket(url);
  const waiting = []; // { match, resolve, timer }
  const subscribed = {};
  let ref = 0;
  let heartbeat = null;

  const send = (msg) => ws.send(JSON.stringify(msg));

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.event === "system" && msg.payload && msg.payload.status === "ok" && msg.payload.extension === "postgres_changes") {
      subscribed[msg.topic] = true;
    }
    for (let i = waiting.length - 1; i >= 0; i--) {
      const w = waiting[i];
      if (w.match(msg)) {
        clearTimeout(w.timer);
        waiting.splice(i, 1);
        w.resolve(msg);
      }
    }
  });

  /** Resolves with the first message `match` accepts, or null after `ms`. */
  const next = (match, ms) =>
    new Promise((resolve) => {
      const w = { match, resolve };
      w.timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(w), 1);
        resolve(null);
      }, ms);
      waiting.push(w);
    });

  return {
    open: () =>
      new Promise((resolve) => {
        ws.addEventListener("open", () => {
          heartbeat = setInterval(() => send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: `hb${++ref}` }), 25000);
          resolve(true);
        });
        ws.addEventListener("error", () => resolve(false));
      }),
    /** Joins `realtime:{name}` for one table's changes as the user; resolves true once Postgres confirms. */
    async subscribe(name, token, change) {
      const topic = `realtime:${name}`;
      const r = String(++ref);
      send({
        topic,
        event: "phx_join",
        ref: r,
        join_ref: r,
        payload: { config: { broadcast: { ack: false, self: false }, presence: { key: "", enabled: false }, postgres_changes: [change], private: false }, access_token: token },
      });
      const reply = await next((m) => m.topic === topic && m.event === "phx_reply" && m.ref === r, 10000);
      if (!reply || reply.payload.status !== "ok") return false;
      if (subscribed[topic]) return true;
      const sys = await next((m) => m.topic === topic && m.event === "system", 10000);
      return !!sys && sys.payload.status === "ok";
    },
    /** Waits for a postgres_changes event on `name` whose record passes `test`. */
    change: (name, test, ms) => next((m) => m.topic === `realtime:${name}` && m.event === "postgres_changes" && test(m.payload.data.record || {}), ms),
    close() {
      if (heartbeat) clearInterval(heartbeat);
      for (const w of waiting.splice(0)) {
        clearTimeout(w.timer);
        w.resolve(null);
      }
      ws.close();
    },
  };
}
