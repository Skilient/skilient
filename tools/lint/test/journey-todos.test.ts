import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectTodos } from "../src/journey-todos.mjs";

const root = join(import.meta.dirname, "../../..");

describe("journey handoff", () => {
  const todos = collectTodos(root);
  const doc = readFileSync(join(root, "docs/azure/journey-handoff.md"), "utf8");

  it("every journey to-do names the workstream that owes it", () => {
    for (const t of todos) expect(t.owner, `${t.file}: ${t.item}`).not.toBe("unassigned");
  });

  it("docs/azure/journey-handoff.md lists every journey to-do (regenerate it with node tools/lint/src/journey-todos.mjs)", () => {
    expect(todos.length).toBeGreaterThan(0);
    for (const t of todos) expect(doc, t.item).toContain(t.item);
  });
});
