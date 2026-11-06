# 階段 E：後續結構與離線改善

## E1：公開影片縮圖快取

已加入獨立的 Workbox runtime cache，只匹配 GET 圖片、HTTPS 的 i.ytimg.com、11 碼影片 ID 與 hqdefault.jpg 路徑。拒絕帶 Authorization 的請求與任何 query string，不匹配 Google OAuth、Sheets、Apps Script 或 YouTube 播放器。

採 StaleWhileRevalidate，最多 24 張、期限 14 天，遇 quota error 可清除這個縮圖快取。快取是最佳努力，iOS 仍可回收儲存。影片本身不離線下載；離線提示只承諾部分曾載入縮圖。接受狀態 0 只用於跨來源不透明圖片，不作 JSON API、登入或健康資料存取的替代。

已檢查產出的 Service Worker：路由函式完整內嵌，沒有依賴遺失的模組變數；包含指定策略、數量與時效限制。新增邊界測試，排除健康／登入／影片 URL、偽造子網域、HTTP、認證 header、query、POST 與非 image 請求。

本輪完整檢查通過：167 項 Vitest、6 項 Python、TypeScript／Vite／Service Worker 建置及 diff 檢查。未進行 iPhone 的真實離線縮圖驗收，也不宣稱 YouTube 影片可離線播放。

官方依據：

- https://developer.chrome.com/docs/workbox/caching-resources-during-runtime
- https://developer.chrome.com/docs/workbox/modules/workbox-expiration

實機：連線瀏覽影片清單、捲動載入縮圖後切離線，確認已快取的部分縮圖保留、沒有快取的影片仍顯示名稱；恢復網路時縮圖可更新。Google 登入與健康資料請求不可從此 cache 回傳。

E1 的 PR #7 已合併為 `3542d7adbcf90ce73f0407550e0b3b11405d8c31`；Pages run 42306449542 成功，首頁、新版資產與含縮圖規則的 Service Worker 已 HTTP 讀回。

## E2：頁面拆分

原本 1,217 行的 main.tsx 改為入口；App.tsx 保留工作區、Google Session callback、導覽、outbox、帳號切換取消、草稿及備份協調。總覽、課表指南、健康摘要、設定、健康圖表、運動紀錄與本週統計拆至 pages/。影片庫沿用既有獨立元件。

SettingsPage 持續掛載，切頁只改可見性，不能重建 CloudPanel 或重置登入。課表管理也持續掛載並按帳號／檔案設 key：同帳號切頁保留未儲存草稿、阻擋 PWA 更新；換帳號／檔案清除草稿。DOM 整合測試已驗證切頁不卸載 CloudPanel、草稿保留與切換帳號清除，Token 不進裝置快取。

## E3：自訂每週課表

- WorkoutPlans 實際資料投影到可選 Data.plans，包含停用列；缺少舊 plans 才使用預設三筆，明確空陣列或全部停用不復活預設值。JSON 備份與還原保留設定。
- 新增／編輯標題、ISO 星期、13 種運動、建議分鐘範圍與 HTTPS YouTube 教學，啟用／停用保留原列。直接影片需點擊才載入 youtube-nocookie 播放器，搜尋連結於 YouTube 開啟；未宣稱實機播放通過。
- 同一 weekday/type 僅允許一筆啟用，避免一筆紀錄完成重複目標；不同類型可同日安排。完成定義仍是同日同類型有正分鐘數，建議時長不作硬性門檻。
- 沿用 schema v1 九欄；檢查過四份 schema／腳本，建立腳本只在新檔提供三筆預設，升級與健康上傳不重填課表。沒有新增分頁、授權範圍或必要手動 Google 設定，也沒有修改使用者的實際課表。
- 雲端寫入沿用私人副本檢查、typed cells、outbox、帳號／檔案隔離、Web Locks 及寫後讀回。比對完整課表及 updatedAt，重試相同結果不重複新增；停用不用刪列。保留 coalesce 的先後位置，避免停用／新增同一時段的順序倒置。
- 離線課表若被另一個遠端 ID 佔用時段，保留分區的裝置內容與意圖、標記衝突並停止課表寫入；已確認其他運動寫入後，剩餘課表出現相同衝突亦有測試。只有成功重讀雲端後才可放棄修改。跨裝置仍沒有原子 CAS，不宣稱解決同時修改。

本輪檢查：186 項 Vitest（27 個檔案），6 項 Python，TypeScript／Vite／Service Worker 建置及 diff 檢查。測試只用虛構資料；DOM／mock 寫入測試不等於 iPhone OAuth 實際寫入驗收。PR／CI／正式部署完成後，記錄於 autonomous-progress.md。

E2／E3 的 PR #8 已合併為 `ddd1f6c9b00fe20bd061183cc47adb2ec2ed56c5`；PR CI 及 Pages run 42313475934 成功。正式首頁、index-5MQcn3vJ.js、index-B7X9vcmP.css、sw.js 已 HTTP 200，讀回 JS 有管理／儲存課表與重複時段規則，SW 包含新版 JS 及既有縮圖快取。

官方方案依據：

- https://react.dev/learn/sharing-state-between-components （共享狀態留在共同父層）
- https://developers.google.com/workspace/sheets/api/guides/batchupdate （明確欄位及批次更新；失敗不部分套用）

## 手動驗收

1. 更新 PWA，在本週課表新增週二瑜伽、修改分鐘、停用及再啟用；同日同類型重複啟用應被阻擋。全部停用後關閉重開，應維持 0 / 0，不出現三筆預設。
2. 本機匯出 JSON，修改後還原，課表應一致；舊無 plans 備份仍顯示預設課表。
3. Google 登入選原私人副本，修改一筆課表並等同步完成，在 Sheets 檢查同列及 updatedAt；離線修改後重連／重新授權，確認補同步不重複新增。這仍待真實 Safari OAuth 寫入驗收。
4. 課表表單未儲存時切到總覽再返回，保留內容；切另一帳號或副本則不帶入舊草稿。開啟表單時更新版本應被保護。
5. iPhone Safari／主畫面 PWA 檢查 320–390px、橫向、鍵盤與文字縮放；試播課表 YouTube、測試失敗外連備援。尚未實機執行，不能稱為通過。

## 下一個可交付部分

- 若有使用者實機回報，先修正再擴充；Apps Script 部署與 iOS 健康捷徑尚待本人授權與手機操作，不假造 Mac 或捷徑控制能力。
- 已完成 Recharts 官方升級與可及性初步調研，見 docs/maintenance.md；尚未改圖表套件。可接續以獨立 PR 改善趨勢的文字／表格替代與缺值語意，再評估主要版本更新。
- 實際 CI 出現的舊 Actions runtime 提示已另行更新工作流程，版本、SHA 與驗收要求亦見 maintenance.md；接續先確認其 PR／Pages 結果。
- 保留「逐筆」課表同步的限制：跨裝置同時修改，或複雜離線時段對調，可能需要處理衝突；未實作多筆課表的條件交易。

回來先檢查 PR／部署與使用者回報，保護其他工作階段的修改。
