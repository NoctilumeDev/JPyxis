# Observatory publication synchronization

This directory retains the public-demo follow-up to merged frontend PR #40. Browser simulation
is separate from the actual Java/Python host and does not establish runtime qualification.

- PR #40 merged at `09ac1d4caea32ff1ce251da8acdc56cbebb5020e`. Its four exact-main jobs passed
  in [run 37047689101](https://github.com/NoctilumeDev/JPyxis/actions/runs/37047689101).
- A clean local rebuild at that source passed seven actual requests and six evidence mutations,
  with explicitly declared local Maven reuse. The fresh installed preview served the exact
  three merged UI assets. `actual-merged-home.*` is its native empty homepage, after a browser
  reload removed stale pre-merge DOM. It is not a public-demo simulation capture.
- `demo-1440-*` and `demo-1280-*` are parent-operated pre-publication prototype captures.
  Their displayed `09ac1d4c` is the host-asset base; the then-uncommitted demo adapter is not
  claimed to be an immutable revision. Metrics retain the actual viewport/scroll position.
  The cutover capture is scrolled and is not claimed as first-screen evidence.
- `c11b499-reset-1280.*` captures the committed disclosure-reset repair in the local demo.
  After opening both disclosures and resetting, receipt/ceremony are collapsed, selectors are
  STANDARD/normal, and Overview is restored. The measured viewport is 1280×900.
- `post-c11b499-narrow-*` captures the subsequent small demo-toolbar repair before its commit:
  the new Reset control joins the shared read-only boundary. At 800 and 390px there is no
  horizontal overflow or visible mutation/selector control. These are safe degradation checks,
  not a mobile product or actual worker observation.
- The parent exercised install, activate, normal REVIEW, held v1 across v2 activation, release,
  missing outcome/null/WITHHELD, fresh rollback, LOW/ALLOW, left/right directory navigation,
  receipt expansion, close and actual browser download. The downloaded demo JSON used
  `jpyxis.io/frontend-demo-receipt/v1alpha1` with an explicit simulation scope and four requests.
  The browser's download-event wait timed out, but the file itself was independently read from
  disk and validated. This limitation is retained rather than presented as an event success.
- The independent tester's original `011bb66` report, model checks and seven-file HTTP readback
  are under `reviews/tester-011bb66/`. Its first mistaken HIGH expectation is retained in the
  original ZIP and classified as a reviewer-helper failure. The tester's browser was unavailable;
  neither its report nor the later product review substitutes for the parent's live session.
- The subsequent [product review](reviews/product-c11b499/report.md) is bound to `c11b499`.
  Its one P2 is the new Reset control escaping the narrow read-only range; the subsequent
  demo-only media rule addresses that exact control. Its optional Node.js prerequisite
  suggestion is included in the local-run guide. Original reviewer bytes and scope limits
  are retained alongside the report; neither reviewer claims independent live HTTPS testing.

The original user checkout's unrelated README and roadmap edits remained byte-identical.
The personal profile repository was not edited. Prior native captures, raw receipts, rejected
candidates and frozen records remain historical records; none is relabelled as a deployed demo.
The public site's `publication.json` binds its eventual main revision and current asset hashes.
