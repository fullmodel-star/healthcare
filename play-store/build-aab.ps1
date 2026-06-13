# ============================================================
#  健康管理 — 產生 Google Play 上架用的 Android App Bundle (.aab)
#  使用 Bubblewrap (Google 官方 TWA 打包工具)
#
#  執行前需求：已安裝 Node.js（已具備）。
#  Bubblewrap 首次執行會自動下載 JDK 與 Android SDK（約 1GB，需網路）。
#
#  用法：在本資料夾 (play-store) 開啟 PowerShell，執行：
#      powershell -ExecutionPolicy Bypass -File .\build-aab.ps1
# ============================================================

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "== 1/4 安裝 Bubblewrap CLI ==" -ForegroundColor Cyan
npm install -g @bubblewrap/cli

Write-Host "== 2/4 初始化專案（讀取線上 manifest）==" -ForegroundColor Cyan
# 若已存在 twa-manifest.json，bubblewrap 會沿用；否則由線上 manifest 產生
if (-not (Test-Path ".\twa-manifest.json")) {
  bubblewrap init --manifest "https://fullmodel-star.github.io/healthcare/manifest.json"
}

Write-Host "== 3/4 建置 AAB（首次會下載 JDK / Android SDK，請耐心等候）==" -ForegroundColor Cyan
# 首次執行會詢問是否下載 JDK/SDK，請回答 Yes，並設定簽署金鑰密碼（請務必牢記）
bubblewrap build

Write-Host "== 4/4 完成 ==" -ForegroundColor Green
Write-Host "產出檔案：" -ForegroundColor Green
Get-ChildItem -Filter *.aab | Select-Object Name, Length
Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "  1. 將 app-release-bundle.aab 上傳到 Google Play Console。"
Write-Host "  2. 啟用 Play App Signing 後，複製 Google 提供的 SHA-256，"
Write-Host "     填入 assetlinks.json，並發佈到網站根目錄的 /.well-known/assetlinks.json。"
Write-Host "  詳見 ..\DEPLOY.md"
