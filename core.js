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

  /* ---------- 主題 ---------- */
  function setTheme(mode){
    if(mode==='auto'){ document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('hcTheme'); }
    else { document.documentElement.setAttribute('data-theme',mode); localStorage.setItem('hcTheme',mode); }
    ['auto','light','dark'].forEach(m=>{ const el=document.getElementById('th-'+m); if(el) el.classList.toggle('on', m===mode); });
  }
  function currentTheme(){ return localStorage.getItem('hcTheme')||'auto'; }
  (function applyInitTheme(){ const t=localStorage.getItem('hcTheme'); if(t==='dark'||t==='light') document.documentElement.setAttribute('data-theme',t); })();

  /* ---------- 大字體（長輩友善）---------- */
  function setBigFont(on){ document.documentElement.classList.toggle('bigfont', !!on); localStorage.setItem('hcBigFont', on?'1':'0'); }
  function bigFontOn(){ return localStorage.getItem('hcBigFont')==='1'; }
  (function initBig(){ if(localStorage.getItem('hcBigFont')==='1') document.documentElement.classList.add('bigfont'); })();

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
    const key=(val||'').trim();
    if(!key){ toast('請輸入 API Key','warn'); return false; }
    if(!key.startsWith('AIza')){ toast('Google Gemini Key 應以 AIza 開頭','warn'); return false; }
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

  /* ---------- Service Worker 註冊（PWA）---------- */
  function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    window.addEventListener('load',()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
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

  return { ymd, todayStr, fmtDate, dateOffset, daysBetween, ageFrom,
           animateNum, toast, ensureToastWrap,
           load, save, exportData, importData, clearData,
           setTheme, currentTheme, setBigFont, bigFontOn, goPage,
           bmi, bmiInfo, bmr, normalCdf, zToPercentile,
           getApiKey, saveApiKey, clearApiKey, isOffline, setOffline, callAI,
           buildICS, downloadICS, canNotify, notifyPermission, requestNotify, notify,
           registerSW, lineChart };
})();
