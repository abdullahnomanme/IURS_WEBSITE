import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function check(label, ok) {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + label); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + label); }
}
const pages = [
  ['index.html','https://iurs.org.bd/'],
  ['about.html','https://iurs.org.bd/about.html'],
  ['alumni.html','https://iurs.org.bd/alumni.html'],
  ['blog.html','https://iurs.org.bd/blog.html'],
  ['contact.html','https://iurs.org.bd/contact.html'],
  ['events.html','https://iurs.org.bd/events.html'],
  ['executive-committee.html','https://iurs.org.bd/executive-committee.html'],
  ['gallery.html','https://iurs.org.bd/gallery.html'],
  ['join.html','https://iurs.org.bd/join.html'],
  ['notices.html','https://iurs.org.bd/notices.html'],
  ['publications.html','https://iurs.org.bd/publications.html'],
  ['training-session.html','https://iurs.org.bd/training-session.html'],
];
console.log('\n\x1b[1mPublic-page SEO and metadata\x1b[0m');
for (const [file,url] of pages) {
  const html = readFileSync(path.join(root,'public',file),'utf8');
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || '';
  const canonicalPath = canonical.match(/\bdata-abs=["']([^"']+)["']/i)?.[1] || canonical.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
  const canonicalUrl = canonicalPath ? new URL(canonicalPath, 'https://iurs.org.bd').href : '';
  check(file + ' has canonical URL', canonicalUrl === url);
  check(file + ' has social-sharing metadata', html.includes('property="og:title"') && html.includes('name="twitter:card"'));
  check(file + ' retains a meta description', /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i.test(html));
}
const homepage = readFileSync(path.join(root,'public','index.html'),'utf8');
check('homepage has complete closing document markup', /<\/body>\s*<\/html>\s*$/i.test(homepage));
check('homepage loads the shared CMS content binder', /<script\b[^>]*\bsrc=["']assets\/iurs-content\.js["']/i.test(homepage));

console.log('\n\x1b[1mPrivate portal indexing safeguards\x1b[0m');
for (const file of ['admin.html','dashboard.html','login.html','setup.html']) {
  const html = readFileSync(path.join(root,'public',file),'utf8');
  check(file + ' is excluded from indexing', /<meta\s+name=["']robots["']\s+content=["']noindex\s*,\s*nofollow["']/i.test(html));
}
console.log('\n\x1b[1mJavaScript syntax checks\x1b[0m');
for (const file of ['iurs-content.js','iurs-live.js']) {
  const target = path.join(root,'public/assets',file);
  const result = spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
  check(file + ' parses without syntax errors', result.status === 0);
  if (result.status !== 0) console.error((result.stderr || result.stdout || '').trim());
}
console.log('\n\x1b[1mShared design and sitemap\x1b[0m');
const css = readFileSync(path.join(root,'public/assets/iurs-polish.css'),'utf8');
check('keyboard focus styles are present', css.includes('SITE QUALITY LAYER') && css.includes('a:focus-visible'));
check('mobile hero layout is covered', css.includes('max-width: 760px') && css.includes('body .hero-content-grid'));
check('reduced-motion preference remains supported', css.includes('prefers-reduced-motion: reduce'));
const peoplePage = readFileSync(path.join(root,'public','executive-committee.html'),'utf8');
const contentJs = readFileSync(path.join(root,'public/assets','iurs-content.js'),'utf8');
check('Advisor Panel has a visible, unique anchor target', /id="advisors"/.test(peoplePage) && !/<section[^>]*id="advisors"[^>]*hidden/i.test(peoplePage) && /advSec\.hidden = false/.test(contentJs));
check('General Members has a visible, unique anchor target', /id="members"/.test(peoplePage) && !/<section[^>]*id="members"[^>]*hidden/i.test(peoplePage) && /memSec\.hidden = false/.test(contentJs));
check('empty advisor/member states are rendered instead of jumping to another section', contentJs.includes('committee-empty') && contentJs.includes('committee-empty-cell'));
const sitemap = readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
check('sitemap contains all 12 public pages', pages.length === urls.length && pages.every(([,url])=>urls.includes(url)));
check('sitemap excludes private portal pages', !urls.some(url=>/\/(admin|dashboard|login|setup)(\.html)?$/.test(url)));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
