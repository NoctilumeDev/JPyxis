# Bounded independent product recheck

Source reviewed: `3143a78fcfa6195942030ca49f830c86675130e7`.
Previous reviewed source: `8aa073c5f06c718511cced38d7c59376db05bed1` (asset-equivalent review head `333bcec65ef1e636100a0abe4fae9c6b0fd56d4b`).

Verdict: **both previously reported P2 defects are closed for the reviewed source and provided actual-browser evidence**. This is an independent examination of the small source diff and the supplied native browser captures/readbacks. It is not a new independently executed browser session, final user visual sign-off, or merge authorization.

## Method and limit

I independently examined the exact source diff: four existing media-query conditions use continuous range syntax; the existing desktop notice adds the instruction to widen the window. The app.js diff is empty. There is no new terminal override block and no wide-desktop component redesign in this patch.

The parent supplied fresh actual Java-host/browser evidence under `evidence/risk-scoring-reference/v1/design-qa/polish-v4/review-fix/`. I opened the six native images listed below and read their matching metrics. The visible source banner is `SOURCE 3143a78fcfa61959` and the selected actual failed request is R003, pinned to risk-v2, with OUTCOME_UNKNOWN / AUTHORITY HELD / WITHHELD.

My attempt to open a separate read-only IAB tab failed because this child session had no available browser. A state inventory was empty, and one session reset did not restore IAB availability. No child viewport override or browser tab was created in this recheck; no business actions or source edits were performed. The earlier review's temporary viewport/tab had already been restored/closed. The parent's actual-browser run remains the execution witness.

## Findings closed

| Step | Evidence inspected | Result |
| --- | --- | --- |
| 1 | `238-repair-1024-unknown.png` and metrics | Operating four stages remain readable at 1024px. WITHHELD content width 154.375px, decision and document overflow 0. Technical fields wrap in readable pieces rather than individual characters. |
| 2 | `241-repair-800-unknown.png` and metrics | The original failing width now enters the read-only presentation: notice visible, visible controls empty, decision/document overflow 0. |
| 3 | `240-repair-1023-fractional.png` and metrics | Actual CSS width is greater than 1023 and below 1024; `below1024=true`, notice visible, visible controls empty, decision/document overflow 0. The repaired boundary has no observed gap. |
| 4 | `242-repair-767-fractional.png` and metrics | Original fractional counterexample also enters the safe presentation, with notice visible, no visible controls and zero decision/document overflow. |
| 5 | `236-repair-held-cutover.png` and metrics | At 1440x900 the prior desktop direction is preserved; four stages remain horizontal and receipt entry bottom is 888.40px at scroll 0. |
| 6 | `250-repair-home-top-stable.png` and metrics | Stable 1440x900 UNKNOWN homepage preserves both navy rails, selected R003, title, arrows and flat results; receipt entry bottom is 849.06px at scroll 0. |

All six readbacks report no typography-floor violation. `246-repair-actual-lifecycle-to-home.metrics.json` additionally records the direct return to the Overview title, selected R003/current risk-v2 route, scroll 0 and receipt bottom 849.06px. I did not perform that navigation myself. Capture 248 is not used as first-screen evidence because it had a browser-induced scroll offset.

P2-1, operating below readable content width: closed by applying the existing read-only presentation below 1024px, with actual UNKNOWN confirmed at the supported boundary.

P2-2, fractional breakpoint gap: closed by the continuous `<1024` / `>=1024` partition and observed fractional readbacks at both repaired and original failing coordinates.

No additional product recommendations are introduced by this bounded recheck. The user's later request for directories to yield width is a subsequent source change; it must preserve the established 1440px view and revalidate any narrower operating geometry. This closure binds only to source 3143a78f and its evidence. Final user visual sign-off remains pending.
