import { readFileSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { describe, expect, it } from "vitest";
import { rulesetSchema } from "@/lib/rulesets/schema";

function loadYaml(relativePath: string): unknown {
  const text = readFileSync(path.join(process.cwd(), relativePath), "utf-8");
  return parseYaml(text);
}

describe("rulesetSchema", () => {
  it("accepts the committed SOW ruleset", () => {
    const parsed = rulesetSchema.parse(loadYaml("rules/sow.yaml"));
    expect(parsed.documentType).toBe("SOW");
    expect(parsed.rules.length).toBeGreaterThan(0);
  });

  it("rejects a ruleset missing a required severity band", () => {
    const invalid = {
      documentType: "SOW",
      version: "0.0.1",
      rules: [
        {
          id: "test-rule",
          category: "Test",
          description: "test",
          severity: { green: "ok", amber: "meh", red: "bad" },
          suggestedFix: "fix it",
        },
      ],
    };
    expect(() => rulesetSchema.parse(invalid)).toThrow();
  });

  it("rejects a ruleset with a duplicate rule id", () => {
    const severity = { green: "a", amber: "b", red: "c", critical: "d" };
    const invalid = {
      documentType: "SOW",
      version: "0.0.1",
      rules: [
        { id: "dup", category: "A", description: "a", severity, suggestedFix: "fix" },
        { id: "dup", category: "B", description: "b", severity, suggestedFix: "fix" },
      ],
    };
    expect(() => rulesetSchema.parse(invalid)).toThrow(/Duplicate rule id/);
  });
});
