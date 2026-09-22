import { GALLERY_SEED, TRAINING_SEED, COMMITTEE_SEED, EXECUTIVE_SEED, PUBLICATION_SEED } from './seed.js';
const SESSION_DAYS = 7;
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const UPLOAD_TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
/* What a notice may carry as an attachment: a document, or an image (a photographed
   circular is the most common case of all). Word/Excel/PowerPoint files are ZIP
   containers, so they share one signature and are stored under a generic extension —
   the browser still opens them, and the admin sees the original file name. */
/* Who appears in which block on the People page. "leadership" are the office
   bearers shown as photo cards, "roster" is the numbered committee table,
   "advisor" is the advisory panel and "member" is the general membership — each
   one gets its own section, and moving somebody between them is a dropdown in
   the dashboard rather than a code change. */
const EXEC_TIERS = ['leadership','advisor','roster','member'];
/* Two records count as the same title when they differ only in capitalisation,
   surrounding spaces, or the flavour of apostrophe used (Word turns ' into ’ on
   paste). SQLite has no regex, so the smart quotes are named by code point. */
const NORM_TITLE = `replace(replace(replace(lower(trim(title)),char(8217),''),char(8216),''),'''','')`;
const DOC_TYPES = {...UPLOAD_TYPES,'application/pdf':'pdf','application/zip':'docx','application/msword':'doc'};
const GALLERY_CATEGORIES = ['Events','Community','Achievements','Training','Research','Campus','Documents'];
const PUB_CATEGORIES = ['peer_reviewed','conference','working_paper','under_review'];
const APPLICATION_STATUSES = ['pending','contacted','approved','rejected'];
const PAYMENT_STATUSES = ['unverified','verified','rejected'];
const STAT_LABELS = {members:'Community Members',research_outputs:'Research Outputs',workshops:'Workshops & Training',peer_reviewed:'Peer-reviewed Articles',working_papers:'Working Papers',under_review:'Manuscripts Under Review',best_paper:'Best Paper Award'};
const STAT_KEYS = Object.keys(STAT_LABELS);
const RECRUITMENT_DEFAULTS = {
 open:false,title:'Member Recruitment',
 closedMessage:'Member recruitment is closed at the moment. Follow our Facebook page and this website — the next call for members will be announced here first.',
 openMessage:'Recruitment is open. Please complete every field and pay the membership fee before submitting.',
 opensOn:'',closesOn:'',fee:'150',currency:'BDT',feeNote:'One-time membership fee for the current session.',
 methods:'bKash,Nagad,Rocket,Bank transfer',payTo:'+880 1749-022577',payToLabel:'bKash / Nagad (Personal)',requirePayment:true
};
const RECRUITMENT_KEY='recruitment';
async function getRecruitment(env){try{const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(RECRUITMENT_KEY).first();if(!row||!row.value)return {...RECRUITMENT_DEFAULTS};const saved=JSON.parse(row.value);return {...RECRUITMENT_DEFAULTS,...(saved&&typeof saved==='object'?saved:{})};}catch(e){console.error('recruitment settings unreadable, using defaults',e);return {...RECRUITMENT_DEFAULTS}}}
const SITE_SETTINGS_KEY='site';
const SITE_DEFAULTS={orgName:'IURS',orgSubtitle:'Islamic University Research Society',about:'A premier academic research organization at Islamic University, Kushtia, dedicated to advancing knowledge, fostering innovation, and nurturing the next generation of researchers and leaders.',email:'iuresearchsociety@gmail.com',phone:'+8801749022577',address:'TSCC, Islamic University, Kushtia-7003',hours:'Sat – Thu: 9:00 AM – 5:00 PM',website:'https://iurs.org.bd',facebook:'https://www.facebook.com/iuresearchsociety/',linkedin:'',youtube:'',x:''};
async function getSiteSettings(env){try{const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(SITE_SETTINGS_KEY).first();if(!row||!row.value)return {...SITE_DEFAULTS};const saved=JSON.parse(row.value);return {...SITE_DEFAULTS,...(saved&&typeof saved==='object'?saved:{})};}catch(e){console.error('site settings unreadable, using defaults',e);return {...SITE_DEFAULTS}}}
function recruitmentIsOpen(s,today){if(!s.open)return false;const d=today||new Date().toISOString().slice(0,10);if(s.opensOn&&d<s.opensOn)return false;if(s.closesOn&&d>s.closesOn)return false;return true}
function publicRecruitment(s){const open=recruitmentIsOpen(s);return {open,title:s.title,message:open?s.openMessage:s.closedMessage,opensOn:s.opensOn||null,closesOn:s.closesOn||null,campaignId:s.campaignId||null,code:s.code||null,imageUrl:s.imageUrl||'',fee:s.fee||'',currency:s.currency||'BDT',feeNote:s.feeNote||'',requirePayment:!!s.requirePayment,methods:String(s.methods||'').split(',').map(x=>x.trim()).filter(Boolean),payTo:s.payTo||'',payToLabel:s.payToLabel||''}}
const EVENT_STATUSES=['upcoming','past','cancelled'];
function todayStr(){return new Date().toISOString().slice(0,10)}
function effectiveEventStatus(row,today){const t=today||todayStr();const ov=String((row&&row.status_override)||'').toLowerCase();if(ov==='cancelled')return 'cancelled';if(ov==='upcoming'||ov==='past')return ov;const d=row&&row.event_date?String(row.event_date).slice(0,10):'';if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d>=t?'upcoming':'past';const legacy=String((row&&row.status)||'').toLowerCase();return EVENT_STATUSES.includes(legacy)?legacy:'upcoming'}
function withEventStatus(row,today){if(!row)return row;const s=effectiveEventStatus(row,today);return {...row,status:s,effective_status:s,is_upcoming:s==='upcoming'}}
function sortEvents(rows,today){const t=today||todayStr();const list=(rows||[]).map(r=>withEventStatus(r,t));const up=list.filter(r=>r.status==='upcoming').sort((a,b)=>String(a.event_date||'9999-99-99').localeCompare(String(b.event_date||'9999-99-99')));const rest=list.filter(r=>r.status!=='upcoming').sort((a,b)=>String(b.event_date||'').localeCompare(String(a.event_date||''))||b.id-a.id);return [...up,...rest]}
const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','vary':'Cookie',...extra}});
const cookieOptions = maxAge => `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const PBKDF2_ITERATIONS=100000;
function b64u(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function b64uDecode(str){const pad='='.repeat((4-(str.length%4))%4);const raw=atob(str.replace(/-/g,'+').replace(/_/g,'/')+pad);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function sha256Base64(v){return b64u(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))}
async function randomToken(){return b64u(crypto.getRandomValues(new Uint8Array(32)))}
async function hashPassword(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},key,256);return `${b64u(salt)}.${b64u(bits)}`}
async function verifyPassword(password,encoded){try{const [salt]=encoded.split('.');return (await hashPassword(password,b64uDecode(salt)))===encoded}catch{return false}}
function parseCookie(h=''){const o={};for(const item of h.split(';')){const [k,...r]=item.trim().split('=');if(k)o[k]=r.join('=')}return o}
function sameOrigin(req){const o=req.headers.get('Origin');return !o||o===new URL(req.url).origin}
function cleanUser(r){if(!r)return null;const {password_hash,...u}=r;return u}
async function currentUser(req,env){const c=parseCookie(req.headers.get('Cookie')||'');if(!c.iurs_session)return null;const hash=await sha256Base64(c.iurs_session);const row=await env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.status='active' LIMIT 1`).bind(hash).first();if(row)await env.DB.prepare(`UPDATE sessions SET last_seen_at=datetime('now') WHERE token_hash=?`).bind(hash).run();return cleanUser(row)}
const allowed = (u,roles=['admin','executive']) => !!u && roles.includes(u.role);
let schemaReady;
async function ensureSchema(env){
  if(schemaReady)return schemaReady;
  schemaReady=(async()=>{
    const ddl=[
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,iurs_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','executive','admin')),name TEXT NOT NULL,email TEXT,department TEXT,year_level TEXT,position TEXT,phone TEXT,photo_url TEXT,status TEXT NOT NULL DEFAULT 'active',must_change_password INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,level TEXT NOT NULL DEFAULT 'normal',published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,image_url TEXT,link_url TEXT,attachment_url TEXT,attachment_name TEXT,pinned INTEGER NOT NULL DEFAULT 0,notice_date TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,event_date TEXT,event_time TEXT,venue TEXT,description TEXT,status TEXT NOT NULL DEFAULT 'upcoming',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,image_url TEXT,link_url TEXT,registration_url TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS publications (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,authors TEXT NOT NULL,category TEXT NOT NULL,journal TEXT,publication_year INTEGER,doi TEXT,url TEXT,abstract TEXT,published_status TEXT NOT NULL DEFAULT 'published',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,featured INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS site_stats (key TEXT PRIMARY KEY,value TEXT NOT NULL,label TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,`CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role,status)`,`CREATE INDEX IF NOT EXISTS idx_publications_category_year ON publications(category,publication_year DESC)`,`CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status,event_date)`,`CREATE INDEX IF NOT EXISTS idx_notices_published_created ON notices(published,created_at DESC)`,
      `INSERT OR IGNORE INTO site_stats(key,value,label) VALUES ('working_papers','10+','Working Papers'),('under_review','3+','Manuscripts Under Review'),('best_paper','1','Best Paper Award')`,
      `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,`CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,attempt_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,`CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time ON login_attempts(attempt_key,created_at)`,
      `CREATE TABLE IF NOT EXISTS gallery_images (id INTEGER PRIMARY KEY AUTOINCREMENT,seed_key TEXT UNIQUE,category TEXT NOT NULL DEFAULT 'Events',title TEXT NOT NULL,caption TEXT,image_url TEXT NOT NULL,fit TEXT NOT NULL DEFAULT 'cover',featured INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS training_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,seed_key TEXT UNIQUE,title TEXT NOT NULL,description TEXT,image_url TEXT,date_text TEXT,venue TEXT,registration_url TEXT,published INTEGER NOT NULL DEFAULT 1,featured INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS executive_members (id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER,name TEXT NOT NULL,position TEXT NOT NULL,department TEXT,photo_url TEXT,tier TEXT NOT NULL DEFAULT 'member',sort_order INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS committee_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,session_name TEXT NOT NULL UNIQUE,session_year TEXT,approval_doc_p1 TEXT,approval_doc_p2 TEXT,ref_number TEXT,approval_date TEXT,approved_by TEXT,recommended_by TEXT,official_note TEXT,is_current INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS alumni (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,session TEXT,department TEXT,designation TEXT,organization TEXT,photo_url TEXT,published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS blog_posts (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,slug TEXT UNIQUE,excerpt TEXT,body TEXT NOT NULL,image_url TEXT,status TEXT NOT NULL DEFAULT 'draft',author_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,published_at TEXT)`,
      `CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT,phone TEXT,department TEXT,student_id TEXT,session TEXT,payment_method TEXT,payment_txn TEXT,payment_status TEXT NOT NULL DEFAULT 'unverified',status TEXT NOT NULL DEFAULT 'pending',admin_notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS publications_meta (id INTEGER PRIMARY KEY AUTOINCREMENT,publication_id INTEGER,title TEXT,authors TEXT,year INTEGER,category TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,code TEXT UNIQUE,status TEXT NOT NULL DEFAULT 'draft',open_message TEXT,closed_message TEXT,opens_on TEXT,closes_on TEXT,fee TEXT,currency TEXT,methods TEXT,pay_to TEXT,pay_to_label TEXT,image_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_name TEXT,user_role TEXT,action TEXT,content_type TEXT,content_id TEXT,timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ];
    for(const sql of ddl){try{await env.DB.prepare(sql).run()}catch(e){console.error('schema statement failed',e,sql)}}
    try{await seedContent(env)}catch(e){console.error('seed failed',e)}
  })();
  return schemaReady;
}
async function seedContent(env){
  for(const x of GALLERY_SEED){await env.DB.prepare(`INSERT OR IGNORE INTO gallery_images(seed_key,category,title,caption,image_url,fit,featured,published,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`).bind(x.seed_key,x.category,x.title,x.caption||null,x.image_url,x.fit||'cover',x.featured?1:0,1,x.sort_order||0).run()}
  for(const x of TRAINING_SEED){await env.DB.prepare(`INSERT OR IGNORE INTO training_sessions(seed_key,title,description,image_url,date_text,venue,registration_url,published,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(x.seed_key,x.title,x.description||null,x.image_url||null,x.date_text||null,x.venue||null,x.registration_url||null,1,x.featured?1:0,x.sort_order||0).run()}
  for(const x of COMMITTEE_SEED){await env.DB.prepare(`INSERT OR IGNORE INTO committee_sessions(id,session_name,session_year,is_current) VALUES (?,?,?,?)`).bind(x.id,x.session_name,x.session_year||null,x.is_current?1:0).run()}
  for(const x of EXECUTIVE_SEED){await env.DB.prepare(`INSERT OR IGNORE INTO executive_members(id,session_id,name,position,department,photo_url,tier,sort_order,published) VALUES (?,?,?,?,?,?,?,?,?)`).bind(x.id,x.session_id,x.name,x.position,x.department||null,x.photo_url||null,x.tier||'member',x.sort_order||0,1).run()}
  for(const x of PUBLICATION_SEED){await env.DB.prepare(`INSERT OR IGNORE INTO publications(id,title,authors,category,journal,publication_year,doi,url,abstract,published_status,featured) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(x.id,x.title,x.authors,x.category,x.journal||null,x.publication_year||null,x.doi||null,x.url||null,x.abstract||null,'published',x.featured?1:0).run()}
}
function cleanText(v,max=10000){return String(v??'').trim().slice(0,max)}
function safeUrl(v){const s=String(v??'').trim();if(!s)return '';try{const u=new URL(s,s.startsWith('/')?'https://iurs.org.bd':'https://iurs.org.bd');if(!['http:','https:'].includes(u.protocol))return '';return s}catch{return ''}}
async function publicStats(env){const [m,p,w,pr]=await Promise.all([env.DB.prepare("SELECT COUNT(*) c FROM users WHERE status='active'").first(),env.DB.prepare("SELECT COUNT(*) c FROM publications WHERE published_status='published'").first(),env.DB.prepare("SELECT COUNT(*) c FROM training_sessions WHERE published=1").first(),env.DB.prepare("SELECT COUNT(*) c FROM publications WHERE published_status='published' AND category='peer_reviewed'").first()]);const rows={members:m?.c||0,research_outputs:p?.c||0,workshops:w?.c||0,peer_reviewed:pr?.c||0};for(const k of STAT_KEYS){const r=await env.DB.prepare('SELECT value FROM site_stats WHERE key=?').bind(k).first();if(r?.value)rows[k]=r.value}return rows}
async function logActivity(env,user,action,contentType,contentId=''){try{await env.DB.prepare('INSERT INTO activity_logs(user_name,user_role,action,content_type,content_id) VALUES (?,?,?,?,?)').bind(user?.name||'system',user?.role||'system',action,contentType,String(contentId||'')).run()}catch(e){console.error('activity log failed',e)}}
async function publicRoutes(req,env,path){
 if(path==='/api/health')return json({ok:true,service:'iurs-website'});
 if(path==='/api/public/settings')return json(await getSiteSettings(env));
 if(path==='/api/public/recruitment')return json(publicRecruitment(await getRecruitment(env)));
 if(path==='/api/public/stats')return json(await publicStats(env));
 if(path==='/api/public/gallery'){const r=await env.DB.prepare('SELECT * FROM gallery_images WHERE published=1 ORDER BY sort_order ASC,id ASC').all();return json({gallery:r.results||[]})}
 if(path==='/api/public/training'){const r=await env.DB.prepare('SELECT * FROM training_sessions WHERE published=1 ORDER BY sort_order ASC,id ASC').all();return json({training:r.results||[]})}
 if(path==='/api/public/events'){const r=await env.DB.prepare('SELECT * FROM events ORDER BY event_date DESC,id DESC').all();return json({events:sortEvents(r.results||[])})}
 if(path==='/api/public/notices'){const r=await env.DB.prepare('SELECT * FROM notices WHERE published=1 ORDER BY pinned DESC,created_at DESC').all();return json({notices:r.results||[]})}
 if(path==='/api/public/publications'){const r=await env.DB.prepare("SELECT * FROM publications WHERE published_status='published' ORDER BY publication_year DESC,id DESC").all();return json({publications:r.results||[]})}
 if(path==='/api/public/alumni'){const r=await env.DB.prepare('SELECT * FROM alumni WHERE published=1 ORDER BY id DESC').all();return json({alumni:r.results||[]})}
 if(path==='/api/public/blog'){const r=await env.DB.prepare("SELECT * FROM blog_posts WHERE status='published' ORDER BY published_at DESC,id DESC").all();return json({posts:r.results||[]})}
 return null;
}
async function authRoutes(req,env,path){if(path==='/api/auth/me'){return json({user:await currentUser(req,env)})}if(path==='/api/auth/logout'){const c=parseCookie(req.headers.get('Cookie')||'');if(c.iurs_session){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256Base64(c.iurs_session)).run()}return json({ok:true},{headers:{'set-cookie':cookieOptions(0)}})}return null}
async function adminRoutes(req,env,user,path){if(!allowed(user))return json({error:'Unauthorized'},403);const m=req.method;let b={};try{if(req.headers.get('content-type')?.includes('application/json'))b=await req.json()}catch{}
 if(path==='/api/admin/summary'&&m==='GET'){const [n,e,p,a]=await Promise.all([env.DB.prepare('SELECT COUNT(*) c FROM notices').first(),env.DB.prepare('SELECT COUNT(*) c FROM events').first(),env.DB.prepare('SELECT COUNT(*) c FROM publications').first(),env.DB.prepare('SELECT COUNT(*) c FROM applications WHERE status=\'pending\'').first()]);return json({notices:n?.c||0,events:e?.c||0,publications:p?.c||0,pendingApplications:a?.c||0})}
 if(path==='/api/admin/gallery'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM gallery_images ORDER BY sort_order ASC,id ASC').all();return json({gallery:r.results||[]})}
 if(path==='/api/admin/training'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM training_sessions ORDER BY sort_order ASC,id ASC').all();return json({training:r.results||[]})}
 if(path==='/api/admin/notices'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM notices ORDER BY pinned DESC,created_at DESC').all();return json({notices:r.results||[]})}
 if(path==='/api/admin/events'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM events ORDER BY event_date DESC,id DESC').all();return json({events:r.results||[]})}
 if(path==='/api/admin/publications'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM publications ORDER BY publication_year DESC,id DESC').all();return json({publications:r.results||[]})}
 if(path==='/api/admin/members'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM users ORDER BY id DESC').all();return json({members:r.results||[]})}
 if(path==='/api/admin/applications'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();return json({applications:r.results||[]})}
 if(path==='/api/admin/activity'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 200').all();return json({logs:r.results||[]})}
 if(path==='/api/admin/recruitment'&&m==='GET')return json(await getRecruitment(env));
 if(path==='/api/admin/recruitment'&&m==='PUT'){const s={...RECRUITMENT_DEFAULTS,...(b||{})};await env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES ('recruitment',?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(JSON.stringify(s)).run();await logActivity(env,user,'update','recruitment','');return json({ok:true,recruitment:s})}
 if(path==='/api/admin/site-settings'&&m==='GET')return json(await getSiteSettings(env));
 if(path==='/api/admin/site-settings'&&m==='PUT'){const s={...SITE_DEFAULTS,...(b||{})};await env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES ('site',?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(JSON.stringify(s)).run();await logActivity(env,user,'update','site-settings','');return json({ok:true,settings:s})}
 if(path==='/api/admin/stats'&&m==='GET')return json(await publicStats(env));
 if(path==='/api/admin/stats'&&m==='PUT'){for(const k of STAT_KEYS){if(b[k]!==undefined)await env.DB.prepare('INSERT INTO site_stats(key,value,label) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,label=excluded.label').bind(k,cleanText(b[k],100),STAT_LABELS[k]).run()}await logActivity(env,user,'update','stats','');return json({ok:true})}
 if(path==='/api/admin/gallery'&&m==='POST'){const title=cleanText(b.title,200);const image=safeUrl(b.imageUrl);if(!title||!image)return json({error:'Title and image are required.'},400);const r=await env.DB.prepare('INSERT INTO gallery_images(category,title,caption,image_url,fit,featured,published,sort_order) VALUES (?,?,?,?,?,?,?,?)').bind(cleanText(b.category,40)||'Events',title,cleanText(b.caption,1000)||null,image,cleanText(b.fit,20)||'cover',b.featured?1:0,b.published===false?0:1,Number.isFinite(Number(b.sortOrder))?Number(b.sortOrder):9999).run();await logActivity(env,user,'create','gallery',r.meta?.last_row_id||'');return json({ok:true})}
 if(path.match(/^\/api\/admin\/gallery\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop());const title=cleanText(b.title,200);const image=safeUrl(b.imageUrl);if(!title||!image)return json({error:'Title and image are required.'},400);await env.DB.prepare('UPDATE gallery_images SET category=?,title=?,caption=?,image_url=?,fit=?,featured=?,published=?,sort_order=?,updated_at=datetime(\'now\') WHERE id=?').bind(cleanText(b.category,40)||'Events',title,cleanText(b.caption,1000)||null,image,cleanText(b.fit,20)||'cover',b.featured?1:0,b.published===false?0:1,b.sortOrder===''?9999:Number(b.sortOrder),id).run();await logActivity(env,user,'update','gallery',id);return json({ok:true})}
 if(path.match(/^\/api\/admin\/gallery\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM gallery_images WHERE id=?').bind(id).run();await logActivity(env,user,'delete','gallery',id);return json({ok:true})}
 if(path.match(/^\/api\/admin\/training\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM training_sessions WHERE id=?').bind(id).run();return json({ok:true})}
 if(path==='/api/admin/training'&&m==='POST'){const title=cleanText(b.title,200);if(!title)return json({error:'Title required'},400);await env.DB.prepare('INSERT INTO training_sessions(title,description,image_url,date_text,venue,registration_url,published,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?)').bind(title,cleanText(b.description,3000),safeUrl(b.imageUrl),cleanText(b.dateText,100),cleanText(b.venue,300),safeUrl(b.registrationUrl),b.published===false?0:1,b.featured?1:0,Number.isFinite(Number(b.sortOrder))?Number(b.sortOrder):9999).run();return json({ok:true})}
 if(path==='/api/setup/initial-admin'&&m==='POST'){return json({error:'Unauthorized'},403)}
 return json({error:'Not found'},404)}
async function handle(req,env){const url=new URL(req.url);const path=url.pathname;await ensureSchema(env);if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':url.origin,'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'Content-Type,Cookie'}});if(path.startsWith('/api/auth/')){const r=await authRoutes(req,env,path);if(r)return r}if(path.startsWith('/api/public/')){const r=await publicRoutes(req,env,path);if(r)return r}if(path.startsWith('/api/admin/')){const user=await currentUser(req,env);const r=await adminRoutes(req,env,user,path);if(r)return r}if(path==='/api/health')return json({ok:true});if(path.startsWith('/uploads/')){const o=await env.MEDIA?.get(path.slice('/uploads/'.length));if(!o)return new Response('Not found',{status:404});const h=new Headers();o.writeHttpMetadata?.(h);h.set('etag',o.httpEtag||'');h.set('cache-control','public, max-age=31536000, immutable');return new Response(o.body,{headers:h})}return env.ASSETS.fetch(req)}

}
};
