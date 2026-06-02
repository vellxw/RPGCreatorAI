# Phase 11 Mocked Provider Contract Test Suite

CP-063 / FRA-98 adds the offline provider contract suite used by normal
validation. The suite is deterministic and does not require network access,
provider credentials, paid APIs, project mutation, or native runtime support.

## Fixtures

`src/providers/mockProviderContract.ts` defines the required fixture set:

- `success`
- `malformed-response`
- `provider-error`
- `rate-limit`
- `timeout`
- `cancellation`

All fixtures target the local `offline-mock` provider and model. They contain
no API keys, provider base URLs, or live endpoint metadata.

## Serialization And Normalization

`src/providers/providerResponseNormalization.ts` provides:

- deterministic provider request serialization
- recursive redaction for secret-looking request input fields
- response normalization for success, malformed, provider-error, rate-limit,
  quota-exceeded, timeout, and cancellation outcomes
- structured failure metadata with retry guidance

The mock provider adapter uses these normalization helpers for fixture-driven
failures, so adapter tests and contract tests share one response shape.

## Provider Readiness

The contract suite covers disabled and missing-credential provider states. A
disabled provider or a provider with missing credentials is not considered
ready for execution; normal validation continues to use offline fixtures.

## Running Offline Validation

Focused contract command:

```powershell
npm test -- --run src/providers/__tests__/mockProviderContract.test.ts src/providers/__tests__/mockProviderAdapter.test.ts src/providers/__tests__/providerCostBudget.test.ts
```

Full frontend validation:

```powershell
npm run typecheck
npm test -- --run
npm run build
```

## Optional Live Diagnostics Boundary

Live provider diagnostics are not part of normal validation and were not run
for CP-063. Future live diagnostics must be explicit opt-in, must require
user-approved credentials configured outside project JSON, must redact secrets
from logs, and must never be required for `npm test`, build, native runtime
validation, or the Phase 11 gates.
