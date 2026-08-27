'use strict';
const { db } = require('./db');

// 멱등 시드: 기존 데이터를 비우고 다시 채운다.
function reset() {
  for (const t of ['post_channels','posts','metrics_daily','inbox','reviews','reservations','ads','channels','business']) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  db.prepare("DELETE FROM sqlite_sequence").run();
}

const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const dayStr = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const daysFromNow = (n, h = 10, m = 0) => {
  const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d;
};

function seed() {
  reset();

  const biz = db.prepare(
    `INSERT INTO business (name,type,country,city,tagline) VALUES (?,?,?,?,?)`
  ).run('코나 서프 하우스', 'surf', '인도네시아', '발리 짱구',
        '발리 짱구의 한인 서프 게스트하우스 · 서핑 레슨 · 브런치 카페').lastInsertRowid;

  // 채널 — 팔로워/직전값(성장률 계산용)
  const chDefs = [
    ['instagram', '@konasurf.bali', 1, 18420, 17650],
    ['youtube',   'konasurfhouse',  1, 6240,  5980],
    ['tiktok',    '@konasurf',      1, 24800, 21300],
    ['x',         '@konasurf_bali', 1, 2130,  2090],
    ['facebook',  'konasurfhouse',  1, 5410,  5360],
    ['naver',     '코나서프하우스',  1, 3120,  2870],
    ['google',    'Kona Surf House',1, 0,     0],
    ['kakao',     '코나서프',        0, 1450,  1450],   // 미연결 예시
  ];
  const chIns = db.prepare(
    `INSERT INTO channels (business_id,platform,handle,connected,followers,prev_followers)
     VALUES (?,?,?,?,?,?)`);
  const ch = {};
  for (const [p, h, c, f, pf] of chDefs) {
    ch[p] = chIns.run(biz, p, h, c, f, pf).lastInsertRowid;
  }

  // 30일 시계열 (완만한 성장 + 노이즈)
  const mIns = db.prepare(
    `INSERT INTO metrics_daily (channel_id,date,followers,reach,engagement) VALUES (?,?,?,?,?)`);
  for (const [p, , c, f] of chDefs) {
    if (!c || f === 0) continue;
    const start = Math.round(f * 0.92);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const t = (29 - i) / 29;
      const foll = Math.round(start + (f - start) * t + (Math.sin(i) * f * 0.004));
      const reach = Math.round(foll * (0.35 + 0.25 * Math.abs(Math.sin(i * 1.7))));
      const eng = Math.round(reach * (0.04 + 0.03 * Math.abs(Math.cos(i * 2.1))));
      mIns.run(ch[p], dayStr(d), foll, reach, eng);
    }
  }

  // 게시물 — 발행완료 + 예약 + 초안
  const pIns = db.prepare(
    `INSERT INTO posts (business_id,title,body,media,status,scheduled_at,published_at)
     VALUES (?,?,?,?,?,?,?)`);
  const pcIns = db.prepare(
    `INSERT INTO post_channels (post_id,channel_id,status,likes,comments,reach) VALUES (?,?,?,?,?,?)`);
  const addPost = (title, body, media, status, when, chans, stats) => {
    const sched = status === 'scheduled' ? iso(when) : null;
    const pub = status === 'published' ? iso(when) : null;
    const pid = pIns.run(biz, title, body, media, status, sched, pub).lastInsertRowid;
    for (const p of chans) {
      const s = stats?.[p] || {};
      pcIns.run(pid, ch[p],
        status === 'published' ? 'published' : 'scheduled',
        s.likes || 0, s.comments || 0, s.reach || 0);
    }
    return pid;
  };

  addPost('선셋 서프 세션 🌅', '오늘 짱구 비치 선셋 파도 완벽했어요! 내일 오전 초보 레슨 2자리 남았습니다.', '🏄',
    'published', daysFromNow(-2, 18), ['instagram','tiktok','facebook'],
    { instagram:{likes:842,comments:37,reach:9200}, tiktok:{likes:3120,comments:88,reach:24100}, facebook:{likes:120,comments:9,reach:2100} });
  addPost('브런치 신메뉴 아보카도 토스트', '한국인 입맛 저격 아보카도 토스트 출시 🥑 게스트하우스 조식으로도 제공!', '🥑',
    'published', daysFromNow(-5, 9), ['instagram','naver'],
    { instagram:{likes:610,comments:22,reach:7400}, naver:{likes:0,comments:14,reach:1800} });
  addPost('발리 우기 서핑 꿀팁 영상', '우기에도 좋은 파도 찾는 법 5가지 — 풀버전 유튜브 공개', '🎬',
    'published', daysFromNow(-8, 12), ['youtube','x'],
    { youtube:{likes:410,comments:52,reach:12800}, x:{likes:88,comments:6,reach:3200} });

  addPost('주말 서프캠프 모집 🏄‍♀️', '2박3일 서프캠프 얼리버드 마감 임박! 숙소+레슨+보드 포함.', '📣',
    'scheduled', daysFromNow(1, 11), ['instagram','tiktok','facebook','kakao']);
  addPost('한식 디너 나이트', '금요일 한식 디너 — 김치찌개와 삼겹살, 발리에서 즐기는 집밥.', '🍲',
    'scheduled', daysFromNow(3, 17), ['instagram','naver','kakao']);
  addPost('신규 룸 오픈 하우스', '오션뷰 디럭스룸 2개 신규 오픈 기념 이벤트 예고편.', '🏠',
    'scheduled', daysFromNow(6, 10), ['instagram','youtube','facebook']);
  addPost('(초안) 요가 클래스 콜라보', '옆집 요가 스튜디오와 서프+요가 패키지 초안...', '🧘',
    'draft', null, []);

  // 통합 인박스
  const inIns = db.prepare(
    `INSERT INTO inbox (business_id,channel_id,platform,kind,author,text,sentiment,received_at,read,replied,reply_text)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const msgs = [
    ['instagram','dm','soojin_traveler','초보인데 레슨 예약 가능할까요? 다음주 화요일 오전이요!','neutral',-0.2,0,0,null],
    ['instagram','comment','bali_lover','사진 진짜 예뻐요 😍 위치가 어디예요?','positive',-0.5,0,0,null],
    ['tiktok','comment','surf_kim','보드 렌탈만도 가능한가요?','neutral',-0.8,0,0,null],
    ['kakao','dm','김민수','3인 게스트하우스 2박 문의드립니다. 조식 포함인가요?','neutral',-1.2,1,1,'네 조식 포함이며, 예약 링크 보내드릴게요!'],
    ['youtube','comment','waverider','우기 꿀팁 영상 최고네요 구독하고 갑니다','positive',-1.5,1,0,null],
    ['instagram','comment','angry_guest','지난주 예약했는데 답이 없어서 취소했어요','negative',-2.1,0,0,null],
    ['facebook','dm','Anna L.','Do you offer English surf lessons?','neutral',-2.4,0,0,null],
    ['naver','comment','제주감성','발리 가면 꼭 들를게요! 주차 되나요?','positive',-3.0,1,0,null],
    ['tiktok','dm','young_surfer','친구 4명이서 캠프 가고싶은데 남은자리 있나요?','neutral',-3.3,0,0,null],
    ['x','comment','digitalnomad','짱구 카페 와이파이 어때요? 워케이션 고민중','neutral',-4.0,0,0,null],
    ['instagram','dm','hyewon.k','디럭스룸 오션뷰 이번 주말 가능한가요?','neutral',-4.5,0,0,null],
    ['kakao','dm','박서준','서프캠프 얼리버드 아직 되나요?','neutral',-5.1,0,0,null],
  ];
  for (const [pl, kind, author, text, sent, dOff, read, replied, reply] of msgs) {
    const d = new Date(now); d.setDate(d.getDate() + Math.floor(dOff)); d.setHours(9 + Math.floor(Math.random()*10));
    inIns.run(biz, ch[pl] || null, pl, kind, author, text, sent, iso(d), read, replied, reply);
  }

  // 리뷰
  const rIns = db.prepare(
    `INSERT INTO reviews (business_id,platform,author,rating,text,received_at,replied,reply_text)
     VALUES (?,?,?,?,?,?,?,?)`);
  const revs = [
    ['google','James P.',5,'Best surf stay in Canggu. The Korean breakfast was amazing!',-1,1,'Thank you James! See you next swell 🤙'],
    ['google','유진',5,'사장님이 한국분이라 너무 편했어요. 레슨도 친절하고 최고!',-3,0,null],
    ['naver','여행러버',4,'위치 좋고 깨끗해요. 다만 주말엔 좀 붐벼요.',-4,0,null],
    ['google','Marco',5,'Great vibe, clean rooms, and the surf lessons are legit.',-6,1,'Terima kasih Marco!'],
    ['naver','서핑입문',3,'초보라 무서웠는데 강사님이 잘 잡아주셨어요. 파도가 좀 아쉬웠음.',-8,0,null],
    ['google','Sophie',2,'Booked via Instagram DM but reply was slow. Room was fine though.',-9,0,null],
    ['naver','발리한달',5,'한 달 살기 워케이션으로 최고. 카페 브런치 강추!',-11,1,'감사합니다! 다음에도 편히 오세요 ☕'],
    ['google','Kenji',4,'Nice place, friendly staff. WiFi could be faster.',-13,0,null],
  ];
  for (const [pl, a, rt, tx, dOff, rp, rtx] of revs) {
    const d = new Date(now); d.setDate(d.getDate() + dOff);
    rIns.run(biz, pl, a, rt, tx, iso(d), rp, rtx);
  }

  // 예약·문의
  const resIns = db.prepare(
    `INSERT INTO reservations (business_id,kind,customer,party,when_at,status,source,note)
     VALUES (?,?,?,?,?,?,?,?)`);
  const res = [
    ['class','수진',1, daysFromNow(2,9), 'new','instagram','초보 서프 레슨 오전'],
    ['stay','김민수',3, daysFromNow(4,15), 'confirmed','kakao','게스트하우스 2박, 조식 포함'],
    ['class','young_surfer',4, daysFromNow(5,8), 'new','tiktok','서프캠프 4인 문의'],
    ['table','Anna L.',2, daysFromNow(1,19), 'confirmed','instagram','한식 디너 2인'],
    ['stay','혜원',2, daysFromNow(3,14), 'new','instagram','디럭스 오션뷰 주말'],
    ['class','박서준',1, daysFromNow(7,9), 'new','kakao','얼리버드 서프캠프'],
    ['stay','James P.',2, daysFromNow(-2,15), 'done','google','2박 완료'],
    ['table','유진',5, daysFromNow(-1,18), 'done','naver','브런치 5인 완료'],
    ['class','Sophie',1, daysFromNow(-3,9), 'cancelled','instagram','노쇼 취소'],
    ['stay','Marco',2, daysFromNow(9,15), 'confirmed','google','1주 장기 숙박'],
    ['table','디지털노마드',1, daysFromNow(2,11), 'new','x','워케이션 카페 데이패스'],
    ['class','민지',3, daysFromNow(6,8), 'new','instagram','친구 3인 레슨'],
  ];
  for (const [k, c, pty, w, st, src, note] of res) {
    resIns.run(biz, k, c, pty, iso(w), st, src, note);
  }

  // 광고
  const aIns = db.prepare(
    `INSERT INTO ads (business_id,channel,name,spend,revenue,impressions,clicks,conversions)
     VALUES (?,?,?,?,?,?,?,?)`);
  const ads = [
    ['instagram','서프캠프 얼리버드', 1200000, 4800000, 182000, 5400, 62],
    ['facebook','게스트하우스 리타게팅', 600000, 1980000, 94000, 2100, 24],
    ['google','발리 서핑 레슨 검색', 900000, 3600000, 41000, 3800, 41],
    ['tiktok','짱구 서프 릴스 부스팅', 450000, 990000, 220000, 6100, 11],
  ];
  for (const [c, n, sp, rv, im, cl, cv] of ads) aIns.run(biz, c, n, sp, rv, im, cl, cv);

  return { biz };
}

module.exports = { seed };

if (require.main === module) {
  const r = seed();
  const c = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  console.log('시드 완료 — business', r.biz);
  console.log(' 채널', c('channels'), '· 지표', c('metrics_daily'), '· 게시물', c('posts'),
              '· 인박스', c('inbox'), '· 리뷰', c('reviews'), '· 예약', c('reservations'), '· 광고', c('ads'));
}
