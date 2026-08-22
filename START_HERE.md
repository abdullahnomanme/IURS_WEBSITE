# IURS website — what was done, and what you need to do

Written for you, not for a programmer. Nothing here requires you to understand code.

---

## The short version

The website was broken in a way that would have shown a blank error page to every
visitor. That is fixed. The website now also has a working control panel, so you can
add notices, upload gallery photos, and manage members yourself without ever opening
a code file.

Everything is finished and tested on my side. **The only thing left is publishing it,
and that needs your Cloudflare login — which I do not have and should not have.**
It is one double-click. Instructions are in "What you need to do" below.

---

## The one serious problem that was found

A single missing comma in the website's main program file meant the whole site
answered every request with an error. Not the homepage only — everything. This is the
kind of fault that is invisible until a visitor tries to open the site.

It is fixed, and I added a safety net so it cannot happen again in the same way: if
any unexpected fault ever occurs in the program, visitors still see the normal website
page instead of an error screen. The site now degrades quietly instead of collapsing.

---

## Other things that were wrong, and are now fixed

**Security.** Four real problems, all closed:

- An executive committee member could reset the *administrator's* password and take
  over the account. Executives can now reset member passwords only.
- Web addresses typed into the control panel were not checked, so a malicious link
  could have been saved and run in a visitor's browser. All addresses are now validated.
- Another website could have submitted changes to yours in the background. Requests
  from other websites are now rejected.
- Login had no limit on wrong password attempts. It does now.

Accounts an administrator creates are forced to change their password on first login,
so you never need to know a member's permanent password.

**The database could take the public site down.** If the database was slow or
unavailable, the public pages went down with it. Now the pages fall back to their
built-in content and stay online. The database is only needed for the parts that
genuinely change.

**Broken page structure on 8 pages.** Search-engine information had been placed after
the end of the page instead of inside the header, which some browsers and Google
handle badly. All 12 pages were repaired and re-checked.

**Text too faint to read comfortably.** 73 places had grey text on white that failed
the standard readability threshold used for accessibility. All corrected to a slightly
darker grey. Nothing on the dark navy sections was touched, so the design still looks
the same — the text is just properly legible now.

**Keyboard users could not see where they were.** People who navigate with the Tab key
saw no indication of the focused link. There is now a clear outline.

**The gallery page had a duplicated stylesheet block.** Removed.

**The site was far heavier than it needed to be.** The website folder went from
11.4 MB to 3.0 MB — the same pictures, just stored efficiently, plus 12 files that were
byte-for-byte duplicates of each other. Pages load noticeably faster on mobile data.
No photo was lost and no image link is broken.

---

## What is new

**A control panel at `/admin.html`** where you can manage, without code:

- **Notices** — add, edit, publish or unpublish
- **Gallery photos** — drag and drop a photo, give it a title, caption and category,
  mark it as featured, choose its position
- **Training sessions** — add and edit
- **Events** — with a cover image and an optional external link
- **Publications** — peer-reviewed and conference papers are listed separately
- **Members and executives** — create, edit, deactivate, reset a password

Anything you unpublish disappears from the public site immediately. Anything you delete
stays deleted — it does not come back the next time the site restarts.

**Your existing content was imported, not replaced.** The 32 gallery photographs and
6 training sessions already on the site were read out of the existing pages and loaded
into the database exactly as they were, with their real titles and captions. I did not
invent a single publication, member, event, statistic or achievement.

**Homepage counters, notices and events now come from the database**, so they update
when you update them rather than needing a code change.

**Six sections that were previously fixed text are now yours to manage.**

- **Executive Committee** — you can keep several committees. One is marked *Current* and
  shows at the top of the page; every earlier committee is kept below it as an archive.
  Adding a new committee never erases the old one.
- **Alumni** — the same idea: current alumni and previous alumni, both preserved.
- **Publications** — four separate groups: peer-reviewed articles, conference and
  research papers, working papers, and papers under review. Peer-reviewed and conference
  papers stay in their own lists. The "working papers" and "under review" counters on the
  page are numbers you type, so you can state them honestly without inventing papers.
  The duplicate publication records that existed before were removed and the page now
  uses one single card design.
- **Blog** — write an article, save it as a draft while you work on it, publish when
  ready. Drafts are invisible to the public. The blog is completely separate from
  publications.
- **Join IURS** — a public application form at `/join.html`. Applications are stored
  privately and can only be read in the control panel; the public and ordinary members
  cannot see them at all. Each one can be marked pending, contacted, approved or
  rejected, with private notes. Basic abuse protection is built in: an invisible trap
  field for bots, a limit on how many applications one visitor can send in a day, and a
  block on submitting the same email address twice within a week.
- **Website assistant** — a small chat bubble in the corner of every public page. It
  answers *only* from your own database: your publications, events, training sessions,
  notices, current committee, alumni, blog posts and how to join. If it has no record of
  something it says "I do not have that information on the IURS website" and points the
  visitor at your email address. It cannot invent an award, a number, a date or a name.
  Nothing about it lives in the page code that visitors can read.

**Search engines.** The site now provides the two files Google looks for
(`robots.txt` and `sitemap.xml`), listing your 11 public pages and deliberately hiding
the login, setup and admin pages. Link previews on Facebook and WhatsApp will show the
correct title and picture.

**Photo uploads are checked properly.** An uploaded file is examined byte by byte and
rejected unless it really is an image, whatever the file is named. Maximum size 8 MB.

---

## What was tested

There are 287 automated checks covering the pages, the control panel, every security
boundary, and the deployment script itself. All 287 pass. Specifically confirmed:

- A visitor who is not logged in cannot read or change anything in the control panel
- A member cannot reach executive pages or admin pages
- An executive cannot reset the administrator's password and cannot deactivate accounts
- The public website stays online when the database is switched off entirely
- A photo you delete does not reappear
- An "Order" number you type is respected; leaving it blank leaves the item where it was
- Adding a new executive committee **keeps the old one as an archive** instead of erasing it
- Adding new alumni **does not delete the previous alumni**
- A blog post saved as a draft does not appear anywhere on the public site
- Membership applications cannot be read by the public, or by ordinary members
- The website assistant answers only from your database, and says "I do not have that
  information" rather than inventing an award, a number or a person
- The deployment script really does create your administrator account, force a password
  change, and then close the setup route permanently

---

## What you need to do

**Step 1 — install Node.js, once.** Go to https://nodejs.org and click the big **LTS**
button. Accept the defaults. This is a one-time thing.

**Step 2 — double-click `DEPLOY.bat` in this folder.**

That is the whole deployment. The script signs you in to Cloudflare in your browser,
connects your existing `iurs-production` database, creates the photo storage, updates
the database tables, publishes the site, **and creates your administrator account for
you.** You do not need to open the setup page and you do not need to type any command.

(`DEPLOY.bat` just runs `deploy.ps1` for you. It exists because Windows often refuses to
run PowerShell scripts when you right-click them. If you prefer, right-clicking
`deploy.ps1` → "Run with PowerShell" does exactly the same thing.
`README_NO_CODE_DEPLOY.md` also has a GitHub route that needs no terminal at all.)

**Step 3 — copy the temporary password it prints.** At the end the script shows:

| | |
|---|---|
| IURS ID | `IURS26` |
| Password | a strong random password, shown **once** |

That password is generated on your own computer at that moment. It is not written into
any file in this project, not stored in readable form anywhere, and not on GitHub — so
copy it before closing the window. The account is `Abdullah Al Noman`, `Office Secretary`,
with administrator rights.

**Step 4 — log in at `/login.html`.** Type `IURS26` in the **IURS ID** box (not an email
address) and the temporary password below it. The control panel then opens straight on
the **Security** tab with every other tab locked, and asks you to set your own password:
type the temporary one as "Current Password", choose a new one of at least 10 characters,
and the moment you save it the temporary password stops working and the whole dashboard
unlocks. All your existing content — 32 gallery photos, 33 executive committee members,
7 publications and 6 training sessions — is already there, ready to edit.

That is all. Steps 1–4 take about ten minutes, most of it waiting for the Node.js
installer.

If you ever run `deploy.ps1` again it will *not* create a second administrator and will
*not* change your password — it just republishes the site.

---

## Cloudflare pieces the site uses

Nothing here needs setting up by hand. `deploy.ps1` does all of it.

| What | Name | Already exists? |
|---|---|---|
| Database | `iurs-production` | Yes — your existing one, reused |
| Photo storage | `iurs-media` | Optional — only for drag-and-drop upload; `deploy.ps1` switches it on by itself if R2 is enabled on your account |
| Website files | the `public` folder | Yes |
| Assistant model | Cloudflare Workers AI | Switched on by `deploy.ps1` |
| Administrator account | `IURS26` | Created by `deploy.ps1` |

No password, API token or secret is stored anywhere in this project. If you ever put
this folder on GitHub, there is nothing sensitive in it.

**About photo storage (R2).** New Cloudflare accounts have R2 switched off, and that is
completely fine — the website does not need it. Every photo already on your site is a
normal file, and in the dashboard you can always add a photo by pasting its image path.
Drag-and-drop *upload* is the only thing R2 adds. If you want it, open the Cloudflare
dashboard once, turn on R2 (it has a free tier), and run `DEPLOY.bat` again — the script
detects it and enables upload automatically. You never edit any file to do this.

If Workers AI is ever unavailable on your plan, the assistant does not break — it simply
quotes your database directly instead of rephrasing it. Either way it cannot make
anything up.

---

## Three things I chose not to change, so you know they exist

**1. Two gallery entries show the same photograph.** `research-award` and
`research-fundamentals-workshop` were identical files with different titles. That is a
content question, not a bug — if you send me the correct second photo I will put it in,
or you can replace it yourself from the control panel.

**2. Some gallery photos look slightly soft.** A number of the originals are only
206×206 pixels but are displayed larger. No software can add detail that was never
captured. If you have the original camera files, upload them through the control panel
and they will sharpen up.

**3. The mobile layout uses several different breakpoints.** They were added over time
and are inconsistent, though they do not conflict with each other. Tidying them
properly needs someone looking at real phones and tablets while doing it — worth doing,
but not worth risking your working design blind.

---

## If something goes wrong later

Run `deploy.ps1` again. It is safe to repeat, it never deletes anything, and it
republishes the current files. If the site itself misbehaves, tell me what you see on
screen and I will find it.
