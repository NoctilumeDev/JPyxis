# Risk Scoring Observatory: polish-v4 design verification

Implementation regression verification: PASS. The independent tester and product-manager
reviews have completed in sequence. Two confirmed P2 narrow-width issues were repaired;
the final directory refinement has no remaining substantive product finding in the bounded
source and native-evidence review. The user subsequently authorized merge, commit and push.
PR [#40](https://github.com/NoctilumeDev/JPyxis/pull/40) merged on 2026-10-02 UTC at
`09ac1d4caea32ff1ce251da8acdc56cbebb5020e`; its four exact-main repository gates passed in
[run 37047689101](https://github.com/NoctilumeDev/JPyxis/actions/runs/37047689101).
The [public demo guide](docs/observatory-demo.md) describes the later browser-only presentation.

## Scope and exact source

Base main: `109646c7c5266a164018ac2f9534afe850b94c7c`.
Final rendered source: `2456e291faac791ceb2fda6b00db249d4236584b`.
Later evidence/report-only commits retain these asset blobs:

| Asset under reference-apps/versioned-risk-scoring/host-java/src/main/resources/observatory | Git blob |
| --- | --- |
| index.html | 2a1223394734146e8f382f4c98511c346e1f8ecc |
| style.css | 638085c30a28ce69a4d9e881504f692433edb4b6 |
| app.js | 0e8863d2791b4e3f6e75f2dfd76d3ad0987c44fb |

Only these UI assets, this report and design evidence change from base. Java, Python
algorithms, protocols, policy, receipt schema, frozen contracts, tests and gate scripts
remain unchanged. The original user checkout retains its unrelated README/roadmap edits;
the original main preview was retained separately during review and has since been replaced by
a fresh installed preview built from merged source `09ac1d4caea32ff1ce251da8acdc56cbebb5020e`.

All paths below are relative to `evidence/risk-scoring-reference/v1/design-qa/polish-v4/`.
The latest source-bound inventory, native captures, geometry comparisons and actual outcomes
are in `review-fix/directory-summary.json`. Earlier `final-summary.json` describes rendered
source `8aa073c5`; it is preserved historical evidence, not the current candidate summary.

## User-selected direction and final refinement

The selected original reference is
`evidence/risk-scoring-reference/v1/design-qa/source-reference.png` (1503 x 1047,
SHA256 f666f4b20c206dc703ca5bd9da17e9d2092c4a38a8fe94cf145fae268e3afa2e).
The user's subsequent references and instructions authorize:

- Clean white central stages and flat results/status text, without nested colored cards.
- Matching navy directories: left text left aligned, middle centered, right right aligned.
- Both directories change the central actual view. Full realization coordinates and history
  appear centrally; right navigation contains short, single-line rows.
- Shared stage tracks 1 : 1.1 : 1.02 : 0.88 give Control Binding slightly more weight.
- Wine for authority/decision; navy for execution/context; gold for boundaries and active
  authorization. Lucide icons and the directional arrows remain.
- Strong main serif title with quieter 12px eyebrow and slogan.
- Desktop-first inspection, with a continuous read-only boundary below 1024px. The desktop
  notice says to widen the window to use controls. No mobile control architecture is added.
- Correct existing component rules directly and remove obsolete styles.

The final request to let both directories give the middle more space is implemented by
shared width and padding variables in the existing rules, rather than added overrides:

| Desktop viewport width | Left directory | Right directory | Directory horizontal padding |
| --- | --- | --- | --- |
| 1440px and wider | 200px | 200px | 14px |
| 1360px | 190px | 190px | 11px |
| 1280px | 180px | 180px | 8px |

This gives the center 40px more width at 1280px. At intermediate widths the existing compact
124px left rail is retained; context moves below the central view. Below 1024px the existing
read-only presentation exposes no mutation or selector controls. These are safety boundaries,
not mobile product acceptance.

## Component consolidation

`review-fix/directory-css-audit.json` compares the stylesheet at
`df07798d808be9df5d34446e1f68f9a8c0278953` with the final component rules.
It records 38 repeated complete selector blocks in the same context before cleanup and zero
after cleanup. Intentional state variants and media contexts remain. The stylesheet is
17,897 bytes, down from 29,149. Old deployment cards, version-card buttons, right tables,
nested status surfaces and obsolete color tokens were removed. The sole `!important` is
the existing `[hidden]` attribute contract. No appended override pile remains.

## Real browser observations and homepage consistency

The implementer used the actual Codex In-app Browser against a source-bound installed Java
host and real Python workers. No separate Chrome or Edge surface was connected. Screenshots
are retained at their original pixel dimensions; no image is stretched or substituted with
mock data. CSS viewport, DPR, scroll position and observed DOM are retained separately.

Primary acceptance viewport: 1440 x 900 CSS pixels, zoom 1, density approximately 1.
All following final-source captures are at scroll 0:

| Actual view | Native screenshot under review-fix | Receipt entry bottom |
| --- | --- | --- |
| Empty | 260-directory-empty.png | 779.06px |
| v1 STANDARD, actual 0.73 REVIEW | 262-directory-review.png | 797.06px |
| Held v1 request while route switches to v2 | 264-directory-held-cutover.png | 888.40px |
| Actual worker crash, UNKNOWN / WITHHELD | 266-directory-unknown-settled.png | 849.06px |
| Lifecycle to Overview | 275-directory-lifecycle-home.png | 849.06px |
| Right request directory to branded homepage | 276-directory-request-home.png | 797.06px |
| Restored UNKNOWN homepage | 277-directory-unknown-home.png | 849.06px |
| Closed session preserves UNKNOWN | 279-directory-closed.png | 849.06px |

All four stages, actual result and receipt entry fit at the primary viewport, including
the held state. Comparing the empty, REVIEW, held and UNKNOWN scenes against the earlier
`3143a78f` repair yields zero measured geometry delta for control bar, title, arrows, stage
region, receipt entry, directories and all four stage boundaries. Thus the final directory
refinement leaves the 1440px homepage geometry unchanged.

`directory-1440-final.json` and `directory-1280-scroll.json` measure label line boxes:
every group heading and directory row is 48px high and label centers advance by 48px
(rounding tolerance 0.001px). In the actual 1280 x 360 populated scene (`267-directory-1280-scroll.png`),
the right directory has a real scrollbar: scroll height 450px exceeds client height 360px.
Its heading has 147px available; the 142.49px subtitle remains one 18px line and the wordmark
fits. These are actual entries from three requests and two realizations, not inserted data.

Stable replacement captures are `284-stable-1280-unknown.png`,
`285-stable-1360-unknown.png` and `286-stable-1024-unknown.png`. They bind fresh DOM state
to the real UNKNOWN/WITHHELD result of a separate actual v2 crash invocation. At 1280px,
the receipt entry is 923.16px; at 1024px it is 926.78px. Vertical scrolling is expected at
these widths and neither is claimed to meet the 1440px first-screen threshold. At 1024px
the compact left rail still measures 124px and WITHHELD has no internal overflow.

`272-directory-800-safe.png` and `274-directory-390-safe.png` show the actual UNKNOWN
read-only fallback with zero horizontal document overflow. `271-directory-1023-fractional.png`
and `273-directory-767-fractional.png` close the fractional boundary gap: DOM range media
matches prove effective widths between the adjacent integer boundaries, although innerWidth
is recorded as an integer. Each has the desktop notice and hides every mutation/selector.

Across the 27 final-source DOM measurements, auxiliary text is at least 12px and technical
text at least 11px, with no recorded typography-floor violation. Minimum measured enabled
text contrast is 4.74:1. Both latest actual-session console warning/error readbacks are empty.
Measurements do not replace visual or assistive-technology acceptance.

Three resize captures (`268`, `269`, `270`) caught browser transition frames: their PNG canvas
or content did not match the settled metrics. The product manager detected this mismatch;
the originals are retained and excluded from visual closure, then replaced by stable native
`284` through `286`. `265` is an IN_FLIGHT transition, not settled UNKNOWN evidence.
`280` is named 1440 but actually records the default 1280 x 720 viewport at scrollY178;
`281` has the same nonzero scroll. Both are excluded from homepage/first-screen proof.

The user's separate fresh preview remains at `http://127.0.0.1:8766/`, with zero requests
and zero live workers. `directory-preview-sync.json` and `directory-stable-preview-sync.json`
verify that all three resources actually served by the user preview and both actual test
sessions exactly match the final source inventory. `283-directory-live-home-default.png`
shows the preview at its restored default 1280 x 720 viewport, DPR1.5, Overview and scroll0.
It is a native full-page capture; it is not 1440px first-screen evidence.

## Sequential independent reviews and repairs

The independent tester first reviewed pushed commit `333bcec65ef1e636100a0abe4fae9c6b0fd56d4b`.
Original reports and observations are retained in `reviews/tester-333bcec/`. The tester
ran six actual requests, both fresh rollbacks, every action button, dropdown pointer/keyboard
paths, both directories, disclosures, Overview return, Close and exact receipt export. All
eight owned worker/interpreter PIDs were independently observed stopped after Java exited0.
No P0/P1 was reported; two P2 defects were confirmed:

1. At 800px, four operational columns persisted; WITHHELD overflowed and technical text
   fragmented. The safe read-only boundary was too low.
2. Integer max-width767/min-width768 queries left an unhandled fractional gap.

The product-manager agent then independently inspected real browser views at 1440, 1024,
1000, 960, 800, 390 and the fractional boundary. Its original report is retained in
`reviews/product-manager-333bcec/`. It confirmed the P2 issues and recommended a continuous
1024px read-only boundary, matching the workstation inspection scope.

Source `3143a78fcfa6195942030ca49f830c86675130e7` repaired the existing queries using range
syntax and added the concise widen-window instruction. Original actual browser and request
evidence is retained in `review-fix/actual-observations.zip`; the bounded P2 source/native
evidence closure is in `reviews/product-recheck-3143a78f/`.

Final source `2456e291` adds the user's directory refinement. The product manager reviewed
the final source and native images, caught the three transition-frame captures, and examined
their stable replacements. Its final report is in `reviews/product-final-2456e291/`.
Both original P2s remain closed, with no new substantive product defect reported. The
follow-up agent browser surface was unavailable: these follow-ups are independent source
and native-evidence reviews, not independent live-browser reruns. The initial independent
browser reviews and the implementer's final actual browser observations remain separate.

`reviews/review-byte-retention-reconciliation.json` verifies all 107 independent review
members against their staged Git bytes. Three original JSON files required CRLF-to-LF public
text normalization; their exact original bytes remain in
`reviews/original-review-line-ending-bytes.zip`, with original and projection hashes mapped
by the reconciliation. Earlier retention manifests remain historical originals. Native PNGs,
raw observation archives and receipts are preserved byte-for-byte.

## Exact retained actual execution evidence

The final source was built from a clean Git checkout with declared local Maven reuse.
Its standard scenario contains seven actual requests and PASS independent readback; all six
counterexample mutations return the expected rejection or INCONCLUSIVE result. Source,
input inventory, independent readback, mutation readback and shutdown files are copied as
`review-fix/directory-bootstrap-*`. Original construction bytes are retained as `.bin`.
This is local regression evidence, not a fresh-VM or productization qualification claim.

The final main GUI cohort contains three actual requests:

| Request | Pinned version | Mode | Actual score | Execution | Java decision |
| --- | --- | --- | --- | --- | --- |
| R001 | v1 | normal STANDARD | 0.72999996 | SUCCEEDED | REVIEW |
| R002 | v1 while route becomes v2 | hold STANDARD | 0.72999996 | SUCCEEDED | REVIEW |
| R003 | v2 | crash after dispatch | null | OUTCOME_UNKNOWN | WITHHELD |

`review-fix/directory-observations.zip` preserves all original installed observation bytes:
21,717,991 bytes, SHA256 2266f75445a40a1caecb00f894013ae8beb6e7e59df7255cfac1bb901d6da755.
253 manifest members were individually verified. The UI-exported `directory-receipt.bin`
matches the raw receipt byte-for-byte. After Close then Export then host stop, Java exited0
and all four owned worker/interpreter PIDs were independently observed stopped.

The stable replacement cohort has one actual v2 crash request, UNKNOWN/null/WITHHELD.
`review-fix/directory-stable-observations.zip` is 21,666,423 bytes, SHA256
8639e00353a62067dd2b84aeeaa8fe973fa84cfd0fc27aaf7d2fed5c51f2a4f3.
226 manifest members were individually verified; `directory-stable-receipt.bin` exactly
matches its raw receipt. Java exited0 and both owned worker/interpreter PIDs stopped.

The latest GUI cohorts do not claim both fresh rollbacks; that coverage belongs to the
earlier independent tester. The JavaScript asset has not changed since that review.
Original prior candidates, first failures, raw archives and native reference comparisons
are retained. Historical comparisons under `final-comparison-*` describe the earlier
8aa073c5 implementation; the current source is bound by its final inventory and native images.

## Acceptance boundary

The implementer verification and the sequential bounded independent reviews are complete.
The user authorized publication after the bounded reviews. PR #40 is merged, and its exact-main
four-gate run is green. That authorization is separate from CI results. The native captures and
raw archives below remain records of their original rendered sources; they are not relabelled as
the later public browser simulation. The public demo adds no actual runtime qualification.
