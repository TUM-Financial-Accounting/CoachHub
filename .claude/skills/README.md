# Skills — not used in this project (yet)

A skill is a **procedure** Claude loads on demand: a folder
`.claude/skills/<name>/SKILL.md` with `name` and `description` frontmatter, plus
any scripts or reference files it needs. Claude reads the descriptions at start
and pulls the full body into context only when the task matches — so a skill
costs almost nothing until it is used.

Skills are for **repeatable multi-step workflows**, especially ones that reach
outside the code (calling an external API, driving a browser, running a tool
with a specific incantation). That is the difference from `rules/`, which is
knowledge that applies passively while editing certain files.

| | `rules/` | `skills/` |
|---|---|---|
| Contains | facts and constraints | a step-by-step procedure |
| Loads | automatically, on matching file paths | when the task matches the description |
| Answers | "what must stay true here" | "how do I do this task" |

## Why this folder is empty

CoachHub has no external integrations to script, and its build/test commands are
two lines that already live in `CLAUDE.md`. Wrapping them in a skill would add
indirection without adding capability.

## The one candidate worth adding later

**`add-endpoint`** — adding an API endpoint here touches seven places in a fixed
order, and skipping any one of them fails silently:

1. `backend/models.py` — the column
2. `backend/main.py` `_ensure_columns()` — the `ADD COLUMN IF NOT EXISTS`
3. `backend/schemas.py` — Pydantic request/response
4. `backend/main.py` — the route, with the ownership filter
5. `src/types/models.ts` — the camelCase type
6. `src/lib/data-mappers.ts` — **both** `mapXFromApi` and `mapXToApi`
7. `src/services/<resource>-service.ts` — the method
8. `src/locales/en.ts` **and** `de.ts` — any new UI string

If that sequence starts getting done wrong or half-remembered, turn it into a
skill. Until then the `rules/` files cover each step where it matters.
