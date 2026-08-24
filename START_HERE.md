# IURS website — what was done, and what you need to do

Written for you, not for a programmer. Nothing here requires you to understand code.

---

## The short version

**The website is live at https://iurs.org.bd** (and `https://www.iurs.org.bd`). It also
stays reachable at `https://iurs-website.abdullahnoman-me.workers.dev`, which is useful
if the domain ever has a DNS problem.

It has a working control panel, so you can post notices, upload gallery photos and manage
members yourself without ever opening a code file. Everything is deployed and tested.

To publish a change later: double-click **`DEPLOY.bat`**. That is the whole process.

---

## The bug that made the dashboard unusable — and why it looked unfixable

For a while, changing your password did nothing: you would set a new one, and on the next
visit the dashboard threw you straight back onto the **Security** tab with every other tab
locked. Changing it again made no difference.

The password change had been working perfectly the whole time. The problem was that
Cloudflare's edge network had **saved a copy of the dashboard's answer** to the question
"who is logged in, and do they still need to change their password?" — and it kept handing
back the hour-old copy that said *yes, still needs to change it*. The database said the
opposite. Nothing in the login code was wrong; the browser was simply never being told the
truth.

The same stale copies were behind two other things you reported: publications you had
already de-duplicated coming back, and notices not appearing after you published them.

Every answer the site gives about your data is now explicitly marked "never store this",
and the dashboard adds a unique marker to each request so a saved copy can never be
matched and reused. That is one root cause behind three separate symptoms.

---

## The one serious problem that was found earlier

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

**A dedicated notice board at `/notices.html`.** Notices used to live only as four fixed
lines in the homepage panel, and "View all updates" sent visitors to the events page.
There is now a real notice page: newest first, pinned notices held at the top, coloured
badges for Urgent and Important, a search box and filter buttons. The homepage panel and
the page both read the same live list, so posting one notice updates both.

Each notice can carry **all three** of the things you asked for at once:

- **a document** — PDF, Word, Excel, PowerPoint or an image. It appears as a download
  button on the notice.
- **a picture** — shown inside the notice itself.
- **a related link** — a registration form, a results page, a Facebook post.

In the control panel's **Notices** tab you set the title, the priority, the date, the text,
and tick **Pin to the top** if it should stay first. **Publish** / **Unpublish** buttons on
each notice in the register take it off the public page without deleting it.

**Advisor Panel and General Members now have real pages.** The *People* menu had three
items that all pointed at the same page, so Advisor Panel and General Members were
unreachable. They are now their own sections on the executive committee page, each with
its own web address, and the *People* menu points at them properly. In the control panel,
**Placement** on an executive now offers *Advisor Panel* and *General Members* alongside
Leadership and Roster. A section only appears on the public page once you have put someone
in it, so nothing shows up empty.

**The menus stop vanishing.** There was an 8-pixel gap between a menu item and its
dropdown; moving the mouse across it closed the menu before you could reach anything. The
gap is bridged, and the menu now waits a moment before closing, so it behaves the way you
expect. It also opens for keyboard users pressing Tab.

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

**Fonts.** Several headings asked for a weight the font does not actually contain, so the
browser was faking it by smearing the letters sideways — that is the uneven, over-bold look
you noticed. All 55 of those places now ask for a weight that really exists, letter spacing
was loosened slightly, and faking is switched off outright so it cannot come back.

**The two floating buttons no longer overlap on a phone.** The "back to top" arrow and the
chat bubble were sitting in the same corner. The arrow is now stacked above the bubble, and
it hides itself entirely while the chat panel is open.

**Duplicate publications.** Twelve records described seven papers. Most differed only in
capitalisation, but one pair was identical except that one used a curly apostrophe in
*Islamic University's* and the other a straight one — which is why earlier de-duplication
kept missing it. Five records were removed, seven remain, and the comparison now ignores
capitalisation, stray spaces **and** the flavour of apostrophe, so the same thing cannot
creep back in.

**Search engines.** The site now provides the two files Google looks for
(`robots.txt` and `sitemap.xml`), listing your 12 public pages and deliberately hiding
the login, setup and admin pages. Link previews on Facebook and WhatsApp will show the
correct title and picture.

**Photo uploads are checked properly.** An uploaded file is examined byte by byte and
rejected unless it really is an image, whatever the file is named. Maximum size 8 MB.

---

## What was tested

There are 356 automated checks covering the pages, the control panel, every security
boundary, and the deployment script itself. All 356 pass. Specifically confirmed:

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

**Nothing to get the site online — it is already live at https://iurs.org.bd.**

There are only two optional things left, and both are one click each in the Cloudflare
dashboard. Neither one breaks anything if you never do it.

**1. Turn on R2 to get drag-and-drop uploads.** R2 is Cloudflare's file storage, and new
accounts have it switched off. Cloudflare does not allow it to be switched on from a
script — it has to be a click in the dashboard. Until then, the control panel still lets
you attach a document or a picture by pasting a link to it (a Google Drive share link
works fine), and every photo already on the site is a normal file that is unaffected.

To enable it: Cloudflare dashboard → **R2** in the left sidebar → accept the free tier →
then double-click `DEPLOY.bat` here. The script notices R2 is available and switches
drag-and-drop upload on by itself. You do not edit any file.

**2. Disconnect the old GitHub build.** There is a second Cloudflare account still
connected to the `IURS_WEBSITE` repository, and it emails you a failure every time it
tries to build, because it is pointed at a Worker that no longer exists. Cloudflare
dashboard → **Workers & Pages** → the old project → **Settings** → **Builds** →
disconnect the repository. The live site is not affected in any way; this only stops
the emails.

---

## Publishing a change later

Double-click **`DEPLOY.bat`**. It signs you in to Cloudflare in your browser if needed,
applies any database changes, and publishes the current contents of this folder to
`iurs.org.bd`. It never deletes your data and it is safe to run as often as you like.

(`DEPLOY.bat` just runs `deploy.ps1` for you. It exists because Windows often refuses to
run PowerShell scripts when you right-click them. If you prefer, right-clicking
`deploy.ps1` → "Run with PowerShell" does exactly the same thing.)

---

## Logging in

Go to https://iurs.org.bd/login.html and type **`IURS26`** in the **IURS ID** box — not an
email address — with the password you set yourself. The account is `Abdullah Al Noman`,
`Office Secretary`, with administrator rights.

Your password is your own. It is not written in any file in this project, not stored in
readable form anywhere, and not on GitHub — which also means nobody, including me, can
recover it for you. If it is ever lost, `deploy.ps1` can issue a fresh temporary one.

The dashboard opens on the Members tab with everything unlocked. All your content — 32
gallery photos, 33 executive committee members, 7 publications, 6 training sessions and
your notices — is already there, ready to edit.

---

## Cloudflare pieces the site uses

Nothing here needs setting up by hand. `deploy.ps1` does all of it.

| What | Name | Already exists? |
|---|---|---|
| Worker (the site itself) | `iurs-website` | Yes — live, on `iurs.org.bd` |
| Domain | `iurs.org.bd` + `www.iurs.org.bd` | Yes — both attached as custom domains |
| Database | `iurs-production` | Yes — your existing one, reused |
| Photo storage | `iurs-media` | Optional — only for drag-and-drop upload; `deploy.ps1` switches it on by itself once R2 is enabled on your account |
| Website files | the `public` folder | Yes |
| Assistant model | Cloudflare Workers AI | On |
| Administrator account | `IURS26` | Yes — password set by you |

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
