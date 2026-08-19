# IURS Full-Stack — Claude/Cloudflare Ready

This package contains the current IURS website plus the Cloudflare Worker backend and D1 schema.

## Architecture
- Cloudflare Worker: `src/index.js`
- Static website: `public/`
- D1 migration: `db/migrations/0001_initial.sql`
- Worker config: `wrangler.jsonc`
- Auth: server-side sessions + PBKDF2 password hashing
- Roles: member, executive, admin

## Deployment
Use Claude Code with the connected Cloudflare MCP and follow `CLAUDE.md`.

Do NOT use the Cloudflare "Upload static files" uploader for the full-stack project. That uploader only updates static assets.

The existing `wrangler.jsonc` intentionally contains a placeholder D1 database ID. Claude should replace it with the real ID after creating/finding the D1 database.

## First login setup
After deployment, use `/setup.html` with the Cloudflare `SETUP_TOKEN` secret to create the first executive/admin account. The setup endpoint closes permanently after the first account exists.

## Frontend preservation
The `public/` directory is the current IURS master website. Preserve its design and content while making backend/deployment fixes.
