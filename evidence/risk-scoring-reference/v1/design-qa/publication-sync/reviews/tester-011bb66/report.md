# Independent public-demo tester review

Reviewed revision: `011bb66aba9ef89af4aa37dc379cd4e826d95b39`, branch `docs/observatory-publication-sync`.
Scope: read-only source, browser-model, build, documentation and local static HTTP review. No source/test/contract/workflow changes, commits, push or merge were performed. Only ignored helpers and observations in this directory were written.

Verdict: **PASS for the independently tested model/build boundary; no confirmed P0/P1/P2 defect. Browser interaction and visual acceptance remain outside this independent review.**

## Verification

`node scripts/verify-observatory-demo.mjs` completed with exit 0 at the reviewed revision. It built the current demo and reported lifecycle, pinned cutover, policy samples, UNKNOWN, fresh rollback, close/export/reset and shared style reuse PASS.

The separate `independent-check.mjs` / `independent-checks.json` adds distinguishable tests:

1. Both versions times LOW/STANDARD/HIGH use the current calibrations and each expected policy branch. The raw v1 HIGH score is approximately 0.802 and correctly yields REJECT even though the rendered two-decimal score is 0.80.
2. Installing STANDBY alone grants no rollback. A first active v2 that becomes unavailable has no prior-active rollback target; activating the previously installed v1 then establishes a prior-active relationship.
3. Three simultaneous held requests, pinned to three separate realizations, survive v1-to-v2 cutover and fresh v1 rollback. Releasing them in a different order uses each original binding. Old drained realizations retire only after their pin reaches zero; a second call on the currently held active realization is rejected.
4. An UNKNOWN request remains byte-for-byte unchanged as a model object across both fresh rollback directions and later successful requests. It keeps null score and WITHHELD. Every realization within the simulated session has a distinct launch nonce.
5. Closing two held requests removes release eligibility and awards no business decision. Closed state reports zero simulated live workers and rejects further actions. The downloaded-model receipt is a detached snapshot with `jpyxis.io/frontend-demo-receipt/v1alpha1` and explicit browser-only/no-real-evidence scope. Reset clears requests, deployments and active route.
6. Generated HTML uses relative asset URLs, a visible browser-only simulation toolbar and an explicit no-Java/no-Python statement. Generated transport has no `/api/`, host token header or polling interval. The only data fetch is the static local catalog.
7. Publication source hashes match the normalized host assets. Generated `style.css` is byte-equal after LF normalization to the production host stylesheet; the host HTML/CSS/renderer have no changes from merged main `09ac1d4caea32ff1ce251da8acdc56cbebb5020e` to this revision.

`http-readback.json` independently fetched all seven known served files from `http://127.0.0.1:8768/observatory-demo/`. Every response was HTTP 200 and byte-equal to the generated file; `publication.json` identified the reviewed revision. This verifies the static serving coordinate, not a live browser interaction.

## Source, docs and workflow

The build derives the current host HTML and renderer rather than maintaining a second layout. The additional five-rule `demo.css` is scoped to `.demo-toolbar` and does not override host component rules. Current synthetic cases derive from Java's LOW/STANDARD/HIGH definitions. Scale/bias and definition identity/digest derive from the current retained Python-definition envelope, which the Java host itself consumes. The policy seam is asserted before publication.

The generated demo keeps the five left navigation routes, right realization/request selection, full central detail rendering and separate receipt layers from the host renderer. Source review did not find copied reference data substituted for the demo state. UI-derived navigation behavior was not independently exercised in a browser in this run.

README and `docs/observatory-demo.md` clearly distinguish public browser simulation from running the real loopback host and include the local startup command. The public receipt schema and scope do not claim actual dispatch, control qualification or physical shutdown. The documentation correctly states that the simulated hold remains pending until release/close rather than borrowing the actual host's 15-second witness claim.

The Pages workflow permits PR verification but its deploy job is guarded by both non-PR event and `github.ref == 'refs/heads/main'`. It publishes the generated static directory with Pages permissions isolated to the deploy job. The workflow, docs, demo and source changes remain inside JPyxis; no personal-homepage change is part of this commit.

The copied host stylesheet has the continuous `<1024px` safe read-only fallback introduced after the prior review. Static reuse is confirmed; width overflow, actual media matching and menu rendering were not independently measured because browser control was unavailable.

## P3 optional reset consistency observation

At `scripts/build-observatory-demo.mjs` line 69 in the reviewed `011bb66` source (the generated `demo-reset` handler), reset clears model state, selection IDs, errors and native selector values, then navigates to Overview. It does not restore `receipt-details.open` or `ceremony.open` to their initial collapsed state. Static control flow therefore predicts that Receipts -> Reset can retain an expanded empty receipt rather than the exact initial Overview presentation.

This is an optional first-screen consistency improvement, **not a confirmed runtime P2 finding**. No independent browser reproduction was available. If the product expects Reset to restore the initial presentation, the smallest change is to collapse those existing details in the reset handler; no layout rewrite or extra responsive CSS is needed. A live browser check can confirm the desired behavior.

The parent subsequently reported its own live reproduction and started a minimal adapter repair. That later working-tree change is outside this sealed `011bb66` review; this agent did not live-verify that repair. The original reviewed build script is retained as `reviewed-build-script.mjs.bin`.

## Browser limitation and retained helper failure

Creating an independent CUA IAB tab returned `Browser is not available: iab`; `cua.getState()` returned no browsers/apps. Per the parent's direction I did not loop-retry, use another browser technology, or operate the parent's tab. Thus I did not independently claim live menu/button/navigation/download success, screenshots, viewport overflow or deployed HTTPS acceptance. The parent has a separate live-browser record and plans a final deployed HTTPS pass; those observations are not relabelled as this agent's evidence.

The first independent-helper run incorrectly expected REVIEW for v1 HIGH. The model returned REJECT, consistent with the derived score 0.802. The mistaken expectation was corrected only in this ignored review helper. `independent-check.first-helper.mjs` and `first-helper-failure.txt` preserve the original failure and its classification as a reviewer-helper error, not a product defect.

Remaining limits: no independent live browser/assistive-technology session, actual Java/Python execution, deployment run, published URL availability, security audit or new runtime qualification claim. Those are distinct from this public teaching model's bounded tests.
