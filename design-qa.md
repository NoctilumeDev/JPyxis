# Risk Scoring Observatory: polish-v4 candidate review

Visual acceptance: PENDING USER SIGN-OFF.
Merge authorization: WITHHELD until explicit user visual acceptance, independent product
acceptance (P0/P1 cleared, P2 adjudicated by the user), and regression gates.
CI and implementer measurements do not grant visual acceptance.

Base: 109646c7c5266a164018ac2f9534afe850b94c7c.
Reference: evidence/risk-scoring-reference/v1/design-qa/source-reference.png (1503 x 1047).
User-selected source file: exec-95a48f36-a157-4817-b943-fdb5da5e6463.png.
Viewport target: 1440 x 900 CSS px, 100 percent zoom, browser density 1.

## Retained counterexamples

The unchanged exact-main v1 REVIEW first screen is polish-v4/00-exact-main-before.png.
The receipt entry sits below the viewport, several labels are 8-10px, and the pale card
surfaces and charter do not yet express the selected reference's material hierarchy.
The exact prior design-qa.md bytes and their source coordinate are retained in
polish-v4/previous-polish-v3-report.md and supersession.json. polish-v3 and all earlier
screenshots, reports, raw observations and failures remain unchanged.

## Candidate changes to inspect

- Typography floors: body, table and auxiliary copy 12px; technical coordinates 11px or
  larger with at least 1.5 line height. Auxiliary text uses a readable muted ink.
- Compact header, control and request surfaces keep the system in the first viewport.
- The wider central charter has a brass frame, deeper stone header, inset paper body,
  explicit authority state and grouped binding coordinates.
- Navy structure, ivory paper, stone panels and oxblood decision surfaces are distinct.
- A qualified standby's Activate action is the only primary action. Fresh rollback has
  an amber recovery outline and keeps its explicit action wording.
- Navigation reflects its actual anchor; real Lucide source vectors are retained.
- Actual empty state has explicit request guidance. The desktop overview rail is retained.

These are implementation proposals to assess from rendered evidence; they are not visual
acceptance assertions. No runtime, Java policy, state machine, protocol or receipt edits.

## Capture and comparison work still required

Capture actual empty/install, v1 REVIEW, v2 STANDBY, held old request during cutover,
v2 REJECT, crash UNKNOWN / HELD / WITHHELD, fresh rollback, expanded receipt,
physical close/export, 1280 desktop, 1120 narrow and 390 mobile. Inspect keyboard and
focus, disabled, navigation and recovery affordances. Preserve intermediate captures.
Put the 1440 x 900 implementation and aspect-preserving reference normalization together,
then inspect native-pixel three-wing, control and rail crops. Classify each difference as
intentional adaptation or unmet; do not downgrade an unmet requirement to optional.

## Exit

Stop at the candidate PR, precise commit and actual screenshots. User visual signature and
independent product acceptance are outstanding. Do not merge this candidate.

## First iteration counterexample

Candidate 9d8b482415a114b28b17cdaef734476b667c8222 was actually constructed and
ran the unchanged seven-request/three-worker scenario and mutation reader. Its UI R001
returned 0.73 / REVIEW / SUCCEEDED, but 05-v1-review.metrics.json puts the receipt summary
bottom at 906.21875px. This fails the stated first-screen requirement. The first UI receipt
is byte-identical to receipt.json; its original worker/probe were physically stopped.
Raw source/construction/owner/receipt bytes remain in first-iteration-observations.zip.
The layout is revised through padding, definition-list gaps and header rhythm while
preserving measured font floors. New actual screenshots are still required.

01-empty-install is a rejected default-viewport capture; 02-empty-1440 is a rejected resize
transient. Both are retained. 03-empty-1440-stable is the inspected stable empty screen.

## Second iteration counterexamples

783d45ef715c717576d8ebfdc4dc1d7e9d381b86 ran five actual GUI requests.
13-v2-standby shows REVIEW and the sole primary Activate action at scrollY=0; its receipt
summary bottom is 853.385px. Held cutover and UNKNOWN still push the summary bottom to
918.969px and 910.219px. Latest fresh realization details are partly hidden below older
cards. These are unmet requirements, preserved in 14/16/17 screenshots and raw ZIP.
The next presentation candidate embeds the readable status notice inside Request, orders
actual version cards newest first, and bounds history/recent scrollers. No host state or
selection data changes. 10/11/12 retain scroll offsets and do not prove the first screen.
The source-bound functional scenario and mutations returned their expected results; all
six original UI worker/probe processes stopped, and export equals the original receipt.

## Third iteration observations and retained capture failure

a31aad7b3534677e63ed0ea4625531c4d84e921f completed the unchanged seven-request
scenario and six mutation expectations. The first GUI pilot used an incorrect release
locator, exceeded the actual 15-second held deadline and produced FAILED. Capture 24
does not prove held cutover. The original pilot receipt, archive and four stopped
worker/probe observations are retained; this is an operator capture failure.

A fresh actual GUI session produced captures 30-42: v1 REVIEW, qualified v2 standby,
old v1 pin across v2 activation (34, IN_FLIGHT, subsequently explicitly released and
SUCCEEDED), v2 REJECT, dispatched crash UNKNOWN, fresh rollback and new v1 ALLOW.
Receipt summary bottoms were 888.802px during held cutover and 880.052px for UNKNOWN.
Fresh rollback keeps the original R004 UNKNOWN / HELD / WITHHELD while its actual new
v1 realization appears first. Its journey line still clips the launch nonce on desktop;
that remaining visibility requirement is unmet. Remove journey text truncation while
retaining the bounded, keyboard-accessible version history. Recent history also receives
an explicit focus target and label. New source-bound observations are required.

40-unknown-1280 has a nonzero scroll offset after receipt keyboard focus and resizing;
it is retained but rejected as top-of-page evidence. 41 and 42 are at scrollY=0. The
third GUI export equals the original receipt byte-for-byte, Java exited normally and
all six original worker/probe processes were independently observed stopped.

## User correction: white surfaces and two navigation rails

The user rejected the broad yellow surfaces, unequal visual weights and weak connectors.
Their annotated reference selects three outer regions: left global navigation, a broad
central workspace, and right contextual navigation. Both side rails should be comparable
in width and should select content in the center. This supersedes the wider central
charter and broad paper/stone tint as visual targets for this candidate.

The next source uses white and light-gray surfaces, four equal step columns in Request /
Control Binding / Execution / Host Decision order, and visible connectors in the gaps.
Both desktop navigation rails are 200px. Right version selection shows actual deployment
facts in the center; right invocation selection shows its actual existing binding,
execution and policy result. Left navigation switches the central observation view.
Selection remains presentation state and does not activate, roll back or invoke a worker.

The rejected yellow empty screen is retained as 50-empty-before-white at exact source
e2ef833f553255687d460256bfd9cdc13979b015. Its empty session closed normally with zero
owned processes. The source completed the unchanged seven-request/three-worker scenario
and six mutation expectations. Four exported receipt copies failed the repository text
newline rule. Their original bytes are now retained under .bin names (same blobs and ZIP
members), so their formatting remains unchanged; the verifier itself is unchanged.
Visual acceptance remains pending and no merge is authorized.
