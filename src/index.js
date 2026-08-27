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
/* Labels for the public counters. The admin panel edits the numbers; the wording
   lives here so a fresh database and an existing one always read the same. */
const STAT_LABELS = {members:'Community Members',research_outputs:'Research Outputs',workshops:'Workshops & Training',peer_reviewed:'Peer-reviewed Articles',working_papers:'Working Papers',under_review:'Manuscripts Under Review',best_paper:'Best Paper Award'};
const STAT_KEYS = Object.keys(STAT_LABELS);
/* ---------------------------------------------------------------------------
   Recruitment window. The Join IURS form is only usable while this is open, so
   the society is not collecting applications (or membership fees) in a month
   when nobody is reading them. Everything here is editable from the admin panel;
   these values are only the starting point for a database that has never had the
   settings saved. Dates are plain YYYY-MM-DD so they can be typed into a date
   input, and are compared as strings, which is safe for that fixed format.
   --------------------------------------------------------------------------- */
const RECRUITMENT_DEFAULTS = {
 open:false,
 title:'Member Recruitment',
 closedMessage:'Member recruitment is closed at the moment. Follow our Facebook page and this website — the next call for members will be announced here first.',
 openMessage:'Recruitment is open. Please complete every field and pay the membership fee before submitting.',
 opensOn:'',
 closesOn:'',
 fee:'150',
 currency:'BDT',
 feeNote:'One-time membership fee for the current session.',
 methods:'bKash,Nagad,Rocket,Bank transfer',
 payTo:'+880 1749-022577',
 payToLabel:'bKash / Nagad (Personal)',
 requirePayment:true
};
const RECRUITMENT_KEY='recruitment';
async function getRecruitment(env){
 try{
  const row=await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind(RECRUITMENT_KEY).first();
  if(!row||!row.value)return {...RECRUITMENT_DEFAULTS};
  const saved=JSON.parse(row.value);
  return {...RECRUITMENT_DEFAULTS,...(saved&&typeof saved==='object'?saved:{})};
 }catch(e){console.error('recruitment settings unreadable, using defaults',e);return {...RECRUITMENT_DEFAULTS}}
}
/* "Open" means the switch is on AND today is inside the window. An empty date is
   deliberately treated as no bound rather than as a failed comparison, so the
   admin can open recruitment without committing to an end date. */
function recruitmentIsOpen(s,today){
 if(!s.open)return false;
 const d=today||new Date().toISOString().slice(0,10);
 if(s.opensOn&&d<s.opensOn)return false;
 if(s.closesOn&&d>s.closesOn)return false;
 return true;
}
function publicRecruitment(s){
 const open=recruitmentIsOpen(s);
 return {open,title:s.title,message:open?s.openMessage:s.closedMessage,opensOn:s.opensOn||null,closesOn:s.closesOn||null,
  fee:s.fee||'',currency:s.currency||'BDT',feeNote:s.feeNote||'',requirePayment:!!s.requirePayment,
  methods:String(s.methods||'').split(',').map(x=>x.trim()).filter(Boolean),
  payTo:s.payTo||'',payToLabel:s.payToLabel||''};
}
/* Every API answer is private and must never be cached. Without this Cloudflare's edge
   happily stored /api/auth/me for an hour: an administrator who had already changed
   their password kept being handed the old must_change_password:1 answer, so the
   dashboard locked itself on the Security tab again on every single visit. The same
   stale copies made deleted publications and unpublished notices reappear. */
const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','vary':'Cookie',...extra}});
const cookieOptions = maxAge => `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
/* Cloudflare Workers refuses a PBKDF2 iteration count above 100000: crypto.subtle
   .deriveBits throws instead of returning a key. That made every password hash and
   every password check fail in production while passing locally, because Node's
   WebCrypto has no such ceiling. Keep this at or below 100000. */
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
  if(schemaReady) return schemaReady;
  schemaReady=(async()=>{
    const ddl=[
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,iurs_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','executive','admin')),name TEXT NOT NULL,email TEXT,department TEXT,year_level TEXT,position TEXT,phone TEXT,photo_url TEXT,status TEXT NOT NULL DEFAULT 'active',must_change_password INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,level TEXT NOT NULL DEFAULT 'normal',published INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,image_url TEXT,link_url TEXT,attachment_url TEXT,attachment_name TEXT,pinned INTEGER NOT NULL DEFAULT 0,notice_date TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,event_date TEXT,event_time TEXT,venue TEXT,description TEXT,status TEXT NOT NULL DEFAULT 'upcoming',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,image_url TEXT,link_url TEXT,registration_url TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS publications (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,authors TEXT NOT NULL,category TEXT NOT NULL,journal TEXT,publication_year INTEGER,doi TEXT,url TEXT,abstract TEXT,published_status TEXT NOT NULL DEFAULT 'published',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,featured INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS site_stats (key TEXT PRIMARY KEY,value TEXT NOT NULL,label TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role,status)`,
      `CREATE INDEX IF NOT EXISTS idx_publications_category_year ON publications(category,publication_year DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status,event_date)`,
      `CREATE INDEX IF NOT EXISTS idx_notices_published_created ON notices(published,created_at DESC)`,
      `INSERT OR IGNORE INTO site_stats(key,value,label) VALUES ('members','459+','Community Members'),('research_outputs','7','Research Outputs'),('workshops','6+','Workshops & Training'),('peer_reviewed','4','Peer-reviewed Articles'),('working_papers','10+','Working Papers'),('under_review','3+','Manuscripts Under Review'),('best_paper','1','Best Paper Award')`,
      // Single place for switches the admin can flip, e.g. whether recruitment is open.
      `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,attempt_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time ON login_attempts(attempt_key,created_at)`,
      `CREATE TABLE IF NOT EXISTS gallery_images (id INTEGER PRIMARY KEY AUTOINCREMENT,seed_key TEXT UNIQUE,category TEXT NOT NULL DEFAULT 'Events',title TEXT NOT NULL,caption TEXT,image_url TEXT NOT NULL,fit TEXT NOT NULL DEFAULT 'cover',featured INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_gallery_pub_order ON gallery_images(published,sort_order,id)`,
      `CREATE TABLE IF NOT EXISTS training_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,seed_key TEXT UNIQUE,title TEXT NOT NULL,trainer TEXT,description TEXT,date_label TEXT,image_url TEXT,link_url TEXT,published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_training_pub_order ON training_sessions(published,sort_order,id)`,
      `CREATE TABLE IF NOT EXISTS committee_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,label TEXT NOT NULL UNIQUE,description TEXT,reference_note TEXT,is_current INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS executives (id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER NOT NULL,name TEXT NOT NULL,designation TEXT NOT NULL,department TEXT,tier TEXT NOT NULL DEFAULT 'roster',photo_url TEXT,email TEXT,linkedin_url TEXT,facebook_url TEXT,sl_no INTEGER,sort_order INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(session_id) REFERENCES committee_sessions(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_exec_session ON executives(session_id,tier,sort_order,id)`,
      `CREATE TABLE IF NOT EXISTS alumni (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,session_label TEXT,department TEXT,graduation_year TEXT,occupation TEXT,organization TEXT,photo_url TEXT,bio TEXT,standing TEXT NOT NULL DEFAULT 'current',published INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_alumni_standing ON alumni(published,standing,sort_order,id)`,
      `CREATE TABLE IF NOT EXISTS blog_posts (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,author TEXT,category TEXT,excerpt TEXT,content TEXT,image_url TEXT,status TEXT NOT NULL DEFAULT 'draft',post_date TEXT,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_blog_status_date ON blog_posts(status,post_date DESC,id DESC)`,
      `CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,student_id TEXT,department TEXT,academic_session TEXT,year_level TEXT,email TEXT,phone TEXT,research_interests TEXT,skills TEXT,experience TEXT,motivation TEXT,payment_method TEXT,transaction_id TEXT,payment_amount TEXT,payment_sender TEXT,payment_date TEXT,payment_status TEXT NOT NULL DEFAULT 'unverified',payment_note TEXT,verified_at TEXT,verified_by TEXT,status TEXT NOT NULL DEFAULT 'pending',admin_notes TEXT,source_key TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status,created_at DESC)`,
      /* Where uploaded pictures and documents live when R2 is not switched on for the
         account. R2 has to be enabled by hand in the Cloudflare dashboard, and until
         somebody does that every upload used to fail with "storage is not connected",
         which meant the dashboard's drag-and-drop simply did not work. Keeping the
         bytes in D1 is not how you would store a photo library, but a committee photo
         is a few tens of kilobytes and this makes the feature work with no setup at
         all. When R2 is available it is still preferred — see putUpload below. */
      `CREATE TABLE IF NOT EXISTS media_blobs (key TEXT PRIMARY KEY,content_type TEXT NOT NULL,bytes BLOB NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    ];
    /* Indexes over columns that ALTER TABLE adds below. They cannot live in `ddl`:
       on a database that predates the column, CREATE TABLE IF NOT EXISTS is a no-op,
       so the index statement would run first and fail with "no such column" — which
       rejects this whole promise and makes every API call return a 500. */
    const lateIndexes=[
      `CREATE INDEX IF NOT EXISTS idx_applications_txn ON applications(transaction_id)`,
      /* The publication list once appeared twice on the page. A count-based seed
         guard ("insert the seven papers only if the table is empty") is not atomic:
         two Worker isolates starting at the same moment both read zero and both
         insert, so every paper is stored twice. This index makes the seed rows
         collide instead, so the second writer is ignored rather than duplicated.
         NULLs stay distinct in SQLite, so rows the admin adds are unaffected. */
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_seed_key ON publications(seed_key)`
    ];
    /* Repairs run once per cold start on data that already exists. They are all
       no-ops on a healthy database and must run BEFORE lateIndexes, because a
       unique index cannot be created while duplicate rows are still present. */
    const repairs=[
      // Collapse papers that are the same entry, keeping the oldest row so its id,
      // admin edits and sort position survive. Titles are compared with the case and
      // the apostrophes stripped, because the real duplicates differed only by a
      // curly ’ versus a straight ' — grouping on lower(trim(title)) alone missed them.
      `DELETE FROM publications WHERE id NOT IN (SELECT MIN(id) FROM publications GROUP BY ${NORM_TITLE},category)`,
      // Same non-atomic guard seeds the committee, so the same fix applies.
      `DELETE FROM executives WHERE id NOT IN (SELECT MIN(id) FROM executives GROUP BY session_id,lower(trim(name)),lower(trim(designation)))`,
      `DELETE FROM notices WHERE id NOT IN (SELECT MIN(id) FROM notices GROUP BY ${NORM_TITLE},lower(trim(body)))`,
      `DELETE FROM events WHERE id NOT IN (SELECT MIN(id) FROM events GROUP BY ${NORM_TITLE})`
    ];
    const seeds=[
      `INSERT INTO events(title,event_date,event_time,venue,description,status,image_url) SELECT 'Orientation to Research Methodology','2026-05-03','9:30 AM','IIER Building, Room 101','Keynote by Professor Mohammed Asaduzzaman, PhD. Chair: Taqy Wasif. Host: Ashfia Kaniz Fatema.','past','assets/orientation-research-methodology.jpg' WHERE NOT EXISTS (SELECT 1 FROM events)`,
      `INSERT INTO events(title,event_date,event_time,venue,description,status,image_url) SELECT 'The Unveiling: Research Insights & Leadership Transition','2025-08-12','9:00 AM – 4:00 PM','Gagan Harkara Gallery, Rabindra-Nazrul Arts Building','Panel seminar with faculty from Bangla, Arabic, Pharmacy, Chemical Engineering, and Social Welfare departments.','past','assets/event-unveiling-seminar.jpg' WHERE (SELECT COUNT(*) FROM events)=1`,
      `INSERT INTO events(title,event_date,event_time,venue,description,status,image_url) SELECT 'Study in Europe: Opportunities, Admissions & Scholarships','2026-02-04','10:00 PM','Online','Speaker: Mohammad Nazmus Sakib, PhD Candidate, Daugavpils University, Latvia.','past','assets/webinar-study-europe.jpg' WHERE (SELECT COUNT(*) FROM events)=2`,
      `INSERT INTO events(title,event_date,event_time,venue,description,status,image_url) SELECT 'Smart Office Tools for University Students','2026-02-25','Classes start 25 Feb','Online','Trainer: S. M. Shahriar Shadhin. Covers Word, PowerPoint, Excel and productivity skills.','past','assets/smart-office-tools-2026.jpg' WHERE (SELECT COUNT(*) FROM events)=3`,
      `INSERT INTO events(title,event_date,event_time,venue,description,status,image_url) SELECT 'Member Recruitment 4.1','2026-01-01','Registration ongoing','Islamic University, Kushtia','Open for students who want to explore research, improve writing and presentation skills, and join research workshops with mentorship support.','upcoming','assets/recruitment-4.1.jpg' WHERE (SELECT COUNT(*) FROM events)=4`
    ];
    // Create/alter everything BEFORE any seed row is inserted. A database that
    // predates a column gets it added here; CREATE TABLE IF NOT EXISTS cannot do
    // that on its own, and the seed statements below reference those columns, so
    // running the seeds first would fail on any pre-existing database.
    for(const q of ddl) await env.DB.prepare(q).run();
    // Added columns are deliberately nullable: SQLite refuses ALTER TABLE ADD
    // COLUMN for a NOT NULL column whose default is not a constant, and
    // updated_at is always written explicitly as datetime('now') anyway.
    const columns={notices:[['image_url','TEXT'],['link_url','TEXT'],['updated_at','TEXT'],
      /* A notice is the one thing that regularly carries a PDF — a circular, a
         results sheet, a form. attachment_url holds it (an uploaded file or a
         pasted link) and attachment_name is what the download button should say. */
      ['attachment_url','TEXT'],['attachment_name','TEXT'],['pinned','INTEGER NOT NULL DEFAULT 0'],['notice_date','TEXT']],
      events:[['image_url','TEXT'],['link_url','TEXT'],['registration_url','TEXT'],['updated_at','TEXT']],publications:[['featured','INTEGER NOT NULL DEFAULT 0'],['updated_at','TEXT'],['seed_key','TEXT'],['type_label','TEXT'],['sort_order','INTEGER NOT NULL DEFAULT 0']],executives:[['facebook_url','TEXT']],
      /* Membership fee details. payment_status is kept separate from status so an
         application cannot be approved by accident before the money is checked:
         the admin has to match transaction_id against the receiving account and
         mark it verified, and only then does approving become possible. */
      applications:[['payment_method','TEXT'],['transaction_id','TEXT'],['payment_amount','TEXT'],['payment_sender','TEXT'],['payment_date','TEXT'],["payment_status","TEXT NOT NULL DEFAULT 'unverified'"],['payment_note','TEXT'],['verified_at','TEXT'],['verified_by','TEXT'],['year_level','TEXT']]};
    for(const [table,cols] of Object.entries(columns)){
      const info=await env.DB.prepare(`PRAGMA table_info(${table})`).all();const have=new Set((info.results||[]).map(x=>x.name));
      for(const [name,type] of cols) if(!have.has(name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run();
      if(!have.has('updated_at')&&cols.some(c=>c[0]==='updated_at')) await env.DB.prepare(`UPDATE ${table} SET updated_at=created_at WHERE updated_at IS NULL`).run();
    }
    for(const q of repairs) await env.DB.prepare(q).run();
    /* A database written before the seed_key column existed stores the seven seeded
       papers with seed_key NULL, so the unique index below could not recognise them
       and a re-seed would insert a second copy. Stamp them first. */
    for(const r of PUBLICATION_SEED) await env.DB.prepare('UPDATE publications SET seed_key=? WHERE seed_key IS NULL AND lower(trim(title))=lower(trim(?))').bind(r.seed_key,r.title).run();
    for(const q of lateIndexes) await env.DB.prepare(q).run();
    for(const q of seeds) await env.DB.prepare(q).run();
    const gc=await env.DB.prepare('SELECT COUNT(*) c FROM gallery_images').first();
    if(!gc||!gc.c){const rows=GALLERY_SEED.map((r,i)=>env.DB.prepare('INSERT OR IGNORE INTO gallery_images(seed_key,category,title,caption,image_url,fit,featured,sort_order) VALUES(?,?,?,?,?,?,?,?)').bind('seed:'+i+':'+r.image_url,GALLERY_CATEGORIES.includes(r.category)?r.category:'Events',r.title,r.caption||null,r.image_url,r.fit==='contain'?'contain':'cover',i<5?1:0,i));if(rows.length) await env.DB.batch(rows)}
    const tc=await env.DB.prepare('SELECT COUNT(*) c FROM training_sessions').first();
    if(!tc||!tc.c){const rows=TRAINING_SEED.map((r,i)=>env.DB.prepare('INSERT OR IGNORE INTO training_sessions(seed_key,title,trainer,description,date_label,image_url,sort_order) VALUES(?,?,?,?,?,?,?)').bind(r.seed_key,r.title,r.trainer||null,r.description||null,r.date_label||null,r.image_url||null,i));if(rows.length) await env.DB.batch(rows)}
    // Committee 2025-2026 and its 33 members, exactly as the page already showed them.
    const cc=await env.DB.prepare('SELECT COUNT(*) c FROM committee_sessions').first();
    if(!cc||!cc.c){
      await env.DB.prepare('INSERT INTO committee_sessions(label,description,reference_note,is_current,sort_order) VALUES(?,?,?,1,0)').bind(COMMITTEE_SEED.label,COMMITTEE_SEED.description,COMMITTEE_SEED.reference).run();
      const s=await env.DB.prepare('SELECT id FROM committee_sessions WHERE label=?').bind(COMMITTEE_SEED.label).first();
      if(s){const rows=EXECUTIVE_SEED.map((r,i)=>env.DB.prepare('INSERT INTO executives(session_id,name,designation,department,tier,sl_no,sort_order) VALUES(?,?,?,?,?,?,?)').bind(s.id,r.name,r.designation,r.department||null,r.tier,r.sl_no||null,i));if(rows.length) await env.DB.batch(rows)}
    }
    // The seven research outputs already published on the site.
    const pc=await env.DB.prepare('SELECT COUNT(*) c FROM publications').first();
    if(!pc||!pc.c){const rows=PUBLICATION_SEED.map((r,i)=>env.DB.prepare('INSERT OR IGNORE INTO publications(seed_key,title,authors,category,type_label,journal,publication_year,doi,url,abstract,published_status,featured,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(r.seed_key,r.title,r.authors,r.category,r.type_label,r.journal||null,r.publication_year||null,r.doi||null,r.url||null,r.abstract||null,'published',i<2?1:0,r.sort_order));if(rows.length) await env.DB.batch(rows)}
    // Older rows used free-text categories; normalise them so the four tabs work.
    await env.DB.prepare("UPDATE publications SET category='peer_reviewed' WHERE category IN ('peer-reviewed','Peer-reviewed','peer reviewed','journal')").run();
    await env.DB.prepare("UPDATE publications SET category='conference' WHERE category IN ('Conference','conference_paper','conference paper','research','Research Paper')").run();
    await env.DB.prepare("UPDATE publications SET category='working_paper' WHERE category IN ('working','Working Paper','working paper')").run();
    await env.DB.prepare("UPDATE publications SET category='under_review' WHERE category IN ('review','Under Review','under review')").run();
    // The roster's serial numbers were typed in by hand and started at 5, so the public
    // table read "5, 6, 7..." instead of "1, 2, 3...". Clearing them makes the page count
    // the rows itself, which stays right no matter who is added or removed later.
    await env.DB.prepare("UPDATE executives SET sl_no=NULL WHERE sl_no IS NOT NULL").run();
  })().catch(e=>{schemaReady=null;throw e});
  return schemaReady;
}
const body = req => req.json().catch(()=>({}));
function cleanUrl(v){const s=String(v||'').trim();if(!s||s.length>500)return null;
 if(/^https?:\/\//i.test(s)){try{const u=new URL(s);return(u.protocol==='http:'||u.protocol==='https:')?u.href:null}catch{return null}}
 // A scheme of any kind (javascript:, data:, vbscript:) and a protocol-relative "//host"
 // are refused outright. Whatever is left is treated as a path inside this site.
 if(/^\/\//.test(s)||/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(s)||s.includes('..')||s.includes('\\')||/[\u0000-\u001f<>"'`?#]/.test(s))return null;
 // Real photo filenames contain spaces, brackets, ampersands and Bengali letters, and all
 // of those are perfectly legal in a url once escaped. So escape them instead of throwing
 // the path away: returning null here is what made the panel say "Saved." and then show
 // no picture at all, with nothing on screen to explain why.
 let out;try{out=s.replace(/%(?![0-9a-fA-F]{2})|[^\w%./~-]/gu,c=>encodeURIComponent(c))}catch{return null}
 return out&&out!=='/'?out:null}
// True when something was typed but cleanUrl could not make a usable address of it, so the
// handler can answer with a real message rather than quietly storing NULL behind "Saved."
function badUrl(raw,cleaned){return String(raw||'').trim()!==''&&cleaned===null}
const PHOTO_REJECTED='That photo address could not be used. Drag a picture onto the photo box instead, or paste a full link starting with https://';
function cleanText(v,max=10000){return String(v??'').trim().slice(0,max)}
function isoDate(v){const s=cleanText(v,20);return s||null}
// The admin dashboard has an optional "Order" box. If it is filled in we respect
// the number; if it is left empty the new item simply goes to the end of the list.
function sortValue(v,fallback){return(v===''||v===null||v===undefined||!Number.isFinite(+v))?fallback:Math.trunc(+v)}
function sniffImage(b){const u=new Uint8Array(b),h=(...v)=>v.every((x,i)=>u[i]===x);
 if(h(0xFF,0xD8,0xFF))return 'image/jpeg';
 if(h(0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A))return 'image/png';
 if(u[0]===0x47&&u[1]===0x49&&u[2]===0x46&&u[3]===0x38)return 'image/gif';
 if(u[0]===0x52&&u[1]===0x49&&u[2]===0x46&&u[3]===0x46&&u[8]===0x57&&u[9]===0x45&&u[10]===0x42&&u[11]===0x50)return 'image/webp';
 if(u[4]===0x66&&u[5]===0x74&&u[6]===0x79&&u[7]===0x70&&u[8]===0x61&&u[9]===0x76&&u[10]===0x69&&u[11]===0x66)return 'image/avif';
 return null}
// Documents, by their real first bytes. %PDF- for PDF, "PK" for the ZIP container
// that every modern Office file is, and the old OLE2 header for legacy .doc/.xls.
function sniffDoc(b){const u=new Uint8Array(b),h=(...v)=>v.every((x,i)=>u[i]===x);
 if(h(0x25,0x50,0x44,0x46,0x2D))return 'application/pdf';
 if(h(0x50,0x4B,0x03,0x04)||h(0x50,0x4B,0x05,0x06))return 'application/zip';
 if(h(0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1))return 'application/msword';
 return null}
function uploadKey(url){const s=String(url||'');return s.startsWith('/uploads/')?s.slice('/uploads/'.length):null}// Turn a title into a clean web address piece, e.g. "Our First Workshop" -> "our-first-workshop".
function slugify(v){return cleanText(v,160).toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/[\s-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)}
async function uniqueSlug(env,wanted,ignoreId){let base=slugify(wanted)||('post-'+Date.now());let slug=base;
 for(let n=2;n<200;n++){const clash=await env.DB.prepare('SELECT id FROM blog_posts WHERE slug=? AND id<>?').bind(slug,ignoreId||0).first();if(!clash)return slug;slug=base+'-'+n}
 return base+'-'+Date.now()}
async function maybeDeleteUpload(env,url){const key=uploadKey(url);if(!key)return;
 for(const [t,col] of [['gallery_images','image_url'],['training_sessions','image_url'],['notices','image_url'],['notices','attachment_url'],['events','image_url'],['publications','url'],['executives','photo_url'],['alumni','photo_url'],['blog_posts','image_url']]){
  try{const r=await env.DB.prepare(`SELECT COUNT(*) c FROM ${t} WHERE ${col}=?`).bind(url).first();if(r&&r.c)return}catch{}}
 if(env.MEDIA){try{await env.MEDIA.delete(key)}catch(e){console.error('R2 delete failed',e)}}
 try{await env.DB.prepare('DELETE FROM media_blobs WHERE key=?').bind(key).run()}catch(e){console.error('media_blobs delete failed',e)}}

/* Storing an upload. R2 is the right home for files and is used whenever the binding
   is present. When it is not — R2 has to be switched on by hand in the Cloudflare
   dashboard, and on this account it is not — the bytes go into D1 instead so that
   drag-and-drop still works out of the box. D1 rows are kept small on purpose: the
   dashboard shrinks pictures in the browser before sending them, and anything still
   over D1_BLOB_MAX is refused with an explanation rather than silently dropped. */
const D1_BLOB_MAX = 900 * 1024;
async function putUpload(env,key,buf,contentType){
 if(env.MEDIA){
  try{await env.MEDIA.put(key,buf,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'}});return{ok:true,where:'r2'}}
  catch(e){console.error('R2 put failed',e);return{ok:false,status:502,error:'Upload failed while saving the file. Please try again.'}}}
 if(buf.byteLength>D1_BLOB_MAX)
  return{ok:false,status:413,error:`This file is ${(buf.byteLength/1024).toFixed(0)} KB. Without Cloudflare R2 switched on, a single upload has to stay under ${Math.round(D1_BLOB_MAX/1024)} KB. Please use a smaller picture, or turn on R2 in the Cloudflare dashboard to lift the limit.`};
 try{await env.DB.prepare('INSERT OR REPLACE INTO media_blobs(key,content_type,bytes,size) VALUES(?,?,?,?)').bind(key,contentType,buf,buf.byteLength).run();return{ok:true,where:'d1'}}
 catch(e){console.error('media_blobs put failed',e);return{ok:false,status:502,error:'Upload failed while saving the file. Please try again.'}}}


async function login(req,env){if(!sameOrigin(req))return json({error:'Invalid origin'},403);const b=await body(req);const id=cleanText(b.iursId,80).toUpperCase(),pw=String(b.password||'');if(!id||!pw)return json({error:'IURS ID and password are required.'},400);const ip=req.headers.get('CF-Connecting-IP')||'unknown';const rlKey=`${id}|${ip}`;const recent=await env.DB.prepare("SELECT COUNT(*) c FROM login_attempts WHERE attempt_key=? AND created_at>datetime('now','-15 minutes')").bind(rlKey).first();if(Number(recent?.c||0)>=8)return json({error:'Too many failed sign-in attempts. Please wait 15 minutes before trying again.'},429);const row=await env.DB.prepare('SELECT * FROM users WHERE upper(iurs_id)=? LIMIT 1').bind(id).first();if(!row||row.status!=='active'||!(await verifyPassword(pw,row.password_hash))){await env.DB.prepare('INSERT INTO login_attempts(attempt_key) VALUES(?)').bind(rlKey).run();return json({error:'Invalid IURS ID or password.'},401)}await env.DB.prepare('DELETE FROM login_attempts WHERE attempt_key=?').bind(rlKey).run();await env.DB.prepare("DELETE FROM login_attempts WHERE created_at<=datetime('now','-1 day')").run();await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')").run();const token=await randomToken(),hash=await sha256Base64(token),expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await env.DB.prepare('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)').bind(row.id,hash,expires).run();const target=row.role==='member'?'/dashboard.html':'/admin.html';return json({ok:true,user:cleanUser(row),redirect:target},200,{'Set-Cookie':`iurs_session=${token}; ${cookieOptions(SESSION_DAYS*86400)}`})}
async function logout(req,env){const c=parseCookie(req.headers.get('Cookie')||'');if(c.iurs_session)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256Base64(c.iurs_session)).run();return json({ok:true},200,{'Set-Cookie':`iurs_session=; ${cookieOptions(0)}`})}
async function setup(req,env){if(!sameOrigin(req))return json({error:'Invalid origin'},403);const token=req.headers.get('X-IURS-Setup-Token')||'';if(env.SETUP_TOKEN && token!==env.SETUP_TOKEN)return json({error:'Invalid setup token.'},403);const c=await env.DB.prepare('SELECT COUNT(*) c FROM users').first();if(Number(c?.c||0)>0)return json({error:'Initial setup is already complete.'},409);const b=await body(req);const id=cleanText(b.iursId,80).toUpperCase(),name=cleanText(b.name,160),email=cleanText(b.email,200),position=cleanText(b.position||'General Secretary',120),pw=String(b.password||'');if(!id||!name||pw.length<10)return json({error:'Name, IURS ID and password (10+ characters) are required.'},400);
 /* When the deploy script generates a temporary password the account MUST be forced
    to change it at first login. A person using /setup.html chooses their own password,
    so there is nothing to force in that case. */
 const force=b.mustChangePassword===true||b.mustChangePassword===1||b.mustChangePassword==='1'?1:0;
 const ph=await hashPassword(pw,crypto.getRandomValues(new Uint8Array(16)));await env.DB.prepare('INSERT INTO users(iurs_id,password_hash,role,name,email,position,must_change_password) VALUES(?,?,?,?,?,?,?)').bind(id,ph,'admin',name,email,position,force).run();return json({ok:true,mustChangePassword:!!force,message:'Admin created. You can now sign in.'})}

async function changePassword(req,env,user){if(!user)return json({error:'Authentication required.'},401);const b=await body(req),old=String(b.currentPassword||''),next=String(b.newPassword||'');const row=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first();if(!row||!(await verifyPassword(old,row.password_hash)))return json({error:'Current password is incorrect.'},400);if(next.length<10)return json({error:'New password must be at least 10 characters.'},400);const ph=await hashPassword(next,crypto.getRandomValues(new Uint8Array(16)));await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=0,updated_at=datetime('now') WHERE id=?").bind(ph,user.id).run();const cc=parseCookie(req.headers.get('Cookie')||'');await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id,await sha256Base64(cc.iurs_session||'')).run();return json({ok:true})}

/* ---------------------------------------------------------------------------
   Excel export. The society needs a real spreadsheet of applicants, not a CSV:
   Excel silently turns a transaction id like 0179... into a number and drops the
   leading zero, and Bangla names come out as mojibake without a byte order mark.
   An .xlsx file is just a ZIP of XML parts, so the XML is written by hand and the
   entries are stored uncompressed — Excel accepts stored entries, which keeps
   this to a CRC32 table instead of a deflate implementation.
   --------------------------------------------------------------------------- */
let CRC_TABLE;
function crc32(bytes){
 if(!CRC_TABLE){CRC_TABLE=new Int32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);CRC_TABLE[i]=c}}
 let c=-1;for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&0xFF]^(c>>>8);
 return (c^-1)>>>0;
}
function zipStore(files){
 const enc=new TextEncoder();
 const u16=n=>[n&0xFF,(n>>>8)&0xFF];
 const u32=n=>[n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF];
 const local=[],cd=[];let offset=0;
 for(const f of files){
  const name=enc.encode(f.name);
  const data=typeof f.data==='string'?enc.encode(f.data):f.data;
  const crc=crc32(data);
  // 0x0021 is the DOS date for 1980-01-01. A fixed stamp keeps the bytes of an
  // export reproducible, which makes the file easy to test.
  const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x0021),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
  local.push(lh,name,data);
  cd.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x0021),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),name);
  offset+=lh.length+name.length+data.length;
 }
 const cdSize=cd.reduce((n,b)=>n+b.length,0);
 const eocd=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdSize),...u32(offset),...u16(0)]);
 const chunks=[...local,...cd,eocd];
 const out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));
 let p=0;for(const c of chunks){out.set(c,p);p+=c.length}
 return out;
}
// XML 1.0 has no escape for most control characters, so they are removed rather
// than encoded: one stray character would make Excel refuse the whole file.
const xmlText=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function colName(n){let s='';n++;while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=(n-1-r)/26}return s}
function sheetRow(r,cells){
 const out=cells.map((v,i)=>{
  const ref=colName(i)+r;
  if(v===null||v===undefined||v==='')return '';
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
  const style=r===1?' s="1"':'';
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
 }).join('');
 return `<row r="${r}"${r===1?' ht="22" customHeight="1"':''}>${out}</row>`;
}
function buildXlsx(sheetTitle,headers,rows,widths){
 const last=colName(Math.max(headers.length,1)-1);
 const body=[sheetRow(1,headers),...rows.map((cells,i)=>sheetRow(i+2,cells))].join('');
 const cols=(widths||headers.map(()=>18)).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  +`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  +`<dimension ref="A1:${last}${rows.length+1}"/>`
  +`<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
  +`<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols>`
  +`<sheetData>${body}</sheetData>`
  +`<autoFilter ref="A1:${last}${rows.length+1}"/></worksheet>`;
 // Fills 0 and 1 must be "none" then "gray125"; Excel treats any other order as corrupt.
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  +`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  +`<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>`
  +`<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
  +`<fill><patternFill patternType="solid"><fgColor rgb="FFA4112F"/><bgColor indexed="64"/></patternFill></fill></fills>`
  +`<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
  +`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  +`<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  +`<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>`
  +`<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 return zipStore([
  {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
  {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
  {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetTitle).slice(0,31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
  {name:'xl/styles.xml',data:styles},
  {name:'xl/worksheets/sheet1.xml',data:sheet}
 ]);
}
const APPLICATION_EXPORT=[
 ['id','#',6],['created_at','Submitted',18],['status','Status',12],['payment_status','Payment',12],
 ['name','Full name',24],['student_id','Student / IURS ID',18],['department','Department',22],
 ['academic_session','Session',12],['year_level','Year',10],['email','Email',26],['phone','Phone',16],
 ['payment_method','Paid via',14],['transaction_id','Transaction ID',22],['payment_amount','Amount',10],
 ['payment_sender','Paid from',16],['payment_date','Payment date',14],['verified_at','Verified at',18],
 ['verified_by','Verified by',16],['payment_note','Payment note',24],
 ['research_interests','Research interests',34],['skills','Skills',28],['experience','Experience',34],
 ['motivation','Why they want to join',40],['admin_notes','Admin notes',28]
];
function applicationRows(rows){
 return rows.map(r=>APPLICATION_EXPORT.map(([k])=>k==='id'?Number(r.id):(r[k]??'')));
}

async function adminApi(req,env,user,path){if(!allowed(user))return json({error:'Executive access required.'},403);const m=req.method;if(m!=='GET'&&!sameOrigin(req))return json({error:'Invalid origin'},403);

 if(path==='/api/admin/summary'&&m==='GET'){const [members,execs,papers,events,notices]=await Promise.all([env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role='member' AND status='active'").first(),env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role IN ('executive','admin') AND status='active'").first(),env.DB.prepare('SELECT COUNT(*) c FROM publications').first(),env.DB.prepare('SELECT COUNT(*) c FROM events').first(),env.DB.prepare('SELECT COUNT(*) c FROM notices WHERE published=1').first()]);return json({members:+members.c,executives:+execs.c,publications:+papers.c,events:+events.c,notices:+notices.c})}
 if(path==='/api/admin/members'&&m==='GET'){const r=await env.DB.prepare('SELECT id,iurs_id,name,email,department,year_level,position,phone,status,role,must_change_password,created_at FROM users ORDER BY id DESC').all();return json(r.results||[])}
 if(path==='/api/admin/members'&&m==='POST'){const b=await body(req),id=cleanText(b.iursId,80).toUpperCase(),name=cleanText(b.name,160),pw=String(b.password||'');if(!id||!name||pw.length<10)return json({error:'IURS ID, name and a 10+ character password are required.'},400);let role=b.role==='executive'?'executive':'member';if(role==='executive'&&user.role!=='admin')return json({error:'Only administrators can create executives.'},403);try{const ph=await hashPassword(pw,crypto.getRandomValues(new Uint8Array(16)));await env.DB.prepare('INSERT INTO users(iurs_id,password_hash,role,name,email,department,year_level,position,phone,must_change_password) VALUES(?,?,?,?,?,?,?,?,?,1)').bind(id,ph,role,name,cleanText(b.email,200)||null,cleanText(b.department,160)||null,cleanText(b.yearLevel,40)||null,cleanText(b.position,120)||null,cleanText(b.phone,60)||null).run()}catch(e){return json({error:'Could not create account. The IURS ID may already exist.'},400)}return json({ok:true})}
 if(path.startsWith('/api/admin/members/')&&m==='PUT'){const id=Number(path.split('/').pop());const target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'User not found.'},404);const b=await body(req);if(target.role==='admin'&&user.role!=='admin')return json({error:'Administrator account requires administrator access.'},403);if(b.role && b.role!==target.role && user.role!=='admin')return json({error:'Only administrators can change account roles.'},403);const role=b.role?((b.role==='admin'&&user.role==='admin')?'admin':(b.role==='executive'?'executive':'member')):target.role;if(role==='admin'&&user.role!=='admin')return json({error:'Only administrators can assign admin role.'},403);await env.DB.prepare("UPDATE users SET name=?,email=?,department=?,year_level=?,position=?,phone=?,role=?,status=?,updated_at=datetime('now') WHERE id=?").bind(cleanText(b.name,160)||target.name,cleanText(b.email,200)||null,cleanText(b.department,160)||null,cleanText(b.yearLevel,40)||null,cleanText(b.position,120)||null,cleanText(b.phone,60)||null,role,['active','inactive','suspended'].includes(b.status)?b.status:target.status,id).run();return json({ok:true})}
 if(path.startsWith('/api/admin/members/')&&m==='DELETE'){if(user.role!=='admin')return json({error:'Only administrators can deactivate accounts.'},403);const id=Number(path.split('/').pop());await env.DB.prepare("UPDATE users SET status='inactive',updated_at=datetime('now') WHERE id=? AND role!='admin'").bind(id).run();return json({ok:true})}
 if(path.match(/^\/api\/admin\/members\/\d+\/reset-password$/)&&m==='POST'){const id=Number(path.split('/')[4]);const target=await env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'User not found.'},404);if(target.role==='admin'&&target.id!==user.id)return json({error:'An administrator password cannot be reset from here. The account owner must change it from the Security tab.'},403);if(user.role!=='admin'&&target.role!=='member')return json({error:'Executives can only reset member passwords.'},403);const b=await body(req),pw=String(b.password||'');if(pw.length<10)return json({error:'Password must be at least 10 characters.'},400);const ph=await hashPassword(pw,crypto.getRandomValues(new Uint8Array(16)));await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=1,updated_at=datetime('now') WHERE id=?").bind(ph,id).run();await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();return json({ok:true})}
 if(path==='/api/admin/stats'&&m==='GET')return json({stats:Object.fromEntries(((await env.DB.prepare('SELECT key,value,label FROM site_stats').all()).results||[]).map(r=>[r.key,r.value])),labels:STAT_LABELS,keys:STAT_KEYS});
 if(path==='/api/admin/stats'&&m==='PUT'){const b=await body(req);for(const key of STAT_KEYS)if(b[key]!=null)await env.DB.prepare('INSERT INTO site_stats(key,value,label) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,cleanText(b[key],50),STAT_LABELS[key]||key).run();return json({ok:true})}
 if(path==='/api/admin/publications'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM publications ORDER BY sort_order,publication_year DESC,id DESC').all();return json({publications:r.results||[],categories:PUB_CATEGORIES,rows:r.results||[]})}
 if(path==='/api/admin/publications'&&m==='POST'){const b=await body(req);const cat=PUB_CATEGORIES.includes(b.category)?b.category:null;
  if(!cleanText(b.title,500)||!cleanText(b.authors,1000)||!cat)return json({error:'Title, authors and a valid category are required.'},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM publications').first();
  await env.DB.prepare('INSERT INTO publications(title,authors,category,type_label,journal,publication_year,doi,url,abstract,published_status,featured,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(cleanText(b.title,500),cleanText(b.authors,1000),cat,cleanText(b.typeLabel,120)||null,cleanText(b.journal,300)||null,Number(b.year)||null,cleanText(b.doi,200)||null,cleanUrl(b.url),cleanText(b.abstract,8000)||null,cleanText(b.publishedStatus||'published',40),b.featured?1:0,sortValue(b.sortOrder,(o&&o.n)||0)).run();return json({ok:true})}
 if(path.startsWith('/api/admin/publications/')&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req);const cat=PUB_CATEGORIES.includes(b.category)?b.category:null;
  if(!cleanText(b.title,500)||!cleanText(b.authors,1000)||!cat)return json({error:'Title, authors and a valid category are required.'},400);
  const prev=await env.DB.prepare('SELECT sort_order FROM publications WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Publication not found.'},404);
  await env.DB.prepare("UPDATE publications SET title=?,authors=?,category=?,type_label=?,journal=?,publication_year=?,doi=?,url=?,abstract=?,published_status=?,featured=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(cleanText(b.title,500),cleanText(b.authors,1000),cat,cleanText(b.typeLabel,120)||null,cleanText(b.journal,300)||null,Number(b.year)||null,cleanText(b.doi,200)||null,cleanUrl(b.url),cleanText(b.abstract,8000)||null,cleanText(b.publishedStatus||'published',40),b.featured?1:0,sortValue(b.sortOrder,prev.sort_order||0),id).run();return json({ok:true})}
 if(path.startsWith('/api/admin/publications/')&&m==='DELETE'){const id=Number(path.split('/').pop());await env.DB.prepare('DELETE FROM publications WHERE id=?').bind(id).run();return json({ok:true})}
 if(path==='/api/admin/events'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM events ORDER BY CASE WHEN status=\'upcoming\' THEN 0 ELSE 1 END,event_date DESC,id DESC').all();return json(r.results||[])}
 if(path==='/api/admin/events'&&m==='POST'){const b=await body(req);if(!cleanText(b.title,400))return json({error:'Event title is required.'},400);await env.DB.prepare('INSERT INTO events(title,event_date,event_time,venue,description,status,image_url,link_url,registration_url) VALUES(?,?,?,?,?,?,?,?,?)').bind(cleanText(b.title,400),isoDate(b.date),cleanText(b.time,80)||null,cleanText(b.venue,300)||null,cleanText(b.description,5000)||null,['upcoming','past','cancelled'].includes(b.status)?b.status:'upcoming',cleanUrl(b.imageUrl),cleanUrl(b.linkUrl),cleanUrl(b.registrationUrl)).run();return json({ok:true})}
 if(path.startsWith('/api/admin/events/')&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req);if(!cleanText(b.title,400))return json({error:'Event title is required.'},400);await env.DB.prepare('UPDATE events SET title=?,event_date=?,event_time=?,venue=?,description=?,status=?,image_url=?,link_url=?,registration_url=?,updated_at=datetime(\'now\') WHERE id=?').bind(cleanText(b.title,400),isoDate(b.date),cleanText(b.time,80)||null,cleanText(b.venue,300)||null,cleanText(b.description,5000)||null,['upcoming','past','cancelled'].includes(b.status)?b.status:'upcoming',cleanUrl(b.imageUrl),cleanUrl(b.linkUrl),cleanUrl(b.registrationUrl),id).run();return json({ok:true})}
 if(path.startsWith('/api/admin/events/')&&m==='DELETE'){await env.DB.prepare('DELETE FROM events WHERE id=?').bind(Number(path.split('/').pop())).run();return json({ok:true})}
 if(path==='/api/admin/notices'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM notices ORDER BY pinned DESC,published DESC,created_at DESC,id DESC').all();return json(r.results||[])}
 if(path==='/api/admin/notices'&&m==='POST'){const b=await body(req);if(!cleanText(b.title,400)||!cleanText(b.body,5000))return json({error:'Notice title and body are required.'},400);await env.DB.prepare('INSERT INTO notices(title,body,level,published,image_url,link_url,attachment_url,attachment_name,pinned,notice_date) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(cleanText(b.title,400),cleanText(b.body,5000),['urgent','high','normal'].includes(b.level)?b.level:'normal',b.published===false?0:1,cleanUrl(b.imageUrl),cleanUrl(b.linkUrl),cleanUrl(b.attachmentUrl),cleanText(b.attachmentName,160)||null,b.pinned?1:0,isoDate(b.noticeDate)).run();return json({ok:true})}
 // One-click "publish / take down" from the notice list, so putting a notice live
 // never means re-submitting the whole form and risking a change to its text.
 if(/^\/api\/admin\/notices\/\d+\/publish$/.test(path)&&m==='POST'){const id=Number(path.split('/')[4]),b=await body(req);await env.DB.prepare("UPDATE notices SET published=?,updated_at=datetime('now') WHERE id=?").bind(b.published?1:0,id).run();return json({ok:true,published:b.published?1:0})}
 if(path.startsWith('/api/admin/notices/')&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req);if(!cleanText(b.title,400)||!cleanText(b.body,5000))return json({error:'Notice title and body are required.'},400);await env.DB.prepare('UPDATE notices SET title=?,body=?,level=?,published=?,image_url=?,link_url=?,attachment_url=?,attachment_name=?,pinned=?,notice_date=?,updated_at=datetime(\'now\') WHERE id=?').bind(cleanText(b.title,400),cleanText(b.body,5000),['urgent','high','normal'].includes(b.level)?b.level:'normal',b.published===false?0:1,cleanUrl(b.imageUrl),cleanUrl(b.linkUrl),cleanUrl(b.attachmentUrl),cleanText(b.attachmentName,160)||null,b.pinned?1:0,isoDate(b.noticeDate),id).run();return json({ok:true})}
 if(path.startsWith('/api/admin/notices/')&&m==='DELETE'){await env.DB.prepare('DELETE FROM notices WHERE id=?').bind(Number(path.split('/').pop())).run();return json({ok:true})}
 /* Notices routinely carry a PDF — a circular, a results sheet, a form to fill in.
    The file is sniffed by its real first bytes, exactly like a photo, so renaming
    something .pdf does not get it accepted. Without R2 the admin can still paste a
    link to a file that already lives somewhere else. */
 if(path==='/api/admin/notices/upload'&&m==='POST'){
  let form;try{form=await req.formData()}catch{return json({error:'Could not read the uploaded file.'},400)}
  const file=form.get('file');if(!file||typeof file==='string'||!file.arrayBuffer)return json({error:'Please choose a file to upload.'},400);
  if(file.size>UPLOAD_MAX_BYTES)return json({error:`That file is ${(file.size/1048576).toFixed(1)} MB. Please use a file under 8 MB.`},413);
  if(!file.size)return json({error:'That file is empty.'},400);
  const buf=await file.arrayBuffer();const real=sniffDoc(buf.slice(0,16))||sniffImage(buf.slice(0,16));
  if(!real||!DOC_TYPES[real])return json({error:'Only PDF, Word, Excel, PowerPoint or image files can be attached.'},415);
  const key=`notices/${new Date().getFullYear()}/${b64u(crypto.getRandomValues(new Uint8Array(12)))}.${DOC_TYPES[real]}`;
  const put=await putUpload(env,key,buf,real);if(!put.ok)return json({error:put.error},put.status);
  return json({ok:true,url:'/uploads/'+key,name:cleanText(file.name,160)||('attachment.'+DOC_TYPES[real]),contentType:real,bytes:file.size})}
 if(path==='/api/admin/gallery/upload'&&m==='POST'){
  let form;try{form=await req.formData()}catch{return json({error:'Could not read the uploaded file.'},400)}
  const file=form.get('file');if(!file||typeof file==='string'||!file.arrayBuffer)return json({error:'Please choose an image file to upload.'},400);
  if(file.size>UPLOAD_MAX_BYTES)return json({error:`That image is ${(file.size/1048576).toFixed(1)} MB. Please use an image under 8 MB.`},413);
  if(!file.size)return json({error:'That file is empty.'},400);
  const buf=await file.arrayBuffer();const real=sniffImage(buf.slice(0,16));
  if(!real||!UPLOAD_TYPES[real])return json({error:'Only JPG, PNG, WebP, GIF or AVIF images can be uploaded.'},415);
  const key=`gallery/${new Date().getFullYear()}/${b64u(crypto.getRandomValues(new Uint8Array(12)))}.${UPLOAD_TYPES[real]}`;
  const put=await putUpload(env,key,buf,real);if(!put.ok)return json({error:put.error},put.status);
  return json({ok:true,url:'/uploads/'+key,contentType:real,bytes:file.size})}
 if(path==='/api/admin/gallery'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM gallery_images ORDER BY sort_order,id').all();return json({gallery:r.results||[],categories:GALLERY_CATEGORIES})}
 if(path==='/api/admin/gallery'&&m==='POST'){const b=await body(req),title=cleanText(b.title,300),image=cleanUrl(b.imageUrl);
  if(!title)return json({error:'Photo title is required.'},400);
  if(!image)return json({error:'A valid image file or image path is required.'},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM gallery_images').first();
  await env.DB.prepare('INSERT INTO gallery_images(category,title,caption,image_url,fit,featured,published,sort_order) VALUES(?,?,?,?,?,?,?,?)').bind(GALLERY_CATEGORIES.includes(b.category)?b.category:'Events',title,cleanText(b.caption,600)||null,image,b.fit==='contain'?'contain':'cover',b.featured?1:0,b.published===false?0:1,sortValue(b.sortOrder,(o&&o.n)||0)).run();
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/gallery\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),title=cleanText(b.title,300),image=cleanUrl(b.imageUrl);
  if(!title)return json({error:'Photo title is required.'},400);
  if(!image)return json({error:'A valid image file or image path is required.'},400);
  const prev=await env.DB.prepare('SELECT image_url,sort_order FROM gallery_images WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Photo not found.'},404);
  await env.DB.prepare("UPDATE gallery_images SET category=?,title=?,caption=?,image_url=?,fit=?,featured=?,published=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(GALLERY_CATEGORIES.includes(b.category)?b.category:'Events',title,cleanText(b.caption,600)||null,image,b.fit==='contain'?'contain':'cover',b.featured?1:0,b.published===false?0:1,sortValue(b.sortOrder,prev.sort_order||0),id).run();
  if(prev.image_url!==image) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/gallery\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());
  const prev=await env.DB.prepare('SELECT image_url FROM gallery_images WHERE id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM gallery_images WHERE id=?').bind(id).run();
  if(prev) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true})}
 if(path==='/api/admin/training'&&m==='GET'){const r=await env.DB.prepare('SELECT * FROM training_sessions ORDER BY sort_order,id').all();return json({training:r.results||[]})}
 if(path==='/api/admin/training'&&m==='POST'){const b=await body(req),title=cleanText(b.title,300);
  if(!title)return json({error:'Training session title is required.'},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM training_sessions').first();
  await env.DB.prepare('INSERT INTO training_sessions(title,trainer,description,date_label,image_url,link_url,published,sort_order) VALUES(?,?,?,?,?,?,?,?)').bind(title,cleanText(b.trainer,200)||null,cleanText(b.description,4000)||null,cleanText(b.dateLabel,120)||null,cleanUrl(b.imageUrl),cleanUrl(b.linkUrl),b.published===false?0:1,sortValue(b.sortOrder,(o&&o.n)||0)).run();
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/training\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),title=cleanText(b.title,300);
  if(!title)return json({error:'Training session title is required.'},400);
  const prev=await env.DB.prepare('SELECT image_url,sort_order FROM training_sessions WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Training session not found.'},404);
  const image=cleanUrl(b.imageUrl);
  await env.DB.prepare("UPDATE training_sessions SET title=?,trainer=?,description=?,date_label=?,image_url=?,link_url=?,published=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(title,cleanText(b.trainer,200)||null,cleanText(b.description,4000)||null,cleanText(b.dateLabel,120)||null,image,cleanUrl(b.linkUrl),b.published===false?0:1,sortValue(b.sortOrder,prev.sort_order||0),id).run();
  if(prev.image_url!==image) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/training\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());
  const prev=await env.DB.prepare('SELECT image_url FROM training_sessions WHERE id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM training_sessions WHERE id=?').bind(id).run();
  if(prev) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true})}

 /* ---------- Committee sessions (2025-26, 2026-27, ...) ---------- */
 if(path==='/api/admin/committee-sessions'&&m==='GET'){const r=await env.DB.prepare('SELECT s.*,(SELECT COUNT(*) FROM executives e WHERE e.session_id=s.id) member_count FROM committee_sessions s ORDER BY s.is_current DESC,s.sort_order,s.label DESC').all();return json({sessions:r.results||[]})}
 if(path==='/api/admin/committee-sessions'&&m==='POST'){const b=await body(req),label=cleanText(b.label,80);
  if(!label)return json({error:'A session name such as 2026-2027 is required.'},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM committee_sessions').first();
  try{await env.DB.prepare('INSERT INTO committee_sessions(label,description,reference_note,is_current,sort_order) VALUES(?,?,?,0,?)').bind(label,cleanText(b.description,1000)||null,cleanText(b.referenceNote,300)||null,sortValue(b.sortOrder,(o&&o.n)||0)).run()}
  catch(e){return json({error:'A committee session with that name already exists.'},400)}
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/committee-sessions\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),label=cleanText(b.label,80);
  if(!label)return json({error:'A session name is required.'},400);
  const prev=await env.DB.prepare('SELECT sort_order FROM committee_sessions WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Committee session not found.'},404);
  try{await env.DB.prepare("UPDATE committee_sessions SET label=?,description=?,reference_note=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(label,cleanText(b.description,1000)||null,cleanText(b.referenceNote,300)||null,sortValue(b.sortOrder,prev.sort_order||0),id).run()}
  catch(e){return json({error:'Another committee session already uses that name.'},400)}
  return json({ok:true})}
 // Making one session current automatically turns the others into the archive.
 if(path.match(/^\/api\/admin\/committee-sessions\/\d+\/current$/)&&m==='POST'){const id=Number(path.split('/')[4]);
  const row=await env.DB.prepare('SELECT id FROM committee_sessions WHERE id=?').bind(id).first();
  if(!row)return json({error:'Committee session not found.'},404);
  await env.DB.batch([env.DB.prepare('UPDATE committee_sessions SET is_current=0'),env.DB.prepare("UPDATE committee_sessions SET is_current=1,updated_at=datetime('now') WHERE id=?").bind(id)]);
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/committee-sessions\/\d+$/)&&m==='DELETE'){if(user.role!=='admin')return json({error:'Only administrators can delete a whole committee session.'},403);
  const id=Number(path.split('/').pop());
  const row=await env.DB.prepare('SELECT is_current FROM committee_sessions WHERE id=?').bind(id).first();
  if(!row)return json({error:'Committee session not found.'},404);
  if(row.is_current)return json({error:'This is the current committee. Make another session current first, then delete this one.'},400);
  const photos=await env.DB.prepare('SELECT photo_url FROM executives WHERE session_id=?').bind(id).all();
  await env.DB.batch([env.DB.prepare('DELETE FROM executives WHERE session_id=?').bind(id),env.DB.prepare('DELETE FROM committee_sessions WHERE id=?').bind(id)]);
  for(const p of (photos.results||[])) await maybeDeleteUpload(env,p.photo_url);
  return json({ok:true})}

 /* ---------- Executives inside a committee session ---------- */
 if(path==='/api/admin/executives'&&m==='GET'){const sid=Number(new URL(req.url).searchParams.get('session')||0);
  const r=sid?await env.DB.prepare("SELECT * FROM executives WHERE session_id=? ORDER BY CASE tier WHEN 'advisor' THEN 0 WHEN 'leadership' THEN 1 WHEN 'roster' THEN 2 ELSE 3 END,sort_order,id").bind(sid).all()
             :await env.DB.prepare("SELECT * FROM executives ORDER BY session_id DESC,CASE tier WHEN 'advisor' THEN 0 WHEN 'leadership' THEN 1 WHEN 'roster' THEN 2 ELSE 3 END,sort_order,id").all();
  return json({executives:r.results||[]})}
 if(path==='/api/admin/executives'&&m==='POST'){const b=await body(req),name=cleanText(b.name,160),designation=cleanText(b.designation,160),sid=Number(b.sessionId)||0;
  if(!name||!designation)return json({error:'Name and designation are required.'},400);
  const s=await env.DB.prepare('SELECT id FROM committee_sessions WHERE id=?').bind(sid).first();
  if(!s)return json({error:'Choose which committee session this person belongs to.'},400);
  const photo=cleanUrl(b.photoUrl);if(badUrl(b.photoUrl,photo))return json({error:PHOTO_REJECTED},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM executives WHERE session_id=?').bind(sid).first();
  await env.DB.prepare('INSERT INTO executives(session_id,name,designation,department,tier,photo_url,email,linkedin_url,facebook_url,sl_no,sort_order,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(sid,name,designation,cleanText(b.department,200)||null,EXEC_TIERS.includes(b.tier)?b.tier:'roster',photo,cleanText(b.email,200)||null,cleanUrl(b.linkedinUrl),cleanUrl(b.facebookUrl),null,sortValue(b.sortOrder,(o&&o.n)||0),b.status==='inactive'?'inactive':'active').run();
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/executives\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),name=cleanText(b.name,160),designation=cleanText(b.designation,160);
  if(!name||!designation)return json({error:'Name and designation are required.'},400);
  const prev=await env.DB.prepare('SELECT photo_url,sort_order,session_id FROM executives WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Executive not found.'},404);
  // Moving somebody to another session is allowed; an unknown session is not.
  let sid=Number(b.sessionId)||prev.session_id;
  const s=await env.DB.prepare('SELECT id FROM committee_sessions WHERE id=?').bind(sid).first();
  if(!s)sid=prev.session_id;
  const photo=cleanUrl(b.photoUrl);if(badUrl(b.photoUrl,photo))return json({error:PHOTO_REJECTED},400);
  await env.DB.prepare("UPDATE executives SET session_id=?,name=?,designation=?,department=?,tier=?,photo_url=?,email=?,linkedin_url=?,facebook_url=?,sl_no=NULL,sort_order=?,status=?,updated_at=datetime('now') WHERE id=?").bind(sid,name,designation,cleanText(b.department,200)||null,EXEC_TIERS.includes(b.tier)?b.tier:'roster',photo,cleanText(b.email,200)||null,cleanUrl(b.linkedinUrl),cleanUrl(b.facebookUrl),sortValue(b.sortOrder,prev.sort_order||0),b.status==='inactive'?'inactive':'active',id).run();
  if(prev.photo_url!==photo) await maybeDeleteUpload(env,prev.photo_url);
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/executives\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());
  const prev=await env.DB.prepare('SELECT photo_url FROM executives WHERE id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM executives WHERE id=?').bind(id).run();
  if(prev) await maybeDeleteUpload(env,prev.photo_url);
  return json({ok:true})}

 /* ---------- Alumni ---------- */
 if(path==='/api/admin/alumni'&&m==='GET'){const r=await env.DB.prepare("SELECT * FROM alumni ORDER BY CASE standing WHEN 'current' THEN 0 ELSE 1 END,sort_order,id").all();return json({alumni:r.results||[]})}
 if(path==='/api/admin/alumni'&&m==='POST'){const b=await body(req),name=cleanText(b.name,160);
  if(!name)return json({error:'Alumnus name is required.'},400);
  const o=await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM alumni').first();
  await env.DB.prepare('INSERT INTO alumni(name,session_label,department,graduation_year,occupation,organization,photo_url,bio,standing,published,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(name,cleanText(b.sessionLabel,80)||null,cleanText(b.department,200)||null,cleanText(b.graduationYear,20)||null,cleanText(b.occupation,200)||null,cleanText(b.organization,200)||null,cleanUrl(b.photoUrl),cleanText(b.bio,3000)||null,b.standing==='previous'?'previous':'current',b.published===false?0:1,sortValue(b.sortOrder,(o&&o.n)||0)).run();
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/alumni\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),name=cleanText(b.name,160);
  if(!name)return json({error:'Alumnus name is required.'},400);
  const prev=await env.DB.prepare('SELECT photo_url,sort_order FROM alumni WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Alumnus not found.'},404);
  const photo=cleanUrl(b.photoUrl);
  await env.DB.prepare("UPDATE alumni SET name=?,session_label=?,department=?,graduation_year=?,occupation=?,organization=?,photo_url=?,bio=?,standing=?,published=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(name,cleanText(b.sessionLabel,80)||null,cleanText(b.department,200)||null,cleanText(b.graduationYear,20)||null,cleanText(b.occupation,200)||null,cleanText(b.organization,200)||null,photo,cleanText(b.bio,3000)||null,b.standing==='previous'?'previous':'current',b.published===false?0:1,sortValue(b.sortOrder,prev.sort_order||0),id).run();
  if(prev.photo_url!==photo) await maybeDeleteUpload(env,prev.photo_url);
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/alumni\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());
  const prev=await env.DB.prepare('SELECT photo_url FROM alumni WHERE id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM alumni WHERE id=?').bind(id).run();
  if(prev) await maybeDeleteUpload(env,prev.photo_url);
  return json({ok:true})}

 /* ---------- Blog / articles ---------- */
 if(path==='/api/admin/blog'&&m==='GET'){const r=await env.DB.prepare("SELECT * FROM blog_posts ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END,post_date DESC,id DESC").all();return json({posts:r.results||[]})}
 if(path==='/api/admin/blog'&&m==='POST'){const b=await body(req),title=cleanText(b.title,300);
  if(!title)return json({error:'Article title is required.'},400);
  const slug=await uniqueSlug(env,cleanText(b.slug,160)||title,0);
  await env.DB.prepare('INSERT INTO blog_posts(slug,title,author,category,excerpt,content,image_url,status,post_date,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(slug,title,cleanText(b.author,160)||null,cleanText(b.category,120)||null,cleanText(b.excerpt,600)||null,cleanText(b.content,60000)||null,cleanUrl(b.imageUrl),b.status==='published'?'published':'draft',isoDate(b.postDate)||new Date().toISOString().slice(0,10),sortValue(b.sortOrder,0)).run();
  return json({ok:true,slug})}
 if(path.match(/^\/api\/admin\/blog\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req),title=cleanText(b.title,300);
  if(!title)return json({error:'Article title is required.'},400);
  const prev=await env.DB.prepare('SELECT image_url,slug,sort_order FROM blog_posts WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Article not found.'},404);
  const wanted=cleanText(b.slug,160)||title;
  const slug=await uniqueSlug(env,wanted,id);
  const image=cleanUrl(b.imageUrl);
  await env.DB.prepare("UPDATE blog_posts SET slug=?,title=?,author=?,category=?,excerpt=?,content=?,image_url=?,status=?,post_date=?,sort_order=?,updated_at=datetime('now') WHERE id=?").bind(slug,title,cleanText(b.author,160)||null,cleanText(b.category,120)||null,cleanText(b.excerpt,600)||null,cleanText(b.content,60000)||null,image,b.status==='published'?'published':'draft',isoDate(b.postDate)||null,sortValue(b.sortOrder,prev.sort_order||0),id).run();
  if(prev.image_url!==image) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true,slug})}
 if(path.match(/^\/api\/admin\/blog\/\d+$/)&&m==='DELETE'){const id=Number(path.split('/').pop());
  const prev=await env.DB.prepare('SELECT image_url FROM blog_posts WHERE id=?').bind(id).first();
  await env.DB.prepare('DELETE FROM blog_posts WHERE id=?').bind(id).run();
  if(prev) await maybeDeleteUpload(env,prev.image_url);
  return json({ok:true})}

 /* ---------- Join IURS applications (never public) ---------- */
 /* Recruitment window. GET returns the raw stored settings (the form needs the
    switch itself, not the computed "is it open right now"), plus the computed
    state so the panel can say what the public is currently seeing. */
 if(path==='/api/admin/recruitment'&&m==='GET'){const s=await getRecruitment(env);return json({settings:s,liveNow:recruitmentIsOpen(s),today:new Date().toISOString().slice(0,10)})}
 if(path==='/api/admin/recruitment'&&m==='PUT'){const b=await body(req);
  const bool=v=>v===true||v===1||v==='1'||v==='true'||v==='on';
  // A date box that is cleared must actually clear, so an invalid value becomes ''
  // rather than being ignored — otherwise the old bound would silently stay in force.
  const date=v=>{const s=cleanText(v,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''};
  const s={...RECRUITMENT_DEFAULTS,
   open:bool(b.open),requirePayment:bool(b.requirePayment),
   title:cleanText(b.title,120)||RECRUITMENT_DEFAULTS.title,
   openMessage:cleanText(b.openMessage,600)||RECRUITMENT_DEFAULTS.openMessage,
   closedMessage:cleanText(b.closedMessage,600)||RECRUITMENT_DEFAULTS.closedMessage,
   opensOn:date(b.opensOn),closesOn:date(b.closesOn),
   fee:cleanText(b.fee,20),currency:cleanText(b.currency,10)||'BDT',
   feeNote:cleanText(b.feeNote,300),methods:cleanText(b.methods,300),
   payTo:cleanText(b.payTo,120),payToLabel:cleanText(b.payToLabel,120)};
  if(s.opensOn&&s.closesOn&&s.closesOn<s.opensOn)return json({error:'The closing date cannot be before the opening date.'},400);
  if(s.requirePayment&&!s.fee)return json({error:'Set the membership fee, or switch off "payment required".'},400);
  if(s.requirePayment&&!s.payTo)return json({error:'Enter the number or account applicants should pay to.'},400);
  await env.DB.prepare("INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(RECRUITMENT_KEY,JSON.stringify(s)).run();
  return json({ok:true,settings:s,liveNow:recruitmentIsOpen(s)})}

 if(path==='/api/admin/applications'&&m==='GET'){const sp=new URL(req.url).searchParams;const st=sp.get('status')||'';const pay=sp.get('payment')||'';const q=cleanText(sp.get('q')||'',120);
  let sql='SELECT * FROM applications',where=[],bind=[];
  if(APPLICATION_STATUSES.includes(st)){where.push('status=?');bind.push(st)}
  if(PAYMENT_STATUSES.includes(pay)){where.push('COALESCE(payment_status,?)=?');bind.push('unverified',pay)}
  if(q){where.push('(name LIKE ? OR student_id LIKE ? OR email LIKE ? OR department LIKE ? OR phone LIKE ? OR research_interests LIKE ? OR transaction_id LIKE ?)');const like='%'+q+'%';bind.push(like,like,like,like,like,like,like)}
  if(where.length)sql+=' WHERE '+where.join(' AND ');
  sql+=' ORDER BY created_at DESC,id DESC LIMIT 500';
  const r=await env.DB.prepare(sql).bind(...bind).all();
  const counts=await env.DB.prepare('SELECT status,COUNT(*) c FROM applications GROUP BY status').all();
  const pcounts=await env.DB.prepare("SELECT COALESCE(payment_status,'unverified') p,COUNT(*) c FROM applications GROUP BY 1").all();
  return json({applications:r.results||[],counts:Object.fromEntries((counts.results||[]).map(x=>[x.status,+x.c])),paymentCounts:Object.fromEntries((pcounts.results||[]).map(x=>[x.p,+x.c])),statuses:APPLICATION_STATUSES,paymentStatuses:PAYMENT_STATUSES})}

 /* Spreadsheet export. Whatever filter the panel is showing is what gets exported,
    so "download the people whose payment is still unverified" needs no extra UI. */
 if(path.startsWith('/api/admin/applications/export')&&m==='GET'){const sp=new URL(req.url).searchParams;const st=sp.get('status')||'';const pay=sp.get('payment')||'';const q=cleanText(sp.get('q')||'',120);
  let sql='SELECT * FROM applications',where=[],bind=[];
  if(APPLICATION_STATUSES.includes(st)){where.push('status=?');bind.push(st)}
  if(PAYMENT_STATUSES.includes(pay)){where.push('COALESCE(payment_status,?)=?');bind.push('unverified',pay)}
  if(q){where.push('(name LIKE ? OR student_id LIKE ? OR email LIKE ? OR department LIKE ? OR phone LIKE ? OR transaction_id LIKE ?)');const like='%'+q+'%';bind.push(like,like,like,like,like,like)}
  if(where.length)sql+=' WHERE '+where.join(' AND ');
  sql+=' ORDER BY created_at DESC,id DESC LIMIT 5000';
  const rows=(await env.DB.prepare(sql).bind(...bind).all()).results||[];
  const stamp=new Date().toISOString().slice(0,10);
  const base='IURS-applications-'+stamp+(st?'-'+st:'')+(pay?'-'+pay+'-payment':'');
  if(path.endsWith('.csv')){
   // The BOM is what makes Excel read the file as UTF-8; without it Bangla names
   // arrive as mojibake. A leading tab keeps long ids from being read as numbers.
   const cell=v=>{const s=String(v??'');return '"'+(/^[0-9+][0-9+\-\s]{6,}$/.test(s)?'\t'+s:s).replace(/"/g,'""')+'"'};
   const csv='\uFEFF'+[APPLICATION_EXPORT.map(c=>cell(c[1])).join(','),...rows.map(r=>APPLICATION_EXPORT.map(([k])=>cell(r[k])).join(','))].join('\r\n')+'\r\n';
   return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${base}.csv"`,'cache-control':'no-store'}})}
  const xlsx=buildXlsx('Applications',APPLICATION_EXPORT.map(c=>c[1]),applicationRows(rows),APPLICATION_EXPORT.map(c=>c[2]));
  return new Response(xlsx,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="${base}.xlsx"`,'cache-control':'no-store'}})}

 /* Payment verification is its own route on purpose: the person checking the
    bKash statement is doing a different job from the person deciding whether to
    take the applicant, and the two must be recorded separately. */
 if(path.match(/^\/api\/admin\/applications\/\d+\/payment$/)&&m==='PUT'){const id=Number(path.split('/')[4]),b=await body(req);
  const row=await env.DB.prepare('SELECT id FROM applications WHERE id=?').bind(id).first();
  if(!row)return json({error:'Application not found.'},404);
  const ps=String(b.paymentStatus||'');
  if(!PAYMENT_STATUSES.includes(ps))return json({error:'Payment status must be one of: '+PAYMENT_STATUSES.join(', ')+'.'},400);
  const verified=ps==='verified';
  await env.DB.prepare("UPDATE applications SET payment_status=?,payment_note=?,verified_at=CASE WHEN ?='verified' THEN datetime('now') ELSE NULL END,verified_by=CASE WHEN ?='verified' THEN ? ELSE NULL END,updated_at=datetime('now') WHERE id=?")
   .bind(ps,cleanText(b.paymentNote,1000)||null,ps,ps,verified?(user.name||user.iurs_id):null,id).run();
  return json({ok:true})}

 if(path.match(/^\/api\/admin\/applications\/\d+$/)&&m==='PUT'){const id=Number(path.split('/').pop()),b=await body(req);
  const prev=await env.DB.prepare('SELECT status,payment_status,transaction_id FROM applications WHERE id=?').bind(id).first();
  if(!prev)return json({error:'Application not found.'},404);
  /* If a status is supplied it must be a real one. Silently keeping the old status
     would report success while nothing changed, which hides a typo. */
  const st=b.status===undefined||b.status===null||b.status===''?prev.status:String(b.status);
  if(!APPLICATION_STATUSES.includes(st))return json({error:'Status must be one of: '+APPLICATION_STATUSES.join(', ')+'.'},400);
  /* The rule the society asked for: nobody is accepted until the money has been
     matched against the transaction id. Enforced here rather than only in the
     panel, so it also holds if someone calls the API directly. */
  if(st==='approved'&&prev.status!=='approved'){
   const rs=await getRecruitment(env);
   if(rs.requirePayment&&(prev.payment_status||'unverified')!=='verified')
    return json({error:'This application cannot be approved yet: the payment is not verified. Match the transaction ID against your bKash/Nagad/bank statement and mark the payment verified first.',code:'payment_unverified'},409);
  }
  await env.DB.prepare("UPDATE applications SET status=?,admin_notes=?,updated_at=datetime('now') WHERE id=?").bind(st,cleanText(b.notes,4000)||null,id).run();
  return json({ok:true})}
 if(path.match(/^\/api\/admin\/applications\/\d+$/)&&m==='DELETE'){if(user.role!=='admin')return json({error:'Only administrators can delete an application.'},403);
  await env.DB.prepare('DELETE FROM applications WHERE id=?').bind(Number(path.split('/').pop())).run();return json({ok:true})}

 return json({error:'Not found'},404)}

async function publicApi(req,env,path){
 // Whether the Join IURS form should be usable right now, and what to pay.
 if(path==='/api/public/recruitment')return json(publicRecruitment(await getRecruitment(env)));
 /* The login page offers a "first-time setup" link. Once an admin account exists
    that link only leads to a 409, so the page hides it — but it has to ask,
    because the pages are static files. Only a boolean is returned. */
 if(path==='/api/public/setup-status'){const c=await env.DB.prepare('SELECT COUNT(*) c FROM users').first();return json({needsSetup:Number(c?.c||0)===0})}
 if(path==='/api/public/stats')return json(Object.fromEntries(((await env.DB.prepare('SELECT key,value,label FROM site_stats').all()).results||[]).map(r=>[r.key,{value:r.value,label:r.label}])));
 if(path==='/api/public/publications'){const r=await env.DB.prepare("SELECT id,title,authors,category,type_label,journal,publication_year,doi,url,abstract,featured FROM publications WHERE published_status='published' ORDER BY sort_order,publication_year DESC,id DESC").all();
  const rows=r.results||[];
  return json({publications:rows,peerReviewed:rows.filter(x=>x.category==='peer_reviewed'),conference:rows.filter(x=>x.category==='conference'),workingPapers:rows.filter(x=>x.category==='working_paper'),underReview:rows.filter(x=>x.category==='under_review')})}
 if(path==='/api/public/events'){const r=await env.DB.prepare('SELECT * FROM events ORDER BY CASE WHEN status=\'upcoming\' THEN 0 ELSE 1 END,event_date DESC,id DESC').all();return json(r.results||[])}
 if(path==='/api/public/notices'){const r=await env.DB.prepare('SELECT * FROM notices WHERE published=1 ORDER BY pinned DESC,COALESCE(notice_date,date(created_at)) DESC,created_at DESC,id DESC').all();return json(r.results||[])}
 if(path==='/api/public/gallery'){const r=await env.DB.prepare('SELECT id,category,title,caption,image_url,fit,featured FROM gallery_images WHERE published=1 ORDER BY sort_order,id').all();return json({gallery:r.results||[],categories:GALLERY_CATEGORIES})}
 if(path==='/api/public/training'){const r=await env.DB.prepare('SELECT id,title,trainer,description,date_label,image_url,link_url FROM training_sessions WHERE published=1 ORDER BY sort_order,id').all();return json({training:r.results||[]})}
 if(path==='/api/public/committee'){const sessions=(await env.DB.prepare('SELECT id,label,description,reference_note,is_current FROM committee_sessions ORDER BY is_current DESC,sort_order,label DESC').all()).results||[];
  const people=(await env.DB.prepare("SELECT id,session_id,name,designation,department,tier,photo_url,email,linkedin_url,facebook_url,sl_no FROM executives WHERE status='active' ORDER BY CASE tier WHEN 'advisor' THEN 0 WHEN 'leadership' THEN 1 WHEN 'roster' THEN 2 ELSE 3 END,sort_order,id").all()).results||[];
  const pack=s=>{const mine=t=>people.filter(p=>p.session_id===s.id&&p.tier===t);
   return {id:s.id,label:s.label,description:s.description,reference:s.reference_note,isCurrent:!!s.is_current,
    leadership:mine('leadership'),
    // Anything not explicitly filed elsewhere stays in the numbered committee table,
    // which is where every existing row already sits.
    roster:people.filter(p=>p.session_id===s.id&&p.tier!=='leadership'&&p.tier!=='advisor'&&p.tier!=='member'),
    advisors:mine('advisor'),
    members:mine('member')}};
  const current=sessions.find(s=>s.is_current)||sessions[0]||null;
  return json({current:current?pack(current):null,archive:sessions.filter(s=>!current||s.id!==current.id).map(pack)})}
 if(path==='/api/public/alumni'){const r=await env.DB.prepare("SELECT id,name,session_label,department,graduation_year,occupation,organization,photo_url,bio,standing FROM alumni WHERE published=1 ORDER BY sort_order,id").all();
  const rows=r.results||[];return json({current:rows.filter(x=>x.standing!=='previous'),previous:rows.filter(x=>x.standing==='previous')})}
 if(path==='/api/public/blog'){const r=await env.DB.prepare("SELECT id,slug,title,author,category,excerpt,image_url,post_date FROM blog_posts WHERE status='published' ORDER BY sort_order,post_date DESC,id DESC").all();return json({posts:r.results||[]})}
 if(path.startsWith('/api/public/blog/')){const slug=decodeURIComponent(path.slice('/api/public/blog/'.length));
  const row=await env.DB.prepare("SELECT id,slug,title,author,category,excerpt,content,image_url,post_date FROM blog_posts WHERE slug=? AND status='published'").bind(cleanText(slug,160)).first();
  return row?json({post:row}):json({error:'Article not found.'},404)}
 if(path==='/api/public/join'&&req.method==='POST')return await submitApplication(req,env);
 if(path==='/api/public/chat'&&req.method==='POST')return await chat(req,env);
 return json({error:'Not found'},404)}

/* ---------------------------------------------------------------------------
   Join IURS. Anyone may submit, nobody may read. Abuse control is three-fold:
   a hidden field real people never fill in, a per-address submission limit,
   and hard length caps on every field.
   --------------------------------------------------------------------------- */
async function submitApplication(req,env){
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 /* The window is checked here and not only in the page. A form left open in a
    browser tab from last month must not be able to post an application after
    recruitment has closed. */
 const rs=await getRecruitment(env);
 if(!recruitmentIsOpen(rs))return json({error:rs.closedMessage||'Member recruitment is closed at the moment.',code:'recruitment_closed'},403);
 const b=await body(req);
 if(cleanText(b.website,200))return json({ok:true});           // honeypot: silently accept, store nothing
 const name=cleanText(b.name,160),email=cleanText(b.email,200);
 if(!name)return json({error:'Please enter your full name.'},400);
 if(!email||!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email))return json({error:'Please enter a valid email address.'},400);
 if(!cleanText(b.department,200))return json({error:'Please enter your department.'},400);
 if(!cleanText(b.academicSession,80))return json({error:'Please enter your academic session, for example 2022-23.'},400);
 if(!cleanText(b.motivation,4000))return json({error:'Please tell us why you would like to join.'},400);
 const method=cleanText(b.paymentMethod,60),txn=cleanText(b.transactionId,80);
 if(rs.requirePayment){
  const methods=String(rs.methods||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!method||(methods.length&&!methods.some(x=>x.toLowerCase()===method.toLowerCase())))
   return json({error:'Please choose how you paid the membership fee.'},400);
  /* A transaction id is the only thing that lets the treasurer match a payment to
     a person, so it is required and must look like one. Providers use 6-32
     letters/digits; anything shorter is almost always a typo or a placeholder. */
  if(!/^[A-Za-z0-9][A-Za-z0-9.\-_]{5,31}$/.test(txn))
   return json({error:'Please enter the full transaction ID from your payment receipt (at least 6 characters, letters and numbers only).'},400);
  const clash=await env.DB.prepare('SELECT id FROM applications WHERE transaction_id IS NOT NULL AND upper(transaction_id)=upper(?)').bind(txn).first();
  if(clash)return json({error:'This transaction ID has already been submitted with another application. Please check your receipt.'},409);
 }
 const ip=req.headers.get('CF-Connecting-IP')||'unknown';
 const key=await sha256Base64('join|'+ip);
 const recent=await env.DB.prepare("SELECT COUNT(*) c FROM applications WHERE source_key=? AND created_at>datetime('now','-1 day')").bind(key).first();
 if(Number(recent?.c||0)>=5)return json({error:'We have already received several applications from this connection today. Please email us instead.'},429);
 const dup=await env.DB.prepare("SELECT id FROM applications WHERE lower(email)=lower(?) AND created_at>datetime('now','-7 days')").bind(email).first();
 if(dup)return json({error:'An application from this email address is already with us. We will be in touch soon.'},409);
 await env.DB.prepare('INSERT INTO applications(name,student_id,department,academic_session,year_level,email,phone,research_interests,skills,experience,motivation,payment_method,transaction_id,payment_amount,payment_sender,payment_date,payment_status,status,source_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(name,cleanText(b.studentId,80)||null,cleanText(b.department,200),cleanText(b.academicSession,80),cleanText(b.yearLevel,40)||null,email,cleanText(b.phone,60)||null,cleanText(b.researchInterests,2000)||null,cleanText(b.skills,2000)||null,cleanText(b.experience,4000)||null,cleanText(b.motivation,4000),method||null,txn||null,cleanText(b.paymentAmount,20)||rs.fee||null,cleanText(b.paymentSender,60)||null,cleanText(b.paymentDate,20)||null,'unverified','pending',key).run();
 return json({ok:true,message:rs.requirePayment
  ? 'Thank you. Your application has reached the IURS executive team. It stays pending until we match your transaction ID against our payment record — you will hear from us by email once that is done.'
  : 'Thank you. Your application has reached the IURS executive team.'})}

/* ---------------------------------------------------------------------------
   Chatbot. It answers ONLY from rows in this database plus a short fixed
   description of IURS taken from the existing website. Facts are retrieved
   first; the language model is given those facts and is told it may not add
   anything. If no model binding exists, the retrieved facts are returned
   directly, so the assistant still works and still cannot invent anything.
   --------------------------------------------------------------------------- */
const CHAT_ABOUT='IURS is the Islamic University Research Society, an academic research organisation at Islamic University, Kushtia-7003, Bangladesh. Its motto is "Research can change the world". Office: TSCC, Islamic University, Kushtia-7003. Email: iuresearchsociety@gmail.com. Phone: +880 1749-022577. Office hours: Saturday to Thursday, 9:00 AM to 5:00 PM.';
const CHAT_LIMIT=20;
const CHAT_TOPICS='publications, events, training sessions, notices, the executive committee, alumni, blog articles, the photo gallery and how to join IURS';
/* Words worth searching on. Matching the WHOLE question with LIKE can never match
   a row, so a natural question ("who is the president?") would silently retrieve
   nothing at all. We keep the topic gate as the relevance test and use the
   remaining words only to order rows, never to hide them. */
const CHAT_STOP=new Set(['what','which','when','where','does','have','has','with','from','this','that','they','their','there','about','iurs','tell','please','know','would','could','many','much','your','yours','into','been','were','also','some','more','most','than','then','them','make','made','give','need','want','like','list','show','name','names','question','questions','society','university','islamic','current','currently','right','latest','recent','anything','everything','something']);
const chatTerms=q=>(String(q||'').toLowerCase().match(/[a-z0-9]{4,}/g)||[]).filter(w=>!CHAT_STOP.has(w)).slice(0,6);
const PUB_LABEL={peer_reviewed:'peer-reviewed article',conference:'conference/research paper',working_paper:'working paper',under_review:'under review'};
async function chatFacts(env,q){
 const out=[],terms=chatTerms(q);
 const want=t=>!q||new RegExp(t,'i').test(q);
 const add=(head,rows,fn)=>{if(rows&&rows.length)out.push(head+'\n'+rows.map(fn).join('\n'))};
 const grab=async(sql,...bind)=>{try{return ((await env.DB.prepare(sql).bind(...bind).all()).results)||[]}catch{return []}};
 /* Put whatever the visitor actually named first, keeping the database order for ties. */
 const rank=(rows,...fields)=>{if(!terms.length)return rows;
  const score=r=>{const hay=fields.map(f=>String(r[f]||'')).join(' ').toLowerCase();return terms.reduce((n,w)=>n+(hay.includes(w)?1:0),0)};
  return rows.map((r,i)=>({r,i,s:score(r)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.r)};
 if(want('publication|paper|research|article|journal|doi|author|publish|study|studies')){
  const rows=rank(await grab("SELECT title,authors,category,journal,publication_year FROM publications WHERE published_status='published' ORDER BY publication_year DESC,id DESC LIMIT 12"),'title','authors','journal').slice(0,8);
  add('PUBLICATIONS:',rows,r=>`- "${r.title}" (${PUB_LABEL[r.category]||r.category}) by ${r.authors}. ${r.journal||''} ${r.publication_year||''}`.trim());
  const c=await grab("SELECT category,COUNT(*) n FROM publications WHERE published_status='published' GROUP BY category");
  add('PUBLICATION COUNTS:',c,r=>`- ${PUB_LABEL[r.category]||r.category}: ${r.n}`);
 }
 if(want('event|seminar|webinar|programme|program|conference|when|upcoming|past')){
  const rows=await grab('SELECT title,event_date,event_time,venue,status FROM events ORDER BY CASE WHEN status=\'upcoming\' THEN 0 ELSE 1 END,event_date DESC LIMIT 8');
  add('EVENTS:',rows,r=>`- ${r.title} — ${r.status}${r.event_date?', '+r.event_date:''}${r.event_time?', '+r.event_time:''}${r.venue?', at '+r.venue:''}`);
 }
 if(want('training|workshop|course|learn|skill')){
  const rows=await grab('SELECT title,trainer,date_label FROM training_sessions WHERE published=1 ORDER BY sort_order LIMIT 8');
  add('TRAINING SESSIONS:',rows,r=>`- ${r.title}${r.trainer?' — trainer '+r.trainer:''}${r.date_label?', '+r.date_label:''}`);
 }
 if(want('notice|announcement|news|deadline')){
  const rows=await grab('SELECT title,body FROM notices WHERE published=1 ORDER BY created_at DESC LIMIT 5');
  add('NOTICES:',rows,r=>`- ${r.title}: ${String(r.body||'').slice(0,240)}`);
 }
 if(want('committee|executive|president|secretary|leader|who is|treasurer|designation|vice|chair|adviser|advisor|moderator')){
  const rows=rank(await grab("SELECT e.name,e.designation,e.department,s.label FROM executives e JOIN committee_sessions s ON s.id=e.session_id WHERE s.is_current=1 AND e.status='active' ORDER BY CASE e.tier WHEN 'advisor' THEN 0 WHEN 'leadership' THEN 1 WHEN 'roster' THEN 2 ELSE 3 END,e.sort_order LIMIT 20"),'name','designation').slice(0,12);
  add('CURRENT EXECUTIVE COMMITTEE:',rows,r=>`- ${r.designation}: ${r.name}${r.department?' ('+r.department+')':''} [term ${r.label}]`);
 }
 if(want('alumni|graduate|former')){
  const rows=await grab('SELECT name,graduation_year,occupation,organization,standing FROM alumni WHERE published=1 ORDER BY sort_order LIMIT 10');
  add('ALUMNI:',rows,r=>`- ${r.name}${r.graduation_year?', '+r.graduation_year:''}${r.occupation?', '+r.occupation:''}${r.organization?' at '+r.organization:''} (${r.standing})`);
 }
 if(want('blog|article|post|write')){
  const rows=await grab("SELECT title,author,post_date,excerpt FROM blog_posts WHERE status='published' ORDER BY post_date DESC LIMIT 5");
  add('BLOG ARTICLES:',rows,r=>`- ${r.title}${r.author?' by '+r.author:''}${r.post_date?' ('+r.post_date+')':''}${r.excerpt?': '+String(r.excerpt).slice(0,160):''}`);
 }
 if(want('join|member|membership|apply|application|recruit|how do i|register|fee|payment|bkash|nagad')){
  /* Read the live switch rather than describing the form as always open — telling
     a student to apply during a closed month would be a wrong answer. */
  const rs=publicRecruitment(await getRecruitment(env));
  out.push('HOW TO JOIN:\n- '+(rs.open
   ? 'Member recruitment is OPEN right now. Apply through the Join IURS form at /join.html.'+(rs.closesOn?' It closes on '+rs.closesOn+'.':'')
   : 'Member recruitment is CLOSED right now, so the form at /join.html cannot be submitted.'+(rs.opensOn?' It opens on '+rs.opensOn+'.':' The next call for members is announced on this website and on the IURS Facebook page.'))
   +'\n- The form asks for name, student/IURS ID, department, session, year, email, phone, research interests, skills, previous research experience and reasons for joining.'
   +(rs.requirePayment&&rs.fee?`\n- There is a membership fee of ${rs.fee} ${rs.currency}, paid to ${rs.payTo}${rs.payToLabel?' ('+rs.payToLabel+')':''} by ${rs.methods.join(', ')||'mobile banking'}. The transaction ID from the receipt must be entered on the form.`:'')
   +'\n- Every application stays pending until the executive team checks it'+(rs.requirePayment?' and matches the transaction ID against the society payment record':'')+'. The team then replies by email.');
 }
 if(want('gallery|photo|picture|image')){
  const c=await grab('SELECT COUNT(*) n FROM gallery_images WHERE published=1');
  add('GALLERY:',c,r=>`- ${r.n} photographs are published in the gallery at /gallery.html, grouped by category.`);
 }
 /* Deliberately NO catch-all here. If nothing above matched, the question is about
    something IURS has no record of, and the assistant must say so rather than
    answering with unrelated rows that look like an answer. */
 return out.join('\n\n')}
async function chat(req,env){
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 const b=await body(req);const q=cleanText(b.message,500);
 if(!q)return json({error:'Please type a question.'},400);
 const ip=req.headers.get('CF-Connecting-IP')||'unknown';
 const key=await sha256Base64('chat|'+ip);
 try{
  const n=await env.DB.prepare("SELECT COUNT(*) c FROM login_attempts WHERE attempt_key=? AND created_at>datetime('now','-1 hour')").bind(key).first();
  if(Number(n?.c||0)>=60)return json({reply:'You have asked a lot of questions in the last hour. Please try again a little later, or email iuresearchsociety@gmail.com.'});
  await env.DB.prepare('INSERT INTO login_attempts(attempt_key) VALUES(?)').bind(key).run();
 }catch(e){console.error('chat rate limit skipped',e)}
 const facts=await chatFacts(env,q);
 const fallback=facts
  ? 'Here is what the IURS website has on that:\n\n'+facts+'\n\nIf this does not answer your question, please email iuresearchsociety@gmail.com.'
  : 'I do not have that information on the IURS website. Please email iuresearchsociety@gmail.com and the team will help you.\n\nYou can ask me about '+CHAT_TOPICS+'.';
 if(!env.AI)return json({reply:fallback,grounded:true,model:'facts-only'});
 const system='You are the assistant on the Islamic University Research Society (IURS) website. Answer ONLY using the FACTS block below and the ABOUT IURS block. You must never add, guess, estimate or invent any name, number, date, title, award or achievement. If the answer is not in those blocks, reply exactly: "I do not have that information on the IURS website. Please email iuresearchsociety@gmail.com and the team will help you." Keep replies under 120 words, plain and friendly, no markdown headings.\n\nABOUT IURS:\n'+CHAT_ABOUT+'\n\nFACTS:\n'+(facts||'(nothing relevant found)');
 try{
  const r=await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{max_tokens:320,temperature:0.1,messages:[{role:'system',content:system},{role:'user',content:q}]});
  const reply=cleanText((r&&(r.response||r.result||''))||'',1500);
  return reply?json({reply,grounded:true,model:'workers-ai'}):json({reply:fallback,grounded:true,model:'facts-only'});
 }catch(e){console.error('Workers AI unavailable',e);return json({reply:fallback,grounded:true,model:'facts-only'})}}

export default {async fetch(request,env,ctx){const url=new URL(request.url);try{if(url.pathname.startsWith('/api/')){await ensureSchema(env);const user=await currentUser(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/login')return await login(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/logout')return await logout(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/change-password')return await changePassword(request,env,user);if(request.method==='POST'&&url.pathname==='/api/setup/initial-admin')return await setup(request,env);if(request.method==='GET'&&url.pathname==='/api/auth/me')return json({authenticated:!!user,user});if(url.pathname.startsWith('/api/admin/')){if(user&&user.must_change_password)return json({error:'For security, please set a new password before managing content.',code:'must_change_password'},403);return await adminApi(request,env,user,url.pathname)}if(url.pathname.startsWith('/api/public/'))return await publicApi(request,env,url.pathname);if(url.pathname==='/api/health')return json({ok:true,service:'IURS full-stack backend'});return json({error:'Not found'},404)}
if(url.pathname.startsWith('/uploads/')){if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed'},405);
 let key;try{key=decodeURIComponent(url.pathname.slice(9))}catch{return new Response('Not found',{status:404})}
 if(!key||key.includes('..')||key.startsWith('/'))return new Response('Not found',{status:404});
 // R2 first when the bucket is attached, then the D1 copy. Uploads made while R2 was
 // switched off live in media_blobs, so both places have to be checked or a photo
 // uploaded last week would vanish the day R2 gets enabled.
 if(env.MEDIA){try{const obj=await env.MEDIA.get(key);if(obj){const uh=new Headers();obj.writeHttpMetadata(uh);uh.set('etag',obj.httpEtag);uh.set('Cache-Control','public, max-age=31536000, immutable');uh.set('X-Content-Type-Options','nosniff');return new Response(request.method==='HEAD'?null:obj.body,{headers:uh})}}catch(e){console.error('R2 get failed',e)}}
 let row=null;try{row=await env.DB.prepare('SELECT content_type,bytes,size FROM media_blobs WHERE key=?').bind(key).first()}catch(e){console.error('media_blobs get failed',e)}
 if(!row||!row.bytes)return new Response('Not found',{status:404});
 // D1 hands a BLOB back as an array of byte values; other engines hand back a typed
 // array. Accept whichever shape arrives rather than assuming one of them.
 const raw=row.bytes;
 const body=raw instanceof Uint8Array?raw:raw instanceof ArrayBuffer?new Uint8Array(raw):new Uint8Array(Array.isArray(raw)?raw:[]);
 const etag='"'+key.replace(/[^\w.-]/g,'')+'-'+(row.size||body.length)+'"';
 const uh=new Headers({'content-type':row.content_type||'application/octet-stream','content-length':String(body.length),etag,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});
 if((request.headers.get('if-none-match')||'')===etag)return new Response(null,{status:304,headers:uh});
 return new Response(request.method==='HEAD'?null:body,{headers:uh})}
if(url.pathname==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /dashboard.html\nDisallow: /login.html\nDisallow: /setup.html\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=86400'}});
if(url.pathname==='/sitemap.xml'){
 // Google prefers a real <lastmod>, so take it from the newest thing actually published.
 // Wrapped in try/catch: a database hiccup must never be able to break the sitemap.
 let stamp=null;
 try{const r=await env.DB.prepare("SELECT MAX(t) t FROM (SELECT MAX(COALESCE(updated_at,created_at)) t FROM notices UNION ALL SELECT MAX(COALESCE(updated_at,created_at)) FROM events UNION ALL SELECT MAX(COALESCE(updated_at,created_at)) FROM blog_posts UNION ALL SELECT MAX(COALESCE(updated_at,created_at)) FROM publications UNION ALL SELECT MAX(COALESCE(updated_at,created_at)) FROM gallery_images)").first();
  if(r&&r.t){const d=new Date(String(r.t).trim().replace(' ','T')+(String(r.t).endsWith('Z')?'':'Z'));if(!isNaN(d))stamp=d.toISOString()}}catch(e){console.error('sitemap lastmod skipped',e)}
 const lm=stamp?`<lastmod>${stamp}</lastmod>`:'';
 // How often each page really changes, rather than one blanket guess for all twelve.
 const pages=[['/','daily','1.0'],['/notices.html','daily','0.9'],['/publications.html','weekly','0.8'],['/blog.html','weekly','0.8'],['/events.html','weekly','0.8'],['/join.html','monthly','0.8'],['/about.html','monthly','0.7'],['/training-session.html','monthly','0.7'],['/gallery.html','monthly','0.7'],['/executive-committee.html','monthly','0.7'],['/alumni.html','monthly','0.6'],['/contact.html','monthly','0.6']];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p,cf,pr])=>`  <url><loc>${url.origin}${p}</loc>${lm}<changefreq>${cf}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=86400'}})}
const asset=await env.ASSETS.fetch(request);const h=new Headers(asset.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');h.set('X-Frame-Options','SAMEORIGIN');const out=new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers:h});
// Search engines and social previews need FULL urls. The pages carry data-abs="/page.html"
// and we fill in the real hostname here, so no domain is ever hard-coded in the files.
if(typeof HTMLRewriter!=='undefined'&&asset.status===200&&(h.get('content-type')||'').includes('text/html')){try{return new HTMLRewriter().on('[data-abs]',{element(el){const p=el.getAttribute('data-abs')||'';el.setAttribute(el.tagName==='link'?'href':'content',url.origin+p);el.removeAttribute('data-abs')}}).transform(out)}catch(e){console.error('HTMLRewriter skipped',e)}}
return out}catch(e){console.error(e);
// Last line of defence: an unexpected bug must never blank the public website.
if(url.pathname.startsWith('/api/'))return json({error:'Server error. Please try again.'},500);
try{return await env.ASSETS.fetch(request)}catch(e2){console.error(e2);return new Response('The website is temporarily unavailable. Please refresh in a moment.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}}}};
