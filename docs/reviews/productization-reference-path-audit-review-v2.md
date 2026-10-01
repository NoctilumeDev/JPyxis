# Productization Reference Path Audit Review v2

Status: `AUDIT A STOP · NEW M4 MODEL COUNTEREXAMPLE · NO PRODUCT CONTRACT B`

## Qualified entry and retained facts

Runtime source base is main `a5553d94136a46cb93ff31caa3e138a5b7ff8731`, tree
`ab2571aa44bc31b1fa43db61dec12e93aabe468e`. [PR #23](https://github.com/NoctilumeDev/JPyxis/pull/23)
completed protected merge and exact-main public checks. Separately downloaded PR/main artifacts
passed independent M5/M6 and v2 guard readback: 35 public-model cases, five durable replay fixtures,
three guard mutations and eight M6 mutations. Resources were accepted and recorded Runtime
processes had stopped. The [implementation record](m5-coordinate-validation-implementation-review.md)
and [manifest](../../evidence/m5-coordinate-validation/v2/implementation-manifest.json) retain the
qualification's exact coordinates and limits. The separate qualification-record closure,
[PR #24](https://github.com/NoctilumeDev/JPyxis/pull/24), completed protected merge at
`fc87c62f68f7ca793fde629fa0c0f4259ff88745`, tree `be643c9af1fd455ae3f7482d017fe7515f84bf1c`.
Its PR/main artifacts independently passed the same declared gates. That accepted main is this
audit-only publication's entry; its own publication qualification remains separate.

The original dirty checkout remains at `9632a4f45c2190da6440e455667090fdd88e4a69`; its README and
candidate SHA-256 still match the first audit record. Both original model receipts, superseded
PR #19, first implementation transport failure, old M0-M6 tags/manifests and frozen contracts are
unchanged. The public repository role map still resolves to
`cb67c33d4ba44c1b216c1f1cb7f6e45ef45fe329`. No system resource grant, scheduling authority or
external Evidence/Verdict meaning has moved into JPyxis.

## Remaining productization boundary

The remaining composition question is still supported by exact source: M4 already passes an
immutable artifact/contract payload, and M3 already supplies the resolved Runtime binding. M2
generates invocation/attempt/trace coordinates internally; its public entry does not accept an M4
pin or M5 plan. M4's public pin carries artifact, deployment and opaque Runtime handle, while M5's
plan carries worker/instance/epoch and retained invocation policy. These separate bounded carriers
do not establish one pre-dispatch association through actual computation. The Environment,
terminal interpretation, rollback realization and cleanup seams remain unqualified.

## New frozen-boundary contradiction

The M4 [profile](../spec/m4-lifecycle-profile.md) says rollback never reuses a retired Runtime handle.
[ADR-0009](../adr/0009-m4-lifecycle-authority-and-cutover.md) separately says a rollback does not
resurrect that handle. This is an existing frozen constraint, not a new Environment or product
construction requirement. The source calls `request`, `load`, `warm`, and `activate` for a new
deployment, but `load` adopts the capability's returned valid-shaped handle without comparing it to
prior retired handles. A new deployment ID alone cannot disprove handle reuse.

A separate fresh public M4 model probe was committed at
`38d3dab41838b5fe7049b9cafa094392c2c622a7` before execution. Every compiled API/Core/port/evidence
source matched the qualified main's exact Git blob. It uses the public ArtifactRegistry,
DeploymentManager, Runtime port, pins and in-memory journal only. There is no private state access,
real Python worker, process, computation, durable store, production exploit or actual artifact
contract-validation claim.

The probe activates v1, captures and releases its public pin, activates v2 and unloads v1 until
Control publishes `RETIRED`. It then requests a fresh rollback deployment of the same immutable v1
artifact. The injected capability returns the exact old handle object and reports warmup success.
Control publishes the new rollback `ACTIVE`, changes the active binding and records
`ROLLBACK_COMMITTED`; the next public pin carries that retired handle object and tuple. The old
deployment remains `RETIRED`. The fresh-handle control follows the same path and works normally.
The identity under review is the canonical `(providerIdentity, providerVersion, opaqueHandle)`
tuple. Exact Java object reuse is additional evidence in this first probe; a different Java object
carrying the same tuple would not establish freshness.

| First case | Control result | New pin versus retired handle | Exit |
| --- | --- | --- | ---: |
| `fresh_handle_rollback_control` | New rollback ACTIVE; active binding changed | Different tuple | 0 |
| `retired_handle_rollback` | New rollback ACTIVE; active binding changed; ROLLBACK_COMMITTED | Same exact object and tuple | 2 |

The [first M4 receipt](../../evidence/productization-audit-v2/first-retired-handle/receipt.json),
original raw stdout/stderr, probe source and runner/reader are retained. Independent readback
verifies raw hashes, exact source bindings, the normal control, original retirement, matching
artifact/digest, actual pin tuple and Control-owned commit event. Its derived disposition is
`STOP_MODEL_COUNTEREXAMPLE`. The emitter's exit code or a stored label is not the sole evidence.
The [publication reader](../../experiments/productization-audit-v2/verify-retained-m4-audit.mjs)
additionally binds every retained Git byte and current source blob and checks the actual
`LIFECYCLE_CAPABILITY` owner has no state transition. The original first reader remains unchanged;
its differently spelled capability-owner condition did not perform that additional owner check.
The canonical pin equality and Control rollback commit still independently establish the failure.
The immutable first M4 receipt SHA-256 is
`98845953495cc58fe224615b1a5735b56d1378cd01212f056a2f48eaea8a66d5`.

This establishes a public consumer/retirement-identity counterexample with a faulty capability
return. It does not claim that the shipped reference capability returns old handles, that a real
process was resurrected, or that M4's original bounded fixture results failed. It invalidates using
an unqualified universal retired-handle rejection premise as the next product contract's input.
The M5 v2 guard qualification remains within its separate declared boundary.

## Disposition and remaining authority

The new counterexample is outside the reviewed M5 v2 boundary. Audit A cannot be upgraded, contract
B is not drafted or frozen, and real path C-G do not begin. M4 Core, API, frozen profile/review,
dependency inputs, thresholds and old tags are untouched. First observations are archived without
repair or rerun. M5 qualification records were closed separately through PR #24. The original mixed
candidate `a3ddae079dcbcee26e11af98335216ad4d9e2552` remains on its unmerged remote branch
`docs/productization-reference-path-audit-v2`; this publication selects only the first M4 probe,
receipt, raw evidence, independent reader, STOP review and needed links.

After this audit-only publication qualifies, the authorized next step is a minimum M4 pre-contract
audit of canonical handle conservation within one in-memory DeploymentManager owner. It must
cover retirement, failed warmup release, failed cleanup, live ownership, rollback and atomic
admission of concurrent duplicate returns. Capability observations remain separate from
Control-owned admission and lifecycle state. A rejected alias must not be unloaded by a deployment
that never owned it. Active bindings and existing pins must survive rejection. Any larger lifecycle
or authority contradiction requires a new STOP. A separate versioned contract must qualify before
runtime repair; product contract B and real path C-G remain gated.

| Required record | Audit A v2 round |
| --- | --- |
| Did | Bound the separately closed M5 qualification entry and retained the first M4 rollback retired-handle falsifier. |
| Why | Recheck counterexamples before treating local identities as guarded inputs to a real product contract. |
| Original plan | Rerun A after M5 qualification, then choose only the minimum continuity/Environment contract B. |
| Actual | The first M4 probe admitted a retired handle and independently reproduced the frozen-boundary contradiction. This audit-only publication does not include the mixed candidate's additional M5 probes. |
| Failed premise | A new M4 deployment/load/warm sequence necessarily prevents a returned retired Runtime handle from being repinned. |
| Final state | M5 v2 guards qualified; audit A STOP; product contract and real path unqualified. |
| Next authority | Qualify this fact publication, then audit the explicitly authorized minimum M4 owner boundary before a separate contract and implementation qualification; keep product A/B/C-G stopped. |
