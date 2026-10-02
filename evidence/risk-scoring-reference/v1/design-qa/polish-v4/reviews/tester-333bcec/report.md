# Independent tester and code review

Reviewed head: `333bcec65ef1e636100a0abe4fae9c6b0fd56d4b`; base main: `109646c7c5266a164018ac2f9534afe850b94c7c`.
Actual rendered construction: `8aa073c5f06c718511cced38d7c59376db05bed1`, with all three asset Git blobs independently confirmed equal to the reviewed head in `static-audit.json`.
I used a fresh actual Java host on port 8767 and did not alter source files, commits, PR state, port 8765 or port 8766.

Verdict: no P0/P1 found in the covered behavior. Two confirmed P2 defects remain in narrow-screen safety. This is not final visual/product acceptance, an assistive-technology compliance claim, or merge authorization.

## Confirmed defects

1. **P2: four fixed-ratio desktop columns remain operational below their readable width.**
   File: `reference-apps/versioned-risk-scoring/host-java/src/main/resources/observatory/style.css`, lines 82, 115, 118 and 196-205.
   Reproduction: load the actual host at 800 x 900 CSS viewport, zoom 1, including the empty state. The 768-1120 media block reduces the left rail but preserves four weighted tracks. The policy column is 126.43px wide; WITHHELD has only 105px available and requires 141px (`white-space:nowrap`). It extends outside its column, and the document has 8px horizontal overflow. Technical definition-list values break into fragments/individual letters. This violates the user's safe narrow fallback even though 1440px is healthy.
   First stable evidence: `05-boundary-800-stable.png` and `.json`. The saved image was opened and inspected at native resolution. The actual live UNKNOWN state exhibits the same clipping in `21-fractional-767-live-controls.png`.
   Minimum repair: choose a minimum readable workstation width and apply the already-approved safe read-only presentation below it, or give the constrained content a deliberate safe overflow/fallback. Preserve the desktop four-stage relationship and existing 1440px weights; do not add mobile controls, shrink text further, or append late forced overrides. Product review should choose the fallback boundary.

2. **P2: the 767/768 media-query boundary leaves a fractional CSS-width gap.**
   File: the same `style.css`, lines 196 and 208.
   Reproduction: request a 767px viewport in the in-app browser. The stable DOM reports `innerWidth=767`; CSS media evaluations confirm the effective media width lies above 767.01px and below 767.5px. Both `(max-width:767px)` and `(min-width:768px)` are false. The layout falls through to the older 160px fixed rail rule, keeps four cramped columns, hides the desktop-use notice, and exposes enabled Invoke/Fresh rollback/Close controls. It does not enter the intended read-only fallback.
   First stable evidence: `04-boundary-767-stable.png` and `.json`; complete media readback and live-control reproduction: `fractional-boundary.json`, `21-fractional-767-live-controls.png` and `.json`.
   Minimum repair: use a shared continuous boundary for adjacent presentation modes, including fractional widths. Edit the existing media rules. Recheck the two sides and a fractional width at the repaired boundary.
   The initial `02-` and `03-` captures were taken during a viewport transition and are retained but excluded from accepted visual evidence.

## Code and CSS review

`static-audit.json` independently records 17,571 stylesheet bytes, 212 rule blocks, no repeated complete selector block in the same context, no duplicate property inside a declaration block, and one `!important` for the existing `[hidden]` contract. Shared selectors, state variants and bounded media rules explain the remaining intentional cascade. I did not find an appended override pile or obsolete deployment-card/right-table rule set. Only the three observatory assets differ under `reference-apps`; backend and policy sources remain at base.

The canonical hidden native selects still supply the actual invocation payload. Display text and technical coordinates are generated with textContent from host observations; central version, request and receipt views do not substitute reference-image data. Navigation keeps the old request pin/outcome while separately displaying the current route.

## Actual coverage

| Step | Independent check | Health |
| --- | --- | --- |
| 1 | Empty 1440x900 first display; weighted columns, clean flat surfaces, matching rails | Healthy in observed desktop view |
| 2 | 800/767 boundary and 390 safe read-only presentation | P2 defects at the boundary; 390 notice, hidden operational controls and document overflow 0 |
| 3 | Sample/mode pointer selection; ArrowDown/ArrowUp, Home/End, PageUp/PageDown, Enter, Space, Escape, Tab, Alt+ArrowUp, type-ahead, outside-click commit | Passed; selected values were used by actual Java invocation |
| 4 | Install/warm v1 and v2, both activations, explicit calls, hold/release, cutover, actual crash, both fresh rollback directions | Passed actual actions; six retained requests |
| 5 | All five left links, brand Overview, right old/current request and realization navigation, central history selection, ceremony and receipt disclosures | Passed observed routes and retained data; directory text centers advance 48px, no duplicate DOM IDs |
| 6 | UI Close, UI Export, byte comparison, host stop, independent owned-process observation | Passed; Java exit 0, eight owned worker/interpreter processes stopped |

The distinguishing concurrent test held R002 on v1, activated v2, invoked R003 on v2 while R002 was still held, then released R002 within 2.809s. The second v1 invocation was disabled while v1 was pinned; a v2 invocation became available after activation. R002 retained v1/0.73/REVIEW; R003 returned v2/0.85/REJECT.

The actual receipt contains:

| Request | Version / sample / mode | Outcome |
| --- | --- | --- |
| R001 | v1 / LOW / normal | SUCCEEDED, 0.09 ALLOW |
| R002 | v1 / STANDARD / hold across cutover | SUCCEEDED, 0.73 REVIEW |
| R003 | v2 / STANDARD / normal while R002 held | SUCCEEDED, 0.85 REJECT |
| R004 | v2 / HIGH / actual crash | OUTCOME_UNKNOWN, null score, WITHHELD |
| R005 | fresh v1 / LOW / normal | SUCCEEDED, 0.09 ALLOW |
| R006 | fresh v2 / HIGH / normal | SUCCEEDED, 0.93 REJECT |

R004 retained its original worker/nonce/pin and UNKNOWN/WITHHELD across both fresh rollbacks and after Close. Central receipt also retained Wire invoked=true. The old v1 realization displayed RETIRED/stopped and its full actual nonce rather than the fresh worker.

Overview was checked on first display, after the Receipts route, and via the brand after returning through right-request navigation; it returned the JPYXIS CONTROL OBSERVATORY heading and current selected request/current route. I did not perform a separate direct Lifecycle-to-Overview click after the last user steering; include that direct path in the post-fix homepage regression. I made no claim that the original main preview was synchronized.

## Retained evidence and limits

Evidence folder: this `build/tester-review-333bcec/` directory. Raw Java session: `build/design-qa/installed/8aa073c5-mur42xge/`.
`readbacks.json`, accepted numbered images/DOM/metrics, `directory.json`, `console.json`, `static-audit.json` and `summary.json` bind the independent observations.
`console.json` has no warn/error entries.

The original exported receipt is `exported-receipt.bin`, 72,112 bytes, byte-equal to the raw session's `receipt.json`, SHA256 `e2af40106ae03bffa1a112e6184f42ea54d321f7d5efd78973f0e226b5da07a3`.
The raw session is retained as `actual-observations.zip`, 21,818,320 bytes, SHA256 `ca0e965d169e91af45662c5d26e19231d36f369e360eaa308f5895c72d299dfd`; all 301 manifest members and every archived file were byte-verified.
`summary.json` and the raw `independent-shutdown.json` record all eight owned processes stopped; `java-exit.json` records natural exit 0. The temporary viewport override was reset and the review tab was closed.

No screen-reader session, exhaustive browser/OS matrix, held-deadline expiry, full security audit, fresh-VM construction qualification or final product acceptance was performed. The existing CI/gates are separate regression evidence; I did not repeat every already-green gate.
