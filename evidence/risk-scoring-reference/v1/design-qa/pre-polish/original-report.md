# Risk Scoring Observatory QA

final result: passed

Source visual truth: the user's selected ivory/navy/brass observatory image,
retained at `evidence/risk-scoring-reference/v1/design-qa/source-reference.png`.
This is the principal style reference. Its generated dates, user identity, versions and requests
are not runtime facts. The host keeps the required west execution / central charter / east Java
policy layout; continuity and recent records sit below it instead of the image's fourth sidebar.

Initial implementation: committed `6882a7ffd36c315f7f7f50ea7250b5aff5098aa8`, real Java HTTP host.
Source pixels: 1503 × 1047. Desktop CSS viewport: 1440 × 900. Full-page implementation:
1424 × 1284 pixels, with browser scrollbar width excluded. The contact sheet fits each image into
800 × 1000 without changing its aspect ratio. It compares style and hierarchy, not identical content
or a pixel-matched state: actual v1 REVIEW and the image's fictional active v2/standby v3 differ.

Initial combined comparison: `evidence/risk-scoring-reference/v1/design-qa/comparison-initial.png`.
Initial desktop REVIEW, cutover, UNKNOWN, 1120 × 800 narrow desktop, 390 × 844 mobile UNKNOWN,
fresh rollback and expanded receipt captures are retained beside it. All were rendered from actual
workers, not fixture output. Console errors/warnings: none for the app.

Initial findings:

- P2: the central feature text lost its intended line breaks. Preserve `white-space: pre-line`.
- P2: state polling rebuilt lifecycle/record buttons, risking keyboard focus loss. Skip unchanged
  state renders and restore the keyed focused control after a real state update.
- P2: the empty state presented two equally strong install actions. Make initial v1 installation
  primary, with v2 secondary; an eligible STANDBY activation remains primary.

These fixes are implemented but require a rebuilt rendered comparison and keyboard readback.
The `a6b11dd` revised pass confirms the line breaks, unique initial primary action and keyed
keyboard focus preservation. Its combined full/focused captures are in the `revised` subfolder.
A further P1 was found in that real pass: v2 STANDBY offered rollback before a prior active version
existed. Its first rendered counterexample and raw owner facts were retained before repair.
The private host repair and actual HTTP rejection check require one final rebuilt QA pass.
The final pass must cover fonts/typography, spacing/layout rhythm, colors/tokens, image quality,
copy/content, focused dense regions, responsive states and receipt/export. There are no raster
decorations or invented crown/flag/landmark icons: the reference brand is plain typography and the
user's explicit constitutional visual constraints govern the required three-wing adaptation.

Verified interactions in the initial real session: install v1, explicit activation, score 0.73 / REVIEW,
v2 STANDBY, held A pinned to v1 through cutover, B on v2 with score 0.85 / REJECT, release A,
actual v2 process crash, amber UNKNOWN / AUTHORITY HELD / WITHHELD, fresh rollback with a new
launch nonce, successful new v1 invocation, three-layer receipt, physical close and downloaded
sealed receipt. All three owned workers were stopped before the server was terminated.

## Final rendered reconciliation

Final implementation source: `93c3763de99fc2d2` (the complete coordinate is retained in the sealed
receipt). This pass launched the source-bound jar from the completed local construction into a
fresh Java host, with fresh owned workers and probes; it reused the installed private environment.
It is an installed-product observation, not a fresh-VM qualification claim.

Combined full-view comparison: `evidence/risk-scoring-reference/v1/design-qa/final/comparison-full.png`.
Focused native-pixel charter comparison: `final/comparison-focused.png` in the same directory.
Desktop REVIEW capture: 1424 × 1298 pixels at 1440 × 900 CSS pixels, density approximately 1;
the full-page capture excludes the 16-pixel scrollbar strip. The source stays 1503 × 1047.
The full-view sheet uses aspect-preserving containment; the focused sheet preserves native pixels.

All initial P2 findings are fixed and recaptured. Keyboard Enter selects a retained request while
the keyed request button keeps focus, including across polling. Features retain three separate
lines. Initial v1 install is primary; qualified STANDBY activation is primary. The P1 rollback
finding is fixed: the final STANDBY capture offers activation with no premature rollback action;
the actual HTTP scenario rejects rollback with 409 and no new deployment. After v2 activation and
its actual crash, the UI offers fresh rollback to the real prior v1 artifact and displays a new nonce.

Required fidelity surfaces:

- Typography: Georgia display/section/score hierarchy, Segoe UI controls and Consolas coordinates
  preserve the source's serif/sans/mono division. The main title is 43 pixels. Dense metadata is
  readable in the native-pixel crop; long identities wrap, and full values remain in the receipt.
- Layout: ivory field, dark fixed desktop rail, thin brand/control strips and navy four-step flow;
  aligned three-wing grid, stable central charter and compact receipt disclosure. The lower
  lifecycle/recent area is the intentional required three-wing adaptation of the reference sidebar.
- Colors: navy/ivory/brass/oxblood tokens match the selected direction. Green marks successful
  execution only. UNKNOWN is amber in all three wings, with AUTHORITY HELD / WITHHELD; a business
  REJECT remains a Java policy value and does not use execution-failure red.
- Assets: no decorative raster asset, crown, flag, landmark, avatar or invented icon carries state.
  The reference's decorative pillar and generated user identity are omitted under the user's
  explicit visual and factual constraints. Branding is accessible plain typography.
- Copy: dates, coordinates, score, policy and lifecycle derive from actual observations. The source's
  fictional versions and user are not copied. Score and Java decision remain distinct; the held
  witness is explicitly labelled as a real barrier rather than a claim that NumPy is busy.

Final responsive captures at 1120 × 800 and 390 × 844: `final/unknown-narrow.png` and
`final/unknown-mobile.png`. The DOM's document scroll width equals the respective viewport width.
All controls and the table remain reachable; the mobile wings stack in the same authority order.
Final expanded rollback/receipt and closed/export states: `final/rollback-receipt.png` and
`final/closed-receipt.png`. Downloaded bytes equal the source-bound `final/sealed-receipt.json`;
all three owned workers were stopped. App console warning/error entries: empty (`final/console.json`).

No actionable P0/P1/P2 findings remain. P3: further decorative polish is optional. Public
fresh-VM, protected merge and exact-main qualification are separate from this visual result.
