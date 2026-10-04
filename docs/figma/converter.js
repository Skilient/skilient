// Figma screen converter (docs/figma/README.md). Pasted into a use_figma call by
// scripts/figma-build-call.mjs, with OPTS and DATA filled in from a chunk written by
// scripts/figma-compact.mjs. Builds editable layers: frames positioned as captured, colours bound
// to the Color variables, text on the slice-1 text styles, and Skilient primitives as instances.
// JOBS: [{ o: { page, name, x, y? | "prev", row? }, d: chunk }], all on one page. `row` names the
// frame whose row (y) this one joins.
const JOBS = __JOBS__;

const page = await figma.getNodeByIdAsync(JOBS[0].o.page);
await figma.setCurrentPageAsync(page);

// Fonts used by the text styles and raw text.
const FONTS = [["Spectral", "Medium"], ["Spectral", "Regular"], ["Spectral", "SemiBold"], ["Barlow", "Regular"], ["Barlow", "Medium"], ["Barlow", "SemiBold"], ["Barlow", "Bold"], ["JetBrains Mono", "Regular"], ["JetBrains Mono", "Medium"]];
for (const [family, style] of FONTS) await figma.loadFontAsync({ family, style });
const WEIGHT = { 300: "Regular", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "Bold" };
const familyOf = (f) => (/spectral/i.test(f) ? "Spectral" : /mono/i.test(f) ? "JetBrains Mono" : "Barlow");

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const colorCol = cols.find((c) => c.name === "Color"), radCol = cols.find((c) => c.name === "Radius");
const vars = await figma.variables.getLocalVariablesAsync();
const CV = Object.fromEntries(vars.filter((v) => v.variableCollectionId === colorCol.id).map((v) => [v.name, v]));
const RV = vars.filter((v) => v.variableCollectionId === radCol.id);
const TS = Object.fromEntries((await figma.getLocalTextStylesAsync()).map((s) => [s.name, s]));
const ES = Object.fromEntries((await figma.getLocalEffectStylesAsync()).map((s) => [s.name, s]));

const iconPage = await figma.getNodeByIdAsync("4:2");
const ICONS = Object.fromEntries(iconPage.findAllWithCriteria({ types: ["COMPONENT"] }).map((c) => [c.name.replace("Icon/", ""), c]));
const SETS = {};
for (const [k, id] of Object.entries({ button: "6:243", input: "7:22", textarea: "7:43", select: "7:84", checkbox: "8:26", switch: "8:35" })) SETS[k] = await figma.getNodeByIdAsync(id);
const LOGO = await figma.getNodeByIdAsync("3:16"), MARK = await figma.getNodeByIdAsync("3:27");
const propKey = (set, name) => Object.keys(set.componentPropertyDefinitions).find((k) => k.startsWith(name + "#"));
const variant = (set, name) => set.children.find((c) => c.name === name) ?? set.defaultVariant;

function rgb(str) {
  const m = String(str).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  if (!m) return null;
  return { color: { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 }, opacity: m[4] === undefined ? 1 : +m[4] };
}
function paint(token) {
  if (!token) return null;
  if (CV[token]) return figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", CV[token]);
  const c = rgb(token);
  return c ? { type: "SOLID", color: c.color, opacity: c.opacity } : null;
}
function setRadius(node, r) {
  if (!r) return;
  const v = r >= 999 ? RV.find((x) => x.name === "radius/full") : RV.find((x) => Math.abs(x.valuesByMode[Object.keys(x.valuesByMode)[0]] - r) < 0.6);
  for (const k of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) { if (v) node.setBoundVariable(k, v); else node[k] = r; }
}
function recolor(inst, token) {
  const p = paint(token ?? "text/primary");
  if (p) for (const v of inst.findAll((n) => n.type === "VECTOR")) v.fills = [p];
}

// Horizontal offset of the last single-line text inside its captured box (alignment kept).
let DX = 0;
async function makeText(n) {
  DX = 0;
  const t = figma.createText();
  if (n.st && TS[n.st]) await t.setTextStyleIdAsync(TS[n.st].id);
  else if (n.fn) { t.fontName = { family: familyOf(n.fn[0]), style: WEIGHT[n.fn[2]] ?? "Regular" }; t.fontSize = n.fn[1]; t.lineHeight = { unit: "PIXELS", value: n.fn[3] }; }
  t.characters = n.x || " ";
  const p = paint(n.c ?? "text/primary"); if (p) t.fills = [p];
  if (n.up) t.textCase = "UPPER";
  if (n.u) t.textDecoration = "UNDERLINE";
  if (n.lt) t.textDecoration = "STRIKETHROUGH";
  if (n.al === "center") t.textAlignHorizontal = "CENTER"; else if (n.al === "right" || n.al === "end") t.textAlignHorizontal = "RIGHT";
  for (const r of n.rn ?? []) {
    const i = t.characters.indexOf(r.t); if (i < 0 || !r.t) continue;
    if (r.st && TS[r.st]) await t.setRangeTextStyleIdAsync(i, i + r.t.length, TS[r.st].id);
    const rp = paint(r.c); if (rp) t.setRangeFills(i, i + r.t.length, [rp]);
    if (r.u) t.setRangeTextDecoration(i, i + r.t.length, "UNDERLINE");
  }
  t.resize(Math.max(1, n.b[2]), Math.max(1, n.b[3]));
  t.textAutoResize = "HEIGHT";
  if (n.sl) {
    // Single line: hug the text and keep its alignment inside the captured box.
    t.textAutoResize = "WIDTH_AND_HEIGHT";
    const slack = n.b[2] - t.width;
    DX = n.al === "center" ? slack / 2 : n.al === "right" || n.al === "end" ? slack : 0;
  }
  return t;
}

// One line of text in a padded box (links, buttons, chips): centre it the way flexbox did, and keep
// it clear of a single icon beside it.
function place(t, n, w, h, ox = 0, oy = 0) {
  const lh = typeof t.lineHeight === "object" && t.lineHeight.unit === "PIXELS" ? t.lineHeight.value : t.fontSize * 1.4;
  if (t.height > lh * 1.5) return;
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  if (t.width > w) { t.textAutoResize = "HEIGHT"; t.resize(w, t.height); return; }
  t.y = oy + Math.round((h - t.height) / 2);
  const icons = (n.ch ?? []).filter((c) => c.k === "icon");
  // A trailing icon far from the text (justify-between, like a FAQ caret) leaves the text at the start.
  if (icons.length === 1) { const [ix, , iw] = icons[0].b; const trailing = ix > w / 2; if (!trailing) t.x = ox + ix + iw + 7; else if (w <= t.width + iw + 40) t.x = ox + Math.round(ix - 7 - t.width); else t.x = ox; }
  else if (n.al === "center" || n.f || n.r || n.tag === "a" || n.tag === "button") t.x = ox + Math.round((w - t.width) / 2);
}

async function build(n, parent) {
  let node;
  const [x, y, w, h] = n.b;
  if (n.k === "button") {
    const set = SETS.button;
    node = variant(set, `Variant=${n.v}, Size=${n.sz}, State=${n.dis ? "Disabled" : "Default"}`).createInstance();
    const props = { [propKey(set, "Label")]: n.l || "Button" };
    if (n.li && ICONS[n.li]) { props[propKey(set, "Leading icon")] = true; props[propKey(set, "Leading icon swap")] = ICONS[n.li].id; }
    if (n.ti && ICONS[n.ti]) { props[propKey(set, "Trailing icon")] = true; props[propKey(set, "Trailing icon swap")] = ICONS[n.ti].id; }
    node.setProperties(props);
    node.resize(w, h);
  } else if (n.k === "input" || n.k === "textarea" || n.k === "select") {
    const set = SETS[n.k];
    node = variant(set, `State=${n.err ? "Error" : "Default"}, Filled=${n.filled ? "Yes" : "No"}`).createInstance();
    const key = propKey(set, "Value");
    if (key) node.setProperties({ [key]: n.val || " " });
    node.resize(w, h);
  } else if (n.k === "checkbox") {
    node = variant(SETS.checkbox, `Value=${n.on ? "Checked" : "Unchecked"}, Disabled=No`).createInstance();
  } else if (n.k === "switch") {
    node = variant(SETS.switch, `Checked=${n.on ? "Yes" : "No"}, Disabled=No`).createInstance();
  } else if (n.k === "icon") {
    const comp = ICONS[n.i] ?? ICONS.Circle;
    node = comp.createInstance();
    node.name = n.i && ICONS[n.i] ? `icon/${n.i}` : `icon/${n.i ?? "unknown"} (missing)`;
    node.resize(Math.max(1, w), Math.max(1, h));
    recolor(node, n.c);
  } else if (n.k === "logo") {
    node = (n.mark ? MARK : LOGO).createInstance();
    node.rescale(Math.max(0.01, w / node.width));
  } else if (n.k === "image") {
    node = figma.createRectangle();
    node.name = `image: ${n.src || "?"}`;
    node.resize(Math.max(1, w), Math.max(1, h));
    node.fills = [paint("bg/subtle")];
  } else if (n.x !== undefined && !n.f && !n.s && !n.sh && !(n.ch ?? []).length) {
    node = await makeText(n);
    node.name = n.id ?? n.tag ?? "text";
    parent.appendChild(node);
    node.x = x + DX; node.y = y;
    // A padded link without paint (nav links): centre it in its box.
    if (!n.sl && (n.r || n.tag === "button")) place(node, n, w, h, x, y);
    return node;
  } else {
    node = figma.createFrame();
    node.name = n.id ?? n.tag ?? "frame";
    node.resize(Math.max(1, w), Math.max(1, h));
    // A closed <details> keeps its answer in the tree; clip it like the browser does.
    node.clipsContent = n.tag === "details";
    const f = paint(n.f); node.fills = f ? [f] : [];
    if (n.s) { const s = paint(n.s[0]); if (s) { node.strokes = [s]; node.strokeWeight = n.s[1]; node.strokeAlign = "INSIDE"; } }
    setRadius(node, n.r);
    if (n.sh && ES["Elevation/1"]) await node.setEffectStyleIdAsync(ES["Elevation/1"].id);
    if (n.x !== undefined) { const tx = n.tx ?? 0, ty = n.ty ?? 0; const t = await makeText({ ...n, b: [tx, ty, w - tx, h - ty] }); node.appendChild(t); t.x = tx + DX; t.y = ty; if (!n.tx && !n.ty) place(t, n, w, h); }
    for (const c of n.ch ?? []) await build(c, node);
  }
  parent.appendChild(node);
  node.x = x; node.y = y;
  return node;
}

// One frame per job: part 0 (re)creates it in place, later parts append to it.
const results = [];
let prevY;
for (const { o: OPTS, d: DATA } of JOBS) {
  let frame = page.findChild((c) => c.type === "FRAME" && c.name === OPTS.name);
  let keepY;
  if (frame && DATA.part === 0) { keepY = frame.y; frame.remove(); frame = null; }
  if (!frame) {
    frame = figma.createFrame();
    frame.name = OPTS.name;
    frame.resize(DATA.w, DATA.h);
    frame.fills = [paint(DATA.bg)];
    frame.clipsContent = true;
    let y = OPTS.y === "prev" ? prevY : OPTS.y ?? keepY;
    if (y === undefined && OPTS.row) y = page.findChild((c) => c.type === "FRAME" && c.name === OPTS.row)?.y;
    if (y === undefined) y = page.children.reduce((m, c) => Math.max(m, c.y + c.height), 0) + 240;
    frame.x = OPTS.x; frame.y = y;
    frame.setExplicitVariableModeForCollection(colorCol, colorCol.modes.find((m) => m.name === "Light").modeId);
  }
  for (const s of DATA.sections) await build(s, frame);
  const bottom = frame.children.reduce((m, c) => Math.max(m, c.y + c.height), 0);
  if (bottom > frame.height) frame.resize(frame.width, Math.ceil(bottom));
  prevY = frame.y;
  results.push({ name: OPTS.name, frame: frame.id, y: frame.y, h: frame.height, part: DATA.part, parts: DATA.parts });
}
return results;
