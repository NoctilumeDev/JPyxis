# Risk Scoring Observatory: polish-v4 review candidate

Prior rendered candidate: regression verification PASS; visual acceptance PENDING.
Sequential independent tester and product-manager reviews of `333bcec65ef1e636100a0abe4fae9c6b0fd56d4b`
confirmed two P2 narrow-width defects. Their original reports and evidence are retained under
`polish-v4/reviews/`. The existing media rules now use a continuous 1024px read-only boundary;
source-bound post-repair observations and independent P2 closure are pending. The measurements
below describe the earlier rendered source, not the unverified repair.
Independent Product Acceptance Agent review is still required. User final visual sign-off
is still required. No merge is authorized. CI, screenshots and implementer measurements
do not grant either form of acceptance.

## Scope and source

Base main: `109646c7c5266a164018ac2f9534afe850b94c7c`.
Rendered source: `8aa073c5f06c718511cced38d7c59376db05bed1`.
The `333bcec` review commit adds evidence and this report only. The three asset Git blobs
below bind the earlier rendered implementation to that reviewed commit:

| Asset under reference-apps/versioned-risk-scoring/host-java/src/main/resources/observatory | Git blob |
| --- | --- |
| index.html | 59cfddc4ba9d38f23fe39317b89ec82bb877654d |
| style.css | 7df63ea35ece5f1c4326058f0dfe22a887a9a079 |
| app.js | 0e8863d2791b4e3f6e75f2dfd76d3ad0987c44fb |

Only these UI assets, this report and design evidence change. Java, Python algorithms,
protocols, policy, receipt schema, frozen contracts, tests and gate scripts stay at base.
The original user checkout retains its unrelated README and roadmap edits.

All evidence paths below are relative to
`evidence/risk-scoring-reference/v1/design-qa/polish-v4/`.
`final-summary.json` contains the source inventory, exact screenshots and actual outcomes.

## User-selected direction

The original selected reference remains
`evidence/risk-scoring-reference/v1/design-qa/source-reference.png` (1503 x 1047,
SHA256 f666f4b20c206dc703ca5bd9da17e9d2092c4a38a8fe94cf145fae268e3afa2e).
The subsequent user references authorize the following changes to that image:

- Clean white stage surfaces, flat results and status text, without nested colored cards.
- Matching navy desktop directories: left text left aligned, middle centered, right right aligned.
- Both directories change the central view. Full realization coordinates and invocation history
  appear centrally; the right directory contains short plain navigation rows.
- Control Binding has slightly more width. The shared tracks are 1 : 1.1 : 1.02 : 0.88.
- Wine identifies authority and decision; navy identifies execution and context; gold marks
  boundaries, selected navigation boundaries and established active authorization.
- The main serif title remains prominent. Eyebrow and slogan use quieter 12px text.
- Desktop inspection remains the product. Below 768px, a desktop-use notice and a safe read-only
  presentation replace operational controls. No mobile-specific control architecture is added.
- Fix the component's own rules; remove obsolete styles instead of appending force overrides.

## CSS consolidation audit

`css-consolidation-audit.json` compares the previous style sheet at
`df07798d808be9df5d34446e1f68f9a8c0278953` with the final component rules.
It records 38 repeated complete selector blocks in the same context before cleanup and zero
after cleanup. Shared selector groups, state variants and bounded media queries remain intentional.

The working stylesheet shrank from 29,149 to 17,571 bytes. Removed rules include old deployment
cards, version-card buttons, right-side tables, nested status surfaces and obsolete color tokens.
The only `!important` is the existing `[hidden]` attribute contract. No final override pile remains.

## Visual evidence and measurements

Primary viewport: 1440 x 900 CSS pixels, zoom 1, density approximately 1.
Original screenshots are retained at native resolution. When a scrollbar is present the
browser capture is 1425 x 891 pixels; the accompanying metrics still record the 1440 x 900
CSS viewport. Captures are never stretched or substituted with mock data.

| Actual view | Screenshot | Receipt entry bottom at scroll 0 |
| --- | --- | --- |
| Empty | 200-final-empty.png | 779.06px |
| Qualified v1 standby | 201-final-v1-standby.png | 779.06px |
| v1 STANDARD, 0.73 REVIEW | 202-final-review.png | 797.06px |
| Expanded sample and execution menus | 203-final-sample-open.png / 204-final-mode-open.png | 797.06px |
| Qualified v2 standby | 205-final-v2-standby.png | 797.06px |
| Held v1 request while current route is v2 | 206-final-held-cutover.png | 888.40px |
| v2 HIGH, 0.93 REJECT | 207-final-reject.png | 797.06px |
| Actual worker crash, UNKNOWN / WITHHELD | 208-final-unknown.png | 849.06px |
| Fresh v1 rollback preserves old UNKNOWN | 212-final-fresh-v1-unknown.png | 849.06px |
| Fresh v1 LOW, 0.09 ALLOW | 216-final-allow.png | 797.06px |
| Fresh v2 keeps R005 pinned to v1 | 217-final-fresh-v2.png | 797.06px |
| Six actual requests, fresh v2 STANDARD, 0.85 REJECT | 218-final-six-requests.png | 797.06px |
| Closed session preserves UNKNOWN | 221-final-closed.png | 849.06px |

At the primary viewport all four stages, actual result and receipt entry fit on the first
screen, including the held state. Both directories measure 200px. Stage headers measure
85px and all four content columns share their top and bottom boundaries.

`final-directory-and-colors.json` measures the complete directory with four realizations
and six requests: headings and row text centers advance by 48px (rounding tolerance 0.001px).
Every navigation row is 48px, single-line, right aligned and has no internal text overflow.
The established authority is gold, UNKNOWN authority and withheld decision are wine, and
execution score and terminal text are navy.

Twenty-two source-bound captures have no body/table/auxiliary text below 12px and no
technical text below 11px; technical line height is at least 1.5. The minimum measured
enabled text contrast is 4.74:1. Console warning/error readback is empty.
These measurements do not replace independent visual or assistive-technology acceptance.

1280px (`209-final-1280.png`) remains readable with vertical scrolling; its receipt entry
is 905.16px, so it does not meet the primary viewport's first-screen threshold.
1120px (`210-final-1120.png`) retains the four stages and moves context below the center.
390px (`211-final-safe-narrow.png`, `final-narrow-safety.json`) shows the desktop notice,
has zero horizontal document overflow and exposes no mutation or selector controls.
This is a safety fallback, not a mobile product acceptance claim.

## Reference comparison

`final-comparison-1440.png` pairs the original reference with the actual 0.73 REVIEW view.
The reference is contained without distortion; the actual 1440 x 900 screenshot is copied
at its original size. `final-comparison-native.png` compares native control, stages and
directory crops without resizing them.

The visible REVIEW state matches for comparison; the reference is a static illustration
with different version/runtime records. Actual inputs, workers, versions and results are
retained from the running Java host. No reference data is substituted into the application.
The flat surfaces, second navy directory, weighted columns, semantic colors and calmer
title hierarchy are deliberate user-directed differences.

## Actual interaction and shutdown evidence

The unchanged source-bound bootstrap scenario passed seven actual requests and all six
mutation gates. Exact source, input inventory, construction, independent readback, mutation
readback and independent shutdown are retained in `final-bootstrap-*.json`; the original
machine construction bytes are retained as `final-bootstrap-construction.bin`.
This local construction reused a private Maven repository; it grants no fresh-VM qualification.

The separate browser session exercised installation, activation, explicit invocation,
hold/release during cutover, actual crash after dispatch, both fresh rollback directions,
left navigation, right version/request selection, central history selection, rollback
ceremony and receipt disclosures, close and sealed export.

| Request | Actual version / sample / mode | Terminal | Java decision |
| --- | --- | --- | --- |
| R001 | v1 / STANDARD / normal | SUCCEEDED | REVIEW |
| R002 | v1 / STANDARD / hold, released after v2 activation | SUCCEEDED | REVIEW |
| R003 | v2 / HIGH / normal | SUCCEEDED | REJECT |
| R004 | v2 / HIGH / crash after dispatch | OUTCOME_UNKNOWN, score null | WITHHELD |
| R005 | fresh v1 / LOW / normal | SUCCEEDED | ALLOW |
| R006 | fresh v2 / STANDARD / normal | SUCCEEDED | REJECT |

Both fresh rollbacks create new realizations. R004 retains its original UNKNOWN outcome
and withheld authority after both; old pins and decisions are not rewritten.
`213-final-lifecycle.png`, `214-final-ceremony.png`, `215-final-receipt.png`,
`219-final-history.png` and `220-final-right-version.png` retain the actual full details.

`final-source-button-readbacks.json` retains 14 navigation/selector/disabled-state readings.
Pointer selection and keyboard ArrowDown, End, Enter, Escape and Tab were exercised.
The canonical native selects still supply the unchanged invoke action values.
A full screen-reader session was not performed.

`final-receipt.bin` is the original exported 72,167-byte receipt, byte-equal to the host's
sealed receipt. The actual session's eight owned worker/interpreter processes were all
independently observed stopped; Java exited with code 0.
`final-observations.zip` is 21,807,338 bytes, SHA256
37a1a944b3a4e63068c27b53002023aa4560bf0ca54a54a80fc5c7e2b80d2d10.
All 301 manifest members and the exported receipt were byte-verified.
These shutdown claims apply to this test session; the original main preview is separate.

## Retained counterexamples and supersession

Every prior image, raw archive, failed candidate and original receipt remains retained.
The superseded working report is preserved as `superseded-v4-working-report.md` with
the exact previous Git content and `superseded-v4-working-report.bin` with exact working
file bytes. Its earlier proposals and interim claims do not describe this candidate.

The warm, boxed and cluttered iterations were superseded by the user's white/flat/double
directory direction. The 39ed61e candidate met the first-screen measurements but preceded
the new weighting, semantic colors and uniform group-heading rhythm.

The CSS consolidation pilot at 2b860e82 exposed narrow Request wrapping: held receipt
bottom 958.09px (`182-consolidated-held-counterexample.png`).
The 67c60b13 weighted pilot exposed scrollbar-induced wrapping: 906.40px
(`193-semantic-held-cutover.png`).
Their original archives and receipts remain retained. The final source fixes the shared
track proportions directly and measures 888.40px; neither failure is relabeled as passing.

## Preview and review boundary

Build from a clean committed checkout with the repository's existing
`node scripts/run-risk-scoring-host.mjs` runner and its documented Java/Python prerequisites.
To reproduce from the retained local construction, use the original verified host jar and
config together; do not edit its source or execution coordinates. Select an unused loopback
port so the original main preview remains separate.

The review candidate may be pushed as a draft PR. The four protected repository gates
must remain intact. A green run is regression evidence only.
Independent Product Acceptance Agent assessment must clear P0/P1 and surface P2 issues for
user adjudication before any merge. Final visual acceptance remains pending; no merge occurs.
