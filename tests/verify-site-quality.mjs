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
check('homepage loads Poppins bold weights for its hero headline', /family=Poppins:wght@400;500;600;700;800/.test(homepage));

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
check('People dropdown routes Executive, General Members, Advisors and Alumni separately', /href="executive-committee\.html#executive">Executive Committee/.test(peoplePage) && /href="executive-committee\.html#members">General Members/.test(peoplePage) && /href="executive-committee\.html#advisors">Advisors/.test(peoplePage) && /href="alumni\.html">Alumni/.test(peoplePage));
check('duplicate in-page People category menus are removed', !peoplePage.includes('people-jump-links') && !peoplePage.includes('data-people-view='));
check('category routing follows URL hashes and supports same-page navigation', contentJs.includes("function viewFromHash()") && contentJs.includes("window.addEventListener('hashchange'") && contentJs.includes("location.hash === '#advisors'") && contentJs.includes("location.hash === '#members'"));
check('empty advisor/member states are rendered without showing another category', contentJs.includes('committee-empty') && contentJs.includes('committee-empty-cell') && /id="advisors" hidden/.test(peoplePage) && /id="members" hidden/.test(peoplePage));
check('full committee roster renders as profile cards, not a truncated table', /class="exec-grid exec-roster-grid"[^>]*id="exec-roster"/.test(peoplePage) && /body\.appendChild\(execCard\(r, i\)\)/.test(contentJs));
check('President and General Secretary use circular, full-image portrait frames', /#exec-leadership \.exec-photo\{width:112px;height:112px;/.test(peoplePage) && /#exec-leadership \.exec-photo\{[^}]*border-radius:50%/.test(peoplePage) && /#exec-leadership \.exec-photo img\{width:100%;height:100%;object-fit:contain;/.test(peoplePage));
check('committee-term selector always receives an option and supports available archives', contentJs.includes('sel.innerHTML = all.map') && contentJs.includes('sel.disabled = all.length < 2') && contentJs.includes('data.archive') && contentJs.includes('setPeopleView(selectedView)'));
const homePage = readFileSync(path.join(root,'public','index.html'),'utf8');
check('View All Community Members links directly to the full committee roster', /href="executive-committee\.html#roster"><i class="fas fa-users"><\/i> View All Community Members/.test(homePage));
const eventDetail = readFileSync(path.join(root,'public','event-details.html'),'utf8');
const liveJs = readFileSync(path.join(root,'public/assets','iurs-live.js'),'utf8');
const adminPage = readFileSync(path.join(root,'public','admin.html'),'utf8');
const worker = readFileSync(path.join(root,'src','index.js'),'utf8');
check('event detail page loads event data from the public API and handles missing IDs', eventDetail.includes('/api/public/events') && eventDetail.includes('new URLSearchParams(location.search)') && eventDetail.includes('Unable to load this event'));
check('live event cards link to the matching internal detail page', liveJs.includes('event-details.html?id=') && liveJs.includes('View Details'));
check('admin event register offers a public preview and event editing fields', adminPage.includes('Preview Public Page') && adminPage.includes('id="eventFile"') && adminPage.includes('id="ex"') && adminPage.includes('id="er"'));
check('event admin API supports create, update, delete and public listing', worker.includes("path==='/api/public/events'") && worker.includes("path==='/api/admin/events'&&m==='POST'") && worker.includes("path.startsWith('/api/admin/events/')&&m==='PUT'") && worker.includes("path.startsWith('/api/admin/events/')&&m==='DELETE'"));
const finalUi = readFileSync(path.join(root,'public/assets','iurs-final-ui.css'),'utf8');
check('committee portraits and event cards receive reference-inspired responsive styles', finalUi.includes('#roster .exec-roster-grid .exec-photo') && finalUi.includes('.events-grid[data-live-events]') && finalUi.includes('iursLogoSpin') && finalUi.includes('prefers-reduced-motion:reduce'));
const sitemap = readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
check('sitemap contains all 12 public pages', pages.length === urls.length && pages.every(([,url])=>urls.includes(url)));
check('sitemap excludes private portal pages', !urls.some(url=>/\/(admin|dashboard|login|setup)(\.html)?$/.test(url)));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
