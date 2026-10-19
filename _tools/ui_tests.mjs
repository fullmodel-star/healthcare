/**
 * 201 健康管理 · 瀏覽器層走查（2026-10-19 版面美化第二階段建立）
 *
 *   node _tools/ui_tests.mjs                     → 對這支資料夾跑
 *   node _tools/ui_tests.mjs --root=<絕對路徑>    → 對別的副本跑（例：改前備份）
 *   node _tools/ui_tests.mjs --shots=<資料夾>     → 另外拍 8 張截圖（首訪／有資料 × 手機淺色首屏、捲到第一張卡、手機深色、桌機 1440）
 *
 * 家族沒有既有瀏覽器測試，這支照 605 `_tools/ui_tests.mjs` 的寫法：
 * - 自己起 http server（no-store）、直接試綁埠；最小 CDP 用戶端；不用 virtual-time，一律真實時間輪詢。
 * - 每次開頁先清 localStorage，再依情境放入「有資料」紀錄、主題、長輩模式；confirm() 一律回 true 並記錄。
 * - 每條斷言盡量印出樣本數，避免空集合假通過。
 * 示範資料流程（首訪只在畫面顯示示範、不落盤；清除示範／新增第一筆才結束）是這支的核心，第 2 節專門守它。
 */
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const ROOT = path.resolve(arg('root') || path.join(HERE, '..'));
const SHOTS = arg('shots');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.txt': 'text/plain', '.woff2': 'font/woff2' };
// 既有、非本次加入的外部資源：Chart.js（cdnjs，index.html 第 25 行，有 SRI）。其他網域一律不准。
const ALLOWED_EXT = /^cdnjs\.cloudflare\.com$/;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 160) : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); }
}

async function startServer() {
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
    const p = path.join(ROOT, rel);
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      const b = await readFile(p);
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(b);
    } catch { res.writeHead(404); res.end(); }
  });
  for (let port = 8840; port < 8880; port++) {
    const okBind = await new Promise((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => resolve(true));
    });
    if (okBind) return { server, port };
  }
  throw new Error('找不到可用的埠');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiters = new Map(); this.errors = []; this.requests = []; this.failed = []; this.initScript = null; }
  static async connect(debugPort) {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
      } catch { /* Chrome 還沒起來 */ }
      if (!target) await sleep(250);
    }
    if (!target) throw new Error('接不上 Chrome 的 CDP');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.waiters.has(m.id)) { c.waiters.get(m.id)(m); c.waiters.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') c.errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'unknown');
      if (m.method === 'Network.requestWillBeSent') c.requests.push(m.params.request.url);
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) c.failed.push(m.params.response.status + ' ' + m.params.response.url);
    };
    await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res) => { this.waiters.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  }
  async until(expr, ms = 8000, step = 150) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { if (await this.eval(expr)) return true; } catch { /* 還沒 ready */ }
      await sleep(step);
    }
    return false;
  }
  async width(w, h = 844) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await sleep(250);
  }
  async scheme(dark) {
    await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  }
  /** 開頁：清 localStorage → 依情境放資料。seed：'none'（首訪＝示範模式）／'real'（有自己的紀錄） */
  async open(url, { seed = 'none', theme = null, senior = false } = {}) {
    if (this.initScript) await this.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.initScript });
    const r = await this.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      try {
        if (!sessionStorage.getItem('__keep')) {
          localStorage.clear();
          ${theme ? `localStorage.setItem('hcTheme', ${JSON.stringify(theme)});` : ''}
          ${senior ? `localStorage.setItem('hf_senior_mode','1');` : ''}
          ${seed === 'real' ? `(() => {
            const d = (o) => { const t = new Date(); t.setDate(t.getDate() + o); return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'); };
            const st = { profile: { height:165, weight:62, age:45, sex:'f', actFactor:1.375, goal:'lose', waterGoal:2000, sleepGoal:7.5, goalWeight:58 },
              meals: { [d(0)]: { breakfast:[{name:'燕麥粥',qty:'250g',cal:180,pro:6,fat:3,carb:30,id:11}], lunch:[{name:'雞胸便當',qty:'1份',cal:620,pro:38,fat:18,carb:70,id:12}], dinner:[], snack:[] } },
              weightRecords: [{date:d(-6),weight:63.2,time:'07:00'},{date:d(-3),weight:62.8,time:'07:00'},{date:d(0),weight:62.4,time:'07:00'}],
              exerciseRecords: [{id:21,name:'快走',icon:'ti-walk',date:d(0),duration:40,cal:180,intensity:'medium',time:'18:00'},{id:22,name:'瑜伽',icon:'ti-yoga',date:d(-2),duration:30,cal:110,intensity:'low',time:'20:00'}],
              sleepRecords: [{date:d(0),bed:'23:30',wake:'06:45',dur:7.25,quality:4,note:''}],
              waterLogs: [{id:31,date:d(0),time:'09:00',amount:500},{id:32,date:d(0),time:'13:00',amount:400}] };
            localStorage.setItem('healthAppState', JSON.stringify(st));
          })();` : ''}
        }
      } catch(e) {}
      window.__confirms = []; window.confirm = (m) => { window.__confirms.push(String(m)); return true; };
      window.__alerts = []; window.alert = (m) => { window.__alerts.push(String(m)); };
    })();` });
    this.initScript = r.result && r.result.identifier;
    await this.send('Page.navigate', { url });
    return this.until(`document.readyState==='complete' && /^\\d+$/.test((document.getElementById('p6-score')||{}).textContent||'') && typeof HC==='object'`, 15000);
  }
  async shot(file, full = false) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
    await writeFile(file, Buffer.from(r.result.data, 'base64'));
  }
}

// 相對亮度與對比（測深色可讀）
const CONTRAST_FN = `(() => {
  // 計算後的顏色可能是 rgb()/rgba()，也可能是 color-mix 產生的 color(srgb r g b / a)（0–1）
  const parse = (s) => { let m = s.match(/rgba?\\(([^)]+)\\)/), k = 1; if (!m) { m = s.match(/color\\(srgb ([^)]+)\\)/); k = 255; } if (!m) return null;
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r:p[0]*k, g:p[1]*k, b:p[2]*k, a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126*f(c.r) + .7152*f(c.g) + .0722*f(c.b); };
  const bgOf = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > .5) return c; const bi = getComputedStyle(e).backgroundImage; if (bi && bi !== 'none') { const m = bi.match(/rgba?\\([^)]+\\)|color\\(srgb [^)]+\\)/g); if (m) { const cs = m.map(parse); return { r: cs.reduce((s,c)=>s+c.r,0)/cs.length, g: cs.reduce((s,c)=>s+c.g,0)/cs.length, b: cs.reduce((s,c)=>s+c.b,0)/cs.length, a:1 }; } } e = e.parentElement; } return { r:255, g:255, b:255, a:1 }; };
  window.__cr = (el) => { if (!el) return 0; const f = parse(getComputedStyle(el).color), b = bgOf(el); const l1 = lum(f), l2 = lum(b); return +((Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05)).toFixed(2); };
  return 1;
})()`;

const { server, port } = await startServer();
const BASE = `http://127.0.0.1:${port}/`;
const profile = await mkdtemp(path.join(tmpdir(), 'hc201-ui-'));
const DEBUG_PORT = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let c;
async function cleanup() {
  try { chrome.kill(); } catch {}
  server.close();
  await sleep(300);
  try { await rm(profile, { recursive: true, force: true }); } catch {}
}

const EMOJI = '/\\p{Extended_Pictographic}/u';
console.log('ROOT = ' + ROOT);

try {
  c = await CDP.connect(DEBUG_PORT);
  await c.width(390);
  await c.scheme(false);

  console.log('\n[1 載入]');
  ok('1.1 首訪載入完成：總覽是預設首頁、健康分數已算出數字', await c.open(BASE), await c.eval(`[document.querySelector('.page.active')?.id, document.getElementById('p6-score')?.textContent]`));
  await sleep(600);
  ok('1.2 沒有未捕捉的 JS 例外', c.errors.length === 0, c.errors.slice(0, 3));

  console.log('\n[2 示範資料流程（首訪）]');
  const demo = await c.eval(`(()=>{const b=document.getElementById('demo-banner'); return {shown: !!b && getComputedStyle(b).display!=='none' && b.offsetHeight>0, txt: b? b.textContent.replace(/\\s+/g,''):'', demo: !!STATE._demo, w: STATE.weightRecords.length}})()`);
  ok('2.1 首訪顯示示範說明（寫明是示範資料、不會存進紀錄），記憶體裡有示範紀錄', demo.shown && /示範資料/.test(demo.txt) && /不會存進/.test(demo.txt) && demo.demo && demo.w > 0, demo);
  await c.eval(`saveState()`);
  const disk = await c.eval(`(()=>{const s=JSON.parse(localStorage.getItem('healthAppState')||'{}'); return {w:(s.weightRecords||[]).length, x:(s.exerciseRecords||[]).length, demoKey:'_demo' in s}})()`);
  ok('2.2 示範資料不落盤（saveState 後 localStorage 的紀錄是 0 筆）', disk.w === 0 && disk.x === 0 && !disk.demoKey, disk);
  await c.eval(`[...document.querySelectorAll('#demo-banner button')].find(b=>/先留著看/.test(b.textContent)).click()`);
  ok('2.3 按「先留著看」：說明收起，示範資料仍在畫面上', await c.eval(`getComputedStyle(document.getElementById('demo-banner')).display==='none' && STATE._demo===true`));
  await c.open(BASE);
  await c.eval(`[...document.querySelectorAll('#demo-banner button')].find(b=>/清除示範/.test(b.textContent)).click()`);
  const cleared = await c.eval(`({demo: !!STATE._demo, w: STATE.weightRecords.length, dismissed: localStorage.getItem('healthDemoDismissed'), confirms: window.__confirms.length, banner: getComputedStyle(document.getElementById('demo-banner')).display})`);
  ok('2.4 按「清除示範」：先問確認，示範清空、記住不再載入、說明收起', !cleared.demo && cleared.w === 0 && cleared.dismissed === '1' && cleared.confirms === 1 && cleared.banner === 'none', cleared);
  await c.eval(`sessionStorage.setItem('__keep','1'); location.reload()`);
  await c.until(`document.readyState==='complete' && typeof STATE==='object'`, 10000); await sleep(400);
  ok('2.5 清除後重新整理：不再出現示範資料', await c.eval(`!STATE._demo && STATE.weightRecords.length===0 && getComputedStyle(document.getElementById('demo-banner')).display==='none'`));
  await c.eval(`sessionStorage.removeItem('__keep')`);

  console.log('\n[3 有資料狀態]');
  await c.open(BASE, { seed: 'real' });
  const real = await c.eval(`({demo: !!STATE._demo, w: STATE.weightRecords.length, banner: getComputedStyle(document.getElementById('demo-banner')).display, score: +document.getElementById('p6-score').textContent})`);
  ok('3.1 有自己的紀錄：不載入示範、不顯示示範說明、分數 > 0', !real.demo && real.w === 3 && real.banner === 'none' && real.score > 0, real);
  await sleep(900);
  const sc = await c.eval(`({n:+document.getElementById('p6-score').textContent, off:+document.getElementById('p6-score-circle').getAttribute('stroke-dashoffset')})`);
  ok('3.2 分數環的弧長跟分數一致（dashoffset＝427.3×(1−分數/100)）', Math.abs(sc.off - 427.3 * (1 - sc.n / 100)) < 0.5, sc);

  console.log('\n[4 首屏主視覺（健康分數環＝首屏儀表）]');
  const hero = await c.eval(`(()=>{const h=document.querySelector('#p6 .hf-hero'); if(!h) return {has:false};
    const r=h.getBoundingClientRect(); const ring=h.querySelector('.score-ring-wrap'); const rr=ring&&ring.getBoundingClientRect();
    const go=h.querySelectorAll('.hf-go'); const g=go[0]&&go[0].getBoundingClientRect(); const navTop=document.querySelector('.nav').getBoundingClientRect().top;
    const firstCard=document.querySelector('#p6 > .card'); const fc=firstCard&&firstCard.getBoundingClientRect();
    return {has:true, inHeader: !!h.closest('header'), top:Math.round(r.top), ringIn: !!ring && !!h.querySelector('#p6-score'), ringW: rr?Math.round(rr.width):0,
      goN: go.length, goBottom: g?Math.round(g.bottom):9999, navTop: Math.round(navTop), beforeCard: fc? r.bottom<=fc.top+1 : false,
      allGo: document.querySelectorAll('.hf-go').length, title:(h.querySelector('.hf-hero-t')||{}).textContent}})()`);
  ok('4.1 總覽最上方有主視覺卡（.hf-hero），不在黏住的頁首裡，在第一張卡之前', hero.has && !hero.inHeader && hero.beforeCard, hero);
  ok('4.2 健康分數環放進主視覺、手機寬 ≥ 170px', hero.ringIn && hero.ringW >= 170, { ringW: hero.ringW });
  ok('4.3 全頁只有一顆主行動大鈕（.hf-go），手機首屏內看得到（不被底欄蓋住）', hero.goN === 1 && hero.allGo === 1 && hero.goBottom <= hero.navTop, hero);
  await c.eval(`document.querySelector('#p6 .hf-go')?.click()`);
  ok('4.4 按主行動：切到飲食頁（記一筆飲食）', await c.until(`document.querySelector('.page.active')?.id==='p2'`, 3000));
  await c.eval(`history.back()`);
  ok('4.5 返回鍵回到總覽', await c.until(`document.querySelector('.page.active')?.id==='p6'`, 3000));
  const mets = await c.eval(`[...document.querySelectorAll('#p6 .hc6-met')].map(b=>({tag:b.tagName, img: !!b.querySelector('img'), page:b.dataset.go}))`);
  ok('4.6 六項分數各有 3D 小圖、可點進對應頁', mets.length === 6 && mets.every((m) => m.img && m.tag === 'BUTTON' && /^p[1-5]$/.test(m.page)), mets);
  if (mets.length) {
    await c.eval(`document.querySelector('#p6 .hc6-met[data-go="p5"]').click()`);
    ok('4.7 點「睡眠」分數：切到睡眠頁', await c.until(`document.querySelector('.page.active')?.id==='p5'`, 3000));
    await c.eval(`history.back()`); await c.until(`document.querySelector('.page.active')?.id==='p6'`, 3000);
  } else ok('4.7 點「睡眠」分數：切到睡眠頁', false, 'no .hc6-met');
  await c.open(BASE);
  const demoIn = await c.eval(`(()=>{const b=document.getElementById('demo-banner'); const h=document.querySelector('#p6 .hf-hero'); const go=document.querySelector('#p6 .hf-go');
    return {inHero: !!(h && b && h.contains(b)), goBottom: go? Math.round(go.getBoundingClientRect().bottom): 9999, navTop: Math.round(document.querySelector('.nav').getBoundingClientRect().top)}})()`);
  ok('4.8 首訪（示範說明開著）時主行動鈕仍在手機首屏內、示範說明收進主視覺卡裡', demoIn.inHero && demoIn.goBottom <= demoIn.navTop, demoIn);
  // 2026-10-19 審查退回：3D 書本原本疊在分數環左上弧線 → 書本必須在環外、也不壓到文字
  const BOOK_FN = `(()=>{const h=document.querySelector('#p6 .hf-hero'); const bk=h&&h.querySelector('img[src*="book"]'); if(!bk) return {has:false};
    const R=e=>{const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom}}; const hit=(a,b)=>a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1;
    const b=R(bk), ring=R(h.querySelector('.score-ring-wrap')), hr=R(h);
    const texts=[...h.querySelectorAll('.hf-hero-k,.hf-hero-t,.hf-hero-p,.hc6-info-btn,.hf-go')].filter(e=>e.offsetParent);
    const tHit=texts.filter(e=>hit(b,R(e))).map(e=>e.className);
    return {has:true, w:Math.round(b.r-b.l), ringHit:hit(b,ring), tHit, inside: b.l>=hr.l && b.r<=hr.r && b.t>=hr.t && b.b<=hr.b, n:texts.length}})()`;
  const bk390 = await c.eval(BOOK_FN);
  ok('4.9 390px：3D 書本與分數環的邊界框不重疊、不壓到文字或主鈕、在主視覺卡內', bk390.has && !bk390.ringHit && bk390.tHit.length === 0 && bk390.inside && bk390.n >= 4, bk390);
  const bar = await c.eval(`(()=>{const h=document.querySelector('header.rl-appbar'); const cs=getComputedStyle(h); return {cls:h.className, bg:cs.backgroundColor, body:getComputedStyle(document.body).backgroundColor, title:getComputedStyle(h.querySelector('.rl-title')).color, mark:getComputedStyle(h.querySelector('.rl-mark')).backgroundColor, btns:[...h.querySelectorAll('button,a')].map(b=>getComputedStyle(b).backgroundColor)}})()`);
  ok('4.10 頁首是家族暖底淺色版（.hf-bar：底色＝頁面底、深字、山形磚主題色、頁首鈕白卡）', /hf-bar/.test(bar.cls) && bar.bg === bar.body && bar.title === 'rgb(58, 33, 24)' && bar.btns.length >= 3 && bar.btns.every((x) => x === 'rgb(255, 255, 255)'), bar);

  console.log('\n[5 圓體字型與 3D 圖]');
  await c.eval(`document.fonts.ready`);
  const font = await c.until(`[...document.fonts].some(f=>f.family.replace(/"/g,'')==='HF Round' && f.status==='loaded')`, 6000);
  const fams = await c.eval(`['.hf-hero-t','.nav-item span','.rl-appbar .rl-title','.card-title','#p6-score'].map(s=>{const e=document.querySelector(s); return e? getComputedStyle(e).fontFamily : 'none'})`);
  ok('5.1 圓體子集（HF Round）有載入', font, await c.eval(`[...document.fonts].map(f=>f.family+':'+f.status)`));
  ok('5.2 主視覺大標、分頁字、App 名、卡片標題、分數數字都用 HF Round', fams.every((f) => /HF Round/.test(f)), fams);
  const bodyFam = await c.eval(`getComputedStyle(document.querySelector('.ai-text, .note, .li-name, .stat-card .sl')||document.body).fontFamily`);
  ok('5.3 內文維持系統字（不是圓體）', !/^"?HF Round/.test(bodyFam), bodyFam);
  const f3 = await c.eval(`(async()=>{const srcs=[...new Set([...document.querySelectorAll('img')].map(i=>i.getAttribute('src')).filter(s=>/fluent-3d\\//.test(s||'')))];
    const res=await Promise.all(srcs.map(s=>new Promise(ok=>{const im=new Image(); im.onload=()=>ok(im.naturalWidth>0?null:s); im.onerror=()=>ok(s); im.src=s;})));
    return {n:srcs.length, srcs, broken:res.filter(Boolean)}})()`);
  ok('5.4 用到的 3D 圖（' + f3.n + ' 種）全部載得出來（new Image 實際載入）', f3.n >= 6 && f3.broken.length === 0, f3);
  const fontFile = await c.eval(`fetch('vendor/hf-round.woff2').then(r=>r.ok? r.arrayBuffer().then(b=>b.byteLength):0).catch(()=>0)`);
  ok('5.5 字型檔 vendor/hf-round.woff2 存在且 < 400KB（' + Math.round(fontFile / 1024) + ' KB）', fontFile > 10000 && fontFile < 400 * 1024, fontFile);

  console.log('\n[6 操作元件文字無 emoji]');
  const emo = await c.eval(`(()=>{const sel='.app button, .nav .nav-item, .rl-appbar button, .card-title, .page-title, .hf-hero *';
    const els=[...document.querySelectorAll(sel)].filter(e=>!e.closest('footer, .rl-signature, #rdgInstall, #rdgIos'));
    const bad=els.map(e=>(e.childElementCount?[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''):e.textContent)||'').filter(t=>${EMOJI}.test(t));
    return {n:els.length, bad:[...new Set(bad)].slice(0,6)}})()`);
  ok('6.1 操作元件（' + emo.n + ' 個；頁尾簽名與安裝鈕是家族注入區塊，不在範圍）文字沒有 emoji', emo.n >= 60 && emo.bad.length === 0, emo);

  console.log('\n[7 底欄不透明、暖色底]');
  const navL = await c.eval(`(()=>{const n=getComputedStyle(document.querySelector('.nav')); return {bg:n.backgroundColor, bf:n.backdropFilter, body:getComputedStyle(document.body).backgroundColor}})()`);
  ok('7.1 淺色：底部分頁列不透明', /^rgb\(/.test(navL.bg) && (!navL.bf || navL.bf === 'none'), navL);
  ok('7.2 淺色：頁面底是米白暖底 #FBF5EC（與家族 core.css 一致）', navL.body === 'rgb(251, 245, 236)', navL.body);

  console.log('\n[8 桌機兩欄]');
  for (const w of [1000, 1440]) {
    await c.width(w, 900);
    await c.open(BASE, { seed: 'real' });
    const d = await c.eval(`(()=>{const cards=[...document.querySelectorAll('#p6 > .card')].map(e=>e.getBoundingClientRect()); const h=document.querySelector('#p6 .hf-hero'); const hr=h&&h.getBoundingClientRect();
      const ring=h&&h.querySelector('.score-ring-wrap'); const rr=ring&&ring.getBoundingClientRect(); const t=h&&h.querySelector('.hf-hero-t'); const tr=t&&t.getBoundingClientRect();
      const lefts=[...new Set(cards.map(r=>Math.round(r.left)))];
      return {cards:cards.length, cols:lefts.length, heroW: hr?Math.round(hr.width):0, pageW: Math.round(document.getElementById('p6').getBoundingClientRect().width),
        ringRight: !!(rr&&tr&&rr.left>=tr.right-1), ringW: rr?Math.round(rr.width):0, titlePx: t? parseFloat(getComputedStyle(t).fontSize):0,
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1}})()`);
    ok(`8.${w} ${w}px：卡片至少兩欄、主視覺橫跨整列、分數環在大標右邊（≥ 200px）、大標 ≥ 36px、沒有水平捲動`,
      d.cols >= 2 && d.heroW >= d.pageW - 40 && d.ringRight && d.ringW >= 200 && d.titlePx >= 36 && !d.hscroll, d);
    const bk = await c.eval(BOOK_FN);
    ok(`8.${w}b ${w}px：3D 書本與分數環不重疊、不壓文字、在主視覺卡內`, bk.has && !bk.ringHit && bk.tHit.length === 0 && bk.inside, bk);
  }
  if (SHOTS) {
    await mkdir(SHOTS, { recursive: true });
    await c.width(1440, 900); await c.open(BASE, { seed: 'real' }); await sleep(1200); await c.shot(path.join(SHOTS, '201_data_light_d.png'));
    await c.open(BASE); await sleep(1200); await c.shot(path.join(SHOTS, '201_first_light_d.png'));
  }

  console.log('\n[9 沒有水平捲動（各頁、各寬度）]');
  for (const w of [360, 390]) {
    await c.width(w);
    await c.open(BASE, { seed: 'real' });
    const bad = [];
    for (const p of ['p6', 'p3', 'p2', 'p4', 'p5', 'p1']) {
      await c.eval(`goPage('${p}', document.querySelector('.nav-item[data-page="${p}"]'))`); await sleep(250);
      if (await c.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`)) bad.push(p);
    }
    ok(`9.${w} ${w}px 六頁都沒有水平捲動`, bad.length === 0, bad);
  }

  console.log('\n[10 深色模式]');
  await c.width(390);
  for (const mode of ['system', 'manual']) {
    await c.scheme(mode === 'system');
    await c.open(BASE, mode === 'manual' ? { theme: 'dark' } : {});
    await c.eval(CONTRAST_FN);
    const dk = await c.eval(`(()=>{const q=s=>document.querySelector(s); const go=q('#p6 .hf-go'); const n=getComputedStyle(q('.nav'));
      return {body:getComputedStyle(document.body).backgroundColor, nav:n.backgroundColor, goBg: go? getComputedStyle(go).backgroundColor:'',
        cr:{title:__cr(q('.hf-hero-t')), score:__cr(q('#p6-score')), cardTitle:__cr(q('#p6 > .card .card-title')), navItem:__cr(q('.nav-item:not(.active) span')), navActive:__cr(q('.nav-item.active span')), go:__cr(go), demo:__cr(q('#demo-banner span')), metric:__cr(q('#p6 .hc6-met .sl')), barTitle:__cr(q('header .rl-title')), barSub:__cr(q('header .rl-sub'))}, bar:getComputedStyle(q('header.rl-appbar')).backgroundColor}})()`);
    const crs = Object.values(dk.cr);
    ok(`10.${mode} 深色（${mode === 'system' ? '跟隨系統' : '手動切換'}）：暖深底 #1A1311、頁首同為暖深底、底欄不透明、主鈕金色、文字（含頁首）對比全部 ≥ 4.5`,
      dk.body === 'rgb(26, 19, 17)' && /^rgb\(/.test(dk.nav) && dk.goBg === 'rgb(255, 200, 61)' && dk.bar === dk.body && crs.length >= 10 && crs.every((x) => x >= 4.5), dk);
    if (SHOTS && mode === 'system') {
      await sleep(900); await c.shot(path.join(SHOTS, '201_first_dark_m.png'));
      await c.open(BASE, { seed: 'real' }); await sleep(1200); await c.shot(path.join(SHOTS, '201_data_dark_m.png'));
    }
  }
  await c.scheme(false);

  console.log('\n[11 淺色對比、換強調色、長輩模式]');
  await c.open(BASE);
  await c.eval(CONTRAST_FN);
  const lt = await c.eval(`(()=>{const q=s=>document.querySelector(s); return {title:__cr(q('.hf-hero-t')), kicker:__cr(q('.hf-hero-k')), go:__cr(q('#p6 .hf-go')), navActive:__cr(q('.nav-item.active span')), metric:__cr(q('#p6 .hc6-met .sl')), demo:__cr(q('#demo-banner span'))}})()`);
  ok('11.1 淺色：主視覺大標、小標、主鈕、分頁、分數標籤、示範說明對比全部 ≥ 4.5', Object.values(lt).every((x) => x >= 4.5), lt);
  const before = await c.eval(`(()=>{const g=document.querySelector('#p6 .hf-go'); return g? getComputedStyle(g).backgroundColor : 'none'})()`);
  await c.eval(`HC.setAccent('healthcare','blue')`); await sleep(200);
  await c.eval(CONTRAST_FN);
  const after = await c.eval(`({bg:(()=>{const g=document.querySelector('#p6 .hf-go'); return g? getComputedStyle(g).backgroundColor : 'none'})(), bar:getComputedStyle(document.querySelector('.rl-appbar .rl-mark')).backgroundColor, go:__cr(document.querySelector('#p6 .hf-go')), ring:document.getElementById('p6-score-circle') && getComputedStyle(document.getElementById('p6-score-circle')).stroke})`);
  ok('11.2 換強調色（藍）：主鈕、頁首山形磚跟著換色，白字對比仍 ≥ 4.5', after.bg !== before && after.bar === after.bg && after.go >= 4.5, { before, after });
  await c.eval(`HC.setAccent('healthcare','default')`);
  await c.open(BASE, { senior: true });
  const sen = await c.eval(`(()=>{const h=document.querySelector('#p6 .hf-hero'); const over=h?[...h.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>h.getBoundingClientRect().right+1).map(e=>e.className||e.tagName).slice(0,5):['no hero'];
    return {cls:document.documentElement.className, hscroll:document.documentElement.scrollWidth>window.innerWidth+1, over, title: h&&h.querySelector('.hf-hero-t')? parseFloat(getComputedStyle(h.querySelector('.hf-hero-t')).fontSize):0}})()`);
  ok('11.3 長輩大字模式：主視覺放大（大標 ≥ 30px）、沒有元素超出卡片、沒有水平捲動', /bigfont/.test(sen.cls) && sen.title >= 30 && !sen.hscroll && sen.over.length === 0, sen);
  const bkS = await c.eval(BOOK_FN);
  ok('11.4 長輩大字模式：3D 書本仍不壓分數環與文字', bkS.has && !bkS.ringHit && bkS.tHit.length === 0 && bkS.inside, bkS);

  console.log('\n[12 Service Worker 預先快取]');
  const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ver = (sw.match(/const CACHE='health-app-v(\d+)'/) || [])[1];
  const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1].split('?')[0]).filter(Boolean);
  const missing = assets.filter((a) => !existsSync(path.join(ROOT, a)));
  const vend = assets.filter((a) => a.startsWith('vendor/'));
  ok('12.1 sw.js 版號 ≥ v24', +ver >= 24, ver);
  ok('12.2 預先快取含圓體與全部 3D 圖（' + vend.length + ' 個 vendor 檔），清單上每個檔都存在', vend.includes('vendor/hf-round.woff2') && f3.srcs.every((s) => vend.includes(s)) && missing.length === 0, { vend, missing });

  console.log('\n[13 沒有錯誤、只連本機]');
  ok('13.1 全程沒有未捕捉的 JS 例外', c.errors.length === 0, c.errors.slice(0, 3));
  const hosts = [...new Set(c.requests.filter((u) => /^https?:/i.test(u)).map((u) => new URL(u).hostname))];
  const unexpected = hosts.filter((h) => h !== '127.0.0.1' && !ALLOWED_EXT.test(h));
  ok('13.2 只連本機（＋既有的 Chart.js cdnjs）；實際主機：' + hosts.join(', '), unexpected.length === 0, unexpected);
  const f404 = [...new Set(c.failed.filter((u) => u.includes('127.0.0.1')))];
  ok('13.3 本機資源沒有 404', f404.length === 0, f404.slice(0, 5));

  if (SHOTS) {
    await c.width(390); await c.scheme(false);
    await c.open(BASE); await sleep(1200);
    await c.shot(path.join(SHOTS, '201_first_light_m.png'));
    await c.eval(`(document.querySelector('#p6 > .card')||document.body).scrollIntoView({block:'start'}); window.scrollBy(0,-70)`); await sleep(500);
    await c.shot(path.join(SHOTS, '201_first_card_m.png'));
    await c.open(BASE, { seed: 'real' }); await sleep(1200);
    await c.shot(path.join(SHOTS, '201_data_light_m.png'));
    await c.eval(`(document.querySelector('#p6 > .card')||document.body).scrollIntoView({block:'start'}); window.scrollBy(0,-70)`); await sleep(500);
    await c.shot(path.join(SHOTS, '201_data_card_m.png'));
    await c.open(BASE, { seed: 'real', senior: true }); await sleep(1200);
    await c.shot(path.join(SHOTS, '201_data_senior_m.png'));
    console.log('截圖 → ' + SHOTS);
  }
} catch (e) {
  fail++;
  console.log('  FAIL 測試程式本身出錯：' + (e && e.stack || e));
} finally {
  console.log('\n' + (fail ? 'FAIL' : 'PASS') + '　通過 ' + pass + ' 項，失敗 ' + fail + ' 項');
  await cleanup();
  process.exit(fail ? 1 : 0);
}
