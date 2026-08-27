/* MOA 정적 데모용 목(mock) 백엔드.
 * github.io/Static Site 처럼 서버가 없는 환경에서 window.fetch('/api/..')를 가로채
 * 브라우저 안의 데이터(localStorage)로 응답한다. server.js의 로직을 그대로 재현.
 * 인스타그램 실연동만은 서버 시크릿이 필요하므로 configured:false로 안내만 한다. */
(function () {
  'use strict';
  const KEY = 'moa.mock.v2';
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 19).replace('T', ' ');
  const dayStr = d => d.toISOString().slice(0, 10);
  const dfn = (n, h = 10, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d; };

  const PLATFORMS = {
    instagram:{name:'Instagram',icon:'IG'}, youtube:{name:'YouTube',icon:'YT'},
    tiktok:{name:'TikTok',icon:'TT'}, x:{name:'X',icon:'X'}, facebook:{name:'Facebook',icon:'FB'},
    naver:{name:'Naver',icon:'N'}, google:{name:'Google',icon:'G'}, kakao:{name:'Kakao',icon:'K'},
  };

  function buildSeed() {
    const business = { id:1, name:'코나 서프 하우스', type:'surf', country:'인도네시아', city:'발리 짱구',
      tagline:'발리 짱구의 한인 서프 게스트하우스 · 서핑 레슨 · 브런치 카페' };
    const chDefs = [
      ['instagram','@konasurf.bali',1,18420,17650],['youtube','konasurfhouse',1,6240,5980],
      ['tiktok','@konasurf',1,24800,21300],['x','@konasurf_bali',1,2130,2090],
      ['facebook','konasurfhouse',1,5410,5360],['naver','코나서프하우스',1,3120,2870],
      ['google','Kona Surf House',1,0,0],['kakao','코나서프',0,1450,1450],
    ];
    const channels = chDefs.map(([platform,handle,connected,followers,prev_followers],i)=>
      ({id:i+1,platform,handle,connected,followers,prev_followers}));
    const chId = p => channels.find(c=>c.platform===p).id;

    // 30일 시계열
    const metrics = [];
    for (const c of channels) {
      if (!c.connected || c.followers===0) continue;
      const start = Math.round(c.followers*0.92);
      for (let i=29;i>=0;i--){
        const d=new Date(now); d.setDate(d.getDate()-i); const t=(29-i)/29;
        const foll=Math.round(start+(c.followers-start)*t+Math.sin(i)*c.followers*0.004);
        const reach=Math.round(foll*(0.35+0.25*Math.abs(Math.sin(i*1.7))));
        const eng=Math.round(reach*(0.04+0.03*Math.abs(Math.cos(i*2.1))));
        metrics.push({channel_id:c.id,date:dayStr(d),followers:foll,reach,engagement:eng});
      }
    }

    let pid=0; const posts=[];
    const addPost=(title,body,media,status,when,chans,stats)=>{
      pid++; posts.push({ id:pid,title,body,media,status,
        scheduled_at: status==='scheduled'?iso(when):null,
        published_at: status==='published'?iso(when):null,
        created_at: iso(now),
        channels: chans.map(p=>({platform:p,status:status==='published'?'published':'scheduled',
          likes:(stats?.[p]?.likes)||0,comments:(stats?.[p]?.comments)||0,reach:(stats?.[p]?.reach)||0})) });
    };
    addPost('선셋 서프 세션 🌅','오늘 짱구 비치 선셋 파도 완벽했어요! 내일 오전 초보 레슨 2자리 남았습니다.','🏄',
      'published',dfn(-2,18),['instagram','tiktok','facebook'],
      {instagram:{likes:842,comments:37,reach:9200},tiktok:{likes:3120,comments:88,reach:24100},facebook:{likes:120,comments:9,reach:2100}});
    addPost('브런치 신메뉴 아보카도 토스트','한국인 입맛 저격 아보카도 토스트 출시 🥑 게스트하우스 조식으로도 제공!','🥑',
      'published',dfn(-5,9),['instagram','naver'],{instagram:{likes:610,comments:22,reach:7400},naver:{comments:14,reach:1800}});
    addPost('발리 우기 서핑 꿀팁 영상','우기에도 좋은 파도 찾는 법 5가지 — 풀버전 유튜브 공개','🎬',
      'published',dfn(-8,12),['youtube','x'],{youtube:{likes:410,comments:52,reach:12800},x:{likes:88,comments:6,reach:3200}});
    addPost('주말 서프캠프 모집 🏄‍♀️','2박3일 서프캠프 얼리버드 마감 임박! 숙소+레슨+보드 포함.','📣','scheduled',dfn(1,11),['instagram','tiktok','facebook','kakao']);
    addPost('한식 디너 나이트','금요일 한식 디너 — 김치찌개와 삼겹살, 발리에서 즐기는 집밥.','🍲','scheduled',dfn(3,17),['instagram','naver','kakao']);
    addPost('신규 룸 오픈 하우스','오션뷰 디럭스룸 2개 신규 오픈 기념 이벤트 예고편.','🏠','scheduled',dfn(6,10),['instagram','youtube','facebook']);
    addPost('(초안) 요가 클래스 콜라보','옆집 요가 스튜디오와 서프+요가 패키지 초안...','🧘','draft',null,[]);

    let iid=0; const inbox=[];
    const M=[
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
    for (const [pl,kind,author,text,sentiment,dOff,read,replied,reply] of M){
      const d=new Date(now); d.setDate(d.getDate()+Math.floor(dOff)); d.setHours(9+Math.floor(Math.random()*10));
      iid++; inbox.push({id:iid,platform:pl,kind,author,text,sentiment,received_at:iso(d),read,replied,reply_text:reply});
    }

    let rid=0; const reviews=[];
    const RV=[
      ['google','James P.',5,'Best surf stay in Canggu. The Korean breakfast was amazing!',-1,1,'Thank you James! See you next swell 🤙'],
      ['google','유진',5,'사장님이 한국분이라 너무 편했어요. 레슨도 친절하고 최고!',-3,0,null],
      ['naver','여행러버',4,'위치 좋고 깨끗해요. 다만 주말엔 좀 붐벼요.',-4,0,null],
      ['google','Marco',5,'Great vibe, clean rooms, and the surf lessons are legit.',-6,1,'Terima kasih Marco!'],
      ['naver','서핑입문',3,'초보라 무서웠는데 강사님이 잘 잡아주셨어요. 파도가 좀 아쉬웠음.',-8,0,null],
      ['google','Sophie',2,'Booked via Instagram DM but reply was slow. Room was fine though.',-9,0,null],
      ['naver','발리한달',5,'한 달 살기 워케이션으로 최고. 카페 브런치 강추!',-11,1,'감사합니다! 다음에도 편히 오세요 ☕'],
      ['google','Kenji',4,'Nice place, friendly staff. WiFi could be faster.',-13,0,null],
    ];
    for (const [platform,author,rating,text,dOff,replied,reply] of RV){
      const d=new Date(now); d.setDate(d.getDate()+dOff);
      rid++; reviews.push({id:rid,platform,author,rating,text,received_at:iso(d),replied,reply_text:reply});
    }

    let sid=0; const reservations=[];
    const RS=[
      ['class','수진',1,dfn(2,9),'new','instagram','초보 서프 레슨 오전'],
      ['stay','김민수',3,dfn(4,15),'confirmed','kakao','게스트하우스 2박, 조식 포함'],
      ['class','young_surfer',4,dfn(5,8),'new','tiktok','서프캠프 4인 문의'],
      ['table','Anna L.',2,dfn(1,19),'confirmed','instagram','한식 디너 2인'],
      ['stay','혜원',2,dfn(3,14),'new','instagram','디럭스 오션뷰 주말'],
      ['class','박서준',1,dfn(7,9),'new','kakao','얼리버드 서프캠프'],
      ['stay','James P.',2,dfn(-2,15),'done','google','2박 완료'],
      ['table','유진',5,dfn(-1,18),'done','naver','브런치 5인 완료'],
      ['class','Sophie',1,dfn(-3,9),'cancelled','instagram','노쇼 취소'],
      ['stay','Marco',2,dfn(9,15),'confirmed','google','1주 장기 숙박'],
      ['table','디지털노마드',1,dfn(2,11),'new','x','워케이션 카페 데이패스'],
      ['class','민지',3,dfn(6,8),'new','instagram','친구 3인 레슨'],
    ];
    for (const [kind,customer,party,w,status,source,note] of RS){
      sid++; reservations.push({id:sid,kind,customer,party,when_at:iso(w),status,source,note});
    }

    const ads=[
      ['instagram','서프캠프 얼리버드',1200000,4800000,182000,5400,62],
      ['facebook','게스트하우스 리타게팅',600000,1980000,94000,2100,24],
      ['google','발리 서핑 레슨 검색',900000,3600000,41000,3800,41],
      ['tiktok','짱구 서프 릴스 부스팅',450000,990000,220000,6100,11],
    ].map(([channel,name,spend,revenue,impressions,clicks,conversions],i)=>
      ({id:i+1,channel,name,spend,revenue,impressions,clicks,conversions}));

    return { business, channels, metrics, posts, inbox, reviews, reservations, ads, _pid:pid, _sid:sid };
  }

  let store;
  try { store = JSON.parse(localStorage.getItem(KEY)); } catch { store = null; }
  if (!store) { store = buildSeed(); persist(); }
  function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch{} }

  const SAVE={multiPublish:7,schedule:5,inbox:3,review:4};
  const pct=(c,p)=>p>0?Math.round((c-p)/p*1000)/10:0;
  const chById=id=>store.channels.find(c=>c.id===id);
  const postChannels=p=>p.channels.map(c=>c.platform);
  const postStats=p=>p.channels.reduce((s,c)=>({likes:s.likes+c.likes,comments:s.comments+c.comments,reach:s.reach+c.reach}),{likes:0,comments:0,reach:0});

  function productivity(){
    const pub=store.posts.filter(p=>p.status==='published');
    const multi=pub.reduce((s,p)=>s+Math.max(0,p.channels.length-1),0);
    const scheduled=store.posts.filter(p=>p.status==='scheduled'||p.status==='published').length;
    const handled=store.inbox.filter(m=>m.read||m.replied).length;
    const rev=store.reviews.filter(r=>r.replied).length;
    const parts=[
      {key:'멀티 채널 발행',min:multi*SAVE.multiPublish},
      {key:'예약 발행',min:scheduled*SAVE.schedule},
      {key:'통합 인박스',min:handled*SAVE.inbox},
      {key:'리뷰 응대',min:rev*SAVE.review},
    ];
    const totalMin=parts.reduce((s,p)=>s+p.min,0);
    return {totalMin,totalHours:Math.round(totalMin/6)/10,parts};
  }

  function overview(){
    const connected=store.channels.filter(c=>c.connected);
    const tot=connected.reduce((s,c)=>s+c.followers,0), prev=connected.reduce((s,c)=>s+c.prev_followers,0);
    const cut=new Date(now.getTime()-30*864e5);
    const monthPub=store.posts.filter(p=>p.status==='published'&&p.published_at&&new Date(p.published_at.replace(' ','T'))>=cut).length;
    const scheduled=store.posts.filter(p=>p.status==='scheduled').length;
    const unread=store.inbox.filter(m=>!m.read).length;
    const newRes=store.reservations.filter(r=>r.status==='new').length;
    const rated=store.reviews;
    const rating=rated.length?Math.round(rated.reduce((s,r)=>s+r.rating,0)/rated.length*10)/10:0;
    const c7=new Date(now.getTime()-7*864e5);
    const chPerf=connected.map(c=>{
      const rows=store.metrics.filter(m=>m.channel_id===c.id&&new Date(m.date)>=c7);
      return {platform:c.platform,handle:c.handle,followers:c.followers,growth:pct(c.followers,c.prev_followers),
        reach7:rows.reduce((s,m)=>s+m.reach,0),eng7:rows.reduce((s,m)=>s+m.engagement,0)};
    });
    const upcoming=store.posts.filter(p=>p.status==='scheduled').sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0,4).map(p=>({id:p.id,title:p.title,media:p.media,scheduled_at:p.scheduled_at,channels:postChannels(p)}));
    const recentInbox=[...store.inbox].sort((a,b)=>b.received_at.localeCompare(a.received_at)).slice(0,5)
      .map(m=>({id:m.id,platform:m.platform,kind:m.kind,author:m.author,text:m.text,sentiment:m.sentiment,received_at:m.received_at,read:m.read}));
    return {kpis:{followers:tot,followersGrowth:pct(tot,prev),monthPub,scheduled,unread,newRes,rating,reviewCount:rated.length},
      productivity:productivity(),channels:chPerf,upcoming,recentInbox};
  }

  function json(data,status){ return {status:status||200,data}; }
  function handle(method,path,qs,body){
    const seg=path.split('/').filter(Boolean); // ['api',...]
    const q=k=>qs.get(k);
    // /api/meta
    if(path==='/api/meta') return json({business:store.business,platforms:PLATFORMS});
    if(path==='/api/overview') return json(overview());
    if(path==='/api/productivity') return json(productivity());
    if(path==='/api/channels'){
      return json(store.channels.map(c=>({...c,growth:pct(c.followers,c.prev_followers)})));
    }
    if(path==='/api/integrations/instagram/status'){
      const ig=store.channels.find(c=>c.platform==='instagram');
      return json({configured:false,connected:false,username:null,followers:ig?ig.followers:0,expires_at:null,
        redirectUri:location.origin+'/auth/instagram/callback',
        scopes:['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_comments','instagram_business_manage_messages']});
    }
    if(path==='/api/integrations/instagram/disconnect'&&method==='POST') return json({ok:true});
    // channel toggle
    let m;
    if((m=path.match(/^\/api\/channels\/(\d+)\/toggle$/))&&method==='POST'){
      const c=chById(+m[1]); if(!c) return json({error:'채널 없음'},404);
      c.connected=c.connected?0:1; persist(); return json({ok:true,connected:c.connected});
    }
    if(path==='/api/metrics'){
      const days=Math.min(+q('days')||30,90); const cut=new Date(now.getTime()-days*864e5);
      const series=store.channels.filter(c=>c.connected&&c.followers>0).map(c=>({platform:c.platform,
        points:store.metrics.filter(x=>x.channel_id===c.id&&new Date(x.date)>=cut).sort((a,b)=>a.date.localeCompare(b.date))
          .map(x=>({date:x.date,followers:x.followers,reach:x.reach,engagement:x.engagement}))}));
      const ads=store.ads.map(a=>({...a,roas:a.spend>0?Math.round(a.revenue/a.spend*10)/10:0,ctr:a.impressions>0?Math.round(a.clicks/a.impressions*1000)/10:0}));
      return json({series,ads});
    }
    if(path==='/api/posts'&&method==='GET'){
      const st=q('status');
      const rows=store.posts.filter(p=>!st||p.status===st)
        .sort((a,b)=>(b.scheduled_at||b.published_at||b.created_at||'').localeCompare(a.scheduled_at||a.published_at||a.created_at||''))
        .map(p=>({...p,channels:postChannels(p),stats:postStats(p)}));
      return json(rows);
    }
    if(path==='/api/posts'&&method==='POST'){
      const req=body||{}; const text=req.body, channels=req.channels, mode=req.mode, scheduled_at=req.scheduled_at;
      if(!text||!text.trim()) return json({error:'내용을 입력하세요.'},400);
      if(!Array.isArray(channels)||!channels.length) return json({error:'발행할 채널을 1개 이상 선택하세요.'},400);
      const chRows=store.channels.filter(c=>channels.includes(c.platform)&&c.connected);
      if(!chRows.length) return json({error:'연결된 채널이 없습니다.'},400);
      const pubNow=mode==='now';
      if(!pubNow&&!scheduled_at) return json({error:'예약 시간을 지정하세요.'},400);
      store._pid++; const p={id:store._pid,title:req.title||'',body:text,media:req.media||'📝',
        status:pubNow?'published':'scheduled',
        scheduled_at:pubNow?null:scheduled_at.replace('T',' '),published_at:pubNow?iso(new Date()):null,created_at:iso(new Date()),
        channels:chRows.map(c=>{const reach=pubNow?Math.round(c.followers*(0.2+Math.random()*0.2)):0;
          return {platform:c.platform,status:pubNow?'published':'scheduled',likes:pubNow?Math.round(reach*0.05):0,comments:0,reach};})};
      store.posts.push(p); persist(); return json({ok:true,id:p.id,status:p.status});
    }
    if((m=path.match(/^\/api\/posts\/(\d+)$/))){
      const p=store.posts.find(x=>x.id===+m[1]);
      if(method==='DELETE'){ store.posts=store.posts.filter(x=>x.id!==+m[1]); persist(); return json({ok:!!p}); }
      if(method==='PATCH'){ if(!p) return json({error:'게시물 없음'},404);
        const req=body||{};
        if(req.title!=null)p.title=req.title; if(req.body!=null)p.body=req.body; if(req.media!=null)p.media=req.media;
        if(req.scheduled_at)p.scheduled_at=req.scheduled_at.replace('T',' '); persist(); return json({ok:true}); }
    }
    if(path==='/api/calendar'){
      return json(store.posts.filter(p=>(p.status==='scheduled'||p.status==='published')&&(p.scheduled_at||p.published_at))
        .map(p=>({id:p.id,title:p.title,media:p.media,status:p.status,at:p.scheduled_at||p.published_at,channels:postChannels(p)}))
        .sort((a,b)=>a.at.localeCompare(b.at)));
    }
    if(path==='/api/inbox'&&method==='GET'){
      const f=q('filter'); let list=[...store.inbox];
      if(f==='unread')list=list.filter(x=>!x.read); else if(f==='unreplied')list=list.filter(x=>!x.replied);
      else if(f&&PLATFORMS[f])list=list.filter(x=>x.platform===f);
      list.sort((a,b)=>b.received_at.localeCompare(a.received_at)); return json(list);
    }
    if((m=path.match(/^\/api\/inbox\/(\d+)\/read$/))&&method==='POST'){
      const x=store.inbox.find(i=>i.id===+m[1]); if(x){x.read=1;persist();} return json({ok:true});
    }
    if((m=path.match(/^\/api\/inbox\/(\d+)\/reply$/))&&method==='POST'){
      const x=store.inbox.find(i=>i.id===+m[1]); if(!body||!body.text||!body.text.trim())return json({error:'답장 내용을 입력하세요.'},400);
      if(x){x.replied=1;x.read=1;x.reply_text=body.text;persist();} return json({ok:!!x});
    }
    if(path==='/api/reviews'){
      const rows=[...store.reviews].sort((a,b)=>b.received_at.localeCompare(a.received_at));
      const dist=[5,4,3,2,1].map(s=>({star:s,n:rows.filter(x=>x.rating===s).length}));
      const avg=rows.length?Math.round(rows.reduce((s,x)=>s+x.rating,0)/rows.length*10)/10:0;
      return json({reviews:rows,avg,count:rows.length,dist});
    }
    if((m=path.match(/^\/api\/reviews\/(\d+)\/reply$/))&&method==='POST'){
      const x=store.reviews.find(r=>r.id===+m[1]); if(!body||!body.text||!body.text.trim())return json({error:'답변 내용을 입력하세요.'},400);
      if(x){x.replied=1;x.reply_text=body.text;persist();} return json({ok:!!x});
    }
    if(path==='/api/reservations'&&method==='GET'){
      return json([...store.reservations].sort((a,b)=>a.when_at.localeCompare(b.when_at)));
    }
    if(path==='/api/reservations'&&method==='POST'){
      const {kind,customer,party,when_at,source,note}=body||{};
      if(!customer||!when_at)return json({error:'고객명과 일시는 필수입니다.'},400);
      store._sid++; store.reservations.push({id:store._sid,kind:kind||'inquiry',customer,party:party||1,
        when_at:when_at.replace('T',' '),status:'new',source:source||'walkin',note:note||''});
      persist(); return json({ok:true,id:store._sid});
    }
    if((m=path.match(/^\/api\/reservations\/(\d+)$/))&&method==='PATCH'){
      const x=store.reservations.find(r=>r.id===+m[1]);
      if(!['new','confirmed','done','cancelled'].includes(body?.status))return json({error:'잘못된 상태'},400);
      if(x){x.status=body.status;persist();} return json({ok:!!x});
    }
    return json({error:'not found'},404);
  }

  const orig = window.fetch.bind(window);
  window.fetch = async (input, init={}) => {
    const raw = typeof input==='string'?input:(input&&input.url);
    let u; try{ u=new URL(raw, location.href); }catch{ return orig(input,init); }
    const i=u.pathname.indexOf('/api/');
    if(i===-1) return orig(input,init);
    const p=u.pathname.slice(i);
    const method=(init.method||'GET').toUpperCase();
    let bd=null; try{ bd=init.body?JSON.parse(init.body):null; }catch{}
    const res=handle(method,p,u.searchParams,bd);
    return new Response(JSON.stringify(res.data),{status:res.status,headers:{'Content-Type':'application/json'}});
  };
  window.__moaResetDemo = () => { store=buildSeed(); persist(); location.reload(); };
})();
