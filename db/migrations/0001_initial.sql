CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iurs_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('member','executive','admin')),
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  year_level TEXT,
  position TEXT,
  phone TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','suspended')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'normal',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  venue TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  category TEXT NOT NULL,
  journal TEXT,
  publication_year INTEGER,
  doi TEXT,
  url TEXT,
  abstract TEXT,
  published_status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO site_stats(key,value,label) VALUES
('members','459+','Community Members'),
('research_outputs','7','Research Outputs'),
('workshops','6+','Workshops & Training'),
('peer_reviewed','4','Peer-reviewed Articles'),
('working_papers','10+','Working Papers'),
('under_review','3+','Manuscripts Under Review');

INSERT OR IGNORE INTO notices(title,body,level) VALUES
('Orientation to Research Methodology','03 May 2026 · 9:30 AM · IIER Building, Room 101','urgent'),
('Study in Europe: Opportunities, Admissions & Scholarships','04 Feb 2026 · Online webinar','high'),
('Smart Office Tools for University Students','February 2026 training programme','normal');

INSERT OR IGNORE INTO publications(title,authors,category,journal,publication_year,doi,url,published_status) VALUES
('Women’s Leadership in Higher Education in Bangladesh: Public and Private University Perspectives','Mohammed Asaduzzaman · Aklima Akter Puthi · Porna Dey · Farjana Bari','peer_reviewed','Public Organization Review',2025,'10.1007/s11115-025-00864-7','https://link.springer.com/article/10.1007/s11115-025-00864-7','published'),
('Field-calibrated threshold-distance assessment of lead dispersion from controlled lead-acid battery plate combustion','Md. Shaheduzzaman Roky · Md. Hasib Mia · Subroto Kumar · Mst. Shahanaz Islam Hira · Shahat Siddique · Mahadi Hasan · Asad Ud-Daula','peer_reviewed','Environmental Pollution',2026,'10.1016/j.envpol.2026.128853','https://www.sciencedirect.com/science/article/abs/pii/S0269749126012236','published'),
('Anti-cancer activity elucidation of geissolosimine as an MDM2-p53 interaction inhibitor: An in-silico study','Md Al-Amin · Rehnuma Tanjin · Md Rasul Karim · Jannatul Mawa Etee · Ayesha Siddika · Nafisa Akter · Md Helal Uddin · Ratul Mahmud · Tasfia Saffat · Md Faruk Hossen · Samira Idris Mowlee · Elmu Kabir Rafa · Sumi Akter','peer_reviewed','PLOS ONE',2025,'10.1371/journal.pone.0323003','https://pubmed.ncbi.nlm.nih.gov/40339040/','published'),
('The Synergy of Leadership and Team Effectiveness: An Empirical Study at Islamic University’s Non-Profit Organization','Dr. Md. Golam Mohiuddin · Md. Jobaer Hossain Bhuiya · Sazzad Hossain · Mst. Tanima Tasnim · Md. Tuhin Hossain','peer_reviewed','International Journal of Innovative Science and Research Technology',2024,'10.38124/ijisrt/IJISRT24NOV150','https://www.ijisrt.com/the-synergy-of-leadership-and-team-effectiveness-an-empirical-study-at-islamic-universitys-nonprofit-organization','published'),
('Reducing Operational Complexity Through E-Governance: A Case Study on Islamic University, Kushtia','IURS research community','conference','10th International Integrative Research Conference · BARD',2025,NULL,'','conference');
