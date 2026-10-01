# Bounded Reference Path Implementation Review v1

Status: `ACTUAL PATH INPUTS QUALIFIED · SEPARATE QUALIFICATION PUBLICATION`

Protected PR #34, reviewed head `35fa5c342616b25026119717241ee7e0e55c8cb4`, and exact main
`b50495a12fbb32bbd06a8cff9c92e333cd395606` pass the actual-process gate, both predecessor jobs
and independently downloaded semantic readbacks. The [qualification record](reference-path-qualification-v1.md)
binds eighteen actual families, five evidence mutations, stopped owned processes and unchanged M6
acceptance. The first rejected candidates below remain original observations. Separate qualification
publication and its exact-main reconciliation do not imply a new runtime scope.

The first complete candidate was committed before verification at
`455bb0f123bc97dedd458ef3940349ba248f0d5a`. Its first local build failed at the two reference
composition call sites: M4 pin admission lacked the explicit pin ID, and the full plan had been
passed to M5's ID-only late API. The retained [first-failure record](../../evidence/reference-path/v1/local-candidates/455bb0f123bc-first-build/failure-record.json)
classifies this as `COMPOSITION_API_SIGNATURE_MISMATCH`; 176 original input/log files were archived
before repair at `643b232`. No product worker had started and no qualification was granted.
The minimal repair supplies a fresh pin ID and routes the already bound late observation through
`recordObservation(plan, ...)`, whose existing terminal path validates the full plan before recording
and ignoring the late observation. No module API or frozen semantic boundary changes.

The repaired candidate `fc43f60dfea5b835c9ece6650b43df226a5b8071` compiled, then rejected its first
launch before representative invocation or M4 admission. Windows venv `python.exe` was a redirector:
its Process PID differed from the actual CPython child's PID. The
[second retained failure](../../evidence/reference-path/v1/local-candidates/fc43f60dfea5-first-launch/failure-record.json)
and 199 original files were archived at `f1188532dcdc4cd675269cee0518b0117c8d184c` before repair.
A later direct OS read found that the worker's numeric PID had already been reused by a conhost
process; it was not a cleanup target. The original root-only shutdown record remains unchanged and
does not supply actual-worker identity authority.

The bounded repair selects the native CPython executable explicitly, passes `-S` and the freshly
installed private package directory, and uses that exact executable/environment for both independent
probe and worker. It checks actual imported module versions/origins and the selected construction
interpreter. Direct Process ownership and worker PID/birth association remain required; no descendant
adoption from a self-reported PID, new semantic coordinate or lifecycle state is introduced.

Candidate `2363a9436898002193e3190dbd25b7b4d50f2ff4` reached actual deadline continuation and
retained a late NumPy result, then rejected the internal association comparison. The
[third first-failure record](../../evidence/reference-path/v1/local-candidates/2363a9436898-first-late/failure-record.json)
retains 516 original files at `0bc47030e3123d873d3cbc52958e4db0781d5f5f`. Independently parsed
associations and the recorded metadata digest match; Jackson's in-memory Long/Float and reparsed
Int/Double node classes differ. The repair compares exact admitted metadata bytes, then the parsed
retained representation, while retaining full M2 coordinates, typed output and M5 plan validation.
UNKNOWN was not upgraded by the failed bridge. Native launch ownership and physical cleanup were retained.

The revised candidate exercises fractional float32 inputs, rejects an actual required-receipt filesystem
write failure before wire admission, and independently decodes the retained frozen protobuf report.
The reader joins the independent probe to its host-owned launch and checks private package origins.
A fifth hash-repaired binary-report mutation must fail despite a matching JSON projection. Cleanup
continues across owned processes if observation recording fails; unavailable observations still cannot
grant successful lifecycle release or product qualification.

Candidate `b46bfa9883ebc377dfbe0e7f6f97cb54aa261e5e` failed before its first product wire call:
the new receipt path used an opaque M5 attempt ID containing `/`. Its 209-file
[first dispatch failure](../../evidence/reference-path/v1/local-candidates/b46bfa9883eb-first-dispatch/failure-record.json)
was retained at `4e7c7ce744516bf6115d5b76a7852f85338884c0` before changing the filename to the
existing explicit M4 pin ID. M2/M5 identities are unchanged. The same retained record contains an
unchanged-source replay of repository verification: raw receipts without final newlines were treated
as authored source. Repository validation now distinguishes only byte/hash-verified ledger members
under the local-candidate archive from authored text formatting and locator-path rules; credential
checks, all module semantics and the M6 resource predicate remain intact. A dedicated retained-file
gate checks both current Git blobs and the first archive commit; full history is fetched only by
the new actual-path job so those checks remain independently executable on a fresh VM.

Candidate `ef7884f42c8c45720ed12ef219cb46c35c39124a` completed all eighteen actual journey families,
then the first independent reader rejected three source inputs. The two fixed requirements files
and frozen proto have exact CRLF-only checkout differences from their committed text blobs. The
[first reader rejection](../../evidence/reference-path/v1/local-candidates/ef7884f42c8c-first-reader/failure-record.json)
retains the unchanged raw construction bytes and Environment closure. The bounded correction permits
newline-only Git-blob reconstruction for those three explicit inputs; all normalized blobs must match
exactly. This does not replace raw-byte identity or erase the original reader failure, and the complete
driver run alone does not grant qualification.

The retained reader diagnostics also preserve an initially rejected sampling interpretation:
empty RSS frames occurred while the Java parent remained live, not only after exit. A direct
PowerShell reproduction returned valid resident stdout with exit code 1 when another requested
PID no longer existed. The sampler now retains stdout/stderr/status and parses valid partial output;
empty frames remain observation gaps and cannot be described as measured zero. The reader derives
resident sums and requires real positive samples. Negative candidates that never invoke may have
an empty M3 journal; every admitted qualification or product invocation still requires matching M3
Runtime-start coordinates. Supplemental readback derives all eighteen original journey families,
while preserving the first FAIL and granting no product qualification. Fresh candidate execution,
public clean CI and the unchanged M6 resource acceptance remain required.

The fresh local candidate `09c55ea49d63a39d4f1102507274f00e5213a970` passes all eighteen actual
families and five independently checked mutations, with all owned processes stopped. Its first
public run `36911817066` executes merge source `1580e04811b36a804252ceeea40673c402db5aaf` and all
three jobs pass. Independent download is nevertheless INCONCLUSIVE: upload-artifact omitted the
retained hidden `.gitattributes` member. The [original incomplete public bundle](../../evidence/reference-path/v1/public-candidates/09c55ea49d63-first-retention/retention.json)
retains 4,524 actual/mutation members and explicitly lists every absent member; no omitted bytes
were fabricated. The original archive is committed at `72275e39d1eed9abd867281ca979adc61b6e12e8`
before enabling hidden-file retention in the new actual-path upload only. Green runner-local
readback does not override this downloaded-artifact rejection or grant product qualification.

The separately frozen contract enters from protected main `bd8cd9eff99f70f642c98571ed2390650320f222`.
Its [runtime entry](../../evidence/reference-path/v1/runtime-entry/entry-manifest.json) binds PR #33,
exact-main gates and independent readbacks. Specification blob `4dab857362aa4362bd3c46c03a3a9e7135b70193`
and ADR blob `e0138b897829631e0cc04234bab4429dadab5e4d` remain immutable.

The concrete reference assembly reuses ArtifactRegistry/DeploymentManager, WorkerSupervisor,
ResilientInvocationManager and M2/M3's actual gRPC invocation and NumPy provider. Narrow retained-byte
factory/loading and outer metadata seams preserve the frozen M2 carrier and earlier owner meanings.
Environment values precede construction; a fresh interpreter and the actual worker separately report
their facts. Control compares them and an actual representative result before admitting M4 activation.
Every deployment owns a fresh launch. Cleanup targets the original Process reference and checks
physical cessation; returned handles cannot redirect it.

Under one composition lock the dispatch guard binds exact qualified operands, the outstanding M4
pin, retained M5 plan/policy, current instance/epoch/owned launch and generated M2 attempt/binding.
The captured endpoint receives that immutable outer association. Old pins can still execute after
cutover. Caller waiting, actual completion and M5 logical terminal decisions stay distinct. Validated
late success enters the original plan's late boundary without upgrading UNKNOWN or changing a new
instance. Rollback constructs and qualifies a new actual launch from the retained prior operands.

The serial journey has eighteen actual case families covering the contract's required rows plus
record failure, duplicate admission and changed-locator byte loading. Raw owner records, physically
separate child facts, frozen-wire reports, build/install inputs, resource samples and final independent
process observations feed a separate semantic reader. Hash-repaired substitution, false shutdown and
worker self-qualification must fail; a missing worker fact must be inconclusive. Their original raw
inputs are retained. None of these emitted labels grants product qualification.

The public fresh Ubuntu job disables dependency caches and builds from exact committed inputs.
Existing M1-M6 jobs, dependency versions, frozen predicates and first-failure archives remain intact.
Qualification still requires the actual gate, all predecessors, protected merge, exact-main replay
and independently downloaded raw readback. Local Windows runs are candidate diagnostics. Resource
samples are observations on the selected 14–18 GiB host class, alongside the unchanged M6 acceptance
predicate; they are not capacity, scheduling or resource-grant authority.

| Required record | First implementation round |
| --- | --- |
| Did | Composed the bounded actual path and independent semantic witness reader. |
| Why | Qualified local module guards did not establish deployment-to-worker-to-invocation continuity. |
| Original plan | Freeze B separately, then implement and qualify D/E/F without a parallel replacement framework. |
| Actual | First complete implementation candidate; execution and qualification have not run yet. |
| Failed premise | No implementation result is inferred from predecessor CI or contract publication. |
| Final state | Contract frozen; implementation candidate only; actual-path qualification pending. |
| Next authority | Commit this complete candidate before serial actual verification; preserve/classify the first failure before repair. |

The proof stays within one trusted local CPU assembly and a stateless typed affine workload. Durable
restart identity, multi-node execution, accelerators, untrusted-code isolation, a public registry or
AlgorithmSlot API, CLI/SPI expansion, Spring façade, resource grants and external Evidence/Verdict
authority are outside this slice. A larger semantic contradiction still requires STOP.
