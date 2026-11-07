# 瀏覽器回歸測試

近期的曲線、數值清單、長表單及再記錄檢查原本以暫存腳本手動執行。現在以 Playwright Test 納入 repo，PR 的 validate 與 Pages 的 build 都在正式建置後執行；失敗時不會上傳 Pages 產物或部署。

## 執行

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

Linux CI 使用官方 `npx playwright install --with-deps chromium` 安裝 Chromium 及系統相依。受控開發環境若已提供 Chromium，可改用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`；本輪本機以此方式檢查，不安裝另一套系統套件。標準 CI 使用 Playwright 對應的瀏覽器，不設定這個覆寫值。

測試自行啟停 127.0.0.1:4173 的 Vite preview，不重用既有 server。必須先重建 dist，測試不自動重新建置。preview 以 `/fitness-pwa/` 子路徑提供同一份正式產物，包含相對資產、manifest 與 Service Worker 路徑。

`npm test` 仍只跑原本的 Vitest。瀏覽器檔案使用 `.pw.ts` 與獨立 testMatch，`test:e2e` 先以 tsconfig.e2e.json 做型別檢查，再跑 Playwright；沒有將 Playwright 測試或虛構資料編入網站。

## 範圍

十一個使用情境，各在 320×852、390×844、844×390 執行，共 33 個案例：

- 平滑曲線、相鄰量測、缺日斷線、真實零及鍵盤 Tooltip，並與每日數值表比對。
- 每日／每週清單最大高度、內部鍵盤捲動、固定欄名，以及捲到底後直接收合。
- 健康摘要 14 筆分批、全部日期、展開後焦點及日期範圍重設。
- 50 段跑步機表單的可見關閉控制項、44px 目標、焦點循環、Escape 與取消不寫入。
- 再記一次預填今天日期與獨立分段、取消、重新儲存的新 ID，以及離線重載後的戶外健走記錄。
- 健康表單日期寬度與至少 16px 輸入字級、同日更新及 0 步儲存。
- 真正下載 JSON、檢查匯出內容、拒絕壞檔及取消取代不改原資料，再選相同檔案還原運動與健康資料。
- 34 筆運動歷史分批、首筆新增運動焦點、關鍵字／種類／起迄日組合、16px／44px 日期與搜尋欄位、清除／無結果、從舊紀錄再記一次取消、統計不變，以及離線重開後搜尋完整資料。

- PWA 回前景偵測真實新版 Service Worker、保留開著的運動草稿、關閉表單後明確更新才重載，並讀回新版 controller 與原始資料。
- 同一 context 的兩個分頁共用真實 worker：另一頁先套用新版，目前頁的 controller 也變更，但草稿仍在；儲存後自行更新畫面，讀回新增紀錄與完整原資料。
- 本機兩個分頁：A 頁開草稿、B 頁儲存新運動後，A 頁保留草稿但停用儲存與重新讀取；關閉草稿並明確讀取後能看到 B 的紀錄，再新增 A 的新紀錄時兩筆都保留，畫面不溢出。

每個案例使用新的瀏覽器 context，僅填入 e2e/fixtures.ts 的虛構 localStorage 資料。Date 固定為 2026-11-07，避免 CI 跨午夜造成日期漂移，計時器與繪圖仍正常執行。請求以 loopback origin 過濾，不進行 Google 登入、Picker、私人 Sheets、健康 API 或真實 YouTube 播放，也沒有 storageState、Token 或真實帳號 fixture。離線案例明確等待 Service Worker 就緒與控制頁面後才切斷網路。

PWA 升級案例另以 e2e/pwa-server.ts 建立獨立 127.0.0.1 隨機 port 的靜態測試 server，提供同一份 dist 的 `/fitness-pwa/` 路徑。僅在記憶體中的 sw.js HTTP 回應附加虛構版本辨識，先註冊版本 1，再提供版本 2；透過真實 MessageChannel 讀取 active controller 版本，沒有 mock 瀏覽器的 ServiceWorker API。推進測試的 Date 61 秒並發送 focus 事件，驗證節流後的實際註冊更新。沒有修改 dist、正式 worker 或公開部署，也不是兩套不同前端產物的快取遷移測試；額外 server 於測試後關閉。每個案例僅允許自己的 loopback origin。E15 的雙分頁案例在同一隔離 context 開兩頁，共用虛構 localStorage 與 worker；先在舊實作重現草稿因自動重載而消失的失敗，再確認修正後可繼續儲存與自行重載。這不是 Safari 與獨立安裝 PWA 是否共享 worker 的驗證。

這是 Chromium 的 viewport 回歸，並非 iPhone Safari、軟體鍵盤、VoiceOver、OAuth 或 iOS 捷徑驗收。Google 與 iPhone 手動驗收維持原清單。

## CI 與失敗診斷

Playwright 固定 1.65.0（npm 官方 metadata：Node ≥20，現有 Node 22 符合）；只增加三個開發套件，應用依賴不變（E11 當時網頁產物也維持一致；E12 已更新還原介面）。安裝後確認此版本有 Ubuntu 24.04／26.04 的 registry／依賴設定，沿用 ubuntu-latest。檢查日期為 2026-11-07。

單一 worker、每案 45 秒、CI 最多三個失敗即停止、job 上限 10 分鐘、不自動重試，避免失敗被隱藏或長時間等待。CI 禁止 test.only。HTML 報告、失敗截圖及 trace 在 playwright-report/ 與 test-results/，已加入 gitignore；CI 僅於瀏覽器案例失敗時上傳這兩個目錄，保留七天，不放進 dist 或公開網站。診斷僅對應虛構測試 context。upload-artifact 固定官方 v7 的完整 SHA `cf430e030ddbb5b0abf93d22962f4752f3646cd9`（Node 24），與既有 Actions runtime 相容。

檢查失敗時，從該 run 的 browser-failure artifact 下載報告，再用 `npx playwright show-report` 或 `npx playwright show-trace 路徑/trace.zip` 在自己的機器閱讀。trace 只在失敗時保留；成功的案例不保留 trace／截圖，也不上傳診斷 artifact。

E16 的本機雙分頁案例先在舊程式重現「A 頁儲存後 B 頁新紀錄消失」的失敗，再確認偵測變更、保留草稿、明確重新讀取與重新記錄的流程通過。這只驗證同來源 localStorage 的先後修改；比對後寫入不是原子操作，不保證真正同時寫入的所有交錯順序，也不驗證不同 iOS 容器是否共享儲存。

E16 本機完整結果：277 項 Vitest、8 項 Python、TypeScript／Vite／Service Worker 建置、瀏覽器測試型別檢查與 33 個 Playwright 案例通過。本機瀏覽器為系統 Chromium 156；E11 的 PR #18 與 Pages 均已實際安裝並通過原 18 個案例；E12 的 PR #19 與 Pages 均已通過 21 個案例；E13 的 PR #20 與 Pages 已通過 24 個案例；E14 的 PR #21 與 Pages 已通過 27 個案例；E15 的 PR #22 與 Pages 已通過 30 個案例；E16 擴增至 33 個案例，結果以本次 PR／Pages 記錄為準。失敗 artifact 上傳條件已設定，成功執行不代表實際觸發過上傳。

官方依據：

- https://playwright.dev/docs/ci-intro
- https://playwright.dev/docs/test-webserver
- https://playwright.dev/docs/service-workers
- https://github.com/actions/upload-artifact/tree/cf430e030ddbb5b0abf93d22962f4752f3646cd9
