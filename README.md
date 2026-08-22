# IURS Full-Stack — Claude/Cloudflare Ready

This package contains the current IURS website plus the Cloudflare Worker backend and D1 schema.

## Architecture
- Cloudflare Worker: `src/index.js`
- Static website: `public/`
- D1 migration: `db/migrations/0001_initial.sql` (the Worker also creates any missing
  table and column idempotently on first request, so a forgotten migration cannot 500 the site)
- Worker config: `wrangler.jsonc`
- Auth: server-side sessions + PBKDF2-SHA256 password hashing
- Roles: member, executive, admin

## Bindings
| Binding | Kind | Target |
|---|---|---|
| `DB` | D1 | `iurs-production` (`5880d1f4-b275-4ca0-b5db-ed33abb0dd09`) |
| `ASSETS` | Static assets | `./public`, `run_worker_first: true` |
| `MEDIA` | R2 | `iurs-media` (optional; **binding deactivated by default** so deploy succeeds without R2 — `deploy.ps1` re-activates it when R2 is enabled; uploads otherwise degrade to pasted paths) |
| `AI` | Workers AI | website assistant (optional; degrades to quoting D1 directly) |

`run_worker_first` must stay the boolean `true`. Written as an array it silently stops
the Worker from seeing requests, which disables security headers, `/uploads/*`,
`robots.txt` and `sitemap.xml` with no error anywhere.

## Deployment
Run `deploy.ps1`, or connect the repository to Cloudflare Workers Builds. See
`README_NO_CODE_DEPLOY.md`.

Do NOT use the Cloudflare "Upload static files" uploader for the full-stack project. That uploader only updates static assets.

`wrangler.jsonc` already points at the real `iurs-production` database
(`5880d1f4-b275-4ca0-b5db-ed33abb0dd09`). Reuse it; do not create a second one.

## First administrator
`deploy.ps1` creates it automatically: it generates a 20-character random password on
the operator's machine, POSTs it once to `/api/setup/initial-admin` with
`mustChangePassword: true`, prints it to the console once, and never writes it to disk.

`/setup.html` remains available as a manual fallback. The endpoint refuses to run once
any account exists (409), so it closes permanently after the first administrator. A
`SETUP_TOKEN` secret is optional: if set, the endpoint additionally requires it.

## Website assistant
`/api/public/chat` retrieves matching rows from D1 first and only then asks Workers AI to
phrase them, with instructions that forbid adding anything. If retrieval finds nothing,
the endpoint returns a fixed "I do not have that information" reply rather than
substituting unrelated rows. There is deliberately no catch-all query in `chatFacts` —
adding one would let an off-topic question be answered with a list that looks like an
answer. No key or model call exists in frontend code.

## Tests
`outputs/verify.mjs` (270 assertions) and `outputs/verify-deploy.mjs` (14 assertions) run
the Worker against `node:sqlite`, i.e. a real SQL engine rather than mocks. Run with
`node verify.mjs` after copying `src/index.js` to `index.mjs`.

## Frontend preservation
The `public/` directory is the current IURS master website. Preserve its design and content while making backend/deployment fixes.
