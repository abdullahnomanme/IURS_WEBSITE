-- CMS & Institutional Web Platform Upgrade (2026-09-21)
-- Mirrors the self-healing schema in src/index.js so the production D1 database
-- can be migrated formally with `wrangler d1 migrations apply iurs-production`.
-- All statements are additive; no existing IURS data is touched.

-- Notices: featured board slot, homepage visibility, expiry, category
ALTER TABLE notices ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notices ADD COLUMN show_on_homepage INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notices ADD COLUMN expiry_date TEXT;
ALTER TABLE notices ADD COLUMN category TEXT;

-- Events: manual status override (NULL = computed from event_date) and featured
ALTER TABLE events ADD COLUMN status_override TEXT;
ALTER TABLE events ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- Blog: featured articles for the homepage rail
ALTER TABLE blog_posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- Applications: which recruitment campaign an application arrived through
ALTER TABLE applications ADD COLUMN campaign_id INTEGER;

-- Homepage Manager: one JSON blob controls sections, ordering and featured items
CREATE TABLE IF NOT EXISTS homepage_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail of successful admin mutations
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC, id DESC);

-- Recruitment campaigns (4.1, 4.2, ...): dated windows, fee/payment, archive
CREATE TABLE IF NOT EXISTS recruitment_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  code TEXT,
  open INTEGER NOT NULL DEFAULT 0,
  opens_on TEXT,
  closes_on TEXT,
  fee TEXT,
  currency TEXT DEFAULT 'BDT',
  fee_note TEXT,
  methods TEXT,
  pay_to TEXT,
  pay_to_label TEXT,
  require_payment INTEGER NOT NULL DEFAULT 1,
  open_message TEXT,
  closed_message TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON recruitment_campaigns(archived, open, sort_order, id);