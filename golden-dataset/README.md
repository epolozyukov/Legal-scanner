# Golden dataset

Synthetic (not real customer) contracts used to validate the ruleset and the
analysis pipeline. Each contract has a paired `.expected.json` file listing,
per rule ID, the severity a correct analysis run should produce.

These are hand-authored fixtures, not real contracts — safe to commit, safe
to use as recorded/mocked model input in integration tests (section 6 of
`contract-validator-requirements.md`), and safe to extend without any
confidentiality concern.

## Layout

```
golden-dataset/
  sow/
    contract-01-clean.md                    + .expected.json
    contract-02-vendor-unfavorable.md        + .expected.json
    contract-03-mixed-severity.md            + .expected.json
```

One subdirectory per document type (`sow/` now; `nda/`, `msa/` to follow once
those rulesets are drafted — see the open item in
`contract-validator-requirements.md` section 9).

## Coverage by design

- **contract-01-clean**: every rule should resolve `green`. Guards against
  false positives — an analyzer that flags well-drafted, standard terms is
  as unreliable as one that misses real issues.
- **contract-02-vendor-unfavorable**: drafted to trip `red`/`critical` on
  nearly every rule, including two clauses (change orders, insurance) that
  are absent from the text entirely — the analyzer must treat a missing
  clause as a finding, not silently skip a rule it can't find text for.
- **contract-03-mixed-severity**: realistic "mediocre, not egregious"
  drafting, deliberately clustered around the `amber` band and the
  `amber`/`red` boundary — the hardest calibration case for the model,
  since `green` vs `critical` distinctions are comparatively easy.

## How this is meant to be used in tests (section 6)

- **Unit tests**: validate `rules/sow.yaml` against the ruleset schema
  (required fields, four severity bands, non-empty suggested fix) —
  independent of the golden dataset.
- **Integration tests**: run each golden contract through the AI SDK call
  path with a *recorded* model response (captured once against the real
  Claude API, then replayed) and assert the parsed, schema-validated
  findings match `expected.json` on `ruleId` + `expectedSeverity`. Recording
  real responses (rather than hand-writing mocks) catches ruleset wording
  that produces inconsistent model behavior.
- **Regression gate**: whenever `rules/sow.yaml` changes, re-record the
  golden dataset responses and diff the resulting findings against the
  previous `expected.json` — surfaces unintended severity drift from a
  rule-wording change, not just outright bugs.
- **E2E tests**: `contract-01-clean.md` (or a trimmed excerpt) is the
  default upload fixture for the Playwright upload → analyze →
  approve/dismiss → persisted-state flow, since it's small and produces a
  predictable, low-noise result set.

## Adding a new golden contract

1. Write the contract text (keep it short — a few hundred words is enough
   to exercise several rules; there's no need to simulate a full 20-page
   SOW).
2. For each rule in the applicable ruleset, decide the intended severity and
   write a one-line `why` justification in the `.expected.json` — this
   justification is what a reviewer checks when a test fails, so keep it
   tied to the specific rule's severity criteria wording, not vague.
3. Run the contract through the real model once to sanity-check the
   ruleset's wording actually produces the intended severity before locking
   it in as an expected value — the golden dataset should reflect what a
   well-written rule *should* produce, but the first pass needs a real
   check against model behavior, not just author intent.
