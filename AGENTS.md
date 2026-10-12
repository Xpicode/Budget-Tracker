# AGENTS.md — Budget Tracker

Instructions for the AI IDE working in this repo. Read this file and `PLAN.md` before every task.

## Roles

- **Owner :** makes every decision. Approves each phase before the next one starts.
- **You (IDE agent):** auditor + implementer. Build exactly what the current phase asks, then audit your own work against that phase's "Done when".
- If something in `PLAN.md` is unclear, wrong, or conflicts with this file, **stop and ask**. Do not guess.

## Project

Offline-first budget/expense tracker, PERN stack, installed as a PWA on Android and Windows.
Stack: PostgreSQL 16 (Docker), Express (Node 24, ES modules), React (Vite), Dexie (IndexedDB), vite-plugin-pwa, bcryptjs + jsonwebtoken (httpOnly cookie), Zod, Recharts, Vitest + Supertest. JavaScript, not TypeScript.
Full spec, schema and phase steps: `PLAN.md`.

## How to work

1. Work on **one phase at a time**, in order (Phase 0 → 10). Never start the next phase on your own.
2. Before coding, post a short plan: files you will create/change and why.
3. After coding, report:
   - files changed, each with a 1–2 line explanation (keep it short and direct; the owner is learning from it),
   - commands to run,
   - the phase's "Done when" check and whether it passes.
4. Commit after each working step with a clear message (`phase-3: add transaction form validation`).
5. Then stop and wait for the owner's approval.

## Golden rules (never break these)

1. **Money = integer centavos** (`amount_cents`). ₱150.75 → 15075. `bigint` in Postgres, `number` in JS. No floats or `numeric` for money. Convert only for display via `client/src/money.js`.
2. **IDs = `crypto.randomUUID()` on the device.** No `serial`, no server-generated ids for synced tables.
3. **No hard deletes.** Set `deleted_at`; every list and total skips rows with `deleted_at`.
4. **All local writes go through `client/src/repo.js`** (`save`, `softDelete`), which set `updated_at` and `dirty = 1`. Components never call `db.<table>.put/update/delete` directly.
5. **Totals and balances are computed**, never stored.
6. **`txn_date` = `'YYYY-MM-DD'` local date.** Timestamps are ISO strings in UTC. In `server/src/db.js`, pg returns `date` as a string (parser 1082) and `bigint` as a number (parser 20).
7. **Same snake_case column names** in Postgres, IndexedDB and JSON. No camelCase mapping layer.
8. **The app must fully work offline.** No page may wait on the network; only `sync.js` and the auth pages call the API.
9. Sync rules are fixed (PLAN.md Phase 6): push dirty rows in batches of 100; the server upserts with `on conflict (id) do update ... where user_id matches and updated_at is newer`; pull by `server_updated_at` with a 5-second overlap; locally, keep a row only if it is dirty **and** newer.

## Security rules

- `user_id` always comes from the verified JWT (`req.userId`), never from the request body or query.
- Sync table names and columns come from a fixed whitelist in `server/src/sync.js`. Never build SQL from request keys. Always use parameterized queries (`$1, $2`).
- Validate every incoming row with Zod on the server, and keep the Postgres `check` constraints.
- JWT lives in an `httpOnly`, `sameSite: 'strict'` cookie (`secure` in production). Never put it in localStorage.
- Passwords: bcryptjs hash only. Never log passwords, hashes, tokens or `.env` values.
- `.env` is git-ignored. Never commit secrets.
- Logging out must not lose data: block or warn if any local row still has `dirty = 1`.

## Code rules

- Folder layout exactly as in `PLAN.md` → "Folder structure". Keep the file count small.
- Same-origin setup: Vite proxies `/api` in dev; Express serves `client/dist` in production. Do not add the `cors` package.
- Use native features first (`crypto.randomUUID`, `Intl.NumberFormat`, `fetch`, `Blob` downloads, Node `--env-file`). Ask before adding any dependency not listed in `PLAN.md`.
- Plain CSS (flex/grid + a 600 px media query). No UI framework unless the owner asks.
- Money math, reports, the merge rule, recurring catch-up and the sync endpoints each get tests (PLAN.md Phase 9).

## Never

- Never overwrite or revert code the owner edited by hand. If his changes conflict with your task, stop and ask.
- Never delete files or data without asking.
- Never change an existing table without a new numbered migration file; never edit an applied migration. For Dexie, bump `db.version(n)`.
- Never mark a phase done if its "Done when" check fails. Report what fails instead.
