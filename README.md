# 健康管理 App

> 單一 HTML 檔案，無需安裝，用瀏覽器開啟即可使用。

---

## 快速開始

1. 用 Chrome 或 Safari 開啟 `health-app.html`
2. 到 **P1 個人資料** 頁填入身高、體重、年齡
3. 點「儲存資料」— BMI、BMR、TDEE 自動計算並同步至所有頁面
4. 輸入 Anthropic API Key（選填）啟用 AI 餐盤掃描與個人化建議

---

## 頁面說明

| 頁面 | 功能 |
|------|------|
| P1 個人資料 | 身高體重、BMI/BMR/TDEE 計算、體組成進階欄位、API Key 設定 |
| P2 飲食記錄 | 餐盤拍照辨識（Haiku 4.5）、衛福部 100 筆食品資料庫搜尋、Open Food Facts 補充、手動輸入 |
| P3 體重追蹤 | 每日記錄、趨勢圖（7/30/90 天）、BMI 動態更新、目標設定與安全速率評估 |
| P4 運動記錄 | 22 種運動、MET 熱量計算、三段強度、今日 / 近 7 天歷史查看 |
| P5 睡眠・水分 | 睡眠時長與品質、飲水量追蹤（每日歸零）、趨勢圖、提醒設定 |
| P6 總覽儀表板 | 健康分數計算、熱量收支、本週概況、Haiku 4.5 AI 個人化建議 |

---

## AI 功能啟用

1. 前往 [console.anthropic.com](https://console.anthropic.com) 取得 API Key
2. 在 P1 個人資料頁最下方貼上 Key，點「儲存」
3. P2 餐盤掃描與 P6 AI 建議即時生效
4. 使用模型：`claude-haiku-4-5-20251001`（每次掃描約 NT$0.03）
5. ⚠️ 請勿在公用電腦使用，Key 儲存於瀏覽器 localStorage

---

## 食品資料庫

- **主要來源**：衛生福利部食品藥物管理署（2026/4 更新，100 種台灣常見食品）
- **補充來源**：Open Food Facts（搜尋不到時自動即時補充）
- 衛福部資料包含：熱量、蛋白質、脂肪、碳水化合物、膳食纖維

---

## 技術規格

- 單一 HTML 檔案（約 1,700 行），無需後端、無需安裝
- 資料存於瀏覽器 localStorage，關閉後保留
- 支援深色模式（跟隨系統設定）
- 依賴套件（CDN 載入）：Chart.js 4.4.1、Tabler Icons 3.19.0
- 建議瀏覽器：Chrome 110+、Safari 16+、Firefox 110+

---

## 開發歷程

本 App 由 Claude Sonnet 4.6 協助開發，歷經以下階段：

1. 需求分析與競品比較（MyFitnessPal、Cronometer、Garmin、Oura）
2. 六頁面架構規劃
3. P1–P6 逐頁開發
4. Haiku 4.5 餐盤掃描整合
5. 衛福部食品資料庫整合 + Open Food Facts 補充
6. 完整測試（108 項）
7. 14 項問題修正

---

## 已知限制

- 無穿戴裝置整合（Apple Health / Garmin）
- 睡眠只能手動輸入，無 HRV / 睡眠分期
- 條碼掃描尚未實作
- InBody OCR 自動讀取為第二期功能

---

## 更新記錄 2026-09-24

> 依前一輪審查（誠信類／接共用核心／版面觸控驗證）修正；`node --check` 全部 inline script 通過、Chrome headless 實測 0 錯誤。**尚未 commit、尚未部署。**

### 誠信類
1. **示範資料不再落盤**：示範紀錄只放記憶體（`STATE._demo`），`saveState` 一律排除；新增第一筆真實紀錄（`beginRealData()`）或按橫幅「清除示範，開始記錄」才結束示範。只改設定／逛頁面不會讓示範消失（`healthDemoDismissed` key）。示範模式下 p1 不拿示範體重、也不把示範體重寫進家族共用資料。橫幅移到總覽首頁。
2. **拍照區直接開相機**：`<input type=file accept="image/*" capture="environment">`；沒有照片按辨識一律提示、不回 MOCK；`MOCK_SCAN` 只留在「看示範」小連結（`p2ShowDemoScan`），結果明確標示為示範且「加入記錄」鈕隱藏、`p2ConfirmScan` 拒收。`p2SimUpload` 已刪。
3. **提醒頁假 toggle 移除**：改成說明卡＋《喝水提醒》`/healthwater/`、《久坐提醒》`/healthsit/` 兩個 root-relative 按鈕。
4. **建議來源徽章誠實化**：預設灰色「一般建議（依規則）」，只有 `p6GetAI` 真的拿到 Gemini 回應才切成綠色「AI 個人化 · Gemini 2.5」；API Key 未設定的說明文字也不再說「示範模式」。

### 接上共用核心（core.js，最小版）
5. `<script src="core.js">` 放在 **head**（不是 body 結尾：主程式 inline script 就會呼叫 `HC.*`，且 HC 載入時先套手動主題避免閃爍）。**不載入 core.css**；`.fam-*`／`.hc-ib*`／`.hc-upd*`／`.pick-*`／`.note*`／`.btn-secondary` 樣式已抄進自帶 `<style>`，並補 `--brand/--brand-bg` 變數。
   - `HC.familyMenu('healthcare')`：右下家族浮鈕＋底部選單＋安裝橫幅。
   - 大字體／主題改走 `HC.setSeniorMode/isSeniorMode/setTheme/currentTheme`（key `hcBigFont`／`hcTheme`），舊 key `bigfont`／`senior_mode`／`theme` 一次性遷移後移除。
   - 身高／性別／體重／目標體重讀寫 `HC.getProfile()/patchProfile()`（`heightCm/sex/weightKg/goalWeightKg`；年齡由 `birth` 換算、只讀不寫），監聽 `hcProfileChange` 反向同步。
   - 01 資料夾原本就有一份 2026-07 的舊 core.js/core.css，已用 `00_共用核心` 現行版覆蓋。
6. `--text3` `#9B9A97 → #6A6965`；補 `.field-row>*{min-width:0}`、`.note`/`.note-amber` 等。

### 版面／觸控／驗證
7. 體重與睡眠輸入列 三欄→兩欄＋日期跨欄（`.span-all`）；`.stat-grid.four` 改 `repeat(auto-fit,minmax(72px,1fr))`。360/320px 實測無水平溢出。
8. 觸控目標：seg-btn／int-tab／si-edit／分數說明鈕／今日‧近7天／複製昨日／導航快捷鈕 ≥40px；toggle 36×20→44×24。
9. 身高／體重／年齡清空或超出範圍 → 紅框＋inline 提示「（未儲存）」，不落盤、不改回預設；體重範圍統一 20–300。
10. 「昨晚睡眠」與睡眠分數改取**日期最新**一筆（`latestSleep()`），載入時 sleep/weight 陣列先排序。
11. 分類 chip 空關鍵字上限 50 筆＋「輸入關鍵字縮小範圍」提示。
12. `p5DelSleep`、`p1Reset` 補 `confirm`；`p1Reset` 補 `goalWeight/goalDate/foodPicks`。
13. 總覽（p6）改為預設首頁，底部導覽順序 總覽／體重／飲食／運動／睡眠／資料。
14. 圖表配色改看 `document.documentElement.dataset.theme`（`chartColors()`），切換主題會重畫。

### 其他
- `sw.js` 快取 `health-app-v18 → v19`，`ASSETS` 加入 `./core.js`。
- **build.ps1 要配合**：目前腳本對 `01_健康管理_healthcare` 跳過 `Copy-Item core.js`，需改成也複製 core.js（core.css 可不複製）。
