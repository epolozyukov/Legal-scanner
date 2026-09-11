# Test plan (draft)

Expands section 6 of `contract-validator-requirements.md` into concrete
cases, tied to the golden dataset in `golden-dataset/`. Written before
implementation, per the TDD approach in that section — these are the tests
an implementation agent should write first, then build the pipeline to
pass.

## 1. Unit tests

### Ruleset schema validation
- A ruleset file with all required fields (`id`, `category`, `description`,
  `severity.{green,amber,red,critical}`, `suggestedFix`) parses successfully.
- A ruleset file missing any required field, or with a duplicate `id`
  within one document type, is rejected with a clear validation error at
  load time — not discovered later as a silent `undefined` in a finding.
- `rules/sow.yaml` itself validates cleanly against the schema (a
  regression test — this is the actual file the app will load).

### Document-type detection (classification step)
- Text clearly matching SOW structure (Services / Fees / Term sections)
  classifies as `SOW` with high confidence.
- Text with no contract-like structure at all (e.g. a random email)
  classifies as `other`.
- Ambiguous/hybrid text (e.g. an MSA with an embedded SOW exhibit) — assert
  the pipeline picks one type deterministically rather than erroring, and
  log/surface the low-confidence case rather than silently guessing.

### Rule-matching and severity logic
- Given a fixed extracted-clause string and a rule's severity criteria,
  the matching logic assigns the correct band — this is really an
  integration-level concern once the model is involved (see below), but
  any non-model pre/post-processing (e.g. mapping model severity strings
  to an internal enum, deduplicating overlapping findings) is covered here
  in isolation with hand-built inputs, not the golden dataset.

### File text extraction
- PDF with selectable text extracts correctly (spot-check against a known
  short PDF fixture).
- DOCX extracts correctly, including text inside tables (SOWs often put
  fee schedules in tables).
- A scanned/image-only PDF with no text layer is detected and rejected
  with a clear "no extractable text" error rather than silently producing
  empty analysis.
- Pasted plain text passes through extraction unchanged.

### Quote-to-original-text matching (for inline highlighting)
- An exact quote returned by the model maps to the correct character range
  in the original extracted text.
- A near-exact quote (whitespace/line-break differences from PDF text
  extraction artifacts) still maps via fuzzy matching within a defined
  similarity threshold.
- A quote that doesn't match anything in the source (model hallucination)
  is detected and the finding is flagged as unlocatable rather than
  silently highlighting the wrong span or crashing the renderer.

## 2. Integration tests (AI SDK call path)

Uses recorded model responses (captured once against the real API per
document in `golden-dataset/`, replayed in CI) rather than hand-written
mocks, so the fixtures reflect actual model behavior against the actual
ruleset wording.

- Each golden SOW contract (`contract-01`..`03`) run through the full
  analysis call produces findings whose `ruleId` + severity match the
  paired `.expected.json` (see `golden-dataset/README.md` for the
  tolerance/comparison approach).
- A malformed/truncated model response (simulated) triggers the AI SDK's
  schema-validation retry, and a response that fails validation on every
  retry surfaces a clear error to the caller rather than returning
  partially-parsed or `undefined` findings.
- A findings response containing a rule ID not present in the currently
  loaded ruleset is rejected/dropped rather than rendered — defends
  against ruleset/prompt drift (e.g. an in-flight request straddling a
  ruleset update).
- The classification-step schema and the findings-step schema are each
  independently validated — a valid classification response paired with
  an invalid findings response should fail only at the findings stage,
  not silently treat the whole pipeline as failed at the wrong step.
- Ruleset delivery: the analysis call uses a ruleset fetched from the
  (mocked) GitHub API; on a simulated GitHub API failure, the pipeline
  falls back to the last-cached ruleset and completes rather than
  erroring (per the "Ruleset delivery mechanism" section added to
  `contract-validator-requirements.md`).

## 3. End-to-end tests (Playwright)

- Upload `contract-01-clean.md` (or a trimmed excerpt saved as a `.docx`
  fixture) → analysis completes → issue list renders → split view shows
  the document with at least one highlighted span.
- Approve one issue and dismiss another → reload the page → confirm both
  states persisted (reads from Postgres, not client-side state).
- Upload a file type outside the accepted list (e.g. `.exe` renamed to
  `.pdf`) → upload is rejected server-side with a clear error, not passed
  to the analysis step.
- Upload `contract-02-vendor-unfavorable.md` → confirm at least one
  `critical` severity issue is visibly distinguished in the UI (this is a
  UI-rendering assertion, not a re-check of model accuracy — accuracy is
  covered by the integration tests above).

## 4. CI wiring

- All three layers run on every push touching application code.
- Unit + integration layers (not the full Playwright suite, to keep
  ruleset-only changes fast) also run on any change under `rules/` or
  `golden-dataset/`, since a ruleset wording change can silently shift
  severity outputs without any application code changing.
- A ruleset change that causes a golden dataset assertion to fail is
  expected/normal when the change is intentional — the fix is to
  re-record the golden response and update `.expected.json` in the same
  commit as the ruleset change, with the `why` justification updated to
  match, not to loosen the test's tolerance.
