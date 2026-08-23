/* IURS Worker verification harness.
   Uses node:sqlite so the Worker runs against a REAL SQL engine (not regex mocks),
   which is what caught the schema/tagged-template class of bug last time. */
import { DatabaseSync } from 'node:sqlite';
import worker from './index.mjs';

const db = new DatabaseSync(':memory:');
const norm = a => a.map(v => v === true ? 1 : v === false ? 0 : v === undefined ? null : v);

function prepare(sql) {
  let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async first() { return db.prepare(sql).all(...norm(args))[0] ?? null; },
    async all() { return { results: db.prepare(sql).all(...norm(args)) }; },
    async run() { db.prepare(sql).run(...norm(args)); return { success: true }; },
  };
  return api;
}

const r2 = new Map();
const env = {
  DB: { prepare, async batch(list) { const o = []; for (const s of list) o.push(await s.run()); return o; } },
  MEDIA: {
    async put(k, v, o) { r2.set(k, { body: v, meta: o?.httpMetadata || {} }); },
    async get(k) { const o = r2.get(k); return o ? { body: o.body, httpEtag: '"e"', writeHttpMetadata(h) { if (o.meta.contentType) h.set('content-type', o.meta.contentType); } } : null; },
    async delete(k) { r2.delete(k); },
  },
  ASSETS: { async fetch(rq) {
    const p = new URL(rq.url).pathname;
    const known = ['/', '/index.html', '/gallery.html', '/admin.html', '/assets/logo-iurs.webp'];
    if (!known.includes(p)) return new Response('Not found', { status: 404 });
    return new Response('<!doctype html><title>IURS</title>', { status: 200, headers: { 'content-type': 'text/html' } });
  } },
};

const ORIGIN = 'https://iurs.example.com';
let cookie = '';
function req(path, opt = {}) {
  const h = { Origin: ORIGIN, ...(opt.headers || {}) };
  if (opt.json !== undefined) { h['content-type'] = 'application/json'; opt.body = JSON.stringify(opt.json); }
  if (!opt.method || opt.method === 'GET' || opt.method === 'HEAD') delete opt.body;
  if (opt.cookie !== false && cookie) h.Cookie = cookie;
  return new Request(ORIGIN + path, { ...opt, headers: h });
}
const hit = async (path, opt) => {
  const r = await worker.fetch(req(path, opt), env, {});
  const sc = r.headers.get('set-cookie');
  if (sc && /iurs_session=/.test(sc)) cookie = sc.split(';')[0];
  let body = null;
  try { body = await r.clone().json(); } catch {}
  return { status: r.status, body, res: r };
};

let pass = 0, fail = 0; const fails = [];
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + label); }
  else { fail++; fails.push(label); console.log('  \x1b[31mFAIL\x1b[0m ' + label + (extra ? '  <- ' + extra : '')); }
}
const section = t => console.log('\n\x1b[1m' + t + '\x1b[0m');

/* ---------------------------------------------------------------- */
section('1. Public site stays up (the outage regression)');
let r = await hit('/');
check('GET / returns 200', r.status === 200, 'got ' + r.status);
check('GET / sets X-Content-Type-Options', r.res.headers.get('X-Content-Type-Options') === 'nosniff');
check('GET / sets X-Frame-Options', r.res.headers.get('X-Frame-Options') === 'SAMEORIGIN');
check('no tables exist yet => static page did not touch the DB',
  db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").all()[0].c === 0);

r = await hit('/api/health');
check('GET /api/health returns 200', r.status === 200, JSON.stringify(r.body));
check('schema was created on first API call',
  db.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table' AND name IN ('users','gallery_images','training_sessions')").all()[0].c === 3);

section('2. Seed content preserved, not invented');
const gcount = db.prepare('SELECT COUNT(*) c FROM gallery_images').all()[0].c;
const tcount = db.prepare('SELECT COUNT(*) c FROM training_sessions').all()[0].c;
check('32 gallery photos seeded from the original pages', gcount === 32, 'got ' + gcount);
check('6 training sessions seeded', tcount === 6, 'got ' + tcount);
check('5 photos marked featured', db.prepare('SELECT COUNT(*) c FROM gallery_images WHERE featured=1').all()[0].c === 5);
r = await hit('/api/public/gallery');
check('GET /api/public/gallery returns 32 rows', r.status === 200 && r.body.gallery.length === 32);
r = await hit('/api/public/training');
check('GET /api/public/training returns 6 rows', r.status === 200 && r.body.training.length === 6);

section('3. Unauthenticated users cannot read or modify admin data');
for (const [m, p] of [['GET', '/api/admin/members'], ['GET', '/api/admin/gallery'], ['POST', '/api/admin/gallery'],
                      ['PUT', '/api/admin/gallery/1'], ['DELETE', '/api/admin/gallery/1'], ['POST', '/api/admin/gallery/upload'],
                      ['GET', '/api/admin/training'], ['POST', '/api/admin/training'], ['DELETE', '/api/admin/training/1'],
                      ['POST', '/api/admin/notices'], ['PUT', '/api/admin/stats'], ['GET', '/api/admin/summary']]) {
  r = await hit(p, { method: m, json: {}, cookie: false });
  check(`${m} ${p} refused`, r.status === 403, 'got ' + r.status);
}

section('4. First-admin setup, then it closes permanently');
r = await hit('/api/setup/initial-admin', { method: 'POST', json: { iursId: 'IURS26', name: 'Abdullah Al Noman', position: 'Office Secretary', password: 'FirstAdminPass2026' } });
check('initial admin created', r.status === 200, JSON.stringify(r.body));
check('stored as admin role', db.prepare("SELECT role FROM users WHERE iurs_id='IURS26'").all()[0].role === 'admin');
check('password is hashed, never plaintext',
  !/FirstAdminPass2026/.test(db.prepare("SELECT password_hash h FROM users WHERE iurs_id='IURS26'").all()[0].h));
r = await hit('/api/setup/initial-admin', { method: 'POST', json: { iursId: 'IURS99', name: 'Intruder', position: 'x', password: 'AnotherPass12345' } });
check('setup route closed after first admin', r.status !== 200, 'got ' + r.status);

section('5. Login, CSRF and brute-force protection');
r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS26', password: 'wrongpass123' } });
check('wrong password rejected', r.status === 401);
r = await hit('/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example' }, json: { iursId: 'IURS26', password: 'FirstAdminPass2026' } });
check('cross-origin login blocked (CSRF)', r.status === 403);
r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS26', password: 'FirstAdminPass2026' } });
check('correct password logs in', r.status === 200, JSON.stringify(r.body));
check('session cookie is HttpOnly+Secure+SameSite=Strict',
  /HttpOnly/.test(r.res.headers.get('set-cookie') || '') && /Secure/.test(r.res.headers.get('set-cookie') || '') && /SameSite=Strict/.test(r.res.headers.get('set-cookie') || ''));
check('raw session token is not stored in the database',
  db.prepare('SELECT token_hash FROM sessions').all().every(s => !(cookie || '').includes(s.token_hash)));

section('6. Password change');
check('first admin chose their own password, so no forced change',
  db.prepare("SELECT must_change_password m FROM users WHERE iurs_id='IURS26'").all()[0].m === 0);
r = await hit('/api/admin/gallery');
check('admin can manage content immediately', r.status === 200, 'got ' + r.status);
r = await hit('/api/auth/change-password', { method: 'POST', json: { currentPassword: 'wrongpass', newPassword: 'RealAdminPass2026!' } });
check('change-password requires the current password', r.status === 400);
r = await hit('/api/auth/change-password', { method: 'POST', json: { currentPassword: 'FirstAdminPass2026', newPassword: 'short' } });
check('short new password rejected', r.status === 400);
r = await hit('/api/auth/change-password', { method: 'POST', json: { currentPassword: 'FirstAdminPass2026', newPassword: 'RealAdminPass2026!' } });
check('password change succeeds', r.status === 200, JSON.stringify(r.body));
check('other sessions were invalidated', db.prepare('SELECT COUNT(*) c FROM sessions').all()[0].c === 1);

section('7. Gallery management (the headline feature)');
r = await hit('/api/admin/gallery', { method: 'POST', json: { title: '', imageUrl: 'assets/x.jpg' } });
check('empty title rejected', r.status === 400);
r = await hit('/api/admin/gallery', { method: 'POST', json: { title: 'Bad', imageUrl: 'javascript:alert(1)' } });
check('javascript: image URL rejected (stored XSS)', r.status === 400, JSON.stringify(r.body));
r = await hit('/api/admin/gallery', { method: 'POST', json: { title: 'New Seminar Photo', caption: 'Added by admin', imageUrl: 'assets/research-seminar.webp', category: 'Research', published: true } });
check('photo added', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/gallery');
check('new photo visible publicly (33 now)', r.body.gallery.length === 33, 'got ' + r.body.gallery.length);
const added = db.prepare("SELECT id FROM gallery_images WHERE title='New Seminar Photo'").all()[0].id;
r = await hit('/api/admin/gallery/' + added, { method: 'PUT', json: { title: 'Renamed Photo', imageUrl: 'assets/research-seminar.webp', category: 'Research', published: false } });
check('photo edited', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/gallery');
check('unpublished photo hidden from public (back to 32)', r.body.gallery.length === 32, 'got ' + r.body.gallery.length);
r = await hit('/api/admin/gallery/' + added, { method: 'DELETE' });
check('photo deleted', r.status === 200);
check('delete really removed the row', db.prepare('SELECT COUNT(*) c FROM gallery_images').all()[0].c === 32);

// The admin form has an optional "Order" box. Blank must mean "leave it where it is",
// a number must be obeyed. Getting this wrong silently reshuffles the whole gallery.
const orderOf = t => db.prepare('SELECT sort_order s FROM gallery_images WHERE title=?').all(t)[0].s;
await hit('/api/admin/gallery', { method: 'POST', json: { title: 'Order Blank', imageUrl: 'assets/research-seminar.webp' } });
check('new photo with a blank Order box goes to the end', orderOf('Order Blank') === 32, 'got ' + orderOf('Order Blank'));
await hit('/api/admin/gallery', { method: 'POST', json: { title: 'Order Three', imageUrl: 'assets/research-seminar.webp', sortOrder: 3 } });
check('new photo keeps the Order number the admin typed', orderOf('Order Three') === 3, 'got ' + orderOf('Order Three'));
const blankId = db.prepare("SELECT id FROM gallery_images WHERE title='Order Blank'").all()[0].id;
await hit('/api/admin/gallery/' + blankId, { method: 'PUT', json: { title: 'Order Blank', imageUrl: 'assets/research-seminar.webp', sortOrder: '' } });
check('editing a photo without touching Order keeps its position', orderOf('Order Blank') === 32, 'got ' + orderOf('Order Blank'));
await hit('/api/admin/gallery/' + blankId, { method: 'PUT', json: { title: 'Order Blank', imageUrl: 'assets/research-seminar.webp', sortOrder: 7 } });
check('editing a photo with a new Order number moves it', orderOf('Order Blank') === 7, 'got ' + orderOf('Order Blank'));
for (const t of ['Order Blank', 'Order Three']) {
  const gid = db.prepare('SELECT id FROM gallery_images WHERE title=?').all(t)[0].id;
  await hit('/api/admin/gallery/' + gid, { method: 'DELETE' });
}
check('gallery back to the 32 real photos', db.prepare('SELECT COUNT(*) c FROM gallery_images').all()[0].c === 32);
await hit('/api/admin/training', { method: 'POST', json: { title: 'Order Test Session', sortOrder: 2 } });
check('new training session keeps the Order number too',
  db.prepare("SELECT sort_order s FROM training_sessions WHERE title='Order Test Session'").all()[0].s === 2);
const tid = db.prepare("SELECT id FROM training_sessions WHERE title='Order Test Session'").all()[0].id;
await hit('/api/admin/training/' + tid, { method: 'PUT', json: { title: 'Order Test Session', sortOrder: '' } });
check('editing a training session without touching Order keeps its position',
  db.prepare("SELECT sort_order s FROM training_sessions WHERE title='Order Test Session'").all()[0].s === 2);
await hit('/api/admin/training/' + tid, { method: 'DELETE' });
check('training back to the 6 real sessions', db.prepare('SELECT COUNT(*) c FROM training_sessions').all()[0].c === 6);

section('8. Photo upload to R2');
const png = new Uint8Array([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0,0,0,13,73,72,68,82]);
async function up(bytes, name, type) {
  const fd = new FormData();
  fd.append('file', new File([bytes], name, { type }));
  return await worker.fetch(new Request(ORIGIN + '/api/admin/gallery/upload', { method: 'POST', headers: { Origin: ORIGIN, Cookie: cookie }, body: fd }), env, {});
}
let up1 = await up(png, 'photo.png', 'image/png');
let d1 = await up1.clone().json();
check('valid PNG uploads', up1.status === 200 && /^\/uploads\/gallery\//.test(d1.url || ''), JSON.stringify(d1));
check('stored under a generated name, not the user filename', !String(d1.url).includes('photo.png'));
check('object really landed in R2', r2.size === 1);
r = await hit(d1.url);
check('uploaded photo is served back', r.status === 200 && r.res.headers.get('content-type') === 'image/png');
check('served with long-lived cache header', /max-age=31536000/.test(r.res.headers.get('cache-control') || ''));

const evil = new TextEncoder().encode('<?php system($_GET[0]); ?>');
up1 = await up(evil, 'shell.php', 'image/png');
check('a non-image lying about its type is rejected', up1.status === 415, 'got ' + up1.status);
up1 = await up(new Uint8Array(9 * 1024 * 1024), 'huge.png', 'image/png');
check('oversized upload rejected', up1.status === 413, 'got ' + up1.status);
for (const t of ['/uploads/../src/index.js', '/uploads/%2e%2e/src/index.js', '/uploads/..%2fsrc%2findex.js', '/uploads//etc/passwd']) {
  r = await hit(t);
  check('path traversal blocked: ' + t, r.status === 404, 'got ' + r.status);
}
r = await hit(d1.url, { method: 'DELETE' });
check('uploads are read-only (DELETE refused)', r.status === 405, 'got ' + r.status);
r = await hit('/uploads/gallery/nope.png');
check('missing upload returns 404 not 500', r.status === 404);

section('9. Training session management');
r = await hit('/api/admin/training', { method: 'POST', json: { title: '' } });
check('empty training title rejected', r.status === 400);
r = await hit('/api/admin/training', { method: 'POST', json: { title: 'Academic Writing Bootcamp', trainer: 'Dr Example', dateLabel: 'Starting soon' } });
check('training session added', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/training');
check('now 7 sessions public', r.body.training.length === 7, 'got ' + r.body.training.length);

section('10. Role boundaries: executive vs admin vs member');
await hit('/api/admin/members', { method: 'POST', json: { iursId: 'IURS-EXEC-1', name: 'Exec One', role: 'executive', position: 'Treasurer', password: 'ExecPassword2026' } });
await hit('/api/admin/members', { method: 'POST', json: { iursId: 'IURS-MEM-1', name: 'Member One', role: 'member', password: 'MemberPassword2026' } });
check('executive account created', db.prepare("SELECT COUNT(*) c FROM users WHERE iurs_id='IURS-EXEC-1'").all()[0].c === 1);
check('member account created', db.prepare("SELECT COUNT(*) c FROM users WHERE iurs_id='IURS-MEM-1'").all()[0].c === 1);
const adminCookie = cookie;
const adminId = db.prepare("SELECT id FROM users WHERE iurs_id='IURS26'").all()[0].id;

check('accounts created by an admin must change their temporary password',
  db.prepare("SELECT must_change_password m FROM users WHERE iurs_id='IURS-EXEC-1'").all()[0].m === 1);
db.prepare('DELETE FROM login_attempts').run();
cookie = '';
await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS-EXEC-1', password: 'ExecPassword2026' } });
r = await hit('/api/admin/gallery');
check('executive blocked from content until temp password is changed',
  r.status === 403 && r.body.code === 'must_change_password', 'got ' + r.status);
r = await hit('/api/auth/change-password', { method: 'POST', json: { currentPassword: 'ExecPassword2026', newPassword: 'ExecPassword2026' } });
check('executive changes their password', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/gallery');
check('executive unlocked after changing password', r.status === 200, 'got ' + r.status);

// log in as the member
db.prepare("UPDATE users SET must_change_password=0 WHERE iurs_id IN ('IURS-MEM-1','IURS-EXEC-1')").run();
db.prepare('DELETE FROM login_attempts').run();
cookie = '';
r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS-MEM-1', password: 'MemberPassword2026' } });
check('member can log in', r.status === 200, JSON.stringify(r.body));
for (const [m, p] of [['GET', '/api/admin/summary'], ['GET', '/api/admin/members'], ['GET', '/api/admin/gallery'],
                      ['POST', '/api/admin/gallery'], ['DELETE', '/api/admin/gallery/1'], ['POST', '/api/admin/gallery/upload'],
                      ['POST', '/api/admin/training'], ['POST', '/api/admin/notices'], ['PUT', '/api/admin/stats'],
                      // the six new CMS sections must be just as closed to ordinary members
                      ['GET', '/api/admin/committee-sessions'], ['POST', '/api/admin/committee-sessions'],
                      ['GET', '/api/admin/executives'], ['POST', '/api/admin/executives'], ['DELETE', '/api/admin/executives/1'],
                      ['GET', '/api/admin/alumni'], ['POST', '/api/admin/alumni'], ['DELETE', '/api/admin/alumni/1'],
                      ['GET', '/api/admin/blog'], ['POST', '/api/admin/blog'], ['DELETE', '/api/admin/blog/1'],
                      ['GET', '/api/admin/applications'], ['PUT', '/api/admin/applications/1'],
                      ['GET', '/api/admin/publications'], ['POST', '/api/admin/publications']]) {
  r = await hit(p, { method: m, json: {} });
  check(`member blocked from ${m} ${p}`, r.status === 403, 'got ' + r.status);
}

// log in as the executive
db.prepare('DELETE FROM login_attempts').run();
cookie = '';
r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS-EXEC-1', password: 'ExecPassword2026' } });
check('executive can log in', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/gallery');
check('executive CAN manage the gallery', r.status === 200, 'got ' + r.status);
r = await hit(`/api/admin/members/${adminId}/reset-password`, { method: 'POST', json: { password: 'HijackedPass2026' } });
check('executive CANNOT reset the admin password (privilege escalation)', r.status === 403, 'got ' + r.status);
check("admin's password was not changed",
  db.prepare('SELECT must_change_password m FROM users WHERE id=?').all(adminId)[0].m === 0);
const memId = db.prepare("SELECT id FROM users WHERE iurs_id='IURS-MEM-1'").all()[0].id;
r = await hit(`/api/admin/members/${memId}`, { method: 'DELETE' });
check('executive CANNOT deactivate accounts (admin only)', r.status === 403, 'got ' + r.status);
r = await hit(`/api/admin/members/${memId}/reset-password`, { method: 'POST', json: { password: 'NewMemberPass2026' } });
check('executive CAN reset a member password', r.status === 200, JSON.stringify(r.body));

section('11. CSRF on every mutating admin route');
cookie = adminCookie;
for (const [m, p] of [['POST', '/api/admin/gallery'], ['PUT', '/api/admin/gallery/1'], ['DELETE', '/api/admin/gallery/1'],
                      ['POST', '/api/admin/training'], ['POST', '/api/admin/notices'], ['PUT', '/api/admin/stats'],
                      ['POST', '/api/admin/committee-sessions'], ['POST', '/api/admin/executives'],
                      ['POST', '/api/admin/alumni'], ['POST', '/api/admin/blog'],
                      ['POST', '/api/admin/publications'], ['PUT', '/api/admin/applications/1']]) {
  r = await hit(p, { method: m, headers: { Origin: 'https://evil.example' }, json: {} });
  check(`cross-origin ${m} ${p} blocked`, r.status === 403, 'got ' + r.status);
}

section('12. Database failure must not take the public site down');
const broken = { ...env, DB: { prepare() { throw new Error('D1 is unavailable'); }, batch() { throw new Error('D1 is unavailable'); } } };
r = await worker.fetch(new Request(ORIGIN + '/'), broken, {});
check('homepage still 200 while the database is down', r.status === 200, 'got ' + r.status);
r = await worker.fetch(new Request(ORIGIN + '/api/public/gallery'), broken, {});
check('API fails cleanly with 500, no crash', r.status === 500);
check('error message leaks no internals', !/D1 is unavailable/.test(JSON.stringify(await r.json())));

section('13. Search engines, social previews and page metadata');
r = await hit('/robots.txt');
check('robots.txt is served', r.status === 200);
let rt = await r.res.text();
check('robots.txt keeps admin pages out of search', /Disallow: \/admin\.html/.test(rt) && /Disallow: \/api\//.test(rt));
check('robots.txt points at the sitemap on the real hostname', rt.includes(ORIGIN + '/sitemap.xml'));
r = await hit('/sitemap.xml');
const sm = await r.res.text();
check('sitemap.xml is served as XML', r.status === 200 && (r.res.headers.get('content-type') || '').includes('xml'));
check('sitemap lists all 11 public pages', (sm.match(/<url>/g) || []).length === 11, 'got ' + (sm.match(/<url>/g) || []).length);
check('sitemap includes the three new public pages',
  ['/blog.html', '/alumni.html', '/join.html'].every(p => sm.includes('<loc>' + ORIGIN + p + '</loc>')), sm.slice(0, 300));
check('sitemap uses the real hostname, no invented domain', sm.includes('<loc>' + ORIGIN + '/</loc>') && !/example\.org|yourdomain|TODO/.test(sm));
check('sitemap hides the admin and login pages', !/admin\.html|login\.html|setup\.html|dashboard\.html/.test(sm));
r = await hit('/');
check('HTML still served normally where HTMLRewriter is unavailable', r.status === 200 && (await r.res.text()).includes('IURS'));

r = await worker.fetch(new Request(ORIGIN + '/gallery.html'), { ...env, DB: null, MEDIA: null }, {});
check('gallery page still loads even with no database binding at all', r.status === 200, 'got ' + r.status);
r = await worker.fetch(new Request(ORIGIN + '/'), { ASSETS: env.ASSETS }, {});
check('homepage survives a completely broken environment', r.status === 200, 'got ' + r.status);


/* ================================================================
   NEW CMS FEATURES. Everything below runs as the administrator
   unless a test explicitly logs in as somebody else.
   ================================================================ */
cookie = adminCookie;

section('14. Executive committee: terms, current/previous, archive preservation');
r = await hit('/api/admin/committee-sessions');
check('committee sessions listed for the dashboard', r.status === 200 && Array.isArray(r.body.sessions) && r.body.sessions.length >= 1, JSON.stringify(r.body).slice(0, 160));
const seededSession = r.body.sessions.find(s => s.is_current === 1);
check('one term is marked as the current committee', !!seededSession, JSON.stringify(r.body.sessions));
check('each term reports how many people are in it', typeof seededSession.member_count === 'number' && seededSession.member_count > 0, 'got ' + seededSession.member_count);
const seededCount = seededSession.member_count;
const seededLabel = seededSession.label;

r = await hit('/api/admin/committee-sessions', { method: 'POST', json: { label: '2026-2027', description: 'Executive committee for the 2026-2027 session.' } });
check('a new committee term can be created', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/committee-sessions', { method: 'POST', json: { label: '2026-2027' } });
check('duplicate term labels are refused', r.status === 400 || r.status === 409, 'got ' + r.status);
r = await hit('/api/admin/committee-sessions', { method: 'POST', json: { description: 'no label' } });
check('a term without a label is refused', r.status === 400, 'got ' + r.status);
const newSessionId = db.prepare("SELECT id FROM committee_sessions WHERE label='2026-2027'").all()[0].id;

r = await hit('/api/admin/executives', { method: 'POST', json: { sessionId: newSessionId, name: 'New President', designation: 'President', department: 'Law', tier: 'leadership', slNo: 1 } });
check('a person can be added to the new term', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/executives', { method: 'POST', json: { sessionId: newSessionId, name: 'New Member', designation: 'Executive Member', department: 'Physics', tier: 'roster', slNo: 2 } });
check('a roster member can be added to the new term', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/executives', { method: 'POST', json: { sessionId: newSessionId, designation: 'Nameless' } });
check('an executive without a name is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/admin/executives', { method: 'POST', json: { sessionId: 999999, name: 'Ghost', designation: 'Ghost' } });
check('an executive cannot be filed under a term that does not exist', r.status === 400 || r.status === 404, 'got ' + r.status);

r = await hit('/api/admin/executives?session=' + newSessionId);
check('the dashboard can list one term at a time', r.status === 200 && r.body.executives.length === 2, 'got ' + JSON.stringify(r.body.executives || []).slice(0, 120));

r = await hit('/api/admin/committee-sessions/' + newSessionId + '/current', { method: 'POST' });
check('the new term can be set as the current committee', r.status === 200, JSON.stringify(r.body));
check('exactly one term is current at any time',
  db.prepare('SELECT COUNT(*) c FROM committee_sessions WHERE is_current=1').all()[0].c === 1);

r = await hit('/api/public/committee');
check('the public page now shows the new committee', r.body.current && r.body.current.label === '2026-2027', JSON.stringify(r.body.current && r.body.current.label));
check('the new leadership appears in the leadership grid', r.body.current.leadership.length === 1 && r.body.current.leadership[0].name === 'New President');
check('the new roster appears in the members table', r.body.current.roster.length === 1 && r.body.current.roster[0].name === 'New Member');
const archived = (r.body.archive || []).find(s => s.label === seededLabel);
check('the previous committee is kept as an archive, not deleted', !!archived, JSON.stringify((r.body.archive || []).map(s => s.label)));
check('every person in the archived committee is preserved',
  archived && (archived.leadership.length + archived.roster.length) === seededCount,
  'expected ' + seededCount + ', got ' + (archived ? archived.leadership.length + archived.roster.length : 'none'));
check('the archived committee is not flagged as current', archived && archived.isCurrent === false);

const newPresId = db.prepare("SELECT id FROM executives WHERE name='New President'").all()[0].id;
r = await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { name: 'New President', designation: 'General Secretary', department: 'Law', tier: 'leadership', photoUrl: 'assets/research-seminar.webp', slNo: 1 } });
check('a designation and photo can be edited', r.status === 200, JSON.stringify(r.body));
check('the edited designation is stored',
  db.prepare('SELECT designation d FROM executives WHERE id=?').all(newPresId)[0].d === 'General Secretary');
check('the photo is stored', db.prepare('SELECT photo_url u FROM executives WHERE id=?').all(newPresId)[0].u === 'assets/research-seminar.webp');
r = await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { name: 'New President', designation: 'General Secretary', tier: 'leadership', photoUrl: 'javascript:alert(1)' } });
check('a dangerous photo link is stripped, not stored',
  !/javascript/i.test(String(db.prepare('SELECT photo_url u FROM executives WHERE id=?').all(newPresId)[0].u || '')));

const oldSessionId = db.prepare('SELECT id FROM committee_sessions WHERE label=?').all(seededLabel)[0].id;
r = await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { sessionId: oldSessionId, name: 'New President', designation: 'General Secretary', tier: 'leadership' } });
check('a person can be moved to a different committee term', r.status === 200, JSON.stringify(r.body));
check('the move is stored', db.prepare('SELECT session_id s FROM executives WHERE id=?').all(newPresId)[0].s === oldSessionId);
await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { sessionId: newSessionId, name: 'New President', designation: 'President', tier: 'leadership' } });
check('and can be moved back', db.prepare('SELECT session_id s FROM executives WHERE id=?').all(newPresId)[0].s === newSessionId);

await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { name: 'New President', designation: 'President', tier: 'leadership', status: 'inactive' } });
r = await hit('/api/public/committee');
check('an inactive person is hidden from the public page', r.body.current.leadership.length === 0, JSON.stringify(r.body.current.leadership));
await hit('/api/admin/executives/' + newPresId, { method: 'PUT', json: { name: 'New President', designation: 'President', tier: 'leadership', status: 'active' } });
r = await hit('/api/public/committee');
check('and reappears when set active again', r.body.current.leadership.length === 1);

r = await hit('/api/admin/committee-sessions/' + newSessionId, { method: 'DELETE' });
check('the CURRENT committee cannot be deleted by accident', r.status === 400 || r.status === 409, 'got ' + r.status);
check('the current committee is still there', db.prepare('SELECT COUNT(*) c FROM committee_sessions WHERE id=?').all(newSessionId)[0].c === 1);

r = await hit('/api/admin/committee-sessions/' + newSessionId, { method: 'PUT', json: { label: '2026-2027', description: 'Updated description.' } });
check('a term description can be edited', r.status === 200 &&
  db.prepare('SELECT description d FROM committee_sessions WHERE id=?').all(newSessionId)[0].d === 'Updated description.');

section('15. Alumni: current list, previous archive, nothing overwritten');
r = await hit('/api/admin/alumni');
check('alumni list loads in the dashboard', r.status === 200 && Array.isArray(r.body.alumni), JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/admin/alumni', { method: 'POST', json: { name: 'Alumnus One', sessionLabel: '2018-2019', department: 'Economics', graduationYear: '2022', occupation: 'Research Assistant', organization: 'BIDS', bio: 'Works on labour economics.' } });
check('an alumnus can be added', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/alumni', { method: 'POST', json: { name: 'Alumnus Old', standing: 'previous', graduationYear: '2015' } });
check('a previous alumnus can be added', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/admin/alumni', { method: 'POST', json: { department: 'No name' } });
check('an alumnus without a name is refused', r.status === 400, 'got ' + r.status);

r = await hit('/api/public/alumni');
check('current alumni show in the CURRENT ALUMNI list', (r.body.current || []).some(a => a.name === 'Alumnus One'), JSON.stringify(r.body.current));
check('previous alumni show in the ARCHIVE list', (r.body.previous || []).some(a => a.name === 'Alumnus Old'));
check('the two lists are kept separate', !(r.body.current || []).some(a => a.name === 'Alumnus Old'));

// The brief is explicit: adding new alumni must never remove the previous ones.
const previousBefore = db.prepare("SELECT COUNT(*) c FROM alumni WHERE standing='previous'").all()[0].c;
await hit('/api/admin/alumni', { method: 'POST', json: { name: 'Alumnus Two', graduationYear: '2024' } });
await hit('/api/admin/alumni', { method: 'POST', json: { name: 'Alumnus Three', graduationYear: '2025' } });
check('adding new alumni does NOT delete the previous alumni',
  db.prepare("SELECT COUNT(*) c FROM alumni WHERE standing='previous'").all()[0].c === previousBefore,
  'was ' + previousBefore + ', now ' + db.prepare("SELECT COUNT(*) c FROM alumni WHERE standing='previous'").all()[0].c);

const aOneId = db.prepare("SELECT id FROM alumni WHERE name='Alumnus One'").all()[0].id;
r = await hit('/api/admin/alumni/' + aOneId, { method: 'PUT', json: { name: 'Alumnus One', standing: 'previous', graduationYear: '2022' } });
check('an alumnus can be moved into the previous archive', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/alumni');
check('the move is reflected on the public page',
  (r.body.previous || []).some(a => a.name === 'Alumnus One') && !(r.body.current || []).some(a => a.name === 'Alumnus One'));

await hit('/api/admin/alumni/' + aOneId, { method: 'PUT', json: { name: 'Alumnus One', standing: 'previous', published: false } });
r = await hit('/api/public/alumni');
check('an unpublished alumnus is hidden from the public page',
  !(r.body.previous || []).some(a => a.name === 'Alumnus One') && !(r.body.current || []).some(a => a.name === 'Alumnus One'));

const aTwoId = db.prepare("SELECT id FROM alumni WHERE name='Alumnus Two'").all()[0].id;
r = await hit('/api/admin/alumni/' + aTwoId, { method: 'DELETE' });
check('an alumnus can be deleted', r.status === 200 && db.prepare('SELECT COUNT(*) c FROM alumni WHERE id=?').all(aTwoId)[0].c === 0);

section('16. Publications: four categories, no duplicates, editable counts');
r = await hit('/api/admin/publications');
check('publications list loads in the dashboard', r.status === 200 && Array.isArray(r.body.publications), JSON.stringify(r.body).slice(0, 120));
check('the dashboard is told the four valid categories',
  JSON.stringify(r.body.categories) === JSON.stringify(['peer_reviewed', 'conference', 'working_paper', 'under_review']),
  JSON.stringify(r.body.categories));
const seedTitles = r.body.publications.map(x => String(x.title).trim().toLowerCase());
check('the publication register contains no duplicate records',
  new Set(seedTitles).size === seedTitles.length,
  'duplicates: ' + seedTitles.filter((x, i) => seedTitles.indexOf(x) !== i).join(' | '));
const seedPubCount = r.body.publications.length;

for (const [cat, title] of [['peer_reviewed', 'Test Peer Reviewed Article'], ['conference', 'Test Conference Paper'],
                            ['working_paper', 'Test Working Paper'], ['under_review', 'Test Manuscript Under Review']]) {
  r = await hit('/api/admin/publications', { method: 'POST', json: { title, authors: 'Test Author', category: cat, year: 2026, journal: 'Test Journal' } });
  check('a ' + cat.replace('_', ' ') + ' can be added', r.status === 200, JSON.stringify(r.body));
}
r = await hit('/api/admin/publications', { method: 'POST', json: { title: 'No Category', authors: 'Someone', category: 'research_paper' } });
check('an invalid publication category is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/admin/publications', { method: 'POST', json: { title: 'No Authors', category: 'peer_reviewed' } });
check('a publication without authors is refused', r.status === 400, 'got ' + r.status);

r = await hit('/api/public/publications');
check('peer-reviewed articles are returned as their own group', r.body.peerReviewed.some(x => x.title === 'Test Peer Reviewed Article'));
check('conference papers are returned as their own group', r.body.conference.some(x => x.title === 'Test Conference Paper'));
check('peer-reviewed and conference papers are NOT mixed together',
  !r.body.peerReviewed.some(x => x.category === 'conference') && !r.body.conference.some(x => x.category === 'peer_reviewed'));
check('working papers are returned separately', r.body.workingPapers.some(x => x.title === 'Test Working Paper'));
check('manuscripts under review are returned separately', r.body.underReview.some(x => x.title === 'Test Manuscript Under Review'));
check('all four groups add up to the full register', r.body.publications.length === seedPubCount + 4,
  'got ' + r.body.publications.length + ', expected ' + (seedPubCount + 4));

const testPubId = db.prepare("SELECT id FROM publications WHERE title='Test Working Paper'").all()[0].id;
r = await hit('/api/admin/publications/' + testPubId, { method: 'PUT', json: { title: 'Test Working Paper', authors: 'Test Author', category: 'peer_reviewed', year: 2026, featured: true } });
check('a publication can be re-categorised', r.status === 200 &&
  db.prepare('SELECT category c FROM publications WHERE id=?').all(testPubId)[0].c === 'peer_reviewed');
check('a publication can be featured', db.prepare('SELECT featured f FROM publications WHERE id=?').all(testPubId)[0].f === 1);
r = await hit('/api/admin/publications/999999', { method: 'PUT', json: { title: 'Ghost', authors: 'Ghost', category: 'peer_reviewed' } });
check('editing a publication that does not exist returns a clear 404', r.status === 404, 'got ' + r.status);
r = await hit('/api/admin/publications/' + testPubId, { method: 'DELETE' });
check('a publication can be deleted', r.status === 200 && db.prepare('SELECT COUNT(*) c FROM publications WHERE id=?').all(testPubId)[0].c === 0);

// Working-paper and under-review headline figures are administrator-set counters,
// so the site never has to invent papers to make a number look bigger.
r = await hit('/api/admin/stats', { method: 'PUT', json: { working_papers: '12+', under_review: '4+' } });
check('the working-paper and under-review counts are editable', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/stats');
check('the edited working-paper count is published', r.body.working_papers.value === '12+', JSON.stringify(r.body.working_papers));
check('the edited under-review count is published', r.body.under_review.value === '4+');

section('17. Blog: drafts stay private, published articles go live');
r = await hit('/api/admin/blog');
check('blog list loads in the dashboard', r.status === 200 && Array.isArray(r.body.posts), JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/admin/blog', { method: 'POST', json: { title: 'Draft Article', author: 'Abdullah Al Noman', excerpt: 'Not ready yet.', content: 'Draft body.', status: 'draft' } });
check('a draft article can be saved', r.status === 200 && r.body.slug === 'draft-article', JSON.stringify(r.body));
const draftSlug = r.body.slug;
r = await hit('/api/admin/blog', { method: 'POST', json: { title: 'Published Article', author: 'IURS', category: 'Research Notes', excerpt: 'A short summary.', content: 'First paragraph.\n\nSecond paragraph.', status: 'published', postDate: '2026-08-01' } });
check('an article can be published straight away', r.status === 200, JSON.stringify(r.body));
const liveSlug = r.body.slug;
r = await hit('/api/admin/blog', { method: 'POST', json: { title: 'Published Article' } });
check('a repeated title still gets its own unique web address', r.status === 200 && r.body.slug !== liveSlug, JSON.stringify(r.body));
const dupSlug = r.body.slug;
r = await hit('/api/admin/blog', { method: 'POST', json: { author: 'No title' } });
check('an article without a title is refused', r.status === 400, 'got ' + r.status);

r = await hit('/api/public/blog');
check('the published article appears on the public blog', r.body.posts.some(x => x.slug === liveSlug), JSON.stringify(r.body.posts.map(x => x.slug)));
check('the draft does NOT appear on the public blog', !r.body.posts.some(x => x.slug === draftSlug));
check('the public list carries no draft content at all', !JSON.stringify(r.body).includes('Not ready yet'));
r = await hit('/api/public/blog/' + liveSlug);
check('a published article can be opened by its web address', r.status === 200 && r.body.post.title === 'Published Article', JSON.stringify(r.body).slice(0, 120));
check('the article body is returned for the reader', /Second paragraph/.test(r.body.post.content || ''));
r = await hit('/api/public/blog/' + draftSlug);
check('a draft cannot be reached by guessing its address', r.status === 404, 'got ' + r.status);
r = await hit('/api/public/blog/does-not-exist');
check('an unknown article returns a clean 404', r.status === 404);

const draftId = db.prepare('SELECT id FROM blog_posts WHERE slug=?').all(draftSlug)[0].id;
r = await hit('/api/admin/blog/' + draftId, { method: 'PUT', json: { title: 'Draft Article', content: 'Now finished.', status: 'published' } });
check('a draft can be published later', r.status === 200, JSON.stringify(r.body));
r = await hit('/api/public/blog/' + draftSlug);
check('the newly published article is now readable', r.status === 200, 'got ' + r.status);
await hit('/api/admin/blog/' + draftId, { method: 'PUT', json: { title: 'Draft Article', content: 'Now finished.', status: 'draft' } });
r = await hit('/api/public/blog/' + draftSlug);
check('an article can be unpublished again', r.status === 404, 'got ' + r.status);

// Blog and Publications are separate registers and must never leak into each other.
r = await hit('/api/public/publications');
check('blog articles never appear among the publications', !r.body.publications.some(x => x.title === 'Published Article'));
r = await hit('/api/public/blog');
check('publications never appear among the blog articles', !r.body.posts.some(x => x.title === 'Test Peer Reviewed Article'));

const dupId = db.prepare('SELECT id FROM blog_posts WHERE slug=?').all(dupSlug)[0].id;
r = await hit('/api/admin/blog/' + dupId, { method: 'DELETE' });
check('an article can be deleted', r.status === 200 && db.prepare('SELECT COUNT(*) c FROM blog_posts WHERE id=?').all(dupId)[0].c === 0);

section('18. Join IURS: only while recruitment is open, and only after the fee is matched');
const APPLY = { name: 'Applicant One', studentId: 'IU-2022-501', department: 'Statistics', academicSession: '2022-2023',
                yearLevel: '3rd year', email: 'applicant.one@example.com', phone: '01700000000',
                researchInterests: 'Survey methodology', skills: 'R, SPSS', experience: 'None yet.',
                motivation: 'I would like to learn how research is done properly.',
                paymentMethod: 'bKash', transactionId: 'BKH8823001XZ', paymentAmount: '150',
                paymentSender: '01700000000', paymentDate: '2026-08-20' };

// The window starts closed, so nothing can be submitted until the admin opens it.
cookie = '';
r = await hit('/api/public/recruitment', { cookie: false });
check('the public can ask whether recruitment is open', r.status === 200 && r.body.open === false, JSON.stringify(r.body).slice(0, 120));
check('a closed window still explains itself to the visitor', typeof r.body.message === 'string' && r.body.message.length > 20);
check('a closed window shows the closed wording, not the open wording', /closed/i.test(r.body.message), r.body.message);
r = await hit('/api/public/join', { method: 'POST', json: APPLY, cookie: false });
check('nobody can apply while recruitment is closed', r.status === 403 && r.body.code === 'recruitment_closed', 'got ' + r.status);
check('and nothing was stored', db.prepare("SELECT COUNT(*) c FROM applications WHERE email='applicant.one@example.com'").all()[0].c === 0);

cookie = adminCookie;
r = await hit('/api/admin/recruitment');
check('the admin panel can read the recruitment settings', r.status === 200 && r.body.settings && r.body.liveNow === false, JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: true, fee: '150', currency: 'BDT',
  methods: 'bKash,Nagad', payTo: '+880 1749-022577', payToLabel: 'bKash Personal', title: 'Member Recruitment 4.2',
  openMessage: 'Recruitment is open until the end of the month.', closedMessage: 'Recruitment is closed for now.' } });
check('the admin can open recruitment', r.status === 200 && r.body.liveNow === true, JSON.stringify(r.body).slice(0, 160));
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, opensOn: '2026-03-01', closesOn: '2026-02-01' } });
check('a closing date before the opening date is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: true, fee: '' } });
check('asking for a fee without naming one is refused', r.status === 400, 'got ' + r.status);
// Restore a good open window for the rest of the section.
await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: true, fee: '150',
  methods: 'bKash,Nagad', payTo: '+880 1749-022577' } });
r = await hit('/api/public/recruitment', { cookie: false });
check('an open window tells the visitor the fee and where to pay it',
  r.body.open === true && r.body.fee === '150' && r.body.payTo === '+880 1749-022577' && r.body.methods.includes('bKash'), JSON.stringify(r.body));

// A window whose dates have passed is closed even though the switch is left on.
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: false, closesOn: '2020-01-01' } });
check('a window that has already closed by date reads as closed', r.body.liveNow === false, JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'toolate@example.com' }, cookie: false });
check('and the form is refused after the closing date even with the switch on', r.status === 403, 'got ' + r.status);
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: false, opensOn: '2999-01-01' } });
check('a window that has not started yet reads as closed', r.body.liveNow === false, JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: false } });
check('a window with the switch on and no dates reads as open', r.body.liveNow === true, JSON.stringify(r.body).slice(0, 120));

// Restore the fee-required open window that the rest of the section expects.
r = await hit('/api/admin/recruitment', { method: 'PUT', json: { open: true, requirePayment: true, fee: '150',
  methods: 'bKash,Nagad', payTo: '+880 1749-022577' } });
check('the settings survive a round trip through the database', r.body.settings.fee === '150' && r.body.settings.open === true, JSON.stringify(r.body.settings));

cookie = '';
r = await hit('/api/public/join', { method: 'POST', json: APPLY, cookie: false });
check('a visitor can submit an application without logging in', r.status === 200 && r.body.ok === true, JSON.stringify(r.body));
check('the application is stored in the database',
  db.prepare("SELECT COUNT(*) c FROM applications WHERE email='applicant.one@example.com'").all()[0].c === 1);
check('a new application starts as Pending',
  db.prepare("SELECT status s FROM applications WHERE email='applicant.one@example.com'").all()[0].s === 'pending');
check('a new application starts with its payment unverified',
  db.prepare("SELECT payment_status p FROM applications WHERE email='applicant.one@example.com'").all()[0].p === 'unverified');
check('every answer on the form is saved, not just the name',
  db.prepare("SELECT skills k FROM applications WHERE email='applicant.one@example.com'").all()[0].k === 'R, SPSS');
check('the transaction ID is saved exactly as typed',
  db.prepare("SELECT transaction_id t FROM applications WHERE email='applicant.one@example.com'").all()[0].t === 'BKH8823001XZ');
check('the year of study is saved',
  db.prepare("SELECT year_level y FROM applications WHERE email='applicant.one@example.com'").all()[0].y === '3rd year');
check('the applicant is told the application waits for the payment check', /transaction ID/i.test(r.body.message || ''), r.body.message);

r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'a@b.co', name: '' }, cookie: false });
check('an application with no name is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'not-an-email' }, cookie: false });
check('an application with a broken email address is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'x@y.co', department: '' }, cookie: false });
check('an application with no department is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'x@y.co', academicSession: '' }, cookie: false });
check('an application with no academic session is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'x@y.co', motivation: '' }, cookie: false });
check('an application with no reason for joining is refused', r.status === 400, 'got ' + r.status);

// Payment details are only optional when the society says the fee is not required.
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'nopay@example.com', transactionId: '' }, cookie: false });
check('an application with no transaction ID is refused while a fee is required', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'shorttxn@example.com', transactionId: 'ABC' }, cookie: false });
check('a transaction ID that is obviously too short is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'badmethod@example.com', paymentMethod: 'Cash in an envelope' }, cookie: false });
check('a payment method the society does not use is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'reuse@example.com' }, cookie: false });
check('the same transaction ID cannot be reused by a second applicant', r.status === 409, 'got ' + r.status);

// Spam control 1: a hidden field that only automated scripts fill in.
const beforeSpam = db.prepare('SELECT COUNT(*) c FROM applications').all()[0].c;
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'spam@example.com', transactionId: 'SPAM99001', website: 'http://spam.example' }, cookie: false });
check('a spam bot gets a normal-looking reply', r.status === 200, 'got ' + r.status);
check('but nothing from the spam bot is stored',
  db.prepare('SELECT COUNT(*) c FROM applications').all()[0].c === beforeSpam);

// Spam control 2: the same person cannot submit twice in a week.
r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, transactionId: 'BKH8823002XZ' }, cookie: false });
check('the same email cannot apply twice in a week', r.status === 409, 'got ' + r.status);

// Spam control 3: a per-connection daily limit.
let limited = 0;
for (let i = 0; i < 6; i++) {
  r = await hit('/api/public/join', { method: 'POST', json: { ...APPLY, email: 'burst' + i + '@example.com', transactionId: 'BURST00' + i + 'AA' }, cookie: false });
  if (r.status === 429) limited++;
}
check('a flood of applications from one connection is rate limited', limited > 0, 'none were limited');

r = await hit('/api/public/join', { method: 'POST', json: APPLY, headers: { Origin: 'https://evil.example' }, cookie: false });
check('another website cannot post applications into the form', r.status === 403, 'got ' + r.status);

// Applications must NOT be publicly accessible.
cookie = '';
for (const pth of ['/api/admin/applications', '/api/public/applications', '/api/admin/applications/export.xlsx']) {
  r = await hit(pth, { cookie: false });
  check('applications are not readable at ' + pth + ' without logging in', r.status === 401 || r.status === 403 || r.status === 404, 'got ' + r.status);
}
db.prepare('DELETE FROM login_attempts').run();
cookie = '';
await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS-MEM-1', password: 'NewMemberPass2026' } });
r = await hit('/api/admin/applications');
check('an ordinary member cannot read other people\'s applications', r.status === 403, 'got ' + r.status);

cookie = adminCookie;
r = await hit('/api/admin/applications');
check('the executive team CAN read the applications', r.status === 200 && Array.isArray(r.body.applications), JSON.stringify(r.body).slice(0, 120));
check('the dashboard gets a count per status', r.body.counts && typeof r.body.counts === 'object', JSON.stringify(r.body.counts));
check('the dashboard gets a count per payment state', r.body.paymentCounts && typeof r.body.paymentCounts === 'object', JSON.stringify(r.body.paymentCounts));
check('the four triage statuses are offered',
  ['pending', 'contacted', 'approved', 'rejected'].every(s => (r.body.statuses || []).includes(s)), JSON.stringify(r.body.statuses));
const appId = db.prepare("SELECT id FROM applications WHERE email='applicant.one@example.com'").all()[0].id;
r = await hit('/api/admin/applications?q=Statistics');
check('applications can be searched', r.body.applications.some(a => a.id === appId), 'found ' + r.body.applications.length);
r = await hit('/api/admin/applications?q=BKH8823001XZ');
check('an application can be found by its transaction ID', r.body.applications.some(a => a.id === appId), 'found ' + r.body.applications.length);
r = await hit('/api/admin/applications?q=zzz-nothing-matches-zzz');
check('a search with no matches returns an empty list, not an error', r.status === 200 && r.body.applications.length === 0);

// The rule the society asked for: no acceptance before the money is matched.
r = await hit('/api/admin/applications/' + appId, { method: 'PUT', json: { status: 'approved' } });
check('an application cannot be approved while its payment is unverified', r.status === 409 && r.body.code === 'payment_unverified', 'got ' + r.status);
check('and the application really is still pending', db.prepare('SELECT status s FROM applications WHERE id=?').all(appId)[0].s === 'pending');
r = await hit('/api/admin/applications/' + appId, { method: 'PUT', json: { status: 'contacted', notes: 'Phoned on 21 August.' } });
check('an application can still be marked Contacted before the payment check', r.status === 200, JSON.stringify(r.body));
check('the status change is stored', db.prepare('SELECT status s FROM applications WHERE id=?').all(appId)[0].s === 'contacted');
check('the private note is stored', /Phoned/.test(db.prepare('SELECT admin_notes n FROM applications WHERE id=?').all(appId)[0].n || ''));
r = await hit('/api/admin/applications?status=contacted');
check('applications can be filtered by status', r.body.applications.length >= 1 && r.body.applications.every(a => a.status === 'contacted'));
r = await hit('/api/admin/applications/' + appId, { method: 'PUT', json: { status: 'not-a-status' } });
check('an invalid status is refused', r.status === 400, 'got ' + r.status);

r = await hit('/api/admin/applications/' + appId + '/payment', { method: 'PUT', json: { paymentStatus: 'nonsense' } });
check('an invalid payment state is refused', r.status === 400, 'got ' + r.status);
r = await hit('/api/admin/applications/' + appId + '/payment', { method: 'PUT', json: { paymentStatus: 'verified', paymentNote: 'Matched in bKash statement, 20 Aug.' } });
check('the treasurer can mark a payment verified', r.status === 200, JSON.stringify(r.body));
const paid = db.prepare('SELECT payment_status p, verified_at v, verified_by b, payment_note n FROM applications WHERE id=?').all(appId)[0];
check('the payment state is stored', paid.p === 'verified');
check('who verified it and when is recorded', !!paid.v && !!paid.b, JSON.stringify(paid));
check('the payment note is stored', /bKash statement/.test(paid.n || ''));
r = await hit('/api/admin/applications?payment=verified');
check('applications can be filtered by payment state', r.body.applications.some(a => a.id === appId));
r = await hit('/api/admin/applications/' + appId, { method: 'PUT', json: { status: 'approved' } });
check('once the payment is verified the application can be approved', r.status === 200, JSON.stringify(r.body));
check('the approval is stored', db.prepare('SELECT status s FROM applications WHERE id=?').all(appId)[0].s === 'approved');
r = await hit('/api/admin/applications/' + appId + '/payment', { method: 'PUT', json: { paymentStatus: 'rejected', paymentNote: 'No such transaction.' } });
check('a payment can be marked rejected if it does not match', r.status === 200
  && db.prepare('SELECT verified_at v FROM applications WHERE id=?').all(appId)[0].v === null, JSON.stringify(r.body));
r = await hit('/api/admin/applications/999999/payment', { method: 'PUT', json: { paymentStatus: 'verified' } });
check('verifying a payment on an application that does not exist is a clean 404', r.status === 404, 'got ' + r.status);

section('18b. The applicant list downloads as a real Excel file');
r = await hit('/api/admin/applications/export.xlsx');
check('the export answers 200', r.status === 200, 'got ' + r.status);
check('the export is served as an .xlsx spreadsheet',
  (r.res.headers.get('content-type') || '').includes('spreadsheetml.sheet'), r.res.headers.get('content-type'));
check('the export is sent as a download with a dated filename',
  /attachment; filename="IURS-applications-\d{4}-\d{2}-\d{2}[^"]*\.xlsx"/.test(r.res.headers.get('content-disposition') || ''),
  r.res.headers.get('content-disposition'));
const xlsxBytes = new Uint8Array(await r.res.clone().arrayBuffer());
check('the file really is a ZIP container, as .xlsx must be',
  xlsxBytes[0] === 0x50 && xlsxBytes[1] === 0x4B && xlsxBytes[2] === 0x03 && xlsxBytes[3] === 0x04,
  [...xlsxBytes.slice(0, 4)].join(','));
check('the file ends with the ZIP central-directory record Excel looks for',
  (() => { for (let i = xlsxBytes.length - 22; i >= 0; i--)
      if (xlsxBytes[i] === 0x50 && xlsxBytes[i + 1] === 0x4B && xlsxBytes[i + 2] === 0x05 && xlsxBytes[i + 3] === 0x06) return true;
    return false; })());
const xlsxText = new TextDecoder().decode(xlsxBytes);
check('the workbook declares the parts Excel needs', xlsxText.includes('xl/workbook.xml') && xlsxText.includes('xl/worksheets/sheet1.xml') && xlsxText.includes('xl/styles.xml'));
check('the applicant appears in the sheet', xlsxText.includes('Applicant One'), 'name missing from sheet XML');
check('the transaction ID is written as text so no leading zero is lost',
  /t="inlineStr"[^>]*><is><t[^>]*>BKH8823001XZ</.test(xlsxText));
check('the header row names the payment columns', xlsxText.includes('Transaction ID') && xlsxText.includes('Payment'));
r = await hit('/api/admin/applications/export.xlsx?payment=verified');
check('the export honours the payment filter that is on screen',
  r.status === 200 && !new TextDecoder().decode(await r.res.clone().arrayBuffer()).includes('Applicant One'),
  'a rejected-payment applicant leaked into a verified-only export');
r = await hit('/api/admin/applications/export.csv');
check('a CSV export is available too', r.status === 200 && (r.res.headers.get('content-type') || '').includes('text/csv'), r.res.headers.get('content-type'));
const csvBytes = new Uint8Array(await r.res.clone().arrayBuffer());
// Checked on the raw bytes: Response.text() strips a leading BOM, so decoding
// first would hide the very thing we need to be sure reached the file.
check('the CSV starts with a UTF-8 byte order mark so Excel reads Bangla names correctly',
  csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF, [...csvBytes.slice(0, 3)].join(','));
const csvText = await r.res.clone().text();
check('the CSV contains the applicant', csvText.includes('Applicant One'));


section('19. The assistant answers only from IURS records');
r = await hit('/api/public/chat', { method: 'POST', json: { message: 'What has IURS published?' }, cookie: false });
check('the assistant replies without any AI key configured', r.status === 200 && !!r.body.reply, JSON.stringify(r.body).slice(0, 140));
check('the reply is marked as grounded in site data', r.body.grounded === true && r.body.model === 'facts-only', JSON.stringify(r.body.model));
const realTitle = db.prepare("SELECT title FROM publications WHERE published_status='published' ORDER BY publication_year DESC LIMIT 1").all()[0].title;
check('it quotes a real publication from the database', r.body.reply.includes(String(realTitle).slice(0, 40)), r.body.reply.slice(0, 200));

r = await hit('/api/public/chat', { method: 'POST', json: { message: 'How do I join IURS?' }, cookie: false });
check('it explains how to join, using the real form', /join\.html/.test(r.body.reply), r.body.reply.slice(0, 160));
r = await hit('/api/public/chat', { method: 'POST', json: { message: 'Who is the president of the executive committee?' }, cookie: false });
check('it answers committee questions from the current committee only',
  /New President/.test(r.body.reply) || /CURRENT EXECUTIVE COMMITTEE/.test(r.body.reply), r.body.reply.slice(0, 160));
r = await hit('/api/public/chat', { method: 'POST', json: { message: 'What training does IURS run?' }, cookie: false });
check('it answers training questions', /TRAINING/i.test(r.body.reply), r.body.reply.slice(0, 120));

r = await hit('/api/public/chat', { method: 'POST', json: { message: 'Which Nobel Prize has IURS won and how much funding does it hold?' }, cookie: false });
check('it refuses to invent awards or funding it has no record of',
  /do not have that information/i.test(r.body.reply), r.body.reply.slice(0, 200));
check('the refusal points the visitor at a real email address',
  r.body.reply.includes('iuresearchsociety@gmail.com'));
r = await hit('/api/public/chat', { method: 'POST', json: { message: '' }, cookie: false });
check('an empty question is refused politely', r.status === 400, 'got ' + r.status);
r = await hit('/api/public/chat', { method: 'POST', json: { message: 'hello' }, headers: { Origin: 'https://evil.example' }, cookie: false });
check('another website cannot use the assistant', r.status === 403, 'got ' + r.status);

r = await worker.fetch(new Request(ORIGIN + '/api/public/chat', { method: 'POST', headers: { Origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'What has IURS published?' }) }),
  { ...env, AI: { async run() { throw new Error('AI binding exploded'); } } }, {});
const aiFail = await r.json();
check('if the AI service fails, the assistant still answers from the database',
  r.status === 200 && /IURS website has on that/.test(aiFail.reply), JSON.stringify(aiFail).slice(0, 160));
check('no AI failure detail is leaked to the visitor', !/exploded/.test(JSON.stringify(aiFail)));
check('no AI key or secret is exposed in the reply', !/api[_-]?key|Bearer/i.test(JSON.stringify(aiFail)));

section('20. The existing website must still work exactly as before');
cookie = adminCookie;
for (const [pth, label] of [['/api/public/stats', 'homepage statistics'], ['/api/public/events', 'events'],
                            ['/api/public/notices', 'notices'], ['/api/public/gallery', 'gallery'],
                            ['/api/public/training', 'training sessions'], ['/api/public/publications', 'publications'],
                            ['/api/public/committee', 'executive committee'], ['/api/public/alumni', 'alumni'],
                            ['/api/public/blog', 'blog']]) {
  r = await hit(pth, { cookie: false });
  check('the public ' + label + ' feed still works', r.status === 200, 'got ' + r.status);
}
r = await hit('/api/public/gallery', { cookie: false });
check('every seeded gallery photograph is still published', r.body.gallery.length >= gcount, 'was ' + gcount + ', now ' + r.body.gallery.length);
r = await hit('/api/public/training', { cookie: false });
check('every seeded training session is still published', r.body.training.length >= tcount, 'was ' + tcount + ', now ' + r.body.training.length);
r = await hit('/api/public/publications', { cookie: false });
check('the original publications are all still on record',
  r.body.publications.length >= seedPubCount, 'was ' + seedPubCount + ', now ' + r.body.publications.length);
check('no publication record was silently emptied',
  r.body.publications.every(x => x.title && x.authors), 'a publication lost its title or authors');
r = await hit('/api/admin/summary');
check('the dashboard summary still loads', r.status === 200, JSON.stringify(r.body).slice(0, 120));
r = await hit('/api/health', { cookie: false });
check('the health check still answers', r.status === 200 && r.body.ok === true);
r = await worker.fetch(new Request(ORIGIN + '/api/public/committee'), { ...env, DB: { prepare() { throw new Error('D1 down'); }, batch() { throw new Error('D1 down'); } } }, {});
check('a database failure on the new pages fails cleanly, without leaking details',
  r.status === 500 && !/D1 down/.test(JSON.stringify(await r.json())));


/* ------------------------------------------------------------------
   19. Upgrading a database that predates the new columns.
   The live database already had an `applications` table without any of the
   payment columns. CREATE TABLE IF NOT EXISTS is a no-op there, so a new index
   over one of those columns ran before ALTER TABLE could add it, ensureSchema
   rejected, and every single API call answered 500 — while this suite stayed
   green because its database is always built fresh from the new CREATE TABLE.
   This section reproduces the old shape on purpose.
   ------------------------------------------------------------------ */
{
  const old = new DatabaseSync(':memory:');
  // Exactly the table the production database had before the payment work.
  old.exec(`CREATE TABLE applications (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,
    student_id TEXT,department TEXT,academic_session TEXT,email TEXT,phone TEXT,research_interests TEXT,
    skills TEXT,experience TEXT,motivation TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_notes TEXT,
    source_key TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  old.exec(`INSERT INTO applications(name,email,department,motivation) VALUES('Older Applicant','old@example.com','Statistics','Wrote in before the fee existed.')`);

  const oldPrepare = sql => { let a = []; const api = {
    bind(...x) { a = x; return api; },
    async first() { return old.prepare(sql).all(...norm(a))[0] ?? null; },
    async all() { return { results: old.prepare(sql).all(...norm(a)) }; },
    async run() { old.prepare(sql).run(...norm(a)); return { success: true }; } }; return api; };
  const oldEnv = { ...env, DB: { prepare: oldPrepare, async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; } } };

  // A fresh module instance: ensureSchema memoizes its promise per module, so the
  // query string is what lets the schema run a second time against this database.
  const fresh = (await import('./index.mjs?upgrade=1')).default;
  const call = (p, o = {}) => fresh.fetch(new Request(ORIGIN + p, { headers: { Origin: ORIGIN }, ...o }), oldEnv, {});

  let up = await call('/api/public/recruitment');
  check('a database predating the payment columns still serves the public API',
    up.status === 200, up.status + ' ' + (await up.clone().text()).slice(0, 160));
  const upBody = await up.json();
  check('and it reports the recruitment window rather than an error', upBody.open === false);

  up = await call('/api/public/stats');
  check('the stats endpoint survives the upgrade too', up.status === 200);

  const cols = new Set(old.prepare('PRAGMA table_info(applications)').all().map(r => r.name));
  for (const c of ['payment_method', 'transaction_id', 'payment_amount', 'payment_sender',
                   'payment_date', 'payment_status', 'payment_note', 'verified_at', 'verified_by', 'year_level']) {
    check('the upgrade adds applications.' + c, cols.has(c));
  }
  const idx = old.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_applications_txn'").all();
  check('the transaction-id index is created after the column exists, not before', idx.length === 1);
  const kept = old.prepare("SELECT name,payment_status FROM applications WHERE email='old@example.com'").all()[0];
  check('the application that was already there is untouched', kept && kept.name === 'Older Applicant');
  check('and it defaults to an unverified payment', kept && kept.payment_status === 'unverified',
    JSON.stringify(kept));
}

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
if (fail) { console.log('\nFailed:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
