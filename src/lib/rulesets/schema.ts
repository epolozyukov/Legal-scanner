import { z } from "zod";

export const documentTypeSchema = z.enum(["SOW", "NDA", "MSA", "other"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const ruleSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  severity: z.object({
    green: z.string().min(1),
    amber: z.string().min(1),
    red: z.string().min(1),
    critical: z.string().min(1),
  }),
  suggestedFix: z.string().min(1),
});
export type Rule = z.infer<typeof ruleSchema>;

export const rulesetSchema = z
  .object({
    documentType: documentTypeSchema,
    version: z.string().min(1),
    description: z.string().optional(),
    rules: z.array(ruleSchema).min(1),
  })
  .superRefine((ruleset, ctx) => {
    const seen = new Set<string>();
    for (const [index, rule] of ruleset.rules.entries()) {
      if (seen.has(rule.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate rule id "${rule.id}" in ${ruleset.documentType} ruleset`,
          path: ["rules", index, "id"],
        });
      }
      seen.add(rule.id);
    }
  });
export type Ruleset = z.infer<typeof rulesetSchema>;
