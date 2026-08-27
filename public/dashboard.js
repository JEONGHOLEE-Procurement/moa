'use strict';
const $ = s => document.querySelector(s);
const view = $('#view');
let META = { platforms: {} };
const state = { section:'overview', overview:null, calMonth:new Date() };

/* ---------- 유틸 ---------- */
async function api(path, opts){
  const r = await fetch(path, { headers:{'Content-Type':'application/json'}, ...opts });
  const d = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error || '요청 실패');
  return d;
}
function toast(msg, err){
  const t=$('#toast'); t.textContent=msg; t.className='toast show'+(err?' err':'');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.className='toast',2600);
}
function modal(html){ $('#modal-body').innerHTML=html; $('#modal').classList.add('show'); }
function closeModal(){ $('#modal').classList.remove('show'); }
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });

const P = p => META.platforms[p] || {name:p, icon:p.slice(0,2).toUpperCase()};
const chIcon = (p,cls='') => `<span class="ch ${p} ${cls}">${P(p).icon}</span>`;
const fmt = n => (n||0).toLocaleString('ko-KR');
const fmtK = n => n>=10000 ? (n/10000).toFixed(1)+'만' : fmt(n);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function ago(iso){
  const d=new Date(iso.replace(' ','T')), s=(Date.now()-d)/1000;
  if(s<0) return fmtWhen(iso);
  if(s<3600) return Math.max(1,Math.round(s/60))+'분 전';
  if(s<86400) return Math.round(s/3600)+'시간 전';
  return Math.round(s/86400)+'일 전';
}
function fmtWhen(iso){
  const d=new Date(iso.replace(' ','T'));
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ---------- 내비게이션 ---------- */
const NAV = [
  ['overview','개요','◎'],['composer','콘텐츠 작성','✏️'],['calendar','캘린더','🗓'],
  ['inbox','통합 인박스','💬'],['reviews','리뷰','⭐'],['reservations','예약·문의','📅'],
  ['analytics','분석','📊'],['channels','채널 연결','🔗'],
];
const TITLES = Object.fromEntries(NAV.map(([k,t])=>[k,t]));
const SUBS = {
  overview:'오늘의 홍보 현황을 한눈에', composer:'한 번 작성해 여러 채널에 발행하세요',
  calendar:'예약·발행된 콘텐츠 일정', inbox:'모든 채널의 댓글·DM을 한 곳에서',
  reviews:'구글·네이버 리뷰 모니터링', reservations:'예약과 문의를 상태별로 관리',
  analytics:'채널 성장과 광고 성과', channels:'홍보 채널 연결 관리',
};
function renderNav(counts={}){
  $('#nav').innerHTML = NAV.map(([k,t,ic])=>{
    const c = counts[k];
    return `<div class="nav-i ${k===state.section?'active':''}" onclick="go('${k}')">
      <span class="ico">${ic}</span>${t}${c?`<span class="cnt">${c}</span>`:''}</div>`;
  }).join('');
}
async function go(section){
  state.section=section;
  $('#pg-title').textContent=TITLES[section];
  $('#pg-sub').textContent=SUBS[section];
  renderNav(state.navCounts||{});
  view.innerHTML='<div class="spin"></div>';
  try{ await RENDER[section](); }
  catch(e){ view.innerHTML=`<div class="empty">불러오지 못했습니다: ${esc(e.message)}</div>`; }
}
window.go=go; window.closeModal=closeModal;

/* ---------- 개요 ---------- */
const RENDER = {};
RENDER.overview = async () => {
  const d = await api('/api/overview'); state.overview=d;
  state.navCounts={ inbox:d.kpis.unread, reservations:d.kpis.newRes }; renderNav(state.navCounts);
  const k=d.kpis;
  const kpi=(l,v,extra='')=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${extra}</div>`;
  const grow=g=>`<div class="d ${g>=0?'up':'down'}">${g>=0?'▲':'▼'} ${Math.abs(g)}%</div>`;
  view.innerHTML=`
   <div class="kpis">
     ${kpi('총 팔로워',fmtK(k.followers),grow(k.followersGrowth))}
     ${kpi('이번달 발행',k.monthPub+'건')}
     ${kpi('예약 발행',k.scheduled+'건')}
     ${kpi('안읽은 메시지',k.unread+'개','<div class="d" style="color:var(--primary)">확인 필요</div>')}
     ${kpi('신규 예약',k.newRes+'건','<div class="d" style="color:var(--primary)">응대 대기</div>')}
     ${kpi('평균 평점','⭐ '+k.rating,`<div class="d" style="color:var(--ink-3)">리뷰 ${k.reviewCount}개</div>`)}
   </div>
   <div class="row c2b" style="margin-bottom:18px">
     <div class="prodp">
       <div class="h">⏱ 이번 달 아낀 시간</div>
       <div class="big">${d.productivity.totalHours}<span> 시간</span></div>
       ${d.productivity.parts.map(p=>`<div class="part"><span>${p.key}</span><b>${Math.round(p.min/6)/10}h</b></div>`).join('')}
     </div>
     <div class="card">
       <div class="card-t">채널별 성과 <span class="sub">최근 7일 도달</span></div>
       ${d.channels.map(c=>`<div class="chrow">${chIcon(c.platform)}
         <div class="info"><div class="hd">${P(c.platform).name}</div><div class="sub">${c.handle||''} · 도달 ${fmtK(c.reach7)}</div></div>
         <div class="foll"><div class="n">${fmtK(c.followers)}</div><div class="g ${c.growth>=0?'up':'down'}">${c.growth>=0?'+':''}${c.growth}%</div></div>
       </div>`).join('')}
     </div>
   </div>
   <div class="row c2">
     <div class="card">
       <div class="card-t">예약된 게시물 <button class="btn btn-soft btn-sm" onclick="go('calendar')">캘린더 →</button></div>
       ${d.upcoming.length? d.upcoming.map(p=>`<div class="li" onclick="go('calendar')">
         <div class="pv-emoji" style="width:52px;height:52px;font-size:24px;margin:0">${p.media||'📝'}</div>
         <div class="body"><div class="top">${p.channels.map(c=>chIcon(c,'ch-sm')).join('')} · ${fmtWhen(p.scheduled_at)}</div>
         <div class="tx"><b>${esc(p.title||'제목 없음')}</b></div></div></div>`).join('') : '<div class="empty">예약된 게시물이 없습니다</div>'}
     </div>
     <div class="card">
       <div class="card-t">최근 메시지 <button class="btn btn-soft btn-sm" onclick="go('inbox')">인박스 →</button></div>
       ${d.recentInbox.map(m=>`<div class="li" onclick="go('inbox')">
         ${chIcon(m.platform)}<div class="body"><div class="top"><span class="au">${esc(m.author)}</span> · ${ago(m.received_at)}</div>
         <div class="tx">${esc(m.text)}</div></div>${m.read?'':'<span class="unreadmark"></span>'}</div>`).join('')}
     </div>
   </div>`;
};

/* ---------- 콘텐츠 작성 ---------- */
RENDER.composer = async () => {
  const chs = await api('/api/channels');
  const EMOJI=['📝','🏄','🌅','🥑','🍲','☕','🏠','📣','🎬','🧘','✨','🔥'];
  const sel=new Set(chs.filter(c=>c.connected).slice(0,3).map(c=>c.platform));
  let media='📝', mode='schedule';
  const def=new Date(Date.now()+864e5); def.setHours(11,0,0,0);
  const defVal=new Date(def.getTime()-def.getTimezoneOffset()*6e4).toISOString().slice(0,16);

  view.innerHTML=`<div class="row c2">
    <div class="card">
      <div class="card-t">새 게시물 작성</div>
      <label>제목 (선택)</label><input id="c-title" placeholder="예: 주말 서프캠프 모집">
      <label style="margin-top:14px">내용</label>
      <textarea id="c-body" rows="5" placeholder="게시물 내용을 입력하세요..."></textarea>
      <label style="margin-top:14px">대표 이미지</label>
      <div class="emojis" id="c-emoji">${EMOJI.map(e=>`<button type="button" class="${e===media?'on':''}" data-e="${e}">${e}</button>`).join('')}</div>
      <label style="margin-top:16px">발행 채널</label>
      <div class="chip-select" id="c-chips">${chs.map(c=>`
        <div class="chip ${!c.connected?'off':(sel.has(c.platform)?'on':'')}" data-p="${c.platform}" ${c.connected?'':'title=미연결'}>
          ${chIcon(c.platform,'ch-sm')} ${P(c.platform).name}${c.connected?'':' 🔒'}</div>`).join('')}</div>
      <label style="margin-top:16px">발행 방식</label>
      <div class="seg" id="c-mode"><button data-m="now">지금 발행</button><button class="on" data-m="schedule">예약 발행</button></div>
      <div id="c-when" style="margin-top:12px"><label>예약 시간</label><input type="datetime-local" id="c-dt" value="${defVal}"></div>
      <div style="margin-top:20px"><button class="btn btn-primary" id="c-submit" style="width:100%">발행하기</button></div>
    </div>
    <div>
      <div class="card"><div class="card-t">미리보기</div>
        <div class="preview"><div id="c-preview"></div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-t">💡 여러 채널 동시 발행</div>
      <p style="font-size:13.5px;color:var(--ink-2);line-height:1.6">채널을 여러 개 선택하면 한 번 작성으로 모두 발행됩니다. 채널당 약 7분씩 아껴요.</p></div>
    </div>
  </div>`;

  const renderPreview=()=>{
    const t=$('#c-title').value, b=$('#c-body').value;
    $('#c-preview').innerHTML = [...sel].length? [...sel].map(p=>`
      <div class="pv-card"><div class="pv-head">${chIcon(p)}<div><div style="font-size:13px;font-weight:700">코나 서프 하우스</div>
      <div style="font-size:11px;color:var(--ink-3)">${P(p).name}</div></div></div>
      <div class="pv-emoji">${media}</div>
      ${t?`<div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(t)}</div>`:''}
      <div style="font-size:13px;color:var(--ink-2);white-space:pre-wrap">${esc(b)||'<span style="color:var(--ink-3)">내용 미리보기...</span>'}</div></div>`).join('')
      : '<div class="empty">채널을 선택하세요</div>';
  };
  renderPreview();
  $('#c-title').oninput=$('#c-body').oninput=renderPreview;
  $('#c-emoji').onclick=e=>{const b=e.target.closest('[data-e]');if(!b)return;media=b.dataset.e;
    $('#c-emoji').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderPreview();};
  $('#c-chips').onclick=e=>{const c=e.target.closest('[data-p]');if(!c||c.classList.contains('off'))return;
    const p=c.dataset.p; sel.has(p)?sel.delete(p):sel.add(p); c.classList.toggle('on');renderPreview();};
  $('#c-mode').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;mode=b.dataset.m;
    $('#c-mode').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
    $('#c-when').style.display=mode==='now'?'none':'';};
  $('#c-submit').onclick=async()=>{
    const body=$('#c-body').value.trim();
    if(!body) return toast('내용을 입력하세요',1);
    if(sel.size===0) return toast('채널을 1개 이상 선택하세요',1);
    try{
      const r=await api('/api/posts',{method:'POST',body:JSON.stringify({
        title:$('#c-title').value, body, media, channels:[...sel], mode,
        scheduled_at: mode==='schedule'?$('#c-dt').value:null })});
      toast(r.status==='published'?'✅ 발행되었습니다!':'🗓 예약되었습니다!');
      go(mode==='published'||r.status==='published'?'overview':'calendar');
    }catch(e){ toast(e.message,1); }
  };
};

/* ---------- 캘린더 ---------- */
RENDER.calendar = async () => {
  const posts = await api('/api/calendar');
  const byDate={}; posts.forEach(p=>{ const k=(p.at||'').slice(0,10); (byDate[k]=byDate[k]||[]).push(p); });
  const cur=state.calMonth, y=cur.getFullYear(), mo=cur.getMonth();
  const first=new Date(y,mo,1), start=new Date(first); start.setDate(1-first.getDay());
  const today=new Date().toISOString().slice(0,10);
  const DOW=['일','월','화','수','목','금','토'];
  let cells='';
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const ds=d.toISOString().slice(0,10), out=d.getMonth()!==mo;
    const evs=(byDate[ds]||[]).map(p=>`<div class="ev ${p.status==='published'?'pub':'sch'}" onclick="calEvent(${p.id})">${p.media} ${esc((p.title||'게시물').slice(0,8))}</div>`).join('');
    cells+=`<div class="cell ${out?'out':''} ${ds===today?'today':''}"><div class="dnum">${d.getDate()}</div>${evs}</div>`;
    if(i>=34 && d.getMonth()!==mo && d.getDay()===6) break;
  }
  state._calPosts=Object.fromEntries(posts.map(p=>[p.id,p]));
  view.innerHTML=`<div class="card">
    <div class="card-t"><div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" onclick="calNav(-1)">‹</button>
      <b style="font-size:17px">${y}년 ${mo+1}월</b>
      <button class="btn btn-ghost btn-sm" onclick="calNav(1)">›</button></div>
      <button class="btn btn-primary btn-sm" onclick="go('composer')">+ 새 게시물</button></div>
    <div class="cal">${DOW.map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div>
    <div style="display:flex;gap:16px;margin-top:14px;font-size:12.5px;color:var(--ink-2)">
      <span>🟪 예약</span><span>🟩 발행완료</span></div>
  </div>`;
};
window.calNav=n=>{ state.calMonth=new Date(state.calMonth.getFullYear(),state.calMonth.getMonth()+n,1); go('calendar'); };
window.calEvent=id=>{
  const p=state._calPosts[id]; if(!p)return;
  modal(`<h3 style="font-size:19px;margin-bottom:6px">${p.media} ${esc(p.title||'게시물')}</h3>
    <div style="font-size:13px;color:var(--ink-3);margin-bottom:14px">${p.status==='published'?'발행완료':'예약'} · ${fmtWhen(p.at)}</div>
    <div style="margin-bottom:14px">${p.channels.map(c=>chIcon(c)).join(' ')}</div>
    ${p.status==='scheduled'?`<button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="delPost(${id})">예약 삭제</button>`:''}`);
};
window.delPost=async id=>{ try{ await api('/api/posts/'+id,{method:'DELETE'}); closeModal(); toast('삭제되었습니다'); go('calendar'); }catch(e){toast(e.message,1);} };

/* ---------- 통합 인박스 ---------- */
RENDER.inbox = async () => {
  state._inboxFilter=state._inboxFilter||'all';
  const f=state._inboxFilter;
  const list=await api('/api/inbox'+(f==='all'?'':'?filter='+f));
  const tabs=[['all','전체'],['unread','안읽음'],['unreplied','미답장'],['instagram','IG'],['kakao','Kakao'],['tiktok','TikTok']];
  view.innerHTML=`<div class="tabs">${tabs.map(([k,t])=>`<div class="tab ${f===k?'on':''}" onclick="inboxFilter('${k}')">${t}</div>`).join('')}</div>
    <div class="card">${list.length? list.map(m=>`
      <div class="li" onclick="openMsg(${m.id})">${chIcon(m.platform)}
        <div class="body"><div class="top"><span class="dot ${m.sentiment}"></span><span class="au">${esc(m.author)}</span>
          <span class="badge badge-mute">${m.kind==='dm'?'DM':'댓글'}</span> · ${ago(m.received_at)}
          ${m.replied?'<span class="badge badge-ok">답장완료</span>':''}</div>
        <div class="tx">${esc(m.text)}</div></div>${m.read?'':'<span class="unreadmark"></span>'}</div>`).join('')
      : '<div class="empty">메시지가 없습니다</div>'}</div>`;
  state._inbox=Object.fromEntries(list.map(m=>[m.id,m]));
};
window.inboxFilter=f=>{ state._inboxFilter=f; go('inbox'); };
window.openMsg=async id=>{
  const m=state._inbox[id];
  if(!m.read){ api('/api/inbox/'+id+'/read',{method:'POST'}).catch(()=>{}); }
  modal(`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${chIcon(m.platform)}
    <div><div style="font-weight:700">${esc(m.author)}</div><div style="font-size:12px;color:var(--ink-3)">${P(m.platform).name} ${m.kind==='dm'?'DM':'댓글'} · ${fmtWhen(m.received_at)}</div></div></div>
    <div style="background:var(--surface-2);border-radius:12px;padding:14px;font-size:14px;margin-bottom:16px">${esc(m.text)}</div>
    ${m.replied?`<div style="font-size:12px;color:var(--ink-3);margin-bottom:6px">내 답장</div>
      <div style="background:var(--primary-050);border-radius:12px;padding:14px;font-size:14px;color:var(--primary)">${esc(m.reply_text)}</div>`
     :`<label>답장</label><textarea id="rp" rows="3" placeholder="답장을 입력하세요..."></textarea>
       <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="sendReply(${id})">답장 보내기</button>`}`);
};
window.sendReply=async id=>{
  const t=$('#rp').value.trim(); if(!t) return toast('답장을 입력하세요',1);
  try{ await api('/api/inbox/'+id+'/reply',{method:'POST',body:JSON.stringify({text:t})});
    closeModal(); toast('✅ 답장을 보냈습니다'); go('inbox'); }catch(e){toast(e.message,1);}
};

/* ---------- 리뷰 ---------- */
RENDER.reviews = async () => {
  const d=await api('/api/reviews');
  const mx=Math.max(1,...d.dist.map(x=>x.n));
  const stars=r=>'★'.repeat(r)+'☆'.repeat(5-r);
  view.innerHTML=`<div class="row c2b" style="margin-bottom:18px">
    <div class="card" style="text-align:center">
      <div style="font-size:52px;font-weight:800;letter-spacing:-2px">${d.avg}</div>
      <div class="stars" style="font-size:20px">${stars(Math.round(d.avg))}</div>
      <div style="font-size:13px;color:var(--ink-3);margin-top:6px">리뷰 ${d.count}개</div></div>
    <div class="card"><div class="card-t">평점 분포</div><div class="dist">
      ${d.dist.map(x=>`<div class="r"><span class="stars">${x.star}★</span>
        <div class="bar"><i style="width:${x.n/mx*100}%"></i></div><span style="width:24px;text-align:right">${x.n}</span></div>`).join('')}
    </div></div></div>
    <div class="card"><div class="card-t">리뷰</div>${d.reviews.map(r=>`
      <div style="padding:14px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">${chIcon(r.platform)}
          <b>${esc(r.author)}</b><span class="stars">${stars(r.rating)}</span>
          <span style="font-size:12px;color:var(--ink-3);margin-left:auto">${ago(r.received_at)}</span></div>
        <div style="font-size:14px;color:var(--ink-2);line-height:1.55">${esc(r.text)}</div>
        ${r.replied?`<div style="margin-top:10px;background:var(--surface-2);border-radius:10px;padding:10px 12px;font-size:13px">
          <b style="color:var(--primary)">사장님 답변</b> ${esc(r.reply_text)}</div>`
         :`<button class="btn btn-soft btn-sm" style="margin-top:10px" onclick="replyReview(${r.id})">답변 달기</button>`}
      </div>`).join('')}</div>`;
  state._reviews=Object.fromEntries(d.reviews.map(r=>[r.id,r]));
};
window.replyReview=id=>{
  const r=state._reviews[id];
  modal(`<h3 style="font-size:18px;margin-bottom:4px">${esc(r.author)} 리뷰에 답변</h3>
    <div class="stars" style="margin-bottom:10px">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
    <div style="background:var(--surface-2);border-radius:10px;padding:12px;font-size:13.5px;margin-bottom:14px">${esc(r.text)}</div>
    <label>답변</label><textarea id="rvp" rows="3" placeholder="감사 인사나 사과를 남겨보세요..."></textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="sendReviewReply(${id})">답변 등록</button>`);
};
window.sendReviewReply=async id=>{
  const t=$('#rvp').value.trim(); if(!t) return toast('답변을 입력하세요',1);
  try{ await api('/api/reviews/'+id+'/reply',{method:'POST',body:JSON.stringify({text:t})});
    closeModal(); toast('✅ 답변을 등록했습니다'); go('reviews'); }catch(e){toast(e.message,1);}
};

/* ---------- 예약·문의 ---------- */
const RES_ST={new:['신규','badge-new'],confirmed:['확정','badge-ok'],done:['완료','badge-mute'],cancelled:['취소','badge-danger']};
const RES_KIND={stay:'🏠 숙박',table:'🍽 테이블',class:'🏄 레슨',inquiry:'❓ 문의'};
RENDER.reservations = async () => {
  state._resFilter=state._resFilter||'all';
  const all=await api('/api/reservations');
  const f=state._resFilter;
  const list=f==='all'?all:all.filter(r=>r.status===f);
  const cnt=s=>all.filter(r=>r.status===s).length;
  const tabs=[['all','전체 '+all.length],['new','신규 '+cnt('new')],['confirmed','확정 '+cnt('confirmed')],['done','완료 '+cnt('done')],['cancelled','취소 '+cnt('cancelled')]];
  view.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div class="tabs" style="margin:0">${tabs.map(([k,t])=>`<div class="tab ${f===k?'on':''}" onclick="resFilter('${k}')">${t}</div>`).join('')}</div>
    <button class="btn btn-primary btn-sm" onclick="newRes()">+ 예약 추가</button></div>
   <div class="card" style="padding:6px 10px"><table class="tbl"><thead><tr>
     <th>유형</th><th>고객</th><th>인원</th><th>일시</th><th>유입</th><th>메모</th><th>상태</th></tr></thead><tbody>
     ${list.length? list.map(r=>`<tr>
       <td>${RES_KIND[r.kind]||r.kind}</td><td><b>${esc(r.customer)}</b></td><td>${r.party}명</td>
       <td>${fmtWhen(r.when_at)}</td><td>${r.source?chIcon(r.source,'ch-sm'):'—'}</td>
       <td style="color:var(--ink-2);max-width:180px">${esc(r.note||'')}</td>
       <td><select class="mini" onchange="setRes(${r.id},this.value)">
         ${Object.entries(RES_ST).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v[0]}</option>`).join('')}
       </select></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty">예약이 없습니다</div></td></tr>'}
     </tbody></table></div>`;
};
window.resFilter=f=>{ state._resFilter=f; go('reservations'); };
window.setRes=async(id,status)=>{ try{ await api('/api/reservations/'+id,{method:'PATCH',body:JSON.stringify({status})});
  toast('상태를 변경했습니다'); go('reservations'); }catch(e){toast(e.message,1);} };
window.newRes=()=>{
  const dv=new Date(Date.now()+864e5); const val=new Date(dv.getTime()-dv.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  modal(`<h3 style="font-size:19px;margin-bottom:14px">예약 추가</h3>
    <label>유형</label><select id="nr-kind"><option value="stay">🏠 숙박</option><option value="table">🍽 테이블</option><option value="class">🏄 레슨</option><option value="inquiry">❓ 문의</option></select>
    <div class="grid2" style="margin-top:12px"><div><label>고객명</label><input id="nr-cust" placeholder="이름"></div>
    <div><label>인원</label><input id="nr-party" type="number" value="1" min="1"></div></div>
    <label style="margin-top:12px">일시</label><input id="nr-when" type="datetime-local" value="${val}">
    <label style="margin-top:12px">유입 경로</label><select id="nr-src">
      ${Object.keys(META.platforms).map(p=>`<option value="${p}">${P(p).name}</option>`).join('')}<option value="walkin">워크인</option></select>
    <label style="margin-top:12px">메모</label><input id="nr-note" placeholder="선택">
    <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="saveRes()">추가</button>`);
};
window.saveRes=async()=>{
  const b={kind:$('#nr-kind').value,customer:$('#nr-cust').value.trim(),party:+$('#nr-party').value,
    when_at:$('#nr-when').value,source:$('#nr-src').value,note:$('#nr-note').value};
  if(!b.customer) return toast('고객명을 입력하세요',1);
  try{ await api('/api/reservations',{method:'POST',body:JSON.stringify(b)});
    closeModal(); toast('✅ 예약이 추가되었습니다'); go('reservations'); }catch(e){toast(e.message,1);}
};

/* ---------- 분석 ---------- */
RENDER.analytics = async () => {
  state._metric=state._metric||'followers';
  const d=await api('/api/metrics?days=30'); state._series=d.series;
  const metrics=[['followers','팔로워'],['reach','도달'],['engagement','참여']];
  view.innerHTML=`<div class="card" style="margin-bottom:18px">
    <div class="card-t">채널 성장 추이 <div class="seg">${metrics.map(([k,t])=>`<button class="${state._metric===k?'on':''}" onclick="setMetric('${k}')">${t}</button>`).join('')}</div></div>
    <div id="chart-wrap"></div></div>
    <div class="card"><div class="card-t">광고 성과 · ROI</div>
    <table class="tbl"><thead><tr><th>캠페인</th><th>채널</th><th>지출</th><th>매출</th><th>ROAS</th><th>전환</th><th>CTR</th></tr></thead><tbody>
    ${d.ads.map(a=>`<tr><td><b>${esc(a.name)}</b></td><td>${chIcon(a.channel,'ch-sm')}</td>
      <td>₩${fmt(a.spend)}</td><td>₩${fmt(a.revenue)}</td>
      <td><span class="badge ${a.roas>=3?'badge-ok':a.roas>=2?'badge-warn':'badge-danger'}">${a.roas}x</span></td>
      <td>${a.conversions}건</td><td>${a.ctr}%</td></tr>`).join('')}
    <tr style="font-weight:800"><td>합계</td><td></td><td>₩${fmt(d.ads.reduce((s,a)=>s+a.spend,0))}</td>
      <td>₩${fmt(d.ads.reduce((s,a)=>s+a.revenue,0))}</td>
      <td><span class="badge badge-ok">${(d.ads.reduce((s,a)=>s+a.revenue,0)/d.ads.reduce((s,a)=>s+a.spend,0)).toFixed(1)}x</span></td>
      <td>${d.ads.reduce((s,a)=>s+a.conversions,0)}건</td><td></td></tr>
    </tbody></table></div>`;
  drawChart();
};
window.setMetric=m=>{ state._metric=m; RENDER.analytics(); };
function drawChart(){
  const metric=state._metric, series=state._series;
  const W=920,H=230,pad=36;
  let max=0,min=Infinity;
  series.forEach(s=>s.points.forEach(p=>{max=Math.max(max,p[metric]);min=Math.min(min,p[metric]);}));
  if(min===Infinity){min=0;max=1;} if(max===min)max=min+1;
  const n=series[0]?.points.length||1;
  const x=i=>pad+i*(W-pad*2)/Math.max(1,n-1);
  const y=v=>H-pad-(v-min)/(max-min)*(H-pad*2);
  const colors={instagram:'#E1306C',youtube:'#FF0033',tiktok:'#171622',x:'#6C6A7C',facebook:'#1877F2',naver:'#03C75A'};
  const paths=series.map(s=>{
    const dd=s.points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(' ');
    return `<path d="${dd}" fill="none" stroke="${colors[s.platform]||'#6D5EF6'}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('');
  const grid=[0,.25,.5,.75,1].map(t=>{const yy=pad+t*(H-pad*2);return `<line x1="${pad}" y1="${yy}" x2="${W-pad}" y2="${yy}" stroke="#ECEBF3"/>
    <text x="8" y="${yy+4}" font-size="10" fill="#9A98A8">${fmtK(Math.round(max-(max-min)*t))}</text>`;}).join('');
  $('#chart-wrap').innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${paths}</svg>
    <div class="legend">${series.map(s=>`<div class="i"><span class="sw" style="background:${colors[s.platform]||'#6D5EF6'}"></span>${P(s.platform).name}</div>`).join('')}</div>`;
}

/* ---------- 채널 연결 ---------- */
RENDER.channels = async () => {
  const [chs, igs] = await Promise.all([ api('/api/channels'), api('/api/integrations/instagram/status') ]);
  state._ig = igs;

  // 인스타그램 설정 안내 배너
  let banner = '';
  if(!igs.configured){
    banner = `<div class="card" style="margin-bottom:16px;border:1.5px solid var(--warn);background:var(--warn-050)">
      <div class="card-t" style="color:#8a5a00">⚙️ 인스타그램 실연동 설정이 필요합니다</div>
      <p style="font-size:13.5px;color:var(--ink-2);line-height:1.7">
        Meta 개발자 앱을 만들고 아래 값을 서버 <code>.env</code>에 넣으면 실제 계정 연결이 활성화됩니다.<br>
        <b>1.</b> developers.facebook.com 에서 앱 생성 → <b>Instagram</b> 제품 추가<br>
        <b>2.</b> 리디렉트 URI 등록: <code style="background:#fff;padding:2px 6px;border-radius:6px">${igs.redirectUri}</code><br>
        <b>3.</b> <code>IG_APP_ID</code>, <code>IG_APP_SECRET</code> 를 <code>.env</code>에 설정 후 서버 재시작<br>
        <span style="color:var(--ink-3)">요청 권한: ${igs.scopes.join(', ')}</span>
      </p></div>`;
  }

  const igCard = (c) => {
    let right;
    if(!igs.configured){
      right = `<button class="btn btn-ghost btn-sm" onclick="go('channels')" disabled>설정 필요</button>`;
    } else if(igs.connected){
      right = `<button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="igDisconnect()">연결 해제</button>`;
    } else {
      right = `<a class="btn btn-primary btn-sm" href="/auth/instagram">인스타그램 연결</a>`;
    }
    const sub = igs.connected
      ? `${igs.username||c.handle||''} · 팔로워 ${fmtK(igs.followers)} · <span style="color:var(--ok)">실제 연동됨</span>`
      : (igs.configured ? '연결 준비됨 (클릭해 로그인)' : '설정 후 연결 가능');
    return `<div class="chset" style="grid-column:1/-1;border:1.5px solid var(--primary-100)">${chIcon('instagram','ch-lg')}
      <div class="info"><div style="font-weight:700;font-size:15px">Instagram <span class="badge badge-new" style="margin-left:4px">실연동</span></div>
        <div style="font-size:12.5px;color:var(--ink-3)">${sub}</div></div>${right}</div>`;
  };

  const others = chs.filter(c=>c.platform!=='instagram');
  view.innerHTML = banner + igCard() + `<div class="chgrid" style="margin-top:14px">${others.map(c=>`
    <div class="chset">${chIcon(c.platform,'ch-lg')}
      <div class="info"><div style="font-weight:700;font-size:15px">${P(c.platform).name}
        <span class="badge badge-mute" style="margin-left:2px">데모</span></div>
        <div style="font-size:12.5px;color:var(--ink-3)">${c.connected?(c.handle||'')+' · 팔로워 '+fmtK(c.followers):'연결되지 않음'}</div></div>
      <div class="sw-toggle ${c.connected?'on':''}" onclick="toggleCh(${c.id})"><i></i></div>
    </div>`).join('')}</div>
    <div class="card" style="margin-top:18px"><div class="card-t">🔒 연동 방식 안내</div>
    <p style="font-size:13.5px;color:var(--ink-2);line-height:1.6"><b>Instagram</b>은 공식 API(Instagram Login·OAuth)로 실제 연동됩니다.
    나머지 채널은 아직 데모 토글이며, 동일한 OAuth 패턴으로 순차 연동 예정입니다.</p></div>`;
};
window.toggleCh=async id=>{ try{ const r=await api('/api/channels/'+id+'/toggle',{method:'POST'});
  toast(r.connected?'채널을 연결했습니다':'채널 연결을 해제했습니다'); go('channels'); }catch(e){toast(e.message,1);} };
window.igDisconnect=async()=>{ if(!confirm('인스타그램 연결을 해제할까요?'))return;
  try{ await api('/api/integrations/instagram/disconnect',{method:'POST'}); toast('연결을 해제했습니다'); go('channels'); }catch(e){toast(e.message,1);} };

/* ---------- 부팅 ---------- */
(async()=>{
  META=await api('/api/meta');
  const b=META.business;
  $('#sb-biz').innerHTML=`<span class="av">🏄</span><div><div class="nm">${esc(b.name)}</div><div class="ty">${esc(b.city)} · 서핑샵</div></div>`;
  // OAuth 콜백 결과 처리
  const qp=new URLSearchParams(location.search);
  if(qp.get('ig')){
    const ig=qp.get('ig');
    if(ig==='connected') toast('✅ 인스타그램 '+(qp.get('u')?'@'+qp.get('u'):'')+' 연결 완료!');
    else if(ig==='notconfigured') toast('먼저 인스타그램 앱 설정이 필요합니다',1);
    else if(ig==='error') toast('연결 실패: '+(qp.get('msg')||'알 수 없는 오류'),1);
    history.replaceState({},'','/dashboard');
    go('channels'); return;
  }
  go('overview');
})();
