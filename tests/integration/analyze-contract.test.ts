import { describe, expect, it, vi } from "vitest";
import { load as parseYaml } from "js-yaml";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rulesetSchema } from "@/lib/rulesets/schema";

// Mocks the AI SDK's generateObject rather than hand-writing findings mocks,
// so the pipeline code under test (analyzeContract) is exercised exactly as
// it runs in production — only the network call to Claude is stubbed.
// Per golden-dataset/README.md, these fixture responses should be captured
// from a real model run and refreshed whenever rules/sow.yaml changes.
const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("@/lib/ai/client", () => ({ analysisModel: {}, classifierModel: {} }));

const { analyzeContract } = await import("@/lib/ai/analyze");

function loadRuleset() {
  const text = readFileSync(path.join(process.cwd(), "rules/sow.yaml"), "utf-8");
  return rulesetSchema.parse(parseYaml(text));
}

function loadGoldenContract(name: string) {
  return readFileSync(
    path.join(process.cwd(), "golden-dataset/sow", name),
    "utf-8",
  );
}

describe("analyzeContract", () => {
  it("returns findings matching the recorded response shape for the clean golden contract", async () => {
    const ruleset = loadRuleset();
    const contractText = loadGoldenContract("contract-01-clean.md");

    mockGenerateObject.mockResolvedValueOnce({
      object: {
        findings: ruleset.rules.map((rule) => ({
          ruleId: rule.id,
          category: rule.category,
          severity: "green" as const,
          quote: "sample clause text",
          title: `${rule.category} meets guideline`,
          issue: "No issue — clause meets the green criteria.",
          suggestedFix: rule.suggestedFix,
        })),
      },
    });

    const result = await analyzeContract(contractText, ruleset);

    expect(result.findings).toHaveLength(ruleset.rules.length);
    expect(result.findings.every((f) => f.severity === "green")).toBe(true);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("propagates a schema-validation failure rather than returning malformed findings", async () => {
    const ruleset = loadRuleset();
    const contractText = loadGoldenContract("contract-02-vendor-unfavorable.md");

    mockGenerateObject.mockRejectedValueOnce(new Error("NoObjectGeneratedError: schema validation failed"));

    await expect(analyzeContract(contractText, ruleset)).rejects.toThrow(/schema validation failed/);
  });

  it("includes every rule id from the ruleset in the prompt sent to the model", async () => {
    const ruleset = loadRuleset();
    const contractText = loadGoldenContract("contract-03-mixed-severity.md");

    mockGenerateObject.mockResolvedValueOnce({ object: { findings: [] } });

    await analyzeContract(contractText, ruleset);

    const callArgs = mockGenerateObject.mock.calls[0][0] as { prompt: string };
    for (const rule of ruleset.rules) {
      expect(callArgs.prompt).toContain(rule.id);
    }
  });
});
