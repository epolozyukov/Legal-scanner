import { z } from "zod";
import { documentTypeSchema } from "@/lib/rulesets/schema";

export const classificationSchema = z.object({
  documentType: documentTypeSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});
export type Classification = z.infer<typeof classificationSchema>;

export const severitySchema = z.enum(["green", "amber", "red", "critical"]);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  ruleId: z.string().min(1),
  category: z.string().min(1),
  severity: severitySchema,
  quote: z
    .string()
    .min(1)
    .describe(
      "The exact clause text from the contract that this finding is about, quoted verbatim for highlighting.",
    ),
  title: z
    .string()
    .min(1)
    .describe("A short headline for the issue card, 3-6 words, e.g. \"Payment terms exceed policy\"."),
  issue: z.string().min(1),
  suggestedFix: z.string().min(1),
});
export type Finding = z.infer<typeof findingSchema>;

export const analysisResultSchema = z.object({
  findings: z.array(findingSchema),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
