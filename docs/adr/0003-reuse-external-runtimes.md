# ADR-0003: Reuse External Runtimes

Status: `ACCEPTED · M0`

## Context

Tensor engines, model formats, compilers, kernels, device libraries, and serving systems already represent large mature ecosystems. Rebuilding them would expand the project beyond its candidate contribution.

## Decision

JPyxis coordinates existing runtimes through capability ports. It does not implement a tensor engine, autograd, compiler IR, numerical kernel, CUDA library, or distributed collective stack in the single-node baseline.

## Consequences

- runtime-specific objects remain inside runtime plugins;
- model or graph artifacts should use established formats where suitable;
- the first runtime is selected for proof value and machine fit, not as a permanent dependency;
- direct DJL or ONNX Runtime integration is a control comparison, not merely a dependency option;
- if a direct integration satisfies the entire chosen problem, JPyxis narrows or stops.

## Validation

M3 must demonstrate that one host contract can execute through two conforming runtime fixtures without implementation-name branches in Core.
