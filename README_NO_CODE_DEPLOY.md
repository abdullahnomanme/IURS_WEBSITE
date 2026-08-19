# IURS — No-Code Cloudflare Deployment

This package is a full Cloudflare Workers application. It includes the existing IURS public website plus a D1-backed member/executive system.

## Recommended deployment without code

Cloudflare's current dashboard supports deploying Workers from a connected GitHub/GitLab repository. It does **not** use the "Upload static files" screen for Worker source code.

1. Create a new private GitHub repository, e.g. `iurs-website`.
2. Extract this ZIP on your computer.
3. Upload the **contents of the extracted folder** to the GitHub repository (keep `src/`, `public/`, `wrangler.jsonc`, `package.json`, and `db/` at repository root).
4. Cloudflare Dashboard → Workers & Pages → Create application → Import repository.
5. Connect GitHub and select the repository.
6. Deploy. Cloudflare Workers Builds will run the Worker deployment from `wrangler.jsonc`.
7. The `wrangler.jsonc` already points to the existing D1 database `iurs-production`.
8. The Worker auto-checks/creates the application schema on its first request, so the extra management columns do not require a manual SQL command.
9. Optional security: Settings → Variables and Secrets → add `SETUP_TOKEN`. If you do not add it, the first-admin setup page works once while there are zero users, and closes permanently after the first account is created.
10. Open `/setup.html`, create the first administrator, then `/login.html`.

## Important

Do **not** use the Cloudflare "Upload static files" screen for this package. That screen is for static assets and will not deploy `src/index.js` as a Worker backend.

## Backend features

- Member/executive/admin login with server-side sessions
- PBKDF2 password hashing
- First-admin setup
- Password change
- Member/executive create, edit, suspend/inactivate, reset password
- Publication CRUD
- Separate peer-reviewed and conference-paper display
- Working-paper and under-review aggregate counters without exposing unpublished manuscripts
- Notice CRUD and publishing control
- Event CRUD and publishing control
- Event/notice cover-image URL and external-link fields
- Homepage live counters, notices and events from D1
- Mobile-responsive public and admin interfaces

## Existing D1

Database name: `iurs-production`
Database ID: `5880d1f4-b275-4ca0-b5db-ed33abb0dd09`

The existing database can be reused. Do not create a second production database unless you intentionally want a separate environment.
