# IURS deployment instructions

This is a production-oriented Cloudflare Workers + D1 website. Preserve the existing public design/content and do not redesign it unless explicitly asked.

## Architecture
- Worker entry: `src/index.js`
- Static assets: `public/`
- Wrangler config: `wrangler.jsonc`
- Existing D1: `iurs-production`
- D1 binding: `DB`

## Current backend capabilities
Authentication, sessions, first-admin setup, password change, member/executive management, publication CRUD, event CRUD, notice CRUD, homepage statistics, and public APIs are implemented.

## Deployment requirement
Use Cloudflare Workers Builds / GitHub or GitLab integration, or Wrangler if available. Do NOT deploy this as a static-only upload.

## If an error occurs
Inspect the actual Worker build/runtime error and fix the project. Do not merely tell the user to run commands if the current environment can execute them.

## Security
`SETUP_TOKEN` is optional. If present, `/api/setup/initial-admin` requires it. If absent, the setup route is allowed only while the users table is empty and closes permanently after the first admin is created.

Do not place real passwords or tokens in source control.
