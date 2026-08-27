'use strict';

require('./lib/env').loadEnv();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { db } = require('./db');
const { seed } = require('./seed');
const ig = require('./lib/instagram');

// OAuth CSRF state (단일 인스턴스용 인메모리, 10분 TTL)
const oauthStates = new Map();
function newState(){ const t=crypto.randomBytes(16).toString('hex'); oauthStates.set(t, Date.now()+6e5); return t; }
function useState(t){ const e=oauthStates.get(t); oauthStates.delete(t); return e && e>Date.now(); }
setInterval(()=>{ const n=Date.now(); for(const[k,v]of oauthStates) if(v<n) oauthStates.delete(k); }, 6e5).unref();

function saveInstagram(profile, token, expiresIn, scope){
  const ch=db.prepare('SELECT * FROM channels WHERE business_id=? AND platform=?').get(BIZ,'instagram');
  const followers=profile.followers_count||0;
  if(ch){
    db.prepare('UPDATE channels SET handle=?, connected=1, prev_followers=followers, followers=? WHERE id=?')
      .run('@'+profile.username, followers, ch.id);
  } else {
    db.prepare('INSERT INTO channels (business_id,platform,handle,connected,followers,prev_followers) VALUES (?,?,?,1,?,?)')
      .run(BIZ,'instagram','@'+profile.username, followers, followers);
  }
  const expISO = expiresIn ? new Date(Date.now()+expiresIn*1000).toISOString().slice(0,19).replace('T',' ') : null;
  db.prepare(`INSERT INTO oauth_tokens (business_id,platform,account_ref,username,access_token,token_type,scope,expires_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(business_id,platform) DO UPDATE SET account_ref=excluded.account_ref, username=excluded.username,
      access_token=excluded.access_token, token_type=excluded.token_type, scope=excluded.scope,
      obtained_at=datetime('now','localtime'), expires_at=excluded.expires_at`)
    .run(BIZ,'instagram', String(profile.user_id||profile.id||''), profile.username, token, 'bearer', scope||'', expISO);
}

// 최초 기동 시 데이터가 없으면 시드
if (db.prepare('SELECT COUNT(*) c FROM business').get().c === 0) seed();

const BIZ = 1; // 데모: 단일 사업장
const app = express();
const PORT = process.env.PORT || 3500;
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const q = {
  business: db.prepare('SELECT * FROM business WHERE id=?'),
  channels: db.prepare('SELECT * FROM channels WHERE business_id=? ORDER BY connected DESC, followers DESC'),
  channel: db.prepare('SELECT * FROM channels WHERE id=?'),
  toggleCh: db.prepare('UPDATE channels SET connected=? WHERE id=?'),
};

// 생산성 절약 시간 모델 (분) — 수동 작업 대비 절약 추정치
const SAVE = { multiPublish: 7, schedule: 5, inbox: 3, review: 4 };

const PLATFORMS = {
  instagram:{name:'Instagram', color:'#E1306C', icon:'IG'},
  youtube:{name:'YouTube', color:'#FF0033', icon:'YT'},
  tiktok:{name:'TikTok', color:'#171622', icon:'TT'},
  x:{name:'X', color:'#171622', icon:'X'},
  facebook:{name:'Facebook', color:'#1877F2', icon:'FB'},
  naver:{name:'Naver', color:'#03C75A', icon:'N'},
  google:{name:'Google', color:'#4285F4', icon:'G'},
  kakao:{name:'Kakao', color:'#FDDC00', icon:'K'},
};

const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0;

app.get('/api/meta', (req, res) => {
  res.json({ business: q.business.get(BIZ), platforms: PLATFORMS });
});

// ---------- 인스타그램 실연동 (OAuth) ----------
app.get('/api/integrations/instagram/status', (req, res) => {
  const tok = db.prepare('SELECT username,expires_at,obtained_at,scope FROM oauth_tokens WHERE business_id=? AND platform=?').get(BIZ,'instagram');
  const ch = db.prepare('SELECT followers,connected FROM channels WHERE business_id=? AND platform=?').get(BIZ,'instagram');
  res.json({
    configured: ig.isConfigured(),
    connected: !!tok,
    username: tok?.username || null,
    followers: ch?.followers || 0,
    expires_at: tok?.expires_at || null,
    redirectUri: ig.redirectUri(req),
    scopes: ig.SCOPES,
  });
});

app.get('/auth/instagram', (req, res) => {
  if (!ig.isConfigured()) return res.redirect('/dashboard?ig=notconfigured');
  res.redirect(ig.authUrl(req, newState()));
});

app.get('/auth/instagram/callback', async (req, res) => {
  const { code, state, error, error_description, error_reason } = req.query;
  if (error) return res.redirect('/dashboard?ig=error&msg=' + encodeURIComponent(error_description || error_reason || error));
  if (!code || !useState(state)) return res.redirect('/dashboard?ig=error&msg=' + encodeURIComponent('요청이 만료되었거나 유효하지 않습니다(state).'));
  try {
    const short = await ig.exchangeCode(req, code);
    const long = await ig.longLivedToken(short.access_token);
    const profile = await ig.getProfile(long.access_token);
    const scope = Array.isArray(short.permissions) ? short.permissions.join(',') : (short.permissions || '');
    saveInstagram(profile, long.access_token, long.expires_in, scope);
    res.redirect('/dashboard?ig=connected&u=' + encodeURIComponent(profile.username || ''));
  } catch (e) {
    res.redirect('/dashboard?ig=error&msg=' + encodeURIComponent(e.message));
  }
});

app.post('/api/integrations/instagram/disconnect', (req, res) => {
  db.prepare('DELETE FROM oauth_tokens WHERE business_id=? AND platform=?').run(BIZ,'instagram');
  db.prepare('UPDATE channels SET connected=0 WHERE business_id=? AND platform=?').run(BIZ,'instagram');
  res.json({ ok: true });
});

// ---------- 개요 ----------
app.get('/api/overview', (req, res) => {
  const channels = q.channels.all(BIZ);
  const connected = channels.filter(c => c.connected);
  const totalFollowers = connected.reduce((s, c) => s + c.followers, 0);
  const prevFollowers = connected.reduce((s, c) => s + c.prev_followers, 0);

  const monthPub = db.prepare(
    `SELECT COUNT(*) c FROM posts WHERE business_id=? AND status='published'
       AND published_at >= datetime('now','localtime','-30 days')`).get(BIZ).c;
  const scheduled = db.prepare(
    `SELECT COUNT(*) c FROM posts WHERE business_id=? AND status='scheduled'`).get(BIZ).c;
  const unread = db.prepare(`SELECT COUNT(*) c FROM inbox WHERE business_id=? AND read=0`).get(BIZ).c;
  const newRes = db.prepare(`SELECT COUNT(*) c FROM reservations WHERE business_id=? AND status='new'`).get(BIZ).c;
  const rating = db.prepare(`SELECT ROUND(AVG(rating),1) avg, COUNT(*) c FROM reviews WHERE business_id=?`).get(BIZ);

  // 채널 성과 (도달/참여 최근 vs 이전)
  const chPerf = connected.map(c => {
    const recent = db.prepare(
      `SELECT SUM(reach) r, SUM(engagement) e FROM metrics_daily WHERE channel_id=? AND date>=date('now','-7 days')`).get(c.id);
    return { platform: c.platform, handle: c.handle, followers: c.followers,
      growth: pct(c.followers, c.prev_followers),
      reach7: recent.r || 0, eng7: recent.e || 0 };
  });

  const upcoming = db.prepare(
    `SELECT id,title,media,scheduled_at FROM posts WHERE business_id=? AND status='scheduled'
       ORDER BY scheduled_at LIMIT 4`).all(BIZ)
    .map(p => ({ ...p, channels: postChannels(p.id) }));

  const recentInbox = db.prepare(
    `SELECT id,platform,kind,author,text,sentiment,received_at,read FROM inbox
       WHERE business_id=? ORDER BY received_at DESC LIMIT 5`).all(BIZ);

  res.json({
    kpis: {
      followers: totalFollowers, followersGrowth: pct(totalFollowers, prevFollowers),
      monthPub, scheduled, unread, newRes,
      rating: rating.avg || 0, reviewCount: rating.c,
    },
    productivity: productivity(),
    channels: chPerf, upcoming, recentInbox,
  });
});

function postChannels(postId) {
  return db.prepare(
    `SELECT c.platform FROM post_channels pc JOIN channels c ON c.id=pc.channel_id WHERE pc.post_id=?`)
    .all(postId).map(r => r.platform);
}

// ---------- 생산성 ----------
function productivity() {
  const pubRows = db.prepare(
    `SELECT p.id, COUNT(pc.id) n FROM posts p JOIN post_channels pc ON pc.post_id=p.id
       WHERE p.business_id=? AND p.status='published' GROUP BY p.id`).all(BIZ);
  const multiChannels = pubRows.reduce((s, r) => s + Math.max(0, r.n - 1), 0);
  const scheduled = db.prepare(`SELECT COUNT(*) c FROM posts WHERE business_id=? AND status IN('scheduled','published')`).get(BIZ).c;
  const handled = db.prepare(`SELECT COUNT(*) c FROM inbox WHERE business_id=? AND (read=1 OR replied=1)`).get(BIZ).c;
  const revReplied = db.prepare(`SELECT COUNT(*) c FROM reviews WHERE business_id=? AND replied=1`).get(BIZ).c;

  const parts = [
    { key:'멀티 채널 발행', min: multiChannels * SAVE.multiPublish, detail:`추가 채널 ${multiChannels}회 × ${SAVE.multiPublish}분` },
    { key:'예약 발행', min: scheduled * SAVE.schedule, detail:`게시물 ${scheduled}건 × ${SAVE.schedule}분` },
    { key:'통합 인박스', min: handled * SAVE.inbox, detail:`메시지 ${handled}건 × ${SAVE.inbox}분` },
    { key:'리뷰 응대', min: revReplied * SAVE.review, detail:`리뷰 ${revReplied}건 × ${SAVE.review}분` },
  ];
  const totalMin = parts.reduce((s, p) => s + p.min, 0);
  return { totalMin, totalHours: Math.round(totalMin / 6) / 10, parts };
}
app.get('/api/productivity', (req, res) => res.json(productivity()));

// ---------- 채널 ----------
app.get('/api/channels', (req, res) => {
  res.json(q.channels.all(BIZ).map(c => ({ ...c, growth: pct(c.followers, c.prev_followers) })));
});
app.post('/api/channels/:id/toggle', (req, res) => {
  const c = q.channel.get(+req.params.id);
  if (!c) return res.status(404).json({ error: '채널 없음' });
  q.toggleCh.run(c.connected ? 0 : 1, c.id);
  res.json({ ok: true, connected: c.connected ? 0 : 1 });
});

// ---------- 지표(분석) ----------
app.get('/api/metrics', (req, res) => {
  const days = Math.min(+req.query.days || 30, 90);
  const channels = q.channels.all(BIZ).filter(c => c.connected && c.followers > 0);
  const series = channels.map(c => ({
    platform: c.platform,
    points: db.prepare(
      `SELECT date, followers, reach, engagement FROM metrics_daily
         WHERE channel_id=? AND date>=date('now',?) ORDER BY date`).all(c.id, `-${days} days`),
  }));
  const ads = db.prepare('SELECT * FROM ads WHERE business_id=?').all(BIZ).map(a => ({
    ...a, roas: a.spend > 0 ? Math.round((a.revenue / a.spend) * 10) / 10 : 0,
    ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 1000) / 10 : 0,
  }));
  res.json({ series, ads });
});

// ---------- 게시물 / 작성 ----------
app.get('/api/posts', (req, res) => {
  const status = req.query.status;
  const rows = (status
    ? db.prepare('SELECT * FROM posts WHERE business_id=? AND status=? ORDER BY COALESCE(scheduled_at,published_at,created_at) DESC').all(BIZ, status)
    : db.prepare('SELECT * FROM posts WHERE business_id=? ORDER BY COALESCE(scheduled_at,published_at,created_at) DESC').all(BIZ)
  ).map(p => ({ ...p, channels: postChannels(p.id), stats: postStats(p.id) }));
  res.json(rows);
});

function postStats(postId) {
  return db.prepare(
    `SELECT COALESCE(SUM(likes),0) likes, COALESCE(SUM(comments),0) comments, COALESCE(SUM(reach),0) reach
       FROM post_channels WHERE post_id=?`).get(postId);
}

app.post('/api/posts', (req, res) => {
  const { title, body, media, channels, mode, scheduled_at } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: '내용을 입력하세요.' });
  if (!Array.isArray(channels) || channels.length === 0)
    return res.status(400).json({ error: '발행할 채널을 1개 이상 선택하세요.' });

  const chRows = q.channels.all(BIZ).filter(c => channels.includes(c.platform) && c.connected);
  if (chRows.length === 0) return res.status(400).json({ error: '연결된 채널이 없습니다.' });

  const publishNow = mode === 'now';
  if (!publishNow && !scheduled_at) return res.status(400).json({ error: '예약 시간을 지정하세요.' });

  const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const pid = db.prepare(
    `INSERT INTO posts (business_id,title,body,media,status,scheduled_at,published_at)
     VALUES (?,?,?,?,?,?,?)`)
    .run(BIZ, title || '', body, media || '📝',
         publishNow ? 'published' : 'scheduled',
         publishNow ? null : scheduled_at.replace('T', ' '),
         publishNow ? nowIso : null).lastInsertRowid;

  const pcIns = db.prepare(
    `INSERT INTO post_channels (post_id,channel_id,status,likes,comments,reach) VALUES (?,?,?,?,?,?)`);
  for (const c of chRows) {
    // 즉시 발행이면 소소한 초기 반응을 시뮬레이션
    const seedReach = publishNow ? Math.round(c.followers * (0.2 + Math.random() * 0.2)) : 0;
    pcIns.run(pid, c.id, publishNow ? 'published' : 'scheduled',
      publishNow ? Math.round(seedReach * 0.05) : 0, 0, seedReach);
  }
  res.json({ ok: true, id: pid, status: publishNow ? 'published' : 'scheduled' });
});

app.patch('/api/posts/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id=? AND business_id=?').get(+req.params.id, BIZ);
  if (!p) return res.status(404).json({ error: '게시물 없음' });
  const { title, body, media, scheduled_at } = req.body || {};
  db.prepare('UPDATE posts SET title=?, body=?, media=?, scheduled_at=? WHERE id=?')
    .run(title ?? p.title, body ?? p.body, media ?? p.media,
         scheduled_at ? scheduled_at.replace('T', ' ') : p.scheduled_at, p.id);
  res.json({ ok: true });
});

app.delete('/api/posts/:id', (req, res) => {
  db.prepare('DELETE FROM post_channels WHERE post_id=?').run(+req.params.id);
  const r = db.prepare('DELETE FROM posts WHERE id=? AND business_id=?').run(+req.params.id, BIZ);
  res.json({ ok: r.changes > 0 });
});

// ---------- 캘린더 ----------
app.get('/api/calendar', (req, res) => {
  const rows = db.prepare(
    `SELECT id,title,media,status,COALESCE(scheduled_at,published_at) at FROM posts
       WHERE business_id=? AND status IN('scheduled','published') AND at IS NOT NULL
       ORDER BY at`).all(BIZ).map(p => ({ ...p, channels: postChannels(p.id) }));
  res.json(rows);
});

// ---------- 통합 인박스 ----------
app.get('/api/inbox', (req, res) => {
  const { filter } = req.query;
  let sql = 'SELECT * FROM inbox WHERE business_id=?';
  const args = [BIZ];
  if (filter === 'unread') sql += ' AND read=0';
  else if (filter === 'unreplied') sql += ' AND replied=0';
  else if (filter && PLATFORMS[filter]) { sql += ' AND platform=?'; args.push(filter); }
  sql += ' ORDER BY received_at DESC';
  res.json(db.prepare(sql).all(...args));
});
app.post('/api/inbox/:id/read', (req, res) => {
  db.prepare('UPDATE inbox SET read=1 WHERE id=? AND business_id=?').run(+req.params.id, BIZ);
  res.json({ ok: true });
});
app.post('/api/inbox/:id/reply', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: '답장 내용을 입력하세요.' });
  const r = db.prepare('UPDATE inbox SET replied=1, read=1, reply_text=? WHERE id=? AND business_id=?')
    .run(text, +req.params.id, BIZ);
  res.json({ ok: r.changes > 0 });
});

// ---------- 리뷰 ----------
app.get('/api/reviews', (req, res) => {
  const rows = db.prepare('SELECT * FROM reviews WHERE business_id=? ORDER BY received_at DESC').all(BIZ);
  const dist = [5,4,3,2,1].map(r => ({ star: r, n: rows.filter(x => x.rating === r).length }));
  const avg = rows.length ? Math.round(rows.reduce((s,x)=>s+x.rating,0)/rows.length*10)/10 : 0;
  res.json({ reviews: rows, avg, count: rows.length, dist });
});
app.post('/api/reviews/:id/reply', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: '답변 내용을 입력하세요.' });
  const r = db.prepare('UPDATE reviews SET replied=1, reply_text=? WHERE id=? AND business_id=?')
    .run(text, +req.params.id, BIZ);
  res.json({ ok: r.changes > 0 });
});

// ---------- 예약·문의 ----------
app.get('/api/reservations', (req, res) => {
  res.json(db.prepare('SELECT * FROM reservations WHERE business_id=? ORDER BY when_at').all(BIZ));
});
app.patch('/api/reservations/:id', (req, res) => {
  const { status } = req.body || {};
  if (!['new','confirmed','done','cancelled'].includes(status))
    return res.status(400).json({ error: '잘못된 상태' });
  const r = db.prepare('UPDATE reservations SET status=? WHERE id=? AND business_id=?')
    .run(status, +req.params.id, BIZ);
  res.json({ ok: r.changes > 0 });
});
app.post('/api/reservations', (req, res) => {
  const { kind, customer, party, when_at, source, note } = req.body || {};
  if (!customer || !when_at) return res.status(400).json({ error: '고객명과 일시는 필수입니다.' });
  const id = db.prepare(
    `INSERT INTO reservations (business_id,kind,customer,party,when_at,status,source,note)
     VALUES (?,?,?,?,?,?,?,?)`)
    .run(BIZ, kind || 'inquiry', customer, party || 1, when_at.replace('T',' '), 'new', source || 'walkin', note || '')
    .lastInsertRowid;
  res.json({ ok: true, id });
});

app.get('/dashboard', (req, res) => res.sendFile('dashboard.html', { root: path.join(__dirname, 'public') }));

app.listen(PORT, () => {
  console.log(`MOA — 통합 홍보 관리 대시보드  http://localhost:${PORT}`);
});
