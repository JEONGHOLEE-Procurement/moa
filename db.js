'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'moa.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS business (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,          -- stay | surf | restaurant | cafe
    country TEXT, city TEXT,
    tagline TEXT
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    platform TEXT NOT NULL,      -- instagram | youtube | x | tiktok | facebook | naver | google | kakao
    handle TEXT,
    connected INTEGER NOT NULL DEFAULT 1,
    followers INTEGER DEFAULT 0,
    prev_followers INTEGER DEFAULT 0
  );

  -- 채널별 일자 지표 (그래프용 시계열)
  CREATE TABLE IF NOT EXISTS metrics_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    followers INTEGER, reach INTEGER, engagement INTEGER
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    title TEXT,
    body TEXT,
    media TEXT,                  -- emoji/placeholder tag
    status TEXT NOT NULL,        -- draft | scheduled | published
    scheduled_at TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS post_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | published | failed
    likes INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, reach INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    channel_id INTEGER,
    platform TEXT NOT NULL,
    kind TEXT NOT NULL,          -- comment | dm
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    sentiment TEXT DEFAULT 'neutral', -- positive | neutral | negative
    received_at TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    replied INTEGER NOT NULL DEFAULT 0,
    reply_text TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    platform TEXT NOT NULL,      -- google | naver
    author TEXT NOT NULL,
    rating INTEGER NOT NULL,
    text TEXT NOT NULL,
    received_at TEXT NOT NULL,
    replied INTEGER NOT NULL DEFAULT 0,
    reply_text TEXT
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    kind TEXT NOT NULL,          -- stay | table | class | inquiry
    customer TEXT NOT NULL,
    party INTEGER DEFAULT 1,
    when_at TEXT,
    status TEXT NOT NULL DEFAULT 'new', -- new | confirmed | done | cancelled
    source TEXT,                 -- instagram | kakao | naver | google | walkin
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- OAuth 액세스 토큰 (플랫폼 실연동). 토큰은 서버에만 보관하며 클라이언트로 내보내지 않는다.
  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    account_ref TEXT,            -- 플랫폼상의 사용자 id
    username TEXT,
    access_token TEXT NOT NULL,
    token_type TEXT,
    scope TEXT,
    obtained_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    expires_at TEXT,
    UNIQUE(business_id, platform)
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    name TEXT NOT NULL,
    spend INTEGER, revenue INTEGER,
    impressions INTEGER, clicks INTEGER, conversions INTEGER
  );
`);

module.exports = { db };
