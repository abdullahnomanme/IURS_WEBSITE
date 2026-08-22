# IURS — Deployment reference

This package is a complete Cloudflare Workers application: the existing IURS public
website plus a D1-backed system for managing notices, events, publications, gallery
photos, training sessions and member accounts.

There are two ways to publish it. Both give the same result — pick one.

---

## Option A — one click from your own computer (fastest)

1. Install Node.js once from https://nodejs.org (click the **LTS** button).
2. Right-click `deploy.ps1` in this folder → **Run with PowerShell**.

The script installs the deployment tool, logs you in to Cloudflare in your browser,
checks the existing database, publishes the site, creates your administrator account
with a one-time temporary password, and prints your live address. Photo storage (R2)
is optional: if it is enabled on your account the script switches drag-and-drop upload
on by itself; if not, the site still deploys and works. It is safe to run again whenever
you change something.

If Windows blocks the script, open PowerShell in this folder and run:

```
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

---

## Option B — from GitHub, no terminal at all

Cloudflare deploys Workers from a connected GitHub/GitLab repository. It does **not**
use the "Upload static files" screen for Worker source code.

1. Create a new **private** GitHub repository, e.g. `iurs-website`.
2. Upload the **contents** of this folder to the repository, keeping `src/`, `public/`,
   `wrangler.jsonc`, `package.json` and `db/` at the repository root.
3. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Import repository**.
4. Connect GitHub, select the repository, deploy. Cloudflare Workers Builds reads
   `wrangler.jsonc` automatically. The project ships with R2 (photo storage) deactivated,
   so this deploy succeeds even on accounts where R2 is off.
5. *(Optional — only for drag-and-drop photo upload.)* Dashboard → **R2** → enable it →
   **Create bucket** named exactly `iurs-media`. Then, in `wrangler.jsonc`, delete the two
   `//` marks in front of the three `"r2_buckets"` lines and redeploy. Without this the
   site still works fully; you simply paste image paths instead of uploading.

> Do **not** use the "Upload static files" screen. It will not deploy `src/index.js`
> as a Worker backend.
>
> The GitHub route does not create your admin account for you. After the first deploy,
> open `/setup.html` once (see **First run** below). The `DEPLOY.bat` route in Option A
> does create the account automatically, so if you want it fully hands-off, use Option A.

---

## First run

Open `/setup.html` once and create the first administrator. The page then closes itself
permanently. Afterwards log in at `/login.html` and manage the site at `/admin.html`.

Optional extra lock: add a secret named `SETUP_TOKEN` (Settings → Variables and Secrets)
*before* first use, and the setup page will also require that token. If you do not add it,
the setup page is still safe — it only works while there are zero user accounts.

---

## Cloudflare resources this project uses

| Resource | Name | Binding | Purpose |
|---|---|---|---|
| D1 database | `iurs-production` (`5880d1f4-b275-4ca0-b5db-ed33abb0dd09`) | `DB` | All content and accounts |
| R2 bucket | `iurs-media` | `MEDIA` | Uploaded gallery photos — **optional**, deactivated by default; enable R2 and uncomment the `r2_buckets` block (or just run `DEPLOY.bat`) to switch on |
| Static assets | `./public` | `ASSETS` | The website pages |

Reuse the existing database. Do not create a second production database unless you
deliberately want a separate environment.

The database tables are created and checked automatically on the first request, so no
manual SQL command is needed.

---

## What the backend can do

- Member / executive / admin login with server-side sessions and PBKDF2 password hashing
- First-admin setup that closes itself permanently afterwards
- Forced password change on accounts created by an administrator
- Member and executive management: create, edit, deactivate, reset password
- Publication management, with peer-reviewed and conference papers shown separately
- Working-paper and under-review counters that never expose unpublished manuscripts
- Notice management with publish / unpublish control
- Event management with publish control, cover image and external link
- **Gallery management with drag-and-drop photo upload, categories and featured photos**
- **Training session management**
- Homepage live counters, notices and events read from D1
- `robots.txt` and `sitemap.xml` generated automatically for search engines
- Public pages keep working even if the database is unavailable

## Security boundaries enforced by the code

- Unauthenticated visitors cannot read or change any management data
- Members cannot reach executive or admin routes
- Executives can manage content and reset **member** passwords, but cannot reset an
  administrator's password and cannot deactivate accounts
- Requests from other websites are rejected (CSRF protection)
- Repeated failed logins are rate-limited
- Uploaded files are checked byte-by-byte and rejected unless they are real images
- No password or API token is stored anywhere in this project
