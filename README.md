# Legal Scanner

Contract validation agent — ingests a contract (SOW, NDA, MSA), checks it
clause by clause against a version-controlled ruleset, and reports issues
on a green / amber / red / critical scale for a reviewer to approve or
dismiss before signing. See [`contract-validator-requirements.md`](./contract-validator-requirements.md)
for the full architecture and requirements.

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values (Anthropic
   API key, Neon `DATABASE_URL`, Vercel Blob token, and an `APP_PASSWORD`
   / `SESSION_SECRET` for the single-user auth gate). Leave the
   `RULESET_GITHUB_*` vars unset for local dev — the app falls back to
   reading `./rules` directly.
2. Push the DB schema: `npx drizzle-kit push`
3. `npm run dev` and open [http://localhost:3000](http://localhost:3000)

## Project layout

- `src/app/` — Next.js App Router pages and API routes (upload, review
  split-view, login, analyze/findings endpoints).
- `src/lib/rulesets/` — ruleset schema and loader (GitHub API fetch with
  local-disk fallback for dev, cached, stale-on-failure).
- `src/lib/ai/` — Claude client, Zod schemas, and the classify/analyze
  calls (AI SDK, schema-validated structured output).
- `src/lib/extraction/` — PDF/DOCX/text extraction.
- `src/lib/highlighting/` — maps a model-returned quote back to a
  character range in the extracted text, for inline highlighting.
- `src/lib/db/` — Drizzle schema (`reviews`, `findings`) and Neon client.
- `src/lib/auth/` — single hardcoded/env-based session gate.
- `rules/` — version-controlled rulesets (one YAML file per document
  type; `sow.yaml` so far).
- `golden-dataset/` — synthetic contracts with expected findings, used by
  the test suite (see `golden-dataset/README.md`).
- `testing/test-plan.md` — the test plan this suite implements.

## Testing

- `npm run test` — unit + integration tests (Vitest).
- `npm run test:e2e` — end-to-end tests (Playwright); requires
  `ANTHROPIC_API_KEY`, `DATABASE_URL`, and `APP_PASSWORD` to be set, and
  are skipped otherwise.
- `npm run typecheck`, `npm run lint`

## Deploying

Target platform is Vercel: Postgres via the Neon Marketplace integration,
file storage via Vercel Blob. See section 8 of the requirements doc.
