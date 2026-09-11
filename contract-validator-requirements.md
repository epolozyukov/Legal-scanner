# Contract validation agent — requirements document

Status: specification only, no implementation. Intended to be handed to an implementation agent (e.g. Claude Code) to build out.

## 1. Purpose

A tool that ingests a contract (SOW, NDA, MSA, and other types over time), checks it clause by clause against a maintained set of guidelines, and reports issues on a green / amber / red / critical scale with suggested fixes, so a reviewer can approve or dismiss each flagged issue before signing.

## 2. Functional requirements

### 2.1 Pipeline
1. Upload contract (PDF, DOCX, or pasted text)
2. Detect document type (SOW, NDA, MSA, other) — a small structured-output classification call to Claude runs first, before clause extraction, sharing the same AI SDK client setup and schema-validation approach used for the full analysis (section 4). If the model classifies the document as "other" and no ruleset matches, the pipeline stops before analysis and surfaces a message to the reviewer (e.g. "no ruleset for this document type") rather than silently skipping or misapplying an unrelated ruleset.
3. Extract and match clauses against the active ruleset
4. Score and flag risks (green / amber / red / critical)
5. Generate a report: the document with flagged clauses highlighted inline, plus an issue list with suggested redlines

### 2.2 Review UI
- Split view: document on one side, issue cards on the other.
- Each issue card shows: severity, category, explanation, suggested fix, and Approve / Dismiss actions.
- A review's state (which issues are approved vs. dismissed) persists — see section 5.

## 3. Rules management — version controlled

Rules live as structured files (JSON or YAML), one per document type, in a git repository — not hardcoded and not only stored in app-local state. Each rule defines: category, severity criteria for green/amber/red/critical, and a suggested fix.

Rationale: every edit is a commit (diffable, revertable), and the ruleset can go through PR review later without any rework, even though the current stage is single-user.

The application reads the currently published ruleset at runtime rather than embedding it in application code.

**No in-app rules editor.** Rules are edited by opening the JSON/YAML files directly (locally or via GitHub's web interface) and committing the change — there is no UI screen in the application for editing rules. This keeps the surface area smaller and avoids the app needing write credentials to the ruleset repo. Whoever is editing the ruleset needs repo access and basic comfort editing structured text files.

### Ruleset delivery mechanism

The app fetches the active ruleset via the GitHub Contents/raw API at request time — not a git submodule baked into the app build. This means the ruleset repo can be separate from the app repo, and a ruleset edit takes effect without an app redeploy.

- The fetch is cached with a short TTL (in-memory per Vercel Function invocation, backed by Vercel Edge Config as the shared cache layer described in section 5) rather than hitting GitHub on every request.
- On a GitHub API failure (rate limit, outage, network error), the app falls back to the last successfully cached ruleset rather than hard-failing the analysis pipeline. A stale-ruleset warning may be surfaced to the reviewer.
- Cache invalidation is TTL-based for now; an explicit cache-bust (e.g. a manual refresh action or a webhook-driven Edge Config update) can be added later if TTL staleness becomes an issue.

## 4. AI integration

The analysis step calls Claude to evaluate contract text against the active ruleset and return structured findings (quote, category, severity, issue, suggested fix).

**Use the Vercel AI SDK for this rather than hand-rolled fetch + JSON parsing.** It's directly relevant here because it:
- Is provider-agnostic and supports Anthropic models natively.
- Provides schema-constrained structured output (a Zod schema for the findings shape), using the model's native tool-use mechanism under the hood, with automatic retry on a malformed response — this replaces manually stripping code fences and hoping `JSON.parse` succeeds.
- Offers a `ToolLoopAgent` construct if the analysis step later needs to call tools (e.g. looking up a specific clause definition, or a separate document-type classifier) rather than a single one-shot prompt.

The same schema-validated structured-output path is reused for the lightweight document-type classification step (section 2.1, step 2), not just the full clause analysis — one AI SDK client/config, two different Zod schemas.

Note for whoever implements this: AI SDK 6 (current stable) is deprecating the older `generateObject`/`streamObject` functions in favor of a unified `Output` API — check the SDK version in use before scaffolding, since tutorials from earlier in 2026 still show the older calls.

## 5. Storage & data architecture

Vercel's storage lineup changed in 2025–2026 — Vercel Postgres and Vercel KV as standalone first-party products were sunset. Current equivalents are provisioned through the **Vercel Marketplace** (Neon for Postgres, Upstash for Redis/KV), which still auto-injects connection credentials as environment variables, so the developer experience is similar even though the product names changed.

Proposed architecture:
- **Session/review records** (Postgres: **Neon**, via the Vercel Marketplace, free tier): one row per review, holding the document reference, the findings returned by the model, and each finding's approve/dismiss state. This is what makes a review persist across visits instead of resetting per session. Neon was chosen over Supabase because Neon's free tier auto-suspends compute when idle at no cost, whereas Supabase's free tier pauses the entire project after ~1 week of inactivity and requires a manual unpause — a worse fit for a low-traffic, single-user tool. The free tier's storage/compute ceiling is a known constraint to revisit if usage grows beyond the current single-user stage.
- **Uploaded document files**: Vercel Blob — first-party object storage for the actual file bytes, referenced from the Postgres record rather than stored inline.
- **Active ruleset cache** (optional): Vercel Edge Config can hold a copy of the currently published ruleset for ultra-low-latency reads at the edge, refreshed whenever the git-backed ruleset repo publishes a new version. The git repo remains the source of truth; Edge Config is a read cache, not where edits happen. (See "Ruleset delivery mechanism" in section 3 for how this cache is populated and used.)

## 6. Testing strategy — test-driven development

Development follows TDD: write the test for a behavior before implementing it. Three layers, all part of CI:
- **Unit tests** — rule-matching and severity logic, ruleset schema validation, document-type detection, file text extraction, quote-to-original-text matching for highlighting.
- **Integration tests** — the AI SDK call path using mocked/recorded model responses, verifying schema validation and error handling on malformed output.
- **End-to-end tests** — full flow (upload → analyze → approve/dismiss → confirm persisted state) driven through a real browser, e.g. via Playwright.

CI runs all three layers on every change to application code and to ruleset files.

## 7. Security requirements

- Treat contract content as untrusted data, not instructions — the prompt must instruct the model to evaluate the text, never follow instructions embedded within it (prompt-injection defense), and findings should be schema-validated before being trusted or rendered.
- The Anthropic API key is only ever used server-side (inside a Vercel Function), never shipped to the browser.
- File upload validation: restrict accepted types/sizes, extract text only, never execute embedded macros/scripts, validate contents server-side rather than trusting the client-declared type.
- Contracts are confidential: encrypt in transit and at rest, apply access control per account, define a retention/deletion policy, avoid writing full contract text to plaintext logs.
- Least-privilege credentials for the database, Blob storage, and any other service the backend touches.
- **Authentication**: for the current single-user stage, the app is protected by a single hardcoded/env-based credential gate (e.g. a shared password checked in middleware, or Vercel's own deployment protection) rather than a full account system — there are no per-user rows or account-scoped data yet. The "access control per account" and "retention/deletion policy" items above become real, separately-scoped work once the tool grows beyond single-user and gets real authentication; until then they're not applicable in their full form.

## 8. Hosting

- **Platform**: Vercel.
- **Frontend**: the upload/review UI (e.g. Next.js).
- **Backend**: Vercel Functions handle the analysis request — this is where the AI SDK call and the Anthropic API key live.
- **Data**: per section 5 (Marketplace Postgres, Vercel Blob, optional Edge Config).

## 10. Talk to your data (cross-contract Q&A) — proposed feature

Status: proposed, not yet approved for build. Documented here so the
decision and design are on record; build after the core SOW validation
flow (sections 1-9) is working, since it reuses that flow's ingestion but
adds new indexing infrastructure on top.

### 10.1 Purpose

Let a reviewer ask natural-language questions across *all* ingested
contracts (not just the one open in the review UI) and get an answer with
citations back to the specific document and clause, e.g.:

- "Which of our active SOWs have Net 60 or longer payment terms?"
- "Summarize the indemnification language across all MSAs from 2025."
- "Find any contract where the liability cap is below $500k."

This is a distinct feature from the per-contract review flow (sections
2.1/2.2) — it's a search/summarization tool over the whole contract corpus,
not a validation step, and doesn't produce approve/dismiss findings.

### 10.2 Architecture

- **Chunking**: when a contract is uploaded and its text extracted (the
  same extraction step used for analysis, section 2.1), also split the
  text into clause-sized chunks (e.g. by numbered section/heading, falling
  back to paragraph splitting) and store each chunk with metadata: source
  document ID, document type, clause heading/number, and the character
  offset range needed to re-locate it for highlighting (reusing the
  quote-to-original-text matching approach from section 6).
- **Embeddings**: generate an embedding per chunk via Voyage AI —
  Anthropic's recommended embedding partner, with a free tier, called
  through the AI SDK's provider-agnostic `embed()`/`embedMany()` functions
  (Anthropic's own API doesn't offer an embeddings endpoint, so this is a
  second, complementary provider alongside Claude for generation).
- **Vector storage**: `pgvector` extension on the existing Neon Postgres
  instance (section 5), rather than a separate vector database (e.g.
  Upstash Vector). This avoids adding a new managed service, keeps
  chunk+embedding+metadata in the same transactional store as the
  review/session records, and stays within the free-tier constraint
  established for Postgres. Revisit only if query latency or scale
  outgrows what pgvector on the free tier can handle.
- **Retrieval**: on a question, embed the query, run a similarity search
  (top-k, e.g. k=10-20) via pgvector, optionally with metadata filters
  (document type, date range) parsed from the question or exposed as UI
  filters.
- **Generation**: pass retrieved chunks as context to Claude via the same
  AI SDK schema-validated structured-output pattern used elsewhere
  (section 4) — the response schema includes both a synthesized answer
  and a list of citations (document ID, clause reference, quoted chunk
  text), so the UI can render clickable links back to the source document
  at the exact clause rather than a bare text answer.
- **UI**: a separate "Ask" view (chat-style input + answer with inline
  citation links), distinct from the per-contract split-view review UI.
  Clicking a citation opens that contract and scrolls/highlights the cited
  clause, reusing the highlighting mechanism from the review UI.

### 10.3 Security & scope

Same constraints as section 7 apply, plus one addition specific to
cross-corpus retrieval: because this feature intentionally surfaces
content across *all* stored contracts rather than one at a time, it must
respect the same access boundary as everything else — under the current
single-user, env-gated auth model (section 7) that's not an additional
constraint, but it becomes a hard requirement (per-account retrieval
scoping, not just per-account row ownership) the moment real multi-user
auth is added, since a naive implementation could otherwise let one
account's questions retrieve chunks from another account's contracts.

### 10.4 Open decision

Confirm the embedding provider (Voyage AI recommended above) and whether a
free tier's rate/volume limits are acceptable for expected usage before
implementation — no clarifying answer has been given on this yet, unlike
the other decisions in section 9.

## 11. Open items

- ~~Confirm which Postgres provider to use via the Vercel Marketplace (Neon vs. Supabase)~~ — **Resolved**: Neon (free tier), per section 5.
- **Still open**: decide whether ruleset files for NDA and MSA get drafted now or after the SOW flow is validated in real use. This is the one remaining decision the user needs to make before implementation of those two document types can start; the SOW ruleset and pipeline can proceed independently in the meantime.
- **Still open**: whether to build the "talk to your data" feature (section 10) at all, and if so, confirm the embedding provider choice (section 10.4).
