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

二十三個使用情境，各在 320×852、390×844、844×390 執行，共 69 個案例：

- 同一 context 的雙分頁偏好：B 收藏及看過後，A 的星號／次數更新，但影片新增草稿、焦點、搜尋與同一 iframe 保留。B 把目標改為 240 時，A 的 175 分鐘草稿仍在，取消不寫入；A 再標記看過，B 更新為 2 次。下載 JSON 的 experience、離線重開與全部原影片／運動／健康資料完整，沒有水平溢出。
- 50 段跑步機明細的高度上限與內部鍵盤捲動、固定欄名、完整第 50 段、具名區域／展開關聯；捲到底整頁位置不變，Tab 可到下方 44px 收合按鈕，Enter 收合回摘要。離線重開仍可查看全部分段，下載的 JSON 保留完整陣列，運動／健康資料不變且整頁無溢出。
- 17 筆長課表清單開啟編輯後，名稱欄位取得焦點且不被固定介面覆蓋；欄位 16px／44px、編輯與取消按鈕至少 44px。原生 Tab／Shift+Tab、具名表單與展開關聯、取消不寫入；離線修改並儲存後返回同一編輯按鈕，新課表取消回新增按鈕，離線重開保留結果、原課表與運動／健康資料。
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
- 本機無法解讀時真正下載原始檔，驗證 raw 字串（含特殊字元）完整保留；確認保存後，以鍵盤 Enter 開啟原生選檔。拒絕把原始檔當作備份，取消取代保持來源不變，確認有效備份後恢復紀錄；再新增一筆，離線重開仍完整保留，控制項至少 44px 且畫面不溢出。
- 離線跨日回前景：週六運動草稿保留原日期／分鐘／備註，進到週日後今日步數不沿用週六；週日健康表單進到週一仍保留原日期／體重，日期上限跟隨今天。週一統計與課表重設，新表單用週一日期，存入新運動後只計入新週，原有資料保留且不溢出。
- 25 部虛構影片的搜尋／長度／分類／收藏交集、12 部分批與首筆新增標題焦點、16px／44px 控制項、零結果時保留 iframe 節點、明確標記看過及預填運動後取消。離線查找未標示長度、下載 JSON 仍包含全部影片，離線重開重設搜尋且資料完整。外部影片與縮圖請求被阻擋，不把 DOM 節點保留當成實際 YouTube 播放驗收。

- 影片庫真實雙分頁：B 頁先新增影片，A 頁保留影片草稿與同一 iframe，停用加入及重新讀取；關閉草稿並明確讀取後保留搜尋，新增 A 的影片不覆蓋 B 的影片。原運動／健康 raw 不變，離線重開後三支虛構影片完整且無水平溢出。

- 本機 25 部自訂影片：從搜尋開編輯後 URL 聚焦、取消不寫入、拒絕重複連結、移除選填長度，保留 ID／原順序並展開到第 25 部的更新標題與焦點。更換網址／分類／長度後仍維持同一 iframe，收藏／看過原始字串及運動／健康 raw 不變，真正下載的備份完整，離線重開可查到新資料。

- 每週目標的真實 Service Worker 更新：表單取得焦點、16px／44px 與展開狀態，填寫時發現新版仍阻擋更新；取消不寫入，再開回原目標，儲存後才解鎖並回到調整按鈕。明確更新後讀回新版 controller，離線重開仍有新目標，運動／健康 raw 不變。

- 影片分類的原生鍵盤流程：搜尋欄 Tab 到長度再到分類，Enter／空白鍵切換，Shift+Tab 返回，焦點保留及按下狀態互斥。窄螢幕橫向分類列隨焦點捲動，深色焦點框及 44px 控制項、清除後回搜尋、同一 iframe、離線篩選／重開與全部 raw 不變。

- 跑步機分段草稿：再記一次後切換健走／跑步，保留兩段；小數與未填欄位經其他運動類型及跑步機開關後仍在，日期／備註／熱量不變。明確套用範本仍取代，取消完全不寫入；重新填寫後離線儲存新紀錄，重開及再次編輯切類型仍完整，原紀錄與健康資料不變。

- 離開有效分段時帶入總時長：45.5 分切騎車或關閉跑步機後為整數 46，顯示前後數值並關聯分鐘輸入；手填後清除提示，非跑步機類型間不重設。回跑步機仍為 45.5，日期／備註／熱量不變，離線明確儲存無分段的新紀錄，重開編輯仍 46，原資料完整。

每個案例使用新的瀏覽器 context，僅填入 e2e/fixtures.ts 的虛構 localStorage 資料。Date 固定為 2026-11-07，避免 CI 跨午夜造成日期漂移，計時器與繪圖仍正常執行。請求以 loopback origin 過濾，不進行 Google 登入、Picker、私人 Sheets、健康 API 或真實 YouTube 播放，也沒有 storageState、Token 或真實帳號 fixture。離線案例明確等待 Service Worker 就緒與控制頁面後才切斷網路。

PWA 升級案例另以 e2e/pwa-server.ts 建立獨立 127.0.0.1 隨機 port 的靜態測試 server，提供同一份 dist 的 `/fitness-pwa/` 路徑。僅在記憶體中的 sw.js HTTP 回應附加虛構版本辨識，先註冊版本 1，再提供版本 2；透過真實 MessageChannel 讀取 active controller 版本，沒有 mock 瀏覽器的 ServiceWorker API。推進測試的 Date 61 秒並發送 focus 事件，驗證節流後的實際註冊更新。沒有修改 dist、正式 worker 或公開部署，也不是兩套不同前端產物的快取遷移測試；額外 server 於測試後關閉。每個案例僅允許自己的 loopback origin。E15 的雙分頁案例在同一隔離 context 開兩頁，共用虛構 localStorage 與 worker；先在舊實作重現草稿因自動重載而消失的失敗，再確認修正後可繼續儲存與自行重載。這不是 Safari 與獨立安裝 PWA 是否共享 worker 的驗證。

這是 Chromium 的 viewport 回歸，並非 iPhone Safari、軟體鍵盤、VoiceOver、OAuth 或 iOS 捷徑驗收。Google 與 iPhone 手動驗收維持原清單。

## CI 與失敗診斷

Playwright 固定 1.65.0（npm 官方 metadata：Node ≥20，現有 Node 22 符合）；只增加三個開發套件，應用依賴不變（E11 當時網頁產物也維持一致；E12 已更新還原介面）。安裝後確認此版本有 Ubuntu 24.04／26.04 的 registry／依賴設定，沿用 ubuntu-latest。檢查日期為 2026-11-07。

單一 worker、每案 45 秒、CI 最多三個失敗即停止、job 上限 10 分鐘、不自動重試，避免失敗被隱藏或長時間等待。CI 禁止 test.only。HTML 報告、失敗截圖及 trace 在 playwright-report/ 與 test-results/，已加入 gitignore；CI 僅於瀏覽器案例失敗時上傳這兩個目錄，保留七天，不放進 dist 或公開網站。診斷僅對應虛構測試 context。upload-artifact 固定官方 v7 的完整 SHA `cf430e030ddbb5b0abf93d22962f4752f3646cd9`（Node 24），與既有 Actions runtime 相容。

檢查失敗時，從該 run 的 browser-failure artifact 下載報告，再用 `npx playwright show-report` 或 `npx playwright show-trace 路徑/trace.zip` 在自己的機器閱讀。trace 只在失敗時保留；成功的案例不保留 trace／截圖，也不上傳診斷 artifact。

E16 的本機雙分頁案例先在舊程式重現「A 頁儲存後 B 頁新紀錄消失」的失敗，再確認偵測變更、保留草稿、明確重新讀取與重新記錄的流程通過。這只驗證同來源 localStorage 的先後修改；比對後寫入不是原子操作，不保證真正同時寫入的所有交錯順序，也不驗證不同 iOS 容器是否共享儲存。

E16 的 PR #23 與 Pages 已通過 277 項 Vitest、8 項 Python 與 33 個 Playwright 案例；E17 的 PR #24 與 Pages 已通過 291 項 Vitest（39 檔）、8 項 Python 與 36 個 Playwright 案例；E18 的 PR #25 與 Pages 已通過 302 項 Vitest（40 檔）、8 項 Python 與 39 個 Playwright 案例。E19 的 PR #26 與 Pages 已通過 318 項 Vitest（41 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置、瀏覽器型別檢查與 42 個 Playwright 案例；部署與正式資產驗證見 PR #26。本機瀏覽器為系統 Chromium 156；E11 的 PR #18 與 Pages 均已實際安裝並通過原 18 個案例；E12 的 PR #19 與 Pages 均已通過 21 個案例；E13 的 PR #20 與 Pages 已通過 24 個案例；E14 的 PR #21 與 Pages 已通過 27 個案例；E15 的 PR #22 與 Pages 已通過 30 個案例。失敗 artifact 上傳條件已設定，成功執行不代表實際觸發過上傳。

官方依據：

- https://playwright.dev/docs/ci-intro
- https://playwright.dev/docs/test-webserver
- https://playwright.dev/docs/service-workers
- https://github.com/actions/upload-artifact/tree/cf430e030ddbb5b0abf93d22962f4752f3646cd9

E20 的 PR #27 與 Pages 完整檢查通過 334 項 Vitest（42 檔）、8 項 Python、正式建置及 45 個 Playwright 案例；增加的影片庫雙分頁案例使用相同 context 的兩頁及真實 localStorage 事件。只驗證先後修改，不宣稱真正同時寫入已原子化；CI／Pages 及正式資產驗證見 PR #27。

E21 的 PR #28 與 Pages 已通過 342 項 Vitest（42 檔）、8 項 Python、正式建置及 48 個 Playwright 案例（2.1 分鐘）。新案例包含實際下載備份及離線重開，僅驗證頁面 DOM 與虛構 localStorage，CI／Pages 及正式資產驗證見 PR #28。

E22 的 PR #29 與 Pages 已通過 347 項 Vitest（42 檔）、8 項 Python、正式建置及最終樣式的 51 個 Playwright 案例（2.2 分鐘）。新增的每週目標流程使用真實 worker waiting／更新／controller 回讀及離線重載；只代表 Chromium 中的虛構測試 context，不代替 iPhone 實機驗收。CI／Pages 及正式資產驗證見 PR #29。

E23 的 PR #30 與 Pages 已通過影片分類的原生鍵盤流程與完整 54 個 Playwright 案例（2.3 分鐘）。初跑在 320／390px 發現焦點按鈕被裁切而分類列不捲動，補 onFocus 的 nearest 捲入後原斷言及完整按鈕邊界均通過；只測虛構清單，CI／Pages 及正式資產驗證見 PR #30。

E24 的 PR #31 與 Pages 已通過 354 項 Vitest（42 檔）、8 項 Python、正式建置及 57 個 Playwright 案例（2.4 分鐘）；新增分段草稿流程在三種尺寸均完成離線儲存及重新編輯，原運動與健康資料保留。CI／Pages 及正式資產驗證見 PR #31。

E25 本機正式建置後通過 60 個案例（2.5 分鐘），含新增的三種尺寸總分鐘轉換、離線儲存與重開流程；359 項 Vitest、8 項 Python 亦通過。PR #32 的 CI／Pages 與正式資產驗證已完成；Chromium 結果不代表 Safari 或本人健康捷徑驗收。

E26 本機正式建置後完整通過 63 個案例（2.8 分鐘）；364 項 Vitest、8 項 Python 亦通過。新增課表定位及欄位檢查只代表 Chromium 的上述三種尺寸；PR #33 的 CI／Pages 與正式資產驗證已完成。

E27 本機正式建置後完整通過 66 個案例（約 2.9 分鐘）；366 項 Vitest、8 項 Python 亦通過。先在舊版重現 50 段明細 1,667px，再修正高度與收合流程。PR #34 的 CI／Pages 與正式資產驗證已完成；不是 Safari／VoiceOver 或本人健康捷徑驗收。

E28 本機正式建置後完整通過 69 個案例（3.1 分鐘），372 項 Vitest、8 項 Python 亦通過。先重現 B 收藏後 A 星號仍為 false，再修正並驗證雙分頁偏好及草稿；CI／Pages 與正式資產證據見本次 PR。
