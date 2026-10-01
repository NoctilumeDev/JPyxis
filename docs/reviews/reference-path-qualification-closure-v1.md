# Bounded Actual Reference Path Qualification Closure v1

Status: `BOUNDED ACTUAL REFERENCE PATH QUALIFICATION / PUBLICATION CLOSURE COMPLETE`

The [qualification candidate](reference-path-qualification-v1.md) records the accepted implementation
inputs and the separate publication gates required at that stage. This status record closes those
gates at exact main `fee87f3baf13c4207c78c0785e02576f7e318963`; the candidate's bound inputs, first
failures and historical pending statements remain unchanged. This is state/projection reconciliation,
with no reopened contract or additional runtime authority.

## Protected chain and preserved rejection

| Boundary | Exact coordinate | Result |
| --- | --- | --- |
| Implementation [PR #34](https://github.com/NoctilumeDev/JPyxis/pull/34) | Merge `b50495a12fbb32bbd06a8cff9c92e333cd395606`; PR run `36913264850`, exact-main run `36914349062`. | Required jobs and downloaded independent readbacks passed; these are the original qualified inputs. |
| Qualification publication [PR #35](https://github.com/NoctilumeDev/JPyxis/pull/35) | Merge `e6cf85615201232e8492d39c915c58d34ae07831`; PR run `36916516863`. | Protected publication merged; its first exact-main result remained a separate gate. |
| First publication-main observation | [Run `36917818036`](https://github.com/NoctilumeDev/JPyxis/actions/runs/36917818036), source `e6cf85615201232e8492d39c915c58d34ae07831`. | Actual reader failed on a successful `ps` row with zero RSS; eighteen actual families completed and all owned processes stopped. M5 and M6 passed. |
| Observer repair [PR #36](https://github.com/NoctilumeDev/JPyxis/pull/36) | Reviewed head `8887ff3c19d38d08d543bb6b4ca7b10a2d3b729b`; executed PR source `b175b9fcf29ef8b3e23968682958c7d9e9d7e2ab`; [run `36919497533`](https://github.com/NoctilumeDev/JPyxis/actions/runs/36919497533). | All three required jobs and independently downloaded readbacks passed; protected merge is `fee87f3baf13c4207c78c0785e02576f7e318963`. |
| Effective exact-main closure | [Run `36920572790`](https://github.com/NoctilumeDev/JPyxis/actions/runs/36920572790), source `fee87f3baf13c4207c78c0785e02576f7e318963`, tree `bcc02c611a3f8fa727c6dab9c1e031b0578c4a94`. | All three required jobs and independently downloaded readbacks passed. |

The first publication-main rejection is preserved in its original
[retention ledger](../../evidence/reference-path/v1/public-candidates/e6cf85615201-first-zero-rss/retention.json),
introduced at `9bb07801c6f5e08a950e8c99d5edb19b88572ad0`, including the 763-member original artifact,
raw CI records and successful `ps` output. PR #36 corrected only the observation boundary: finite
nonnegative RSS rows are valid, positive real samples and exact sums remain required, and `ps` state
is retained. RSS=0 cannot establish cessation. Physical shutdown and M6's unchanged thresholds remain
separate predicates. The original FAIL is not replaced by the later PASS.

## Downloaded evidence and independent results

Both repair-PR and exact-main runs succeeded in `Verify reference actual path`,
`Verify M5 resilience repository` and `Verify M6 single-node baseline`. Their five artifact groups
were downloaded and independently recomputed against each executed source, rather than accepted
from CI labels. Artifact names end in their exact executed SHA above; the following API artifact IDs
and exact-main SHA-256 digests bind the final observations.

| Artifact prefix | PR run `36919497533` ID | Main run `36920572790` ID | Main artifact SHA-256 |
| --- | --- | --- | --- |
| `reference-actual-` | `11190499465` | `11191796190` | `e4acbc525d5c7992fe66d89c25f7253b179bbd4b78f993c953a2eafea351637d` |
| `m4-lifecycle-` | `11191327884` | `11191801531` | `be50ac2b95f427b922027bc80ca290718e75b6657355429a674e9ed36822d537` |
| `m4-handle-clean-` | `11191552348` | `11191059868` | `23986d7d1533a62e8ef04907928adbde3506d74e0261d257e366c2797cc3ca58` |
| `m5-resilience-` | `11191033272` | `11191826532` | `b1e4bb7cee2ad52107147092797862c50ec921d2da74983ee01856c0c35535ec` |
| `m6-reproduction-` | `11190968385` | `11191414142` | `16309ea8b844c98bbd564decac0c65616b8e85247c019dc2faefd67a7606dd2c` |

The raw readers derive eighteen actual case families and five evidence mutations in both groups.
Missing worker facts yield INCONCLUSIVE; rehashed worker substitution, false cleanup,
self-declared qualification and a changed binary report yield FAIL. Complete M2 binary reports,
M3 starts, M4 pins, M5 plans, required association receipts, qualified operands and original owned
launches establish the actual continuity. UNKNOWN remains unchanged by valid late observations.
Independent after-exit observations find all 58 owned worker/probe processes stopped on exact main;
false cleanup remains an original failure followed by separate containment.

M4's eleven-scenario predecessor and 28 canonical cases with three mutations pass in public and
clean runs. M5's 35 coordinate cases, five durable fixtures and three mutations pass. M6's thirteen
phases and eight mutations retain the unchanged 16 GiB ACCEPT criteria and stopped Runtime processes.
The older 473-file M4 qualification archive was also independently recomputed. Frozen normative blobs,
the original qualified input archive and every earlier rejected candidate retain their original bytes.

Exact-main actual-path samples observed peak RSS of 288,538,624 bytes and minimum available memory
of 15,407,099,904 bytes. These sampled observations do not grant capacity or scheduling authority.
Strict main protection retains all three required contexts and no bypass actor. The raw reader's
`productizationQualified: false` remains appropriate: qualification follows this full protected
chain, predecessor gates and independent reconciliation, rather than a reader's standalone verdict.

## Closed scope and final authority

This qualification/publication closure covers one trusted local CPU assembly and a finite stateless
typed float32 affine reference path. The existing post-proof façade evaluation requires no Spring
or general API expansion. This record changes only the public status projection; it grants no new
runtime scope, production-readiness claim or general algorithm-platform authority. No facade, CLI,
API, tag, milestone, FlowKernel or VeriTrail integration follows from this closure.
