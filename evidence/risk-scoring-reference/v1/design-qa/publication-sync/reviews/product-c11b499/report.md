# Product review - public Observatory demo

Reviewed immutable candidate: c11b499d07c919bc77966aa563b6192317570263 (PR #41).
Merged presentation base: 09ac1d4caea32ff1ce251da8acdc56cbebb5020e (PR #40).
Reviewer: independent Product Manager sub-agent; read-only source and supplied native evidence review.

## Verdict

The README-only public demo direction fits the requested product: visitors can explore the four roles before setting up the real local Java/Python host. The visible simulation boundary, shared presentation, walkthrough, and local-run link are coherent. No P0 or P1 was identified. The fixed c11b499 candidate has one P2: the added Reset control does not join the documented <1024px read-only boundary. The parent has already made a minimal working-tree repair and supplied later native checks; this report does not upgrade that repair to an immutable or independently live-tested result.

No implementation change, worker operation, merge or source commit was performed by this reviewer. Final user visual acceptance and deployed HTTPS acceptance remain pending.

## Evidence and limits

- This reviewer attempted one independent IAB tab at http://127.0.0.1:8768/observatory-demo/. CUA returned Browser is not available: iab. There was no independent live browser session, control click, downloaded-file observation, keyboard/accessibility audit, viewport measurement or deployed HTTPS inspection in this review. No repeated browser workaround was attempted.
- Read README.md, docs/observatory-demo.md, design-qa.md, the reference-host guide, publication workflow, build adapter, browser model, demo CSS, verifier, and the independent tester's sealed report/summary for 011bb66aba9ef89af4aa37dc379cd4e826d95b39.
- Native images actually inspected: publication-sync/demo-1440-cutover.png; demo-1440-unknown.png; demo-1280-unknown.png; actual-merged-home.png; c11b499-reset-1280.png; post-c11b499-narrow-800.png. Their paired JSON/retention README were read where available.
- The three demo-1440/1280 images display DEMO SOURCE 09ac1d4caea32ff1. They are parent-operated pre-publication prototypes whose uncommitted adapter is not an immutable c11b499 rendering. The cutover image has scrollY 65.33 and is not first-screen evidence. actual-merged-home.png is an actual host capture, with a different viewport/scroll position; it is not a public simulation or a current wide first-screen comparison.
- c11b499-reset-1280.png displays DEMO SOURCE c11b499d07c919bc. Its supplied metrics show Overview, STANDARD/normal, empty session, both disclosures closed, 180px rails, overflow 0 and scrollY 0. This is parent-collected native evidence of the committed reset repair, not this reviewer's live reproduction.
- post-c11b499-narrow-800/390 metrics report no overflow, visible mutation controls or Reset. The working tree had a subsequent uncommitted demo.css media rule during inspection. These images are later parent repair evidence, not proof that immutable c11b499 itself had no narrow Reset defect.
- The tester independently passed model/build/static HTTP checks at 011bb66. Between that revision and c11b499 the relevant implementation delta only collapses receipt/ceremony disclosures during reset. The model, README/demo guide, and five original demo CSS rules are unchanged. The tester's execution result is a separate witness, not a current live-browser or public deployment acceptance result.

## Product path assessment

| Path | Assessment and basis |
| --- | --- |
| README entry | The play link is near the top; the next paragraph says browser-only simulation and no real Java/Python execution. The same paragraph leads to the demo/local guide. This meets the requested project entry point without adding a personal-homepage product or desktop installer. |
| First visit | The toolbar names BROWSER ONLY, gives Install & warm v1 -> activate -> invoke, and links Run the real host locally. The c11 reset image shows Install & warm v1 as the primary empty-state action and disabled invocation before activation. No auto-run hides the authority step. |
| Install / activate / invoke | Source separates STANDBY installation from ACTIVE authorization; invoke requires an eligible active realization. The retained tester exercises standard/low/high samples and policy outcomes. This review does not claim its own UI click coverage. |
| Held v1 across v2 | Source keeps the original definition/realization pin and completes on that pin after release, while future requests use v2. The guide explicitly distinguishes manually held simulation from the real host's 15-second M3 witness barrier. |
| Missing outcome | Model retains a null score and WITHHELD decision, disables the failed realization and preserves the unknown historical request. The supplied prototype images visibly separate UNKNOWN from authority/decision; their original source labels remain intact. |
| Fresh rollback | Available only after a previous active version exists; source creates a new demo realization and does not turn a historical UNKNOWN into a successful result. This teaches the intended relationship rather than merely changing the displayed version name. |
| Close / download | Close ends demo realizations and pending requests before receipt export. The distinct frontend-demo schema and explicit no-Java/no-Python/no-dispatch/no-qualification/no-physical-shutdown scope avoid passing the download off as actual sealed host evidence. Actual browser download is documented as a parent observation, including its download-event timeout limitation. |
| Reset | c11 clears data/selection, returns to Overview, restores selectors and now closes existing receipt/ceremony disclosures. Parent native evidence supports the disclosure fix. The remaining c11 narrow-screen control mismatch is recorded below. |
| Desktop presentation | Shared host HTML/CSS/renderer are used rather than a second copied dashboard. A direct git diff for all three production assets from 09ac1d4 to c11b499 is empty. Prototype and reset native images preserve white center, same-navy rails, aligned short directories, flat state displays, weighted binding track, arrows and restrained title hierarchy. This is bounded presentation evidence, not a complete independently rendered current-state matrix. |
| Narrow safety | Existing host controls use a continuous width <1024px read-only range and desktop notice. Public demo uses that same layout; only its new Reset button initially escaped that range. No mobile navigation or control redesign is necessary. |
| Docs / homepage drift | The patch adds a public browser transport, guide, workflow and retained evidence. Production homepage assets are unchanged; documentation separates the real loopback host from the static teaching model and does not claim new M0-M6 qualification. No personal-profile files are part of the reviewed patch. |

## Findings

### P2 - The new Reset control escapes the declared narrow read-only view (c11b499 only)

Evidence: scripts/build-observatory-demo.mjs:44 adds #demo-reset outside .actions, .request-bar and .receipt-actions. The fixed candidate's demo.css has only five toolbar rules, with no narrow media rule. Production style.css:209-238 hides existing control classes below 1024px; it does not hide the new toolbar button. The reset handler at build script line 69 changes model state, selections, disclosures and navigation. This conflicts with docs/observatory-demo.md:25, which describes the narrow layout as read-only. The parent separately reproduced Reset visible at 800px; this reviewer did not independently reproduce that live state, and the original pre-repair screenshot is not represented by the later post-c11b499 narrow images.

Minimum repair: hide this new demo-only mutation control in demo.css under the same width <1024px range. Keep links and read-only inspection, do not alter production components or invent mobile controls. The parent's current small media rule does exactly that. Commit/rebuild/read back the new source, retain its actual viewport/source binding and verify no visible mutation controls at 800/390 plus the 1023/1024 boundary. The existing later native 800/390 checks are supportive parent evidence; source-bound closure belongs to the subsequent revision.

### P3 - Name Node.js in local-run prerequisites (optional)

The new visitor guide names Java 17, CPython 3.12 and Maven prerequisites, then begins with a node command. Add Node.js to that one sentence if local startup is meant to be self-contained for first-time readers. There is no need for an installer, a second startup flow or a broad documentation rewrite. This is an onboarding completeness suggestion, not a demonstrated runtime failure.

## Release acceptance boundary

- Keep the candidate-specific tester and product reports sealed; do not relabel 09ac prototype pictures as c11/current publication proof.
- Source-bound closure of the narrow Reset P2 can use the minimal subsequent CSS patch plus actual supplied browser evidence. No additional product redesign is requested.
- After authorized publication, confirm the public /JPyxis/ URL, relative assets, displayed revision and publication.json match the deployed main build. This review has not established that a deployed site exists or serves this candidate.
- User final visual acceptance remains separate from CI, the tester's model checks and this source/native-image review. This report grants no merge authority.
