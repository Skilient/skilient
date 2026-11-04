import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { afterLabel, hoursLabel, PICTOGRAMS, taskStep } from "@/lib/growth/constants";

/**
 * Paths (PRD 5.32): lib/github/taxonomy/paths.yaml is the source of the 8 roles; the migration
 * loads the same JSON into platform_config `paths.seed`. Every skill id must exist in skills.yaml.
 */
const root = process.cwd();
const yaml = parse(readFileSync(join(root, "lib/github/taxonomy/paths.yaml"), "utf8"));
const taxonomy = parse(readFileSync(join(root, "lib/github/taxonomy/skills.yaml"), "utf8")) as { skills: { id: string }[] };
const migration = readFileSync(join(root, "supabase/migrations/20261113000001_paths_tasks.sql"), "utf8");

describe("paths seed", () => {
  it("matches the migration's paths.seed", () => {
    const seed = /\$seed\$\s*([\s\S]*?)\s*\$seed\$/.exec(migration)?.[1];
    expect(seed).toBeTruthy();
    expect(JSON.parse(seed!)).toEqual(yaml);
  });

  it("has 8 roles, each skill from the taxonomy, a known pictogram, no duplicates", () => {
    const ids = new Set(taxonomy.skills.map((s) => s.id));
    expect(yaml.roles).toHaveLength(8);
    for (const r of yaml.roles as { role: string; pictogram: string; skills: string[] }[]) {
      expect(PICTOGRAMS).toContain(r.pictogram);
      expect(new Set(r.skills).size).toBe(r.skills.length);
      for (const s of r.skills) expect(ids.has(s), `${r.role}: ${s}`).toBe(true);
    }
    expect(yaml.min_seniors).toBe(10);
    expect(yaml.min_tier).toBe("shine");
  });
});

describe("growth wording", () => {
  it("says hours the way the Taught entry does", () => {
    expect(hoursLabel(270)).toBe("4.5 h");
    expect(hoursLabel(60)).toBe("1 h");
    expect(hoursLabel(45)).toBe("45 min");
  });
  it("explains a square's place", () => {
    expect(afterLabel("React", 90)).toBe("Seniors proved it after React, median 3 months later");
    expect(afterLabel("React", 21)).toBe("Seniors proved it after React, median 3 weeks later");
    expect(afterLabel(null, 10)).toBeNull();
  });
  it("maps task states to steps", () => {
    expect(taskStep("verifying")).toBe(2);
    expect(taskStep("awaiting_peer")).toBe(3);
    expect(taskStep("needs_changes")).toBe(0);
  });
});
