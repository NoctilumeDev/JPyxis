# Risk Scoring Observatory QA

final result: blocked

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
