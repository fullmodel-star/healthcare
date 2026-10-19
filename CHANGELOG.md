# 更新記錄 CHANGELOG

## 2026-10-19 · 版面美化第二階段「健康存摺」（薄荷綠）（未 commit／**未部署**）
- **為什麼**：老闆選定二系列方向 A「淺色暖光」（深色＝樣稿 B 暖深底＋金色主鈕）；評比 201 輸在「首屏先是示範說明框與紫色小鈕，分數環被推到下方，視線要跳兩次」。派工說明 `04_管理工具\_docs\App版面美化_2026-10-19\POLISH_BRIEF_二系列.md`。
- **01 不載 core.css**：家族暖色 tokens（淺 `#FBF5EC`／深 `#1A1311`、`#261C19`、底欄 `#120D0B`）照 core.css 的值寫進自己的 `:root`；`@font-face HF Round`、圓體套用、卡片、不透明底欄、`.hf-hero`、`.hf-go`（深色金 `#FFC83D`）整段**逐字照抄** core.css（index.html `<style>` 尾段，註解標明；core.css 改了要重抄）。core.js／00 共用核心未改。
- **首屏儀表**：總覽的頁首＋示範橫幅＋分數卡合併成一張 `.hf-hero.hc6-hero`：日期・健康存摺、大標「今天的健康分數」、分數環放大（手機 196px／桌機 240px，圓體大數字，3D 綠色書本貼紙）、「怎麼算」說明、**唯一主行動「記一筆飲食」**（→飲食頁，原 `p6GoLog('p2')`）；示範說明（`#demo-banner`，文字與 `clearDemoData／dismissDemoBanner` 不變）收進同一張卡、改成虛線框次要鈕。桌機左欄文字＋主鈕、右欄大分數環。
- **六項分數**改成 3D 小圖格（沙拉／跑鞋／月亮／水滴／天平／月曆），每格可點進對應頁（新增 `hc6Go()`，返回鍵回總覽）；元素 id 與 `setMetric` 邏輯不變。
- 頁首、主要按鈕、分頁選中改走 `--brand`（預設薄荷 `#12A07E`，白字底 `--brand-solid`）；`--purple` 仍是「運動」分類色。家族選單換強調色後主鈕／頁首／分數環跟著換。`theme-color` 改 `#0C6D56`／深色 `#1A1311`（manifest.json 與 play-store 未動）。
- **套件**：jf open 粉圓 v2.1（OFL-1.1）子集 `vendor/hf-round.woff2` 213KB（1014 字；用 00 的 `build_hf_round.py`，但把 `food-db.js` 排除——2,261 筆食品名不用圓體，收進來會超過 600KB；重產指令：`PYTHONPATH=<pylib>;00_共用核心_health-core/_tools python -c "import sys,build_hf_round as b; b.SKIP_JS|={'food-db.js'}; sys.argv=['x','01_健康管理_healthcare']; b.main()"`）＋`hf-round-LICENSE.txt`；Microsoft Fluent Emoji 3D（MIT）7 張 128px `vendor/fluent-3d/`（book=Green book、salad=Green salad、shoe=Running shoe、moon=Crescent moon、drop=Droplet、scale=Balance scale、cal=Calendar）＋LICENSE.txt。新增約 306KB（之後走快取）。
- **sw**：`health-app-v23 → v24`，預先快取加 `vendor/hf-round.woff2` 與 7 張 3D 圖。
- **測試**：新增 `_tools/ui_tests.mjs`（`node _tools/ui_tests.mjs [--root=副本] [--shots=資料夾]`）44 項：示範資料流程（不落盤／先留著看／清除示範要確認且重整後不再出現）、有資料狀態、主視覺與唯一主鈕在首屏、分數環弧長＝分數、圓體載入且被用到、3D 圖 new Image 全載得出來、操作元件無 emoji、桌機兩欄、360/390 六頁無水平捲動、底欄不透明、深色（系統／手動）對比 ≥4.5 與金色主鈕、換強調色、長輩模式不溢出、sw 清單、只連本機（＋既有 Chart.js cdnjs）。改前 16/44 → 改後 44/44。品牌檢核 0 FAIL（4 WARN 皆既有：brand.config、favicon-32、reg.update、Chart.js CDN）。截圖 `04_管理工具\_docs\App版面美化_2026-10-19\201截圖\`。
- **審查退回修正（同日）**：3D 書本移出分數環，改放主視覺卡右上與大標同列（桌機在文字與環之間）；頁首改家族暖底淺色版 `.rl-appbar.hf-bar`（從 core.css 逐字抄入；深色＝暖深底；山形磚走 --brand-solid、換強調色同步；注入的 LINE／回報鈕 svg 改跟字色，同 206）。測試加書本／環不重疊與頁首檢查，改前 16/44 → 改後 44/44。
- 未做：`build.ps1 -NoOpen` 沒跑（會把 00 的 core 同步到其他支、與並行 agent 互撞；`vendor/` 不是 `_` 開頭會照常出貨、`_tools/` 會被排除）。

## 2026-10-11 · 體驗提升（第二輪）：對比、觸控目標、內文字級
- 問題：Lighthouse 無障礙 89–96，剩餘為 color-contrast（歡迎框「開始」鈕與久坐大鈕白字 2.5–2.8:1、深色模式 purple/blue/pink/品牌色文字 2.1–4.4:1、HUB 編號圓點／flag／頁尾連結）；各 App 自訂 tab/chip/清單鈕 30–42px；內文 14px。
- 改法：00 共用核心 core.css 加區塊（.go/.stand-btn 底色用 --brand-solid；深色提亮 --blue/--purple/--pink/--brand-ink；input/select min-height 44；pick-btn/meal-tab/mode-tab/cat-btn/act-btn/dur-chip/goal-btn/adv-toggle/hi-del/cal-nav ≥44；inline min-height:40 一律 44；li-name/li-sub/note/empty/field label 15px）；core.js 通知授權鈕 44px；01 index.html 內嵌抄本同步並修 demo 橫幅鈕與 balance-hint 對比、食物分類/最近 chips、int-tab；HUB 內嵌 .num/.flag/footer a；07 smart-sub opacity 1；各 App sw 快取版號 +1。
- 前→後：LH 無障礙（深色）HUB/01–08 = 96/96/96/96/96/96/96/96/96 → 全部 100（淺色 08/06 驗過 100）；逐頁小目標（排除頁首 fab 與 toggle）01 共 ~80 → 1（頁首 fab），204 18 → 0，205/206 各 -1；橫向溢出 0、console 錯誤 0。
- 未動：桌機版面、頁首 32–40px 鈕、10-10 的 ≥3 卡兩欄與 .hc-ib-t。

## v1.8.0 — 2026-09-24 誠信修正 + 接上家族共用核心（最新，未 commit／未部署）

> 詳細逐項見 `README.md`「更新記錄 2026-09-24」。

### 誠信
- 示範資料只在記憶體顯示、永不落盤；新增第一筆真實紀錄或按「清除示範」才結束示範。
- 拍照區直接開相機（`capture="environment"`）；沒照片不辨識、不回假結果；示範辨識只剩「看示範」連結且不可加入紀錄。
- 提醒頁三個無作用 toggle 移除，改導向《喝水提醒》《久坐提醒》。
- 規則型建議標示「一般建議」，只有 Gemini 真的回應才掛 AI 徽章。

### 共用核心
- 載入 `core.js`（不載 core.css）：家族選單／安裝橫幅、長輩大字與主題共用 key、家族基本資料（身高／性別／體重／目標體重）填一次全家族共用。

### 版面／驗證
- 360px 三欄含 date/time 改兩欄；觸控目標 ≥40px；toggle 44×24；身高／體重／年齡驗證不再靜默改回預設；體重範圍 20–300；睡眠取日期最新一筆；分類搜尋上限 50；刪睡眠／重設補 confirm；總覽改預設首頁；圖表配色看手動主題。
- Service Worker 快取 v18 → v19，加入 `core.js`。

---

## v1.7.0 — Google Play 上架準備

> 將 PWA 整備為可送上 Google Play 商店的規格（透過 TWA 打包）。詳細上架步驟見 `DEPLOY.md`。

### 新增
- **PNG 圖示**：由向量重建 `icon-192/512.png`、`icon-maskable-192/512.png` 與商店用 `icon-1024.png`（Play / TWA 需要 PNG）。
- **隱私權政策**：`privacy-policy.html`（涵蓋本機儲存、相機、Google Gemini API、無追蹤、醫療免責）— Play 上架必備。
- **打包設定** `play-store/`：Bubblewrap `twa-manifest.json`、`assetlinks.json` 範本、`build-aab.ps1` 一鍵建置腳本。
- **上架指南** `DEPLOY.md`：PWABuilder 與 Bubblewrap 兩種路線 + Play Console 完整步驟。

### 變更
- `manifest.json` 升級為 Play 規格：加上 `id`、改用 PNG 圖示（含 maskable）、`dir`。
- `index.html` 補上 PNG `icon`/`apple-touch-icon` 連結。
- Service Worker 快取版本 v10 → v11，納入新 PNG 圖示。

---

## v1.6.0 — 多人物 UX 試用改版

> 派出 5 種不同性格的假使用者（長輩、忙碌上班族、健身狂、焦慮新手、隱私控）試用後，針對「開場門檻」與「各族群習慣」做的體驗改版。

### 降低開場門檻（多數人共通痛點）
- **飲食頁預設改為「搜尋」**：不需 API Key 就能立刻記錄，拍照不再是強制第一關。
- **餐別依目前時間自動選**：中午打開自動跳午餐，省一步也避免記錯餐別。
- **「目前體重」可直接輸入**：在個人資料頁改體重就自動記錄一筆並同步，移除嚇人的「請按我」大按鈕，改為一行小提示。

### 各族群專屬改善
- **新手**：首次開啟顯示「這是示範資料」橫幅，附「清掉示範，從頭開始」一鍵按鈕；喝水補上「已記錄 +Xml」提示，與其他記錄一致。
- **長輩**：底部導覽圖示與文字放大（圖示 22→26px、字 10→12px、列高 64→70px）；BMR/BMI 等縮寫加中文白話（如「BMR 基礎代謝・不動也會燒的熱量」、kcal→大卡）。
- **健身族**：開放自訂「蛋白質目標（g/kg 體重）」，飲食頁目標蛋白質改依此計算，不再寫死 ×1.8。
- **隱私控**：新增「離線模式」總開關（一鍵停用所有雲端 AI）；新增「資料會送到哪裡」說明（只有主動按拍照/AI 建議才會外傳，且明列傳哪些）；清除資料時詢問是否一併清除 API Key。

### 其他
- Service Worker 快取版本 v9 → v10。

---

## v1.5.0 — AI 多代理健檢修正版

> 由多個 AI 代理分頭健檢後集中修正，聚焦「算數字正確性」與「防呆」。

### 重要修正（高）
- **熱量平衡算錯（會瘦/會胖判斷）**：新增 `maintenanceTDEE()`（身體真實維持消耗，不含減重/增重折扣）。總覽今日結餘、每週累積淨熱量、AI 週統計一律改用真實維持消耗判斷盈虧，修正「折扣被算兩次」導致對減重/增重者系統性誤判。每日「目標熱量」仍用含調整的 `calcTDEE()` 顯示。
- **拍照辨識失敗不再偷塞示範假資料**：辨識失敗（無金鑰／額度／網路）時顯示明確失敗訊息並引導改用搜尋/手動，不再自動填入固定假餐點與綠色「加入記錄」鈕。
- **減重目標安全下限**：減重不再無條件扣 500 kcal，設下限（男 1500／女 1200），達下限時於畫面標註，避免嬌小體型被算出危險的極低目標。
- **誤刪保護**：飲食、運動、飲水的刪除改為先確認；刪除鈕點擊範圍放大至 34–36px，降低誤觸。
- **日期時區陷阱**：日期一律改用本機時區（新增 `ymd()`），修正 `todayStr/dateOffset` 與各週/趨勢統計原本以 UTC 計算、在台灣清晨可能把「今天」算成「昨天」或漏記的問題。
- **API Key 安全**：Gemini 請求金鑰改放 `x-goog-api-key` 請求標頭，不再放在網址查詢字串，避免在瀏覽紀錄/轉介/快取中外洩。

### 其他
- 修正 `fmtDate()` 忽略傳入日期、永遠回傳今天的潛在 bug。
- BMI／掃描結果加入防呆，身高為 0 或缺欄位時不再顯示 Infinity／NaN。
- 「單日 ≈ ±X kg」改為「脂肪約 ±X kg（長期估算）」，避免把當日水分變化誤當體重變化。
- Service Worker 快取版本 v8 → v9；修正 SW 內殘留的「Anthropic」舊註解（實際使用 Google Gemini）。

---

## v1.4.0 — 問題修正版

### 必修修正
- **#01** P5 飲水記錄加入日期欄位，每日自動歸零，不再跨天累計
- **#02** 食品搜尋結果正確顯示分類（f.cat），修正衛福部資料庫欄位不一致
- **#03** Open Food Facts 搜尋結果改用模組變數，避免快速切換時取到舊資料

### 體驗改善
- **#04** P2 熱量超過目標 105% 時進度條自動變紅警示
- **#05** P3 記錄體重後 P1 輸入框同步更新
- **#06** P4 運動記錄加入「今日 / 近 7 天」切換，支援歷史查看
- **#07** P5 睡眠趨勢圖加入空資料保護，新用戶不再報錯
- **#09** P6「步數」改為「活動量」，從本週運動天數動態計算（不再寫死 50 分）

### 優化
- **#10** P1 儲存後即時刷新 P2 熱量目標與 P6 總覽
- **#11** API Key 加入「請勿在公用電腦使用」安全提示
- **#12** 示範資料改為只在首次使用時載入，不再覆蓋真實數據
- **#13** P3 目標體重自動預設為最新體重 - 5kg
- **#14** P2 飲食記錄加入鉛筆編輯按鈕，可直接修改份量

---

## v1.3.0 — 台灣食品資料庫

- 串接衛生福利部食藥署 100 筆驗證食品（2026/4 更新）
- 涵蓋：穀物澱粉、肉類、魚貝類、蔬菜、水果、台灣料理、加工食品、甜點、飲料
- 新增食品分類 Tabs 篩選
- Open Food Facts 即時補充搜尋（搜尋不到時自動呼叫）
- 搜尋結果顯示資料來源標籤（衛福部 / OFF）
- 新增膳食纖維追蹤欄位

---

## v1.2.0 — API Key 整合

- P1 加入 Anthropic API Key 設定介面
- 統一 `callAI()` 函式，自動帶入 `x-api-key` header
- P2 餐盤掃描改用真實 Haiku 4.5 API（需 Key）
- P6 AI 建議改用真實 API，無 Key 時顯示規則型備援建議
- 修正 P4 強度切換按鈕邏輯 bug

---

## v1.1.0 — 六頁整合版

- P1–P6 整合為單一 HTML 檔案
- 共享 STATE 物件，跨頁資料互通
- localStorage 持久化儲存
- P1 TDEE 自動同步至 P2/P4/P6
- P3 體重更新 TDEE 回寫提示
- 深色模式支援

---

## v1.0.0 — 初版

- P1 個人資料（BMI/BMR/TDEE/體組成）
- P2 飲食記錄（拍照掃描 + 搜尋 + 手動）
- P3 體重追蹤（趨勢圖 + 目標）
- P4 運動記錄（22 種運動 + MET 計算）
- P5 睡眠與水分
- P6 總覽儀表板

## 2026-09-30 icon v5 換版

- 依稜線 icon v5 定案重出安裝 icon：healthcare＝CARE（9 檔）。
- 規則：≥128px 為「主圖＋功能字＋底部 RIDGELINE」；48／64 去字；16／32 去字去跳色；apple-touch 180 滿版不透明；maskable 無字滿版。
- 來源＝品牌正式檔 `05_品牌資源/03_App圖示_正式檔/`（byte 一致）；原檔備份在 `03_App圖示_正式檔/_backup_v5前_20260930_App端/`。
- 同日最終確認：底部 `RIDGELINE` 署名字級最終為畫布 5%，有字尺寸（≥128、180、icon.svg）已重出；小尺寸與 maskable 未動。
- 同日：手機 icon（maskable）改為有字版（B 版：大圖卡縮 0.72 倍＋RIDGELINE 6.5%），已升 sw 並部署（未上線的 App 只 commit）。
- 狀態：已於 2026-09-30 升 sw、commit、部署並以公開網址驗證（部署紀錄見 05_品牌資源/05_對外網站/docs/icon-proposals-2026-09-30/OUTPUT-2026-09-30-v5正式輸出.md）。
