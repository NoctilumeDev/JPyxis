# Final bounded product review

Reviewed source: `2456e291faac791ceb2fda6b00db249d4236584b`.
Verdict: **no remaining confirmed product defect found in the reviewed paths; both previously reported P2 safety defects remain closed for this source and accepted evidence**. No P0/P1 was found. The directory-width adjustment meets the user's request while preserving the approved 1440px homepage direction. Final user visual acceptance remains PENDING. No merge is authorized.

## Method and scope

This is an independent source and native-evidence review, not an independently reexecuted live browser test. The child IAB was unavailable in the preceding recheck; I did not retry it in this final review. I made no source edits, browser actions or business mutations. The parent supplied actual Java-host/CUA-browser captures and DOM readbacks from the committed source.

Evidence names below resolve under `evidence/risk-scoring-reference/v1/design-qa/polish-v4/review-fix/`. I opened the accepted native images listed in the summary. I inspected the exact UI diff from source 3143a78f: only the existing CSS directory components gain shared width/padding variables and existing bounded media rules set the same width variable. Central type, four-stage weights, semantic colors and app.js are unchanged. The protected 1024px rule retains the 124px left directory. At 1440px the width/padding formulas evaluate to the previous 200px/14px values.

## Reviewed steps

| Step | Evidence | Health and practical limit |
| --- | --- | --- |
| 1 | `260-directory-empty.png`; `264-directory-held-cutover.png`; `277-directory-unknown-home.png` | Healthy 1440x900 homepage. Clean center, matching navy rails, weighted horizontal chain and arrows preserved. Empty/held/UNKNOWN receipt bottoms are 779.06/888.40/849.06px at scroll 0. |
| 2 | `267-directory-1280-scroll.png`; `directory-1280-scroll.json` | Healthy 1280px directories with a real right scrollbar: both rails 180px, right client height 360px vs scroll height 450px. Heading available width 147px exceeds the measured 142.49px subtitle; subtitle is one 18px line. Heading and row line-box centers advance 48px with no label overflow. |
| 3 | Stable `284-stable-1280-unknown.png`, `285-stable-1360-unknown.png`; matching directory/metrics readbacks | Healthy actual UNKNOWN after stable recapture. Both headings and subtitle remain complete. Rails are 180px at 1280 and 190px at 1360. Decision/document overflow 0. The 1280 receipt bottom is 923.16px, so this width needs vertical scrolling and is not claimed as the primary first-screen target. |
| 4 | Stable `286-stable-1024-unknown.png` and metrics | Supported operating boundary remains readable. WITHHELD content width 154.375px, no decision/document overflow, technical fields wrap into readable pieces. Receipt bottom 926.78px requires vertical scrolling. |
| 5 | `271-directory-1023-fractional.png`, `273-directory-767-fractional.png`; 272/274 metrics | Continuous narrow safety preserved: effective fractional CSS widths below 1024 enter the existing read-only view. Notice visible, visible operation/selector controls empty, document/decision overflow 0 at 1023, 800, 767 and 390px. |
| 6 | 275/276 metrics; `directory-1440-final.json` | Direct Lifecycle-to-Overview and right-request-to-home readbacks retain the Overview title, selected request/current route and scroll 0. Populated right directory rows remain 48px and labels have no overflow. I did not perform these navigations myself. |
| 7 | `283-directory-live-home-default.png`; `directory-preview-sync.json` | User preview has a complete default-window homepage from source 2456e291. The exact actual HTTP readback records equal index.html/style.css/app.js bytes and Git blobs for preview 8766 and the separate test session 8767. This full-page default-window image is not 1440px first-screen evidence. |

## Evidence correction made during this review

I found three resize-transition captures that could not support their claimed native visual coordinates:

- 268: metrics 1280x900, image still 1265x356 from the preceding short viewport.
- 269: metrics 1360x900, image only 1266px wide with the right directory visibly cropped.
- 270: metrics 1024x900, image 1009x668 with a scaled view and unused right area.

These are evidence-acquisition failures, not established application layout defects. All original files remain retained and excluded from visual closure. `first-pass-image-metadata.json` records independent file dimensions and hashes. The parent created a fresh same-source actual session, installed/activated v2 and obtained an actual R001 crash outcome (OUTCOME_UNKNOWN/null score/WITHHELD). Stable replacement images 284/285/286 were captured after separate resize, fresh DOM and capture calls. I opened all three replacements at native resolution: dimensions 1265x889, 1345x890 and 1009x887 now match the scrollbar-aware target coordinates and the views show no prior crop/blank area. They close the visual evidence gap.

Capture 265 remains a transitional business state, and 280/281 remain offset/default-window images. None is used as final layout evidence. Old failures and earlier reports are not rewritten or relabeled as passing.

## Remaining issues and acceptance limits

No further implementation repair is supported by this bounded review. The two original P2s are closed: the readable operating minimum is enforced by the existing read-only presentation and the media partition covers fractional widths continuously. The directory yield is moderate and symmetric; the actual scrollbar test demonstrates that it does not sacrifice its title or single-line labels. Wider-window homepage geometry and semantic colors remain intact.

The updated CSS audit records 17,897 bytes and zero repeated complete selector blocks in the same context, compared with 38 before consolidation. The shared variable changes are in the components themselves and bounded media rules; no appended force-override pile was introduced. Inspected metrics report no typography-floor violations and the supplied console readback is empty.

The original final actual session archive retains three actual requests and four independently stopped worker/interpreter PIDs with Java exit 0. I read its retention report; I did not independently execute or repeat the shutdown. The supplementary stable-capture session has separate ownership and must retain its own export/shutdown evidence before the parent considers that session closed.

This review is not exhaustive browser/zoom coverage or assistive-technology qualification. It does not grant final user visual sign-off or merge authority. The closed product findings and source-bound browser evidence should be reported separately from CI and those remaining acceptance boundaries.
