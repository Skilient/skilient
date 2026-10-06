// Runner stored in the Figma file as shared plugin data skilient/run (slice 3 onwards).
// A call sends deflate-raw + base64 JOBS; the runner inflates them, runs the stored converter
// and applies the app-shell post-fix (sidebar full height, phone tab bar at the bottom).
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stored in the Figma file and called from there
async function RUN(b64) {
  function INFLATE(b64) {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", L = {};
    for (let i = 0; i < 64; i++) L[A[i]] = i;
    const s = b64.replace(/=+$/, ""), src = new Uint8Array((s.length * 3) >> 2);
    for (let i = 0, j = 0, v = 0, n = 0; i < s.length; i++) { v = (v << 6) | L[s[i]]; n += 6; if (n >= 8) { n -= 8; src[j++] = (v >> n) & 255; } }
    let pos = 0, bit = 0, out = [];
    const bits = (k) => { let v = 0; for (let i = 0; i < k; i++) { v |= ((src[pos] >> bit) & 1) << i; if (++bit === 8) { bit = 0; pos++; } } return v; };
    const build = (lens) => { const cnt = new Array(16).fill(0), offs = new Array(16).fill(0); for (const l of lens) cnt[l]++; cnt[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + cnt[i - 1]; const sym = []; lens.forEach((l, i) => { if (l) sym[offs[l]++] = i; }); return { cnt, sym }; };
    const dec = (t) => { let code = 0, first = 0, idx = 0; for (let l = 1; l < 16; l++) { code |= bits(1); const c = t.cnt[l]; if (code - c < first) return t.sym[idx + code - first]; idx += c; first = (first + c) << 1; code <<= 1; } throw new Error("bad code"); };
    const LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258], LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    const DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577], DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    let fin;
    do {
      fin = bits(1); const type = bits(2);
      if (type === 0) { if (bit) { bit = 0; pos++; } const len = src[pos] | (src[pos + 1] << 8); pos += 4; for (let i = 0; i < len; i++) out.push(src[pos++]); continue; }
      let lt, dt;
      if (type === 1) { const l = []; for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8); lt = build(l); dt = build(new Array(30).fill(5)); }
      else {
        const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, ord = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15], cl = new Array(19).fill(0);
        for (let i = 0; i < hc; i++) cl[ord[i]] = bits(3);
        const ct = build(cl), ls = [];
        while (ls.length < hl + hd) { const c = dec(ct); if (c < 16) ls.push(c); else if (c === 16) { const p = ls[ls.length - 1], r = 3 + bits(2); for (let i = 0; i < r; i++) ls.push(p); } else { const r = c === 17 ? 3 + bits(3) : 11 + bits(7); for (let i = 0; i < r; i++) ls.push(0); } }
        lt = build(ls.slice(0, hl)); dt = build(ls.slice(hl));
      }
      for (;;) { const c = dec(lt); if (c < 256) out.push(c); else if (c === 256) break; else { const i = c - 257, len = LB[i] + bits(LE[i]), d = dec(dt), dist = DB[d] + bits(DE[d]); for (let k = 0; k < len; k++) out.push(out[out.length - dist]); } }
    } while (!fin);
    let str = "", i = 0; const o = out;
    while (i < o.length) { const c = o[i++]; if (c < 128) str += String.fromCharCode(c); else if (c < 224) str += String.fromCharCode(((c & 31) << 6) | (o[i++] & 63)); else if (c < 240) str += String.fromCharCode(((c & 15) << 12) | ((o[i++] & 63) << 6) | (o[i++] & 63)); else { const cp = ((c & 7) << 18) | ((o[i++] & 63) << 12) | ((o[i++] & 63) << 6) | (o[i++] & 63), u = cp - 0x10000; str += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 1023)); } }
    return str;
  }
  const JOBS = JSON.parse(INFLATE(b64));
  const CONV = new Function("return " + figma.root.getSharedPluginData("skilient", "converter"))();
  const res = await CONV(JOBS);
  for (const r of res) {
    const f = await figma.getNodeByIdAsync(r.frame);
    if (!f) continue;
    for (const c of f.children) {
      if (c.name === "aside" && c.y < 5 && c.height < f.height) c.resize(c.width, f.height);
      if (/phone/.test(f.name) && c.name === "nav" && c.y > 600 && c.height < 80) c.y = f.height - c.height;
    }
  }
  return res.map((r) => [r.name, r.frame]);
}
