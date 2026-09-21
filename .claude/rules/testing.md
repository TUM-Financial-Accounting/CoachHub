---
description: Vitest conventions and what is worth testing in this codebase.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "vitest.config.ts"
  - "src/test/**"
---

# Testing

Vitest + jsdom. Tests live **next to the code they cover** as `*.test.ts` — no
separate `__tests__` tree.

```bash
npm run test           # once
npm run test:watch
npm run test:coverage
```

`src/test/setup.ts` clears `localStorage` and `sessionStorage` around every
test. Rely on that instead of hand-clearing; do not remove it — several suites
would leak state into each other.

## What is covered today

Pure logic at the boundaries where a regression is expensive:

| File | Covers |
|---|---|
| `src/lib/data-mappers.test.ts` | `snake_case` ⇄ `camelCase`, both directions |
| `src/services/api-client.test.ts` | Headers, auth token, 204 bodies, error surfacing, 401 teardown |
| `src/lib/bootPrefetch.test.ts` | Parallel prefetch, single-consumer handover |
| `src/lib/lastSelection.test.ts` | Per-account season/team stash across logout → login |
| `src/lib/api-config.test.ts` | Base-URL resolution |
| `src/lib/utils.test.ts` | Class merging, timezone-safe date formatting |

## What is deliberately not covered

No React component/render tests, no context tests, no backend `pytest` suite, no
CI. Don't add a testing library or a CI config unless asked — that is a project
decision, not a side effect.

## Conventions

- `describe` per unit, `it('does X when Y')`.
- Mock `fetch` with `vi.fn()`; never hit a real network or database.
- Assert on **behaviour at the boundary** (what was sent, what came back), not
  on internals.
- When you add a field to a mapper, extend `data-mappers.test.ts` in the same
  change — that suite is the only guard against a field that maps one way.

## Where new tests pay off most

If asked to expand coverage, the highest-value targets are:

1. `owned_team_ids` / `require_owned_team` in `backend/main.py` — the isolation
   invariant has no automated guard at all.
2. Training-series scope semantics (`?scope=this|future`) — subtle and easy to
   regress.
3. `delete_team_cascade()` ordering.

All three are backend, and the backend has no test harness yet — so that starts
with adding `pytest` and a test database, which needs the user's sign-off.
