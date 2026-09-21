---
description: How data moves from the API into React — services, mappers, contexts, and the localStorage cache.
paths:
  - "src/services/**"
  - "src/lib/**"
  - "src/contexts/**"
  - "src/components/**"
---

# Frontend data flow

One direction, four layers. Do not skip one.

```
component  →  <Resource>Service  →  apiClient  →  fetch
                     ↓
              data-mappers.ts        (snake_case ⇄ camelCase)
                     ↓
              types/models.ts        (camelCase domain types)
```

## Services

One file per resource: `src/services/<resource>-service.ts`, exporting a plain
object of async methods (`PlayerService.getAll`, `.create`, `.update`,
`.delete`). Follow the shape of `player-service.ts`.

- **Components never call `fetch` or `apiClient` directly.** If a component
  needs data, the service gets a method.
- Services return **mapped domain types**, never raw API objects. `apiClient`
  is typed `<any>` at the call site and the mapper produces the real type:

```ts
const data = await apiClient.get<any[]>('/players');
return data.map(mapPlayerFromApi);
```

- Query params are built with `URLSearchParams` and appended only when present.

## Mappers

`src/lib/data-mappers.ts` is the **only** place case conversion happens. Every
field gets a fallback so the UI never sees `undefined`:

```ts
firstName: p.first_name || '',
isTrial: !!p.is_trial,
teams: p.teams || [],
```

Adding a field means editing **both** `mapXFromApi` and `mapXToApi`, plus the
type in `src/types/models.ts`. A field added to only one direction silently
disappears on save. `data-mappers.test.ts` covers round-tripping — extend it.

## apiClient

`src/services/api-client.ts` centralises what every request needs. Do not
reimplement any of it in a service:

- `credentials: 'include'` for the HttpOnly cookie, plus a `Bearer` header from
  `localStorage.access_token`
- 10-second `AbortController` timeout
- 204 / empty bodies → `undefined`
- Errors thrown as `Error(detail)` from the response body
- **401 handling**: clears auth + cache keys, stashes the active season/team via
  `saveLastSelection()`, and reloads — with a 5-second guard against reload
  loops. Leave this alone; it is subtle and tested.

## Contexts and the cache

`SeasonContext` and `TeamContext` are a hand-rolled cache — no TanStack Query.
The pattern in `SeasonContext.tsx`:

1. Seed `useState` synchronously from `localStorage` (`cache:seasons:v1`) so the
   first paint has real data.
2. `loading` starts `false` when the cache hit — a spinner only appears with
   nothing to show.
3. `refreshSeasons()` prefers a value handed over by `bootPrefetch`, otherwise
   calls the service, then rewrites the cache.

Consequences to respect:

- **Cache keys are versioned and never expire.** If you change the shape of a
  cached object, bump the key (`cache:seasons:v2`) or stale data from a previous
  build will be parsed as the new shape.
- **Every `localStorage` key lives in `src/lib/storageKeys.ts`.** A key that
  belongs to the signed-in account also goes in `SESSION_KEYS` there. Logout,
  the 401 path and the failed boot check all call `clearSession()`
  (`src/lib/session.ts`), which removes exactly that list. A key missing from it
  leaks the previous user's data to the next login on the same browser.
- All `localStorage` reads are wrapped in `try/catch` — private-mode browsers
  throw. Keep that.

`bootPrefetch` is **single-consumer**: `takeSeasons()` hands the promise over
once and returns `null` afterwards. Don't call it from two places.
