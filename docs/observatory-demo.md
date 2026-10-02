# JPyxis Observatory demo

**[▶ 演示 / Play the Demo](https://noctilumedev.github.io/JPyxis/)**

The public frontend is interactive and needs no installation. It is designed for a desktop
browser: the four stages show who prepares, who authorizes, who executes and who decides at once.
It is a browser-only teaching model. No Java host, Python worker or real dispatch runs on GitHub
Pages; the page and downloaded JSON explicitly identify simulation.

## Try it

1. Click **Install & warm v1**, then **Activate risk-v1**.
2. Invoke **Standard exposure** to see 0.73 and REVIEW. Low exposure demonstrates ALLOW.
3. Install v2. Choose **Hold for cutover · demo**, invoke on v1, then activate v2. Release the
   held request: its pin still uses v1. New requests use v2.
4. Choose **Missing outcome · demo**. The score is unavailable and the decision is WITHHELD.
   After v1 and v2 have both been active, **Fresh rollback** creates a new demo realization.
5. Use either directory to inspect versions or requests in the center. Open Receipts to inspect
   binding, execution and decision separately. Close the demo session to download a clearly
   labelled demo receipt; **Reset demo** starts again.

The public model has no automatic retry, network control API, persistent state or worker process.
The held demo request stays pending until release or close; the real local host's 15-second M3
witness barrier is a separate runtime behavior. Refreshing the public page resets the model.
Below 1024px the shared layout is read-only; widen the browser to operate the demo.

## Run the real host

Clone the repository and install Java 17, native CPython 3.12 and the Maven wrapper prerequisites.
From the repository root:

```text
node scripts/run-risk-scoring-host.mjs
```

Open the loopback URL printed by the command. That private host uses actual Java-owned Control,
separate Python/NumPy execution, version pins and sealed Java policy. Close owned workers and
export the sealed receipt before stopping the server. For scenario verification:

```text
node scripts/run-risk-scoring-host.mjs --scenario
```

See the [host guide](../reference-apps/versioned-risk-scoring/README.md),
[bounded qualification record](reviews/risk-scoring-reference-host-qualification-v1.md) and
[native browser Design QA](../design-qa.md). The public demo neither extends nor replaces those
actual execution and qualification records.

## Shared presentation and drift checks

The build reads the current host HTML, CSS and renderer directly. It replaces the loopback
transport with the isolated [browser model](../reference-apps/versioned-risk-scoring/demo/demo-engine.mjs)
and adds one demo toolbar. There is no second copied set of layout overrides.
Calibrations and synthetic cases derive from current Python definition comments and the Java
host; a changed policy or rendering seam fails the build until reconciled.

```text
node scripts/verify-observatory-demo.mjs
```

This verifies demo state transitions, pinned cutover, policy branches, missing outcomes, fresh
rollback, close/export/reset and shared CSS. The publication workflow builds on each main push
and deploys only main. Its `publication.json` binds the deployed revision and source asset hashes.
It never publishes the Java/Python server, credentials or local execution evidence as a live API.
The demo is a presentation layer; M0–M6 freezes and bounded host qualification remain unchanged.
