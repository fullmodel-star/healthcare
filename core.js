/* =============================================================
   health-core · 共用核心邏輯（健康產品家族）
   來源：旗艦款 healthcare 抽取並泛化。四支 App 共用。
   用法：每支 App 先 <script src="core.js"> 再寫自己的邏輯。
   全域命名空間：HC.*   （避免污染各 App 變數）
   ============================================================= */
const HC = (function () {
  'use strict';

  /* ---------- 日期（一律本機時區，避免 UTC 把台灣清晨算成昨天）---------- */
  function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function todayStr(){ return ymd(new Date()); }
  function fmtDate(d){ const dt=d?new Date(d):new Date(); return dt.toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'}); }
  function dateOffset(n,from){ const d=from?new Date(from):new Date(); d.setDate(d.getDate()+n); return ymd(d); }
  function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
  // 從生日算「幾歲幾個月」與總月數
  function ageFrom(birthISO){
    const b=new Date(birthISO), n=new Date();
    let months=(n.getFullYear()-b.getFullYear())*12+(n.getMonth()-b.getMonth());
    if(n.getDate()<b.getDate()) months--;
    return { months:Math.max(0,months), years:Math.floor(months/12), remMonths:months%12,
             days:daysBetween(birthISO, todayStr()) };
  }

  /* ---------- 數字動畫 ---------- */
  function animateNum(el, to, opts){
    if(!el) return; const o=opts||{};
    const duration=o.duration||400, decimals=o.decimals||0;
    const fmt=o.format||(v=>v.toLocaleString());
    const finalText=fmt(decimals?+to.toFixed(decimals):to);
    const from=parseFloat((el.textContent||'').replace(/[^0-9.\-]/g,''))||0;
    if(from===to){ el.textContent=finalText; return; }
    let done=false; const start=performance.now();
    function tick(t){ if(done)return;
      const p=Math.min((t-start)/duration,1); const eased=1-Math.pow(1-p,3);
      const v=from+(to-from)*eased;
      el.textContent=fmt(decimals?+v.toFixed(decimals):Math.round(v));
      if(p<1) requestAnimationFrame(tick); else done=true;
    }
    requestAnimationFrame(tick);
    setTimeout(()=>{ if(!done){ el.textContent=finalText; done=true; } }, duration+150);
  }

  /* ---------- Toast ---------- */
  function ensureToastWrap(){
    let w=document.getElementById('toast-wrap');
    if(!w){ w=document.createElement('div'); w.id='toast-wrap'; w.className='toast-wrap'; document.body.appendChild(w); }
    return w;
  }
  function toast(msg, type='ok', duration=2400){
    const wrap=ensureToastWrap();
    const t=document.createElement('div'); t.className='toast toast-'+type;
    const icon=type==='warn'?'alert-triangle':type==='info'?'info-circle':'circle-check';
    t.innerHTML='<i class="ti ti-'+icon+'"></i><span>'+msg+'</span>';
    wrap.appendChild(t);
    setTimeout(()=>t.classList.add('show'),20);
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),260); }, duration);
  }

  /* ---------- 儲存（每支 App 傳自己的 key；純本機 localStorage）---------- */
  function load(key, target){
    try{ const s=localStorage.getItem(key); if(s){ Object.assign(target, JSON.parse(s)); } }catch(e){}
    return target;
  }
  function save(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){ toast('儲存空間不足','warn'); } }
  function exportData(key, filename){
    const data=localStorage.getItem(key)||'{}';
    const blob=new Blob([data],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(filename||key)+'-backup-'+todayStr()+'.json';
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast('已匯出備份','ok');
  }
  function importData(key, file, onDone){
    const r=new FileReader();
    r.onload=e=>{ try{ JSON.parse(e.target.result); localStorage.setItem(key, e.target.result); toast('匯入成功，重新載入…','ok'); setTimeout(()=>location.reload(),700); if(onDone)onDone(); }
      catch(err){ toast('檔案格式錯誤','warn'); } };
    r.readAsText(file);
  }
  function clearData(key){ if(!confirm('確定清除本 App 所有資料？此動作無法復原。')) return; localStorage.removeItem(key); location.reload(); }

  /* ---------- 全家族一鍵資料備份與還原 ---------- */
  function exportAllFamilyData(){
    try {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        family: 'health-family',
        stores: {}
      };
      for(let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i);
        backup.stores[k] = localStorage.getItem(k);
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'health-family-backup-' + todayStr() + '.json';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      toast('全家族資料備份成功！','ok');
    } catch(e) {
      toast('匯出備份失敗','warn');
    }
  }

  function importAllFamilyData(file, onDone){
    const r = new FileReader();
    r.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        if(!json || typeof json !== 'object'){ throw new Error('Invalid format'); }
        const stores = json.stores || json;
        let count = 0;
        Object.keys(stores).forEach(k => {
          if(typeof stores[k] === 'string'){
            localStorage.setItem(k, stores[k]);
            count++;
          } else if(stores[k] !== undefined && stores[k] !== null){
            localStorage.setItem(k, JSON.stringify(stores[k]));
            count++;
          }
        });
        toast('成功匯入 ' + count + ' 筆家族資料，重新載入…', 'ok', 2000);
        setTimeout(() => location.reload(), 900);
        if(onDone) onDone();
      } catch(err) {
        toast('備份檔案格式無效', 'warn');
      }
    };
    r.readAsText(file);
  }

  /* ---------- 主題 ---------- */
  function setTheme(mode){
    if(mode==='auto'){ document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('hcTheme'); }
    else { document.documentElement.setAttribute('data-theme',mode); localStorage.setItem('hcTheme',mode); }
    ['auto','light','dark'].forEach(m=>{ const el=document.getElementById('th-'+m); if(el) el.classList.toggle('on', m===mode); });
  }
  function currentTheme(){ return localStorage.getItem('hcTheme')||'auto'; }
  (function applyInitTheme(){ const t=localStorage.getItem('hcTheme'); if(t==='dark'||t==='light') document.documentElement.setAttribute('data-theme',t); })();

  /* ---------- 大字體與長輩模式（長輩友善）---------- */
  function setSeniorMode(on){
    document.documentElement.classList.toggle('bigfont', !!on);
    document.documentElement.classList.toggle('simple', !!on);
    localStorage.setItem('hf_senior_mode', on?'1':'0');
    localStorage.setItem('hcBigFont', on?'1':'0');
    localStorage.setItem('hs_simple', on?'1':'0');
    localStorage.setItem('hg_simple', on?'1':'0');
  }
  function isSeniorMode(){
    return localStorage.getItem('hf_senior_mode')==='1' || localStorage.getItem('hcBigFont')==='1' || localStorage.getItem('hs_simple')==='1' || localStorage.getItem('hg_simple')==='1';
  }
  function toggleSeniorMode(){
    const next = !isSeniorMode();
    setSeniorMode(next);
    toast(next ? '已開啟長輩大字模式' : '已關閉長輩大字模式', 'ok');
    return next;
  }
  function setBigFont(on){ setSeniorMode(on); }
  function bigFontOn(){ return isSeniorMode(); }
  (function initSenior(){
    if(isSeniorMode()){
      document.documentElement.classList.add('bigfont');
      document.documentElement.classList.add('simple');
    }
  })();

  /* ---------- 音效輔助（Web Audio API）---------- */
  let _audioCtx = null;
  function getAudioCtx(){
    try {
      if(!_audioCtx && (window.AudioContext || window.webkitAudioContext)){
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if(_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    }catch(e){}
    return _audioCtx;
  }
  function playTone(freq, duration, type='sine', gainVal=0.15){
    try {
      const ctx = getAudioCtx(); if(!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }catch(e){}
  }
  function playBeep(kind='tap'){
    if(kind==='tap'){ playTone(880, 0.05, 'sine', 0.08); }
    else if(kind==='success'){
      playTone(523.25, 0.08, 'sine', 0.12);
      setTimeout(()=>playTone(659.25, 0.08, 'sine', 0.12), 80);
      setTimeout(()=>playTone(783.99, 0.2, 'sine', 0.15), 160);
    }
    else if(kind==='alert'){
      playTone(440, 0.1, 'triangle', 0.18);
      setTimeout(()=>playTone(392, 0.15, 'triangle', 0.18), 100);
    }
  }

  /* ---------- 分頁導覽 ---------- */
  function goPage(id, btn, onShow){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    const pg=document.getElementById(id); if(pg) pg.classList.add('active');
    if(btn) btn.classList.add('active');
    else { const nb=document.querySelector('.nav-item[data-page="'+id+'"]'); if(nb) nb.classList.add('active'); }
    if(onShow) onShow(id);
    window.scrollTo(0,0);
  }

  /* ---------- 計算：BMI / BMR / TDEE ---------- */
  function bmi(w,h){ if(!h||!w) return 0; return +(w/((h/100)**2)).toFixed(1); }
  function bmiInfo(b){ if(b<=0)return{t:'—',c:'c-muted'}; if(b<18.5)return{t:'過輕',c:'c-amber'}; if(b<24)return{t:'正常',c:'c-green'}; if(b<27)return{t:'過重',c:'c-amber'}; return{t:'肥胖',c:'c-red'}; }
  function bmr(sex,w,h,age){ return sex==='m'?(10*w)+(6.25*h)-(5*age)+5:(10*w)+(6.25*h)-(5*age)-161; }

  /* ---------- 常態分布 CDF → 百分位（兒童生長曲線用）---------- */
  function normalCdf(z){ // Abramowitz-Stegun 近似
    const t=1/(1+0.2316419*Math.abs(z));
    const d=0.3989423*Math.exp(-z*z/2);
    let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
    return z>0 ? 1-p : p;
  }
  function zToPercentile(z){ return Math.round(normalCdf(z)*100); }

  /* ---------- API Key / 離線 / Gemini 呼叫（AI 功能需使用者自帶 key）---------- */
  function getApiKey(){ return localStorage.getItem('googleApiKey')||''; }
  function saveApiKey(val){
    // 清掉貼上常見的雜訊：零寬字元/不斷行空白/全形空白、頭尾空白、包住的引號
    let key=(val||'').replace(/[\u200B-\u200D\uFEFF\u00A0\u3000]/g,'').trim().replace(/^['"\u300C\u300D\u300E\u300F]+|['"\u300C\u300D\u300E\u300F]+$/g,'');
    if(!key){ toast('請輸入 API Key','warn'); return false; }
    if(!/^aiza/i.test(key)){
      toast('Key 開頭應該是 AIza，你輸入的開頭是「'+key.slice(0,4)+'」，請確認有貼對、貼完整','warn',4500);
      return false;
    }
    localStorage.setItem('googleApiKey',key); toast('API Key 已儲存','ok'); return true;
  }
  function clearApiKey(){ if(!confirm('確定清除 API Key？')) return; localStorage.removeItem('googleApiKey'); }
  function isOffline(){ return localStorage.getItem('offlineMode')==='1'; }
  function setOffline(on){ localStorage.setItem('offlineMode', on?'1':'0'); toast(on?'已開啟離線模式':'已關閉離線模式','info',1600); }
  async function callAI(contents, maxTokens=1000){
    if(isOffline()) throw new Error('offline');
    const key=getApiKey(); if(!key) throw new Error('no_key');
    const url='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const resp=await fetch(url,{ method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents,generationConfig:{maxOutputTokens:maxTokens,temperature:0.7}}) });
    if(!resp.ok){ const e=await resp.json().catch(()=>({})); throw new Error(e.error?.message||'API '+resp.status); }
    const data=await resp.json();
    return { text:data.candidates?.[0]?.content?.parts?.find(p=>p.text)?.text||'', _raw:data };
  }

  /* ---------- .ics 行事曆匯出（把「準時提醒」外包給手機系統鬧鐘）----------
     events: [{ uid, title, desc, date:'YYYY-MM-DD'(整日) | datetime:'YYYY-MM-DDTHH:MM',
                alarm:'-P14D'|'-PT0M'(提前量,選填), rrule:'FREQ=DAILY'(重複,選填) }] */
  function icsEsc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
  function icsStamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0');
    return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z'; }
  function buildICS(events, calName){
    const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//health-family//TW//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    if(calName) L.push('X-WR-CALNAME:'+icsEsc(calName));
    const stamp=icsStamp();
    events.forEach((e,i)=>{
      L.push('BEGIN:VEVENT');
      L.push('UID:'+(e.uid||('hc-'+i+'-'+stamp))+'@health-family');
      L.push('DTSTAMP:'+stamp);
      if(e.datetime){ const dt=e.datetime.replace(/[-:]/g,'').slice(0,13); L.push('DTSTART:'+dt+'00'); }
      else if(e.date){ L.push('DTSTART;VALUE=DATE:'+e.date.replace(/-/g,'')); }
      if(e.rrule) L.push('RRULE:'+e.rrule);
      L.push('SUMMARY:'+icsEsc(e.title));
      if(e.desc) L.push('DESCRIPTION:'+icsEsc(e.desc));
      if(e.alarm){ L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(e.title),'TRIGGER:'+e.alarm,'END:VALARM'); }
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }
  function downloadICS(events, filename, calName){
    const blob=new Blob([buildICS(events, calName)],{type:'text/calendar;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(filename||'reminders')+'.ics'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast('已匯出行事曆，請匯入手機日曆以取得系統提醒','ok',3000);
  }

  /* ---------- 本機通知（App 開啟時可提醒；背景推播受 PWA 限制，另配 .ics）---------- */
  function canNotify(){ return typeof Notification!=='undefined'; }
  function notifyPermission(){ return canNotify()?Notification.permission:'unsupported'; }
  function requestNotify(){
    if(!canNotify()){ toast('此裝置瀏覽器不支援通知','warn'); return Promise.resolve('unsupported'); }
    return Notification.requestPermission().then(p=>{ toast(p==='granted'?'已開啟通知':'未授權通知，將以畫面提示為主', p==='granted'?'ok':'info'); return p; });
  }
  // 顯示通知；未授權或不支援時回 false（呼叫端可改用 toast）
  function notify(title, body, opts){
    try{ if(canNotify() && Notification.permission==='granted'){ new Notification(title, Object.assign({body, icon:'icon.svg', badge:'icon.svg'}, opts||{})); return true; } }catch(e){}
    return false;
  }
  // 通知權限三態的說明 HTML（granted / default＋按鈕 / denied 解鎖指引 / unsupported）
  // 用法：el.innerHTML=HC.notifyStatusHtml()；按鈕按下取權限後會自動就地刷新所有 [data-hc-notify] 區塊
  function notifyStatusHtml(){
    const p=notifyPermission(); let inner='';
    if(p==='granted') inner='<span class="badge badge-green"><i class="ti ti-bell-check"></i> 已允許</span><span style="font-size:12px;color:var(--text3);margin-left:8px">App 開啟時會以系統通知提醒</span>';
    else if(p==='default') inner='<span class="badge badge-gray"><i class="ti ti-bell-question"></i> 尚未詢問</span><button type="button" class="btn btn-primary" style="min-height:40px;font-size:14px;margin-top:8px;width:100%" onclick="HC._notifyBtn()"><i class="ti ti-bell-ringing"></i>開啟系統通知權限</button>';
    else if(p==='denied') inner='<span class="badge badge-red"><i class="ti ti-bell-off"></i> 已拒絕</span><div style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.5">請到瀏覽器「網站設定 → 通知」解鎖後重新整理。未解鎖前提醒只會以畫面提示顯示。</div>';
    else inner='<span class="badge badge-gray"><i class="ti ti-bell-off"></i> 此瀏覽器不支援</span><div style="font-size:12px;color:var(--text2);margin-top:6px">提醒將以畫面提示為主；要準時提醒請匯入手機行事曆。</div>';
    return '<div class="hc-notify" data-hc-notify>'+inner+'</div>';
  }
  function _notifyBtn(){
    return requestNotify().then(p=>{
      try{ document.querySelectorAll('[data-hc-notify]').forEach(el=>{ el.outerHTML=notifyStatusHtml(); }); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent('hcNotifyChange',{detail:p})); }catch(e){}
      return p;
    });
  }

  /* ---------- Service Worker 註冊（PWA）---------- */
  // 註冊 Service Worker + 「有新版跳橫幅立即更新」（與旗艦 healthcare 一致）
  function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    let _reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!_reloading){ _reloading=true; location.reload(); } });
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js').then(reg=>{
        if(reg.waiting && navigator.serviceWorker.controller) _updateBar(reg.waiting); // 已有等待中的新版
        reg.addEventListener('updatefound',()=>{                                       // 之後偵測到新版
          const sw=reg.installing; if(!sw) return;
          sw.addEventListener('statechange',()=>{ if(sw.state==='installed' && navigator.serviceWorker.controller) _updateBar(sw); });
        });
      }).catch(()=>{});
    });
  }
  function _updateBar(waitingSW){
    if(document.getElementById('hc-upd')) return;
    const bar=document.createElement('div'); bar.className='hc-upd'; bar.id='hc-upd';
    bar.innerHTML='<span class="hc-upd-t"><i class="ti ti-refresh-alert"></i> 有新版可用</span><button class="hc-upd-go">立即更新</button>';
    bar.querySelector('.hc-upd-go').onclick=()=>{ try{ waitingSW.postMessage({type:'SKIP_WAITING'}); }catch(e){} bar.querySelector('.hc-upd-go').textContent='更新中…'; };
    document.body.appendChild(bar);
  }

  /* ---------- Chart.js 折線圖便利函式 ---------- */
  function lineChart(ctx, labels, datasets, opts){
    if(typeof Chart==='undefined') return null;
    const css=getComputedStyle(document.documentElement);
    const grid=css.getPropertyValue('--border').trim()||'rgba(0,0,0,.08)';
    const text=css.getPropertyValue('--text3').trim()||'#999';
    return new Chart(ctx,{ type:'line',
      data:{ labels, datasets:datasets.map(d=>Object.assign({tension:.35,borderWidth:2,pointRadius:2,fill:false},d)) },
      options:Object.assign({ responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:datasets.length>1,labels:{color:text,boxWidth:10,font:{size:11}}}},
        scales:{ x:{grid:{display:false},ticks:{color:text,font:{size:10},maxRotation:0}},
                 y:{grid:{color:grid},ticks:{color:text,font:{size:10}}} }
      }, opts||{}) });
  }

  /* ---------- 家族共用「基本資料」（同源共通：填一次，各 App 皆可讀）----------
     欄位：{name, sex:'m'|'f', birth:'YYYY-MM-DD', heightCm} */
  function getProfile(){ try{ return JSON.parse(localStorage.getItem('hcProfile'))||{}; }catch(e){ return {}; } }
  // 只寫入「有意義」的值，避免 undefined/空字串把既有共用資料覆蓋掉
  function patchProfile(obj){ const p=getProfile(); Object.keys(obj||{}).forEach(k=>{ const v=obj[k]; if(v!==undefined && v!==null && v!=='') p[k]=v; }); localStorage.setItem('hcProfile', JSON.stringify(p)); return p; }

  /* ---------- 家族切換選單（浮鈕 + 底部選單 + 基本資料表）---------- */
  const FAMILY=[
    {slug:'healthcare',name:'健康管理',emo:'🩺'},
    {slug:'healthsenior',name:'血壓日記',emo:'🩸'},
    {slug:'healthkids',name:'成長樹',emo:'🌱'},
    {slug:'healthfem',name:'她的節奏',emo:'🌙'},
    {slug:'healthwater',name:'喝水提醒',emo:'💧'},
    {slug:'healthsit',name:'久坐提醒',emo:'🚶'},
    {slug:'healthglu',name:'血糖日記',emo:'🍬'},
    {slug:'healthstretch',name:'伸展運動',emo:'🧘'},
  ];
  const FAMILY_BASE='/'; // root-relative：同一網域下的 /<slug>/，GitHub Pages 與 Cloudflare Pages 皆適用
  function _famEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // 安裝到桌面（PWA）：Android 觸發原生安裝，iOS/桌面給引導
  let _deferredInstall=null;
  try{ window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _deferredInstall=e; }); }catch(e){}
  function isInstalled(){ try{ return window.navigator.standalone===true || matchMedia('(display-mode: standalone)').matches; }catch(e){ return false; } }
  function promptInstall(){
    if(isInstalled()){ toast('已經安裝在桌面囉 🎉','ok'); return; }
    if(_deferredInstall){ _deferredInstall.prompt(); const c=_deferredInstall; _deferredInstall=null; try{ c.userChoice.then(r=>{ if(r&&r.outcome==='accepted') toast('安裝完成！','ok'); }); }catch(e){} return; }
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(isIOS?'iPhone：用 Safari 底部「分享」鍵 →「加入主畫面」':'請用瀏覽器選單的「安裝應用程式／加到主畫面」','info',4800);
  }
  // 醒目安裝橫幅：在瀏覽器開啟、還沒安裝時自動跳出。Android＝一鍵安裝；iPhone＝指引「分享→加入主畫面」
  function _ibHide(slug){ try{ sessionStorage.setItem('hcIB_'+(slug||''),'x'); }catch(e){} const b=document.getElementById('hc-ib'); if(b) b.remove(); }
  function installBar(slug, appName){
    try{
      if(isInstalled()) return;                                   // 已在桌面模式就不吵
      const urge=/[?&]install=1/.test(location.search);            // 從 HUB「安裝」進來 → 強調脈動＋忽略先前關閉
      if(!urge && sessionStorage.getItem('hcIB_'+(slug||''))==='x') return; // 這次瀏覽已被關掉
      if(urge){ try{ history.replaceState({},'',location.pathname); }catch(e){} } // 清掉網址上的 ?install=1
      const ua=navigator.userAgent;
      const isIOS=/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document);
      const inApp=/fbav|fban|instagram|line\/|micromessenger/i.test(ua); // 社群內建瀏覽器：iOS 無法加主畫面
      const nm=appName||'這支 App';
      const bar=document.createElement('div'); bar.className='hc-ib'+(urge?' urge':''); bar.id='hc-ib';
      const x='<button class="hc-ib-x" aria-label="關閉" onclick="HC._ibHide(\''+slug+'\')">×</button>';
      function render(){
        if(_deferredInstall){
          bar.innerHTML='<span class="hc-ib-t"><i class="ti ti-device-mobile-down"></i> 安裝「'+nm+'」到桌面</span>'
            +'<button class="hc-ib-go" onclick="HC.promptInstall()">安裝</button>'+x;
        } else if(isIOS && !inApp){
          bar.innerHTML='<span class="hc-ib-t"><i class="ti ti-device-mobile"></i> 把「'+nm+'」加到主畫面：點畫面下方 <b>分享</b> →「<b>加入主畫面</b>」</span>'+x;
        } else if(isIOS && inApp){
          bar.innerHTML='<span class="hc-ib-t"><i class="ti ti-external-link"></i> 請改用 <b>Safari</b> 開啟本頁，才能加到主畫面</span>'+x;
        } else {
          bar.innerHTML='<span class="hc-ib-t"><i class="ti ti-device-mobile-down"></i> 安裝「'+nm+'」：瀏覽器選單 →「安裝應用程式」</span>'
            +'<button class="hc-ib-go" onclick="HC.promptInstall()">安裝</button>'+x;
        }
      }
      render();
      document.body.appendChild(bar);
      // Android 的 beforeinstallprompt 可能稍晚才觸發 → 一到就把橫幅升級成一鍵安裝按鈕
      window.addEventListener('beforeinstallprompt', ()=>{ setTimeout(render,60); });
      window.addEventListener('appinstalled', ()=>{ _ibHide(slug); try{ toast('安裝完成！','ok'); }catch(e){} });
    }catch(e){}
  }
  let _famSex='';
  // 本 App 強調色（每支各自記住；預設＝各 App 自己的品牌色）
  const ACCENTS=[{k:'default',name:'預設',c:null},{k:'purple',name:'紫',c:'#534AB7',bg:'--purple-bg'},{k:'red',name:'紅',c:'#D85A30',bg:'--red-bg'},{k:'orange',name:'橘',c:'#F97316',bg:'--amber-bg'},{k:'green',name:'綠',c:'#1D9E75',bg:'--green-bg'},{k:'teal',name:'青',c:'#14B8A6',bg:'--green-bg'},{k:'blue',name:'藍',c:'#0EA5E9',bg:'--blue-bg'},{k:'pink',name:'粉',c:'#C6417F',bg:'--pink-bg'}];
  function _accentKey(slug){ return 'hcAccent_'+(slug||'app'); }
  function applyAccent(slug){ const k=localStorage.getItem(_accentKey(slug)); const a=ACCENTS.find(x=>x.k===k); const r=document.documentElement.style;
    if(a&&a.c){ r.setProperty('--brand',a.c); r.setProperty('--brand-bg','var('+a.bg+')'); } else { r.removeProperty('--brand'); r.removeProperty('--brand-bg'); } }
  function setAccent(slug,k){ localStorage.setItem(_accentKey(slug),k); applyAccent(slug); document.querySelectorAll('.fam-swatch').forEach(s=>s.classList.toggle('on', s.dataset.k===k)); toast('已套用配色','ok',1400); }
  function _famSexSet(s){ _famSex=s; const m=document.getElementById('fam-m'),f=document.getElementById('fam-f'); if(m)m.classList.toggle('on',s==='m'); if(f)f.classList.toggle('on',s==='f'); }
  // 開啟選單時把所有欄位刷新成最新的共用資料（避免顯示/回寫到過時值）
  function _famRefresh(){ const p=getProfile(); const g=id=>document.getElementById(id);
    if(g('fam-name')) g('fam-name').value=p.name||''; if(g('fam-birth')) g('fam-birth').value=p.birth||''; if(g('fam-height')) g('fam-height').value=p.heightCm||'';
    if(g('fam-weight')) g('fam-weight').value=p.weightKg||''; if(g('fam-goalw')) g('fam-goalw').value=p.goalWeightKg||''; _famSexSet(p.sex||''); }
  function _famSaveProfile(){
    const g=id=>document.getElementById(id);
    patchProfile({ name:(g('fam-name').value||'').trim(), sex:_famSex||undefined,
      birth:g('fam-birth').value||undefined, heightCm:parseFloat(g('fam-height').value)||undefined,
      weightKg:parseFloat(g('fam-weight').value)||undefined, goalWeightKg:parseFloat(g('fam-goalw').value)||undefined });
    try{ window.dispatchEvent(new Event('hcProfileChange')); }catch(e){}
    toast('已儲存家族基本資料，支援的 App 會自動帶入','ok',2600);
    const ov=document.getElementById('fam-ov'); if(ov) ov.classList.remove('show');
  }
  function familyMenu(current){
    if(document.getElementById('fam-fab')) return;
    applyAccent(current); // 載入時先套用使用者選過的強調色
    const curAccent=localStorage.getItem(_accentKey(current))||'default';
    const swatches='<div class="fam-swatches">'+ACCENTS.map(a=>'<button type="button" class="fam-swatch'+(a.k===curAccent?' on':'')+'" data-k="'+a.k+'" title="'+a.name+'" onclick="HC.setAccent(\''+current+'\',\''+a.k+'\')" style="'+(a.c?'background:'+a.c:'')+'">'+(a.c?'':'預設')+'</button>').join('')+'</div>';
    const fab=document.createElement('button'); fab.id='fam-fab'; fab.className='fam-fab'; fab.title='健康家族'; fab.innerHTML='<i class="ti ti-apps"></i>';
    const ov=document.createElement('div'); ov.className='fam-overlay'; ov.id='fam-ov';
    const p=getProfile();
    const list=FAMILY.map(f=>{ const cur=f.slug===current;
      return '<a class="fam-row'+(cur?' cur':'')+'" '+(cur?'':'href="'+FAMILY_BASE+f.slug+'/"')+'>'+
        '<span class="fam-emo">'+f.emo+'</span><span class="fam-name">'+f.name+'</span>'+
        (cur?'<span class="fam-here">目前</span>':'<i class="ti ti-chevron-right"></i>')+'</a>'; }).join('');
    const homeRow='<a class="fam-row" href="/hub/"><span class="fam-emo">🏠</span><span class="fam-name">健康家族 首頁</span><i class="ti ti-chevron-right"></i></a>';
    ov.innerHTML='<div class="fam-sheet">'+
      '<div class="fam-title">健康家族</div>'+
      '<div class="fam-sub">資料存在本機；僅在你主動啟用 AI 時才會傳送給 Google</div>'+
      '<button class="btn btn-primary btn-block" onclick="HC.promptInstall()"><i class="ti ti-device-mobile-down"></i>安裝這支 App 到桌面</button>'+
      '<div class="note note-brand" style="margin:8px 0 14px;font-size:12px"><i class="ti ti-info-circle"></i><span><b>各 App 可各自安裝。</b>Android：點上方按鈕（或瀏覽器選單「安裝應用程式」）。iPhone：用 Safari 底部「分享」→「加入主畫面」。裝好後桌面會出現這支 App 專屬圖示。</span></div>'+
      '<div class="fam-divider">偏好與備份</div>'+
      '<button class="btn btn-secondary btn-block" id="hc-senior-btn" style="min-height:50px;font-size:16px;margin-bottom:8px" onclick="HC.toggleSeniorMode();document.getElementById(\'hc-senior-txt\').textContent=HC.isSeniorMode()?\'【大字開啟中】\':\'【標準字體】\';"><i class="ti ti-typography"></i>長輩大字模式：<span id="hc-senior-txt">'+(isSeniorMode()?'【大字開啟中】':'【標準字體】')+'</span></button>'+
      '<div class="field-row two" style="margin-bottom:12px">'+
        '<button class="btn btn-outline" style="min-height:44px;font-size:13px" onclick="HC.exportAllFamilyData()"><i class="ti ti-download"></i>備份全家族</button>'+
        '<label class="btn btn-outline" style="min-height:44px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="ti ti-upload"></i>還原備份<input type="file" accept=".json" style="display:none" onchange="if(this.files[0])HC.importAllFamilyData(this.files[0])"></label>'+
      '</div>'+
      '<div class="fam-divider">前往</div>'+
      homeRow+
      list+
      '<div class="fam-divider" style="margin-top:14px">本 App 強調色</div>'+
      swatches+
      '<div class="fam-basic" style="margin-top:14px">'+
        '<div class="fam-divider">家族基本資料（填一次，支援的 App 共用）</div>'+
        '<div class="field"><label>稱呼</label><input id="fam-name" type="text" value="'+_famEsc(p.name)+'" placeholder="例如：王先生"></div>'+
        '<div class="field"><label>生理性別</label><div class="pick-grid two"><button type="button" class="pick-btn" id="fam-m" onclick="HC._famSexSet(\'m\')">男</button><button type="button" class="pick-btn" id="fam-f" onclick="HC._famSexSet(\'f\')">女</button></div></div>'+
        '<div class="field-row two"><div class="field"><label>生日</label><input id="fam-birth" type="date" value="'+(p.birth||'')+'"></div>'+
        '<div class="field"><label>身高 cm</label><input id="fam-height" type="number" inputmode="decimal" value="'+(p.heightCm||'')+'" placeholder="170"></div></div>'+
        '<div class="field-row two"><div class="field"><label>目前體重 kg</label><input id="fam-weight" type="number" inputmode="decimal" value="'+(p.weightKg||'')+'" placeholder="65"></div>'+
        '<div class="field"><label>目標體重 kg</label><input id="fam-goalw" type="number" inputmode="decimal" value="'+(p.goalWeightKg||'')+'" placeholder="選填"></div></div>'+
        '<button class="btn btn-primary btn-block" onclick="HC._famSaveProfile()"><i class="ti ti-check"></i>儲存基本資料</button>'+
      '</div>'+
      '<footer class="rl-signature"><div class="rl-sig-row"><svg class="rl-sig-glyph" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-width="3.6"><path d="M0 54 L8 48 L14 51 L22 38 L26 42 L36 14 L46 34 L61 44" stroke="currentColor"/><path d="M31.3 27.2 L36 14 L38.7 19.4" stroke="#DE9A45"/></svg><span class="rl-sig-rule"></span><p class="rl-sig-quote">人生走稜，<br>高低都是風景。</p></div><p class="rl-sig-by">LUCAS 出品</p><p class="fam-credits">© 2026 版權所有，保留一切權利 · 圖示 Tabler · 圖表 Chart.js · 生長標準 WHO · 時程 衛福部<br>免責：本 App 內容與提醒僅供健康參考，不能取代醫師診斷；身體不適請就醫。</p></footer>'+
      '<div class="fam-close" onclick="document.getElementById(\'fam-ov\').classList.remove(\'show\')">關閉</div>'+
      '</div>';
    fab.onclick=()=>{ ov.classList.add('show'); _famRefresh(); };
    ov.addEventListener('click',e=>{ if(e.target===ov) ov.classList.remove('show'); });
    document.body.appendChild(fab); document.body.appendChild(ov);
    // 在瀏覽器開啟、尚未安裝時，自動跳出醒目安裝橫幅
    try{ const me=FAMILY.find(f=>f.slug===current); installBar(current, me?me.name:''); }catch(e){}
  }

  return { ymd, todayStr, fmtDate, dateOffset, daysBetween, ageFrom,
           animateNum, toast, ensureToastWrap,
           load, save, exportData, importData, clearData,
           exportAllFamilyData, importAllFamilyData,
           setTheme, currentTheme, setBigFont, bigFontOn,
           setSeniorMode, isSeniorMode, toggleSeniorMode, playTone, playBeep, goPage,
           bmi, bmiInfo, bmr, normalCdf, zToPercentile,
           getApiKey, saveApiKey, clearApiKey, isOffline, setOffline, callAI,
           buildICS, downloadICS, canNotify, notifyPermission, requestNotify, notify, notifyStatusHtml, _notifyBtn,
           getProfile, patchProfile, familyMenu, _famSexSet, _famSaveProfile,
           promptInstall, isInstalled, installBar, _ibHide, applyAccent, setAccent,
           registerSW, lineChart };
})();
