/** Prints what a person sees: headings, visible text (trimmed) and the names of interactive controls. */
import type { Page } from "@playwright/test";
export async function inspect(page: Page, max = 1800): Promise<string> {
  const data = await page.evaluate(() => {
    const vis = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const ctrls = Array.from(document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [role=tab], [role=checkbox], [role=link], [role=menuitem]"))
      .filter(vis)
      .map((el) => {
        const e = el as HTMLElement;
        const name = (e.getAttribute("aria-label") || e.innerText || (e as HTMLInputElement).placeholder || e.getAttribute("name") || e.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 50);
        const tag = e.tagName.toLowerCase();
        const extra = tag === "a" ? ` ->${e.getAttribute("href")}` : tag === "input" ? `[${(e as HTMLInputElement).type}]` : "";
        return `${tag}${extra}:${name}${(e as HTMLButtonElement).disabled ? "(disabled)" : ""}`;
      });
    return { url: location.pathname + location.search, title: document.title, text: document.body.innerText.replace(/\n{2,}/g, "\n").trim(), ctrls };
  });
  return `URL ${data.url} | TITLE ${data.title}\nTEXT: ${data.text.slice(0, max)}\nCONTROLS: ${data.ctrls.join(" | ").slice(0, max)}`;
}
