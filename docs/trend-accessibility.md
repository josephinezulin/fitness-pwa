# E5：趨勢閱讀、缺值與鍵盤操作

## 實作

- 健康圖依選定的 7／30／90 天補齊曆日位置，保留 null 缺值、明確不跨缺日連線，並顯示實際資料點；僅一筆量測時也能顯示。沒有補寫任何零值或新的健康紀錄。
- 日期以既有的裝置／試算表曆日 key 為準，透過 UTC 日期運算列舉，不把資料轉換為裝置時區或每日固定 24 小時間隔，避免 DST 跳日。排除範圍外與未來資料；最新值標示實際日期，不把舊值移到今天。
- 健康摘要顯示該時段記錄天數及最新值；可展開原生 details/table 閱讀每天數值，缺值寫「未記錄」。caption、欄／列標題與完整 ISO 日期可供輔助技術閱讀；最新日期列在最上方。數值顯示最多三位小數，不修改原資料精度。
- 每週累計維持既有計算，額外提供運動及跑步機紀錄數供呈現判斷。無運動紀錄週顯示「未記錄運動」，有運動但無分段時距離／坡度顯示「無跑步機分段」；有分段的 0% 平坡仍是 0。圖表、Tooltip 與每週表格使用相同判斷，不能把沒有紀錄當作確認沒有活動。
- 開啟 Recharts 2 既有 accessibilityLayer，為 SVG 加名稱、說明及可見焦點；左右方向鍵切換時，Tooltip 以完整日期及數值／缺值文字更新 polite status。圖形及 Tooltip 關閉動畫。篩選器採原生按鈕群組及 aria-pressed，保留 Tab／Enter／Space 操作，不使用未完成鍵盤規則的 tablist。
- 每日與每週指標、數值清單使用至少 44px 觸控目標，表格維持兩欄、固定寬度與可換行。尚未以實際 iPhone 量測版面，不能把 CSS／DOM 檢查稱為實機通過。

沿用原先 React／Vite／GitHub Pages、OAuth、私人 Sheets、outbox 與安全 Apps Script 架構，沒有新增 schema、Google scope、網路 API、Token 儲存或健康回應快取，也沒有修改使用者試算表。Recharts 仍為原本 2.15.4。

## 官方方案

W3C WAI 建議複雜圖表提供簡短識別與可閱讀的詳細資料，表格以 caption 與 scope 關聯欄／列。這次提供可展開的數值表與摘要；不宣稱已完成 WCAG 或 VoiceOver 全面認證。

- https://www.w3.org/WAI/tutorials/images/complex/
- https://www.w3.org/WAI/tutorials/tables/one-header/

另查實際使用版本的官方程式：Area 的 connectNulls 預設 false，但只過濾掉缺日仍會把剩餘資料連起；必須先留下曆日 null。AccessibilityManager 已支援左右方向鍵，可在既有版本補上，不必先升級主要版本。

- https://github.com/recharts/recharts/blob/v2.15.4/src/cartesian/Area.tsx
- https://github.com/recharts/recharts/blob/v2.15.4/src/chart/AccessibilityManager.ts

## 測試與限制

本輪完整檢查：`npm ci`、`npm test`、`python3 -m unittest discover -s scripts -p 'test_*.py'`、`npm run build`、`git diff --check`。結果為 196 項 Vitest（29 個檔案）、6 項 Python、TypeScript／Vite／Service Worker 建置與 diff 檢查通過。

新增測試覆蓋跨年／閏日／DST、多裝置時區、區間邊界、未來資料、真實零與缺值、無運動／無分段／0% 平坡。DOM 測試沒有 mock 圖表元件：使用真實 Recharts SVG 路徑與資料點，驗證缺日分成兩段、單點可見、漸層 ID 隔離、方向鍵跨過缺值及最後一週 0% Tooltip、caption／scope／欄位選取與雲端健康唯讀按鈕。只為 jsdom 提供 ResizeObserver 及寬度量測，這不是真實瀏覽器排版或 VoiceOver。

環境更新瀏覽器測試能力後，另以 Chromium 156.0.8078.79／Playwright 1.65.0 對正式 dist 的 localhost preview 執行實際瀏覽器檢查。三個 viewport（320×852、390×844、844×390）共 45 項檢查通過：原生 details／table、真實零與缺值、實際方向鍵 Tooltip、日期 input 邊界與 ≥16px 字體、課表表單、健康及每週表格無頁面水平溢位、Service Worker 控制後離線重載與本機資料保留，沒有未捕捉 pageerror。也已查看 390px 健康及 320px 每週截圖，修正摘要日期／單位不必要斷行，再跑同一組 45 項檢查通過。

瀏覽器僅使用虛構 localStorage 資料並阻擋外部請求，沒有 Google 登入、私人 Sheets 或 YouTube 播放驗收。測試工具裝於工作區外的工具目錄，不更動專案依賴。當次腳本、JSON 報告及截圖在 `/tmp/fitness-pwa-browser/`，沒有提交 repo；它是本輪手動執行的 smoke check，不是已加入 CI 的瀏覽器測試，也不代表 Safari、iOS 文字縮放或 VoiceOver 通過。

PR CI 與部署須通過後才合併／視為上線；回來先確認最新 GitHub PR／main Actions，不把此本機檢查紀錄當作已部署證明。

## 數值清單最大高度與內部捲動

使用者回報展開每日數值後頁面太長，需要滑很遠才回到收合開關。每日／每週共用的數值表格新增獨立捲動容器，最大高度取 320px 與 50svh 較小值（50vh 作為相容備援）。原生 summary 保持在容器外，欄名在內部捲動時固定；邊界捲動不連帶推動整頁。全部數值列、caption 與 scope 保留，容器有名稱、鍵盤焦點與可見焦點框，沒有裁切或刪除資料。

完整 213 項 Vitest、8 項 Python、TypeScript／Vite／Service Worker 建置與 diff 檢查通過。Chromium 320×852、390×844、844×390 的 66 項檢查通過：90 天資料／8 週數值完整、最大高度、End 在容器內捲動、到最底仍能看到收合開關、欄名固定、底部滑鼠滾動不移動整頁、點擊與空白鍵收合／重開、無水平溢位及 pageerror；既有 45 項介面／表單／離線回歸也通過。已查看 320px 滑到底部的截圖，腳本及報告位於 `/tmp/fitness-pwa-browser/`，只有虛構資料，沒有加入瀏覽器 CI。

正式部署結果記錄於本次 PR。iPhone Safari 實機仍需開啟 90 天每日數值，在表格內上下滑到兩端、點 summary 收合，並在橫向及 VoiceOver 下確認內部捲動；Chrome 結果不當作 iOS 手勢驗收。

## 實機驗收

1. 更新 PWA，在健康趨勢切換四個指標及 7／30／90 天，檢查缺日斷線、單筆資料點、最新數值的實際日期。
2. 展開每日數值；確認沒有資料的日期顯示未記錄，已記錄零步仍為 0，關閉／重開清單及文字縮放正常。
3. 運動紀錄頁切換分鐘／距離／坡度，展開每週數值，檢查未記錄、無分段及平坡 0% 的區別；本週資料只計至今天。
4. iPhone 320–390px、橫向、較大文字下檢查指標與表格沒有頁面溢位；試用觸控 Tooltip。VoiceOver 檢查標題、篩選狀態、summary 開關、表格欄列與數值播讀。接外接鍵盤時用 Tab 進 SVG，再以左右鍵查看完整日期／缺值。
5. 切換帳號／副本及離線快取，確認清單僅顯示當前工作區資料，沒有新增登入或健康資料快取路由。Google 寫入／YouTube／健康捷徑的既有待驗收清單不由這輪測試取代。

## 接續

- 收到真實 iPhone／VoiceOver 回報時先修正，再獨立評估 Recharts 3 與相容 react-is；目前沒有主要版本遷移的實機證據。
- 可改善健康摘要清單的時間範圍與長清單閱讀，沿用已驗證的曆日／缺值邏輯；不增加健康寫入權限。

## 外觀回饋：恢復原本平滑曲線

使用者偏好 E5 之前的圖表外觀，健康 Area 恢復 `monotone` 平滑線，沿用原本綠色、線寬與透明漸層。相鄰量測不顯示常駐圓點，操作時仍有 Tooltip；前後都沒有相鄰資料的孤立量測保留小圓點，包含單筆紀錄。完整日曆及 `connectNulls={false}` 保留，缺日仍斷線，每日數值、真實零、摘要及鍵盤操作維持原語意。

完整檢查通過：208 項 Vitest（32 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置及 `git diff --check`。使用實際 Recharts SVG 驗證平滑路徑、三段缺日路徑及兩個孤立端點，既有單筆、真實零與缺值 Tooltip 測試持續通過。

另以正式 dist 在 320×852、390×844、844×390 Chromium 執行 18 項曲線檢查（真實平滑 SVG、無常駐圓點、漸層、無水平溢位、鍵盤 Tooltip、無 pageerror），並檢視 390px 截圖；既有 45 項介面／表單／離線檢查也通過。僅使用虛構 localStorage，工具與報告位於 `/tmp/fitness-pwa-browser/`，沒有修改私人試算表或新增權限。這些是本機 Chrome 檢查，iPhone Safari／VoiceOver 仍待實機驗收。合併及正式站部署結果記錄於本次 PR。
