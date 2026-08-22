/* Proves the exact HTTP call deploy.ps1 makes really does create the IURS26
   administrator, force a password change, and then close the setup route.
   Runs the real Worker against a real SQL engine, same as verify.mjs. */
import { DatabaseSync } from 'node:sqlite';
import worker from './index.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));

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
const env = {
  DB: { prepare, async batch(list) { const o = []; for (const s of list) o.push(await s.run()); return o; } },
  ASSETS: { async fetch() { return new Response('<!doctype html><title>IURS</title>', { headers: { 'content-type': 'text/html' } }); } },
};
const ORIGIN = 'https://iurs.example.workers.dev';

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '  -> ' + extra : '')); }
};
async function hit(path, opt = {}) {
  const h = {};
  if (opt.json !== undefined) { h['content-type'] = 'application/json'; }
  // deploy.ps1 sends NO Origin header (Invoke-WebRequest does not add one),
  // so reproduce that exactly.
  if (opt.origin) h.Origin = opt.origin;
  const r = await worker.fetch(new Request(ORIGIN + path, {
    method: opt.method || 'GET', headers: h,
    body: opt.json !== undefined ? JSON.stringify(opt.json) : undefined,
  }), env, {});
  let body = null;
  try { body = await r.clone().json(); } catch { body = await r.text(); }
  return { status: r.status, body, headers: r.headers };
}

console.log('\n\x1b[1mdeploy.ps1 administrator creation\x1b[0m');

// Step 8 first waits for /api/health.
let r = await hit('/api/health');
check('the health check the script waits for answers 200', r.status === 200, 'got ' + r.status);

// This is byte-for-byte the payload built in deploy.ps1.
const PW = 'K7#mQ2vXp!rL9tZ4wB$e';   // same shape as New-StrongPassword: 20 chars, 4 classes
const payload = {
  iursId: 'IURS26',
  name: 'Abdullah Al Noman',
  position: 'Office Secretary',
  password: PW,
  mustChangePassword: true,
};
r = await hit('/api/setup/initial-admin', { method: 'POST', json: payload });
check('the script creates the administrator without opening setup.html', r.status === 200, JSON.stringify(r.body).slice(0, 160));
check('the reply confirms a password change will be forced', r.body.mustChangePassword === true, JSON.stringify(r.body));

const row = db.prepare('SELECT iurs_id,name,position,role,must_change_password,password_hash FROM users').all()[0];
check('the account is IURS26 / Abdullah Al Noman / Office Secretary',
  row.iurs_id === 'IURS26' && row.name === 'Abdullah Al Noman' && row.position === 'Office Secretary',
  JSON.stringify(row && { i: row.iurs_id, n: row.name, p: row.position }));
check('the account is an administrator', row.role === 'admin', row.role);
check('the account must change its password at first login', Number(row.must_change_password) === 1, String(row.must_change_password));
check('the temporary password is NOT stored in readable form',
  !String(row.password_hash).includes(PW) && String(row.password_hash).length > 40, String(row.password_hash).slice(0, 24));

// The route must now be closed forever, even to the same script.
r = await hit('/api/setup/initial-admin', { method: 'POST', json: { ...payload, iursId: 'IURS99' } });
check('running the script again cannot create a second administrator', r.status === 409, 'got ' + r.status);
check('and no second account was created', db.prepare('SELECT COUNT(*) c FROM users').all()[0].c === 1);

// The temporary password must actually work, and must land on a forced change.
r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS26', password: PW }, origin: ORIGIN });
check('the temporary password logs in', r.status === 200, JSON.stringify(r.body).slice(0, 160));
check('login tells the dashboard to force a password change',
  r.body && (r.body.mustChangePassword === true || r.body.mustChangePassword === 1 || (r.body.user && r.body.user.must_change_password)),
  JSON.stringify(r.body).slice(0, 200));

const sessionCookie = (r.headers.get('Set-Cookie') || '').split(';')[0];
r = await worker.fetch(new Request(ORIGIN + '/api/auth/change-password', {
  method: 'POST', headers: { Origin: ORIGIN, 'content-type': 'application/json', Cookie: sessionCookie },
  body: JSON.stringify({ currentPassword: PW, newPassword: 'MyOwnChosenPassword2026!' }),
}), env, {});
check('changing the password succeeds', r.status === 200, 'got ' + r.status);
check('the forced-change flag is cleared afterwards',
  Number(db.prepare('SELECT must_change_password m FROM users WHERE iurs_id=?').all('IURS26')[0].m) === 0);

r = await hit('/api/auth/login', { method: 'POST', json: { iursId: 'IURS26', password: PW }, origin: ORIGIN });
check('the temporary password stops working once changed', r.status === 401 || r.status === 400, 'got ' + r.status);

/* The Worker refuses /api/admin/ while the flag is set, but a locked dashboard that
   renders empty with no explanation would look broken. Assert the page reacts. */
const adminPage = readFileSync(path.join(here, '..', 'public', 'admin.html'), 'utf8');
check('the dashboard reacts to the forced-change flag instead of loading empty',
  /must_change_password\)\{goTab\('security'\)/.test(adminPage) && /pwForce'\)\.hidden=false/.test(adminPage));
check('the dashboard locks the other tabs until the password is changed',
  /b\.disabled=true/.test(adminPage) && /location\.reload/.test(adminPage));

console.log('\n\x1b[1m' + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
