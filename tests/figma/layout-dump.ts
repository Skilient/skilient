/**
 * Runs in the page (via page.evaluate): a compact layout tree of what is on screen, for
 * rebuilding a frame as editable Figma layers. Colours are mapped back to the PRD 9 token
 * names in app/styles/tokens.css where a token matches, so the Figma build binds variables
 * instead of hard-coding fills. Kept free of imports: Playwright serialises the function.
 */
export interface DumpNode {
  tag: string;
  name?: string;
  role?: string;
  testid?: string;
  text?: string;
  box: [number, number, number, number];
  layout?: { display: string; dir?: string; gap?: number; pad?: [number, number, number, number]; align?: string; justify?: string };
  fill?: string;
  color?: string;
  border?: { color: string; width: number };
  radius?: number;
  shadow?: string;
  font?: { family: string; size: number; weight: number; line: number };
  src?: string;
  children?: DumpNode[];
}

export function dumpLayout(): { tokens: Record<string, string>; root: DumpNode | null } {
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  const rgb = (v: string) => {
    probe.style.color = "";
    probe.style.color = v;
    return getComputedStyle(probe).color;
  };
  // Every colour custom property on :root, resolved to the browser's rgb() form.
  const tokens: Record<string, string> = {};
  const byValue = new Map<string, string>();
  const rootStyle = getComputedStyle(document.documentElement);
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const style = (rule as CSSStyleRule).style;
      if (!style) continue;
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (!prop.startsWith("--") || prop in tokens) continue;
        const raw = rootStyle.getPropertyValue(prop).trim();
        if (!raw || !/^(#|rgb|hsl|oklch|oklab|color\()/.test(raw)) continue;
        const v = rgb(raw);
        tokens[prop] = v;
        // Semantic names (bg-, text-, border-, primary…) win over ramp steps for the same value.
        if (!byValue.has(v) || /^--(color-)?(bg|text|border|primary|accent|success|warning|error|info)/.test(prop)) byValue.set(v, prop);
      }
    }
  }
  probe.remove();
  const paint = (v: string) => (v === "rgba(0, 0, 0, 0)" ? undefined : (byValue.get(v) ?? v));
  const px = (v: string) => Math.round(parseFloat(v) || 0);

  function walk(el: Element, depth: number): DumpNode | null {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const node: DumpNode = { tag: el.tagName.toLowerCase(), box: [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] };
    const role = el.getAttribute("role");
    if (role) node.role = role;
    const label = el.getAttribute("aria-label");
    if (label) node.name = label;
    const testid = el.getAttribute("data-testid");
    if (testid) node.testid = testid;
    if (cs.display.includes("flex") || cs.display.includes("grid")) {
      node.layout = {
        display: cs.display,
        dir: cs.flexDirection,
        gap: px(cs.rowGap || cs.gap),
        pad: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
        align: cs.alignItems,
        justify: cs.justifyContent,
      };
    }
    const fill = paint(cs.backgroundColor);
    if (fill) node.fill = fill;
    const bw = px(cs.borderTopWidth);
    if (bw) node.border = { color: paint(cs.borderTopColor) ?? cs.borderTopColor, width: bw };
    const radius = px(cs.borderTopLeftRadius);
    if (radius) node.radius = radius;
    if (cs.boxShadow !== "none") node.shadow = cs.boxShadow;
    if (el instanceof HTMLImageElement) node.src = el.currentSrc || el.src;
    if (el.tagName === "svg") return node; // icons: the box is enough, the build places a Phosphor icon
    // Direct text, with its typography.
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      node.text = text || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || "";
      node.color = paint(cs.color);
      node.font = { family: cs.fontFamily.split(",")[0].replace(/["']/g, ""), size: px(cs.fontSize), weight: Number(cs.fontWeight), line: px(cs.lineHeight) || Math.round(px(cs.fontSize) * 1.4) };
    }
    if (depth < 40) {
      const kids = Array.from(el.children)
        .map((c) => walk(c, depth + 1))
        .filter((c): c is DumpNode => c !== null);
      if (kids.length) node.children = kids;
    }
    return node;
  }
  return { tokens, root: walk(document.body, 0) };
}
