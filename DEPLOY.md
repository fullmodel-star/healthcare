# 上架 Google Play 商店 — 完整步驟

本 App 已是符合上架資格的 PWA，並已部署在
**https://fullmodel-star.github.io/healthcare/** （GitHub Pages，已上線）。

要把它送上 Google Play，需要把 PWA 包成 Android App（TWA, Trusted Web Activity）。
以下兩條路任選其一。**路線 A（PWABuilder）最簡單，建議非工程師使用。**

程式碼端（圖示、manifest、隱私權政策、打包設定）我已全部準備好，
剩下的步驟都需要「你的 Google 帳號 / 付款 / 線上操作」，無法由程式自動完成。

---

## 一次性前置（兩條路都需要）

1. **Google Play 開發者帳號**：到 <https://play.google.com/console> 註冊，
   一次性費用 **US$25**。個人帳號需身分驗證，約 1–2 天審核。
2. **隱私權政策網址**（已備好）：
   `https://fullmodel-star.github.io/healthcare/privacy-policy.html`
   推送上線後即可使用，填入 Play Console 的「隱私權政策」欄位。

---

## 路線 A：PWABuilder（網頁操作，最簡單）

1. 前往 <https://www.pwabuilder.com>
2. 輸入網址：`https://fullmodel-star.github.io/healthcare/` → **Start**
3. 分數頁面確認 Manifest / Service Worker / 圖示皆通過（已調整為全綠）
4. 點 **Package For Stores → Android → Google Play**
5. 套件參數填：
   - Package ID：`io.github.fullmodelstar.healthcare`
   - App name：`健康管理`
   - 其餘維持預設（PWABuilder 會自動帶入圖示與顏色）
6. 點 **Generate**，下載 zip。內含：
   - `*.aab`（上傳用）
   - `signing-key-info.txt`（**簽署金鑰，務必備份，遺失將無法更新 App**）
   - `assetlinks.json` 與安裝說明
7. 跳到下方「**共同步驟：上傳與發佈**」。

---

## 路線 B：Bubblewrap（CLI，可在本機產生 AAB）

打包設定檔已備好在 `play-store/`。
在 `play-store/` 資料夾開啟 PowerShell，執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-aab.ps1
```

- 首次執行會自動下載 JDK 與 Android SDK（約 1GB）。
- 過程會要你設定**簽署金鑰密碼**，請記下來並備份產生的 `android.keystore`。
- 完成後會在資料夾產生 `app-release-bundle.aab`。

---

## 共同步驟：上傳與發佈（在 Play Console）

1. **建立應用程式** → 名稱「健康管理」、語言繁體中文、類型 App、免費。
2. **上傳 AAB**：到「正式版（Production）→ 建立發布版本」，上傳 `.aab`。
3. **啟用 Play App Signing**（預設開啟）。上傳後到
   **設定 → 應用程式完整性 → App 簽署** 複製
   **「應用程式簽署金鑰憑證」的 SHA-256 指紋**。
4. **完成數位資產連結 (assetlinks)** — 這步是讓 App 開啟時不顯示瀏覽器網址列的關鍵：
   - 編輯 `play-store/assetlinks.json`，把 `REPLACE_WITH_SHA256_FROM_PLAY_CONSOLE_APP_SIGNING`
     換成上一步複製的 SHA-256。
   - 這個檔案必須放在 **網域根目錄**：
     `https://fullmodel-star.github.io/.well-known/assetlinks.json`
   - 因為本站是 GitHub 組織 `fullmodel-star` 的「專案頁」，根目錄需要另一個 repo：
     1. 建立名為 **`fullmodel-star.github.io`** 的 repo。
     2. 在其中放入 `.well-known/assetlinks.json`（即上面改好的檔案）。
     3. 啟用該 repo 的 GitHub Pages。
     4. 開 `https://fullmodel-star.github.io/.well-known/assetlinks.json` 確認可讀取。
   > 註：PWABuilder 產出的 zip 也會附 `assetlinks.json` 與相同說明，內容一致。
5. **填寫商店資訊**：
   - 隱私權政策網址：見上方前置第 2 點。
   - App 圖示：用 `icon-512.png`（已備好 512×512）。
   - 主要圖片 / 螢幕截圖：Play 要求**至少 2 張手機截圖**。
     用手機或 Chrome DevTools 行動模式開 App 截圖即可（這需要你手動截，無法自動產生）。
   - 分類：健康與健身。
6. **資料安全 (Data safety) 表單**（依本 App 實況填寫）：
   - 是否蒐集 / 分享資料：**否**（資料僅存在使用者裝置）。
   - 例外：啟用 AI 功能時，餐點照片會即時傳給 Google Gemini API 分析、不留存。
     若 Play 要求申報，勾選「健康與健身 / 相片」「為了 App 功能」「不會儲存」。
   - 無廣告、無第三方分析追蹤。
7. **內容分級問卷**、**目標對象**（一般 13+）、**廣告聲明（無廣告）** 依序填完。
8. 送出審核。首次審核通常 1–7 天。

---

## 已完成（程式碼端）

- ✅ PNG 圖示：`icon-192/512.png`、`icon-maskable-192/512.png`、`icon-1024.png`
- ✅ `manifest.json` 升級為 Play 規格（加上 `id`、PNG 圖示、maskable）
- ✅ `index.html` 圖示連結、`sw.js` 快取清單更新（v11）
- ✅ `privacy-policy.html` 隱私權政策（含 Gemini API 與健康資料說明）
- ✅ `play-store/twa-manifest.json`、`assetlinks.json`、`build-aab.ps1` 打包設定

## 仍需你本人操作（無法自動化）

- ⬜ 註冊 Google Play 開發者帳號（US$25）
- ⬜ 產生 / 保管簽署金鑰（PWABuilder 或 build-aab.ps1 會產生，務必備份）
- ⬜ 把帶有 Play 簽署 SHA-256 的 `assetlinks.json` 發佈到網域根目錄
- ⬜ 手機螢幕截圖（≥2 張）上傳商店頁
- ⬜ 填寫資料安全表單與內容分級、送審
