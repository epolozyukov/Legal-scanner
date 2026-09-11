import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const documentTypeEnum = pgEnum("document_type", ["SOW", "NDA", "MSA", "other"]);
export const severityEnum = pgEnum("severity", ["green", "amber", "red", "critical"]);
export const findingStatusEnum = pgEnum("finding_status", ["pending", "approved", "dismissed"]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  blobUrl: text("blob_url").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  extractedText: text("extracted_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  category: text("category").notNull(),
  severity: severityEnum("severity").notNull(),
  quote: text("quote").notNull(),
  quoteStart: integer("quote_start"),
  quoteEnd: integer("quote_end"),
  issue: text("issue").notNull(),
  suggestedFix: text("suggested_fix").notNull(),
  status: findingStatusEnum("status").default("pending").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const reviewsRelations = relations(reviews, ({ many }) => ({
  findings: many(findings),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  review: one(reviews, { fields: [findings.reviewId], references: [reviews.id] }),
}));
